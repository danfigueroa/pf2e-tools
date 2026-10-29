-- Só conta o que foi rolado com a SESSÃO INICIADA (decisão do usuário): fora da sessão os jogadores
-- testam a ficha e as ferramentas, e isso sujava o Histórico de Rolagens (troféus, médias, d20).
--
-- Cada rolagem ganha `in_session`, marcada pelo BANCO na inserção (trigger), pela sessão da mesa
-- naquele instante (`mesas.session_started_at`, que o GM liga e desliga em /mesa) — nenhum caminho de
-- escrita precisa lembrar. As rolagens de antes desta migration ficam `true`: não havia sessão para
-- marcar, e o histórico que a mesa já tem continua valendo.
--
-- A rolagem fora da sessão continua no feed (o cartão na tela de todos e as últimas 30); só some do
-- Histórico: os dias, as rolagens do dia e o resumo dos troféus filtram `in_session`. Como as três
-- funções filtram na fonte, o `summarize` do cliente e o fallback em memória não mudam.

alter table public.rolls add column in_session boolean not null default true;

create function public.mark_roll_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.in_session := exists (
        select 1 from public.mesas m where m.id = new.mesa and m.session_started_at is not null
    );
    return new;
end
$$;

revoke all on function public.mark_roll_session() from public, anon, authenticated;

create trigger rolls_in_session before insert on public.rolls
    for each row execute function public.mark_roll_session();

-- Os dias com rolagem (da sessão), o mais recente primeiro.
create or replace function public.diary_days(p_mesa text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day, 'count', d.n, 'first', d.first_at, 'last', d.last_at, 'people', d.people
    ) order by d.day desc), '[]'::jsonb)
    from (
        select public.diary_day(at) as day, count(*) as n, min(at) as first_at, max(at) as last_at,
            count(distinct coalesce(slug, roll->>'by')) as people
        from public.rolls
        where mesa = p_mesa and in_session
        group by 1
    ) d
$$;

-- As rolagens (da sessão) de um dia de jogo, na ordem em que aconteceram (até 3000).
create or replace function public.diary_rolls(p_mesa text, p_day date)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select coalesce(jsonb_agg(r.roll order by r.seq), '[]'::jsonb)
    from (
        select roll, seq from public.rolls
        where mesa = p_mesa and in_session and public.diary_day(at) = p_day
        order by seq
        limit 3000
    ) r
$$;

-- O resumo por (dia de jogo, pessoa): igual ao da migration `historico_da_mesa`, só com as da sessão.
create or replace function public.diary_summary(p_mesa text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    with r as (
        select seq, at, roll, public.diary_day(at) as day,
            coalesce(nullif(roll->>'slug', ''),
                'nome:' || lower(btrim(coalesce(nullif(roll->>'by', ''), 'Alguém')))) as key,
            case when jsonb_typeof(roll->'rays') = 'array'
                then coalesce((select sum((x->'damage'->>'total')::int) from jsonb_array_elements(roll->'rays') x), 0)
                else coalesce((roll->'damage'->>'total')::int, 0)
            end as dmg
        from public.rolls
        where mesa = p_mesa and in_session
    ),
    c as (
        select r.day, r.key, r.seq, r.at, r.roll->>'title' as title,
            (ch->>'d20')::int as d20, (ch->>'total')::int as total, (ch->>'mythic') = 'true' as mythic
        from r
        cross join lateral jsonb_array_elements(
            case
                when jsonb_typeof(r.roll->'rays') = 'array' then jsonb_path_query_array(r.roll, '$.rays[*].check')
                when jsonb_typeof(r.roll->'check') = 'object' then jsonb_build_array(r.roll->'check')
                else '[]'::jsonb
            end
        ) ch
    ),
    g as (
        select day, key,
            count(*) as rolls,
            sum(greatest(dmg, 0)) as damage,
            (array_agg(coalesce(nullif(roll->>'by', ''), 'Alguém') order by seq))[1] as name,
            (array_agg(roll->>'color' order by seq))[1] as color
        from r
        group by day, key
    ),
    cg as (
        select day, key,
            count(*) as checks,
            sum(d20) as d20_sum,
            count(*) filter (where d20 = 20) as nat20,
            count(*) filter (where d20 = 1) as nat1,
            count(distinct seq) filter (where mythic) as mythic
        from c
        group by day, key
    ),
    h as (
        select day, key, jsonb_object_agg(d20::text, n) as hist
        from (select day, key, d20, count(*) as n from c group by day, key, d20) x
        group by day, key
    ),
    best as (
        select distinct on (day, key) day, key, jsonb_build_object('total', total, 'title', title, 'at', at) as v
        from c
        order by day, key, total desc, seq
    ),
    worst as (
        select distinct on (day, key) day, key, jsonb_build_object('total', total, 'title', title, 'at', at) as v
        from c
        order by day, key, total, seq
    ),
    hit as (
        select distinct on (day, key) day, key, jsonb_build_object('total', dmg, 'title', roll->>'title', 'at', at) as v
        from r
        where dmg > 0
        order by day, key, dmg desc, seq
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'day', g.day, 'key', g.key, 'name', g.name, 'color', g.color,
        'rolls', g.rolls, 'damage', g.damage,
        'checks', coalesce(cg.checks, 0), 'd20Sum', coalesce(cg.d20_sum, 0),
        'nat20', coalesce(cg.nat20, 0), 'nat1', coalesce(cg.nat1, 0), 'mythic', coalesce(cg.mythic, 0),
        'hist', coalesce(h.hist, '{}'::jsonb),
        'best', best.v, 'worst', worst.v, 'biggestHit', hit.v
    ) order by g.day, g.key), '[]'::jsonb)
    from g
    left join cg using (day, key)
    left join h using (day, key)
    left join best using (day, key)
    left join worst using (day, key)
    left join hit using (day, key)
$$;

