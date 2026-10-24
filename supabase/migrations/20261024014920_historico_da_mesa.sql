-- Histórico da mesa: o resumo de cada pessoa em cada dia de jogo, para os
-- troféus e o ranking de TODAS as sessões (quem tirou mais 20 desde sempre, a
-- noite mais azarada, o maior dano já rolado).
--
-- Mandar todas as rolagens ao cliente não escala (1–2 KB cada, milhares por
-- ano). O banco resume por (dia de jogo, pessoa) e o cliente soma os dias.
--
-- A conta é a MESMA de `summarize` em `src/modules/session-diary/stats.ts` (e do
-- fallback em memória de `api/_lib/roll-store.js`): cada raio de um Blazing
-- Bolt é um teste, o ✦ é um por rolagem, o dano é o do acerto (o `damage.total`
-- ou a soma dos raios), e rolagem livre não é teste. Mudou uma, muda as outras —
-- `scripts/check-diary.mjs` confere esta contra a do cliente em todo dia do banco.
--
-- Pessoa = o slug da ficha, senão `nome:` + o nome livre do rolador do mapa sem
-- caixa nem espaços nas pontas. Nome e cor são os da PRIMEIRA rolagem do dia.
-- Em empate, o maior/menor teste e o maior dano são os que vieram primeiro.

create function public.diary_summary(p_mesa text)
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
        where mesa = p_mesa
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

revoke all on function public.diary_summary(text) from public, anon, authenticated;
grant execute on function public.diary_summary(text) to service_role;
