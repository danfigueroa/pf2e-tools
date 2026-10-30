-- Troféus do Covil: a coleção de cada CONTA (global, somando as mesas), no estilo PSN.
--
--   · `trophy_feats`: o registro dos feitos (nota criada, background escrito, ficha publicada,
--     destaque da sessão…), gravado pelo servidor. É a fonte de quase todo troféu, e nasce
--     vazio de propósito: decisão do usuário, ninguém ganha nada pelo que já tinha feito.
--   · `mesa_sessions`: o histórico das sessões (a mesa só guardava a de agora). É o que dá
--     sentido a "3 sessões seguidas" e às rolagens que contam (só as feitas DENTRO de uma).
--   · `account_trophies`: o que cada conta já desbloqueou, com a mesa em que foi.
--
-- Quem decide o que desbloqueia é o servidor (`api/_lib/trophies.js`): o catálogo mora lá.
-- Escrita só pelo servidor (chave secreta), como o resto.

create table public.trophy_feats (
    id bigserial primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    mesa text not null references public.mesas (id) on delete cascade,
    kind text not null check (kind ~ '^[a-z0-9-]{1,40}$'),
    -- Milissegundos, do servidor.
    at bigint not null,
    data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 2048)
);

create index trophy_feats_user_kind_idx on public.trophy_feats (user_id, kind, at desc);

create table public.mesa_sessions (
    id bigserial primary key,
    mesa text not null references public.mesas (id) on delete cascade,
    started_at bigint not null,
    ended_at bigint,
    started_by uuid references auth.users (id) on delete set null
);

create index mesa_sessions_mesa_idx on public.mesa_sessions (mesa, started_at);

create table public.account_trophies (
    user_id uuid not null references auth.users (id) on delete cascade,
    trophy_id text not null check (trophy_id ~ '^[a-z0-9-]{1,40}$'),
    unlocked_at bigint not null,
    mesa text references public.mesas (id) on delete set null,
    primary key (user_id, trophy_id)
);

alter table public.trophy_feats enable row level security;
alter table public.mesa_sessions enable row level security;
alter table public.account_trophies enable row level security;
grant select, insert, update, delete on public.trophy_feats, public.mesa_sessions, public.account_trophies to service_role;
grant usage on sequence public.trophy_feats_id_seq, public.mesa_sessions_id_seq to service_role;

-- O sino e o aviso ao vivo: "Troféu desbloqueado".
alter table public.mesa_events drop constraint mesa_events_kind_check;
alter table public.mesa_events add constraint mesa_events_kind_check check (kind in
    ('sheet-published', 'sheet-assigned', 'map-active', 'map-revealed', 'combat-started', 'rule-shared',
     'handout-shared', 'trophy-unlocked'));

-- O combate que começou é do GM que gravou o encontro (rodada 0 → 1, a mesma conta do
-- `encounter_events`). Trigger, e não o handler, para não ler o encontro antigo a cada gravação.
create function public.encounter_trophy_feat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    before_round integer := 0;
    after_round integer;
begin
    if new.updated_by is null then return null; end if;
    after_round := coalesce((new.state->>'round')::integer, 0);
    if tg_op = 'UPDATE' then
        before_round := coalesce((old.state->>'round')::integer, 0);
    end if;
    if before_round = 0 and after_round >= 1 then
        insert into public.trophy_feats (user_id, mesa, kind, at, data)
        values (new.updated_by, new.mesa, 'gm-combat', new.updated_at, '{}'::jsonb);
    end if;
    return null;
exception when invalid_text_representation then
    return null;
end
$$;

revoke all on function public.encounter_trophy_feat() from public, anon, authenticated;

create trigger encounters_trophy_feat after insert or update on public.encounters
    for each row execute function public.encounter_trophy_feat();

-- Os números de cada personagem numa janela de sessão (só as rolagens `in_session`, com
-- personagem): as mesmas contas do `diary_summary` (dano do acerto, raios somados, cada
-- raio um teste), mais o dono da ficha. É o que elege os destaques ao encerrar a sessão.
create function public.session_rollup(p_mesa text, p_from bigint, p_to bigint)
returns jsonb
language sql
stable
set search_path = ''
as $$
    with r as (
        select seq, roll, slug,
            case when jsonb_typeof(roll->'rays') = 'array'
                then coalesce((select sum((x->'damage'->>'total')::int) from jsonb_array_elements(roll->'rays') x), 0)
                else coalesce((roll->'damage'->>'total')::int, 0)
            end as dmg
        from public.rolls
        where mesa = p_mesa and in_session and slug is not null and at between p_from and p_to
    ),
    c as (
        select r.slug, r.seq, (ch->>'d20')::int as d20, (ch->>'mythic') = 'true' as mythic
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
        select slug, count(*) as rolls, sum(greatest(dmg, 0)) as damage, max(greatest(dmg, 0)) as top_hit
        from r group by slug
    ),
    cg as (
        select slug, count(*) as checks, sum(d20) as d20_sum,
            count(*) filter (where d20 = 20) as nat20, count(*) filter (where d20 = 1) as nat1,
            count(distinct seq) filter (where mythic) as mythic
        from c group by slug
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'slug', g.slug, 'owner', s.owner_id, 'rolls', g.rolls, 'damage', g.damage, 'topHit', g.top_hit,
        'checks', coalesce(cg.checks, 0), 'd20Sum', coalesce(cg.d20_sum, 0),
        'nat20', coalesce(cg.nat20, 0), 'nat1', coalesce(cg.nat1, 0), 'mythic', coalesce(cg.mythic, 0)
    )), '[]'::jsonb)
    from g
    left join cg on cg.slug = g.slug
    left join public.sheets s on s.mesa = p_mesa and s.slug = g.slug
$$;

revoke all on function public.session_rollup(text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.session_rollup(text, bigint, bigint) to service_role;

-- Tudo o que o catálogo precisa saber de uma conta, numa consulta só, somando as mesas.
-- Rolagem só conta dentro de uma sessão registrada em `mesa_sessions`, pela ficha que a
-- pessoa possui naquela mesa.
create function public.trophy_facts(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
    with now_ms as (select (extract(epoch from now()) * 1000)::bigint as v),
    feats as (
        select kind, count(*) as n from public.trophy_feats where user_id = p_user group by kind
    ),
    owned as (
        select mesa, slug from public.sheets where owner_id = p_user
    ),
    sess as (
        select s.id, s.mesa, s.started_at, coalesce(s.ended_at, (select v from now_ms)) as until, s.ended_at
        from public.mesa_sessions s
        where s.mesa in (select mesa from public.mesa_members where user_id = p_user)
    ),
    my_rolls as (
        select r.seq, r.roll, s.id as session_id
        from public.rolls r
        join sess s on s.mesa = r.mesa and r.at between s.started_at and s.until
        join owned o on o.mesa = r.mesa and o.slug = r.slug
        where r.in_session
    ),
    checks as (
        select m.session_id, m.seq, (ch->>'d20')::int as d20, (ch->>'mythic') = 'true' as mythic
        from my_rolls m
        cross join lateral jsonb_array_elements(
            case
                when jsonb_typeof(m.roll->'rays') = 'array' then jsonb_path_query_array(m.roll, '$.rays[*].check')
                when jsonb_typeof(m.roll->'check') = 'object' then jsonb_build_array(m.roll->'check')
                else '[]'::jsonb
            end
        ) ch
    ),
    per_session as (
        select session_id, count(*) filter (where d20 = 20) as nat20 from checks group by session_id
    ),
    noted as (
        select distinct s.id
        from sess s
        join public.trophy_feats f on f.user_id = p_user and f.mesa = s.mesa
            and f.kind in ('note-created', 'note-edited', 'background') and f.at between s.started_at and s.until
    ),
    attended as (
        select distinct session_id as id from my_rolls
    )
    select jsonb_build_object(
        'feats', coalesce((select jsonb_object_agg(kind, n) from feats), '{}'::jsonb),
        'noteTags', coalesce((
            select jsonb_agg(distinct data->>'tag') from public.trophy_feats
            where user_id = p_user and kind = 'note-created' and data ? 'tag'
        ), '[]'::jsonb),
        'backgroundMax', coalesce((
            select max((data->>'length')::int) from public.trophy_feats where user_id = p_user and kind = 'background'
        ), 0),
        'backgroundAfterLevelUp', coalesce((
            select count(*) from public.trophy_feats
            where user_id = p_user and kind = 'background' and (data->>'afterLevelUp') = 'true'
        ), 0),
        'levelsGained', coalesce((
            select sum(coalesce((data->>'gained')::int, 1)) from public.trophy_feats where user_id = p_user and kind = 'level-up'
        ), 0),
        'sessions', coalesce((
            select jsonb_agg(jsonb_build_object(
                'mesa', s.mesa, 'id', s.id, 'startedAt', s.started_at, 'endedAt', s.ended_at,
                'attended', exists (select 1 from attended a where a.id = s.id),
                'noted', exists (select 1 from noted n where n.id = s.id)
            ) order by s.mesa, s.started_at)
            from sess s
        ), '[]'::jsonb),
        'checks', (select count(*) from checks),
        'nat20', (select count(*) from checks where d20 = 20),
        'nat1', (select count(*) from checks where d20 = 1),
        'mythic', (select count(distinct seq) from checks where mythic),
        'bestNat20Session', coalesce((select max(nat20) from per_session), 0)
    )
$$;

revoke all on function public.trophy_facts(uuid) from public, anon, authenticated;
grant execute on function public.trophy_facts(uuid) to service_role;

-- O ranking da mesa: cada membro com conta, o nome e o que já desbloqueou (os pontos são
-- somados no servidor, que conhece o catálogo). O usuário sai do e-mail fictício `@covil.local`.
create function public.trophy_ranking(p_mesa text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'userId', mm.user_id,
        'role', mm.role,
        'displayName', mm.display_name,
        'username', split_part(u.email, '@', 1),
        'trophies', coalesce((
            select jsonb_agg(jsonb_build_object('id', t.trophy_id, 'at', t.unlocked_at) order by t.unlocked_at)
            from public.account_trophies t where t.user_id = mm.user_id
        ), '[]'::jsonb)
    ) order by mm.joined_at), '[]'::jsonb)
    from public.mesa_members mm
    join auth.users u on u.id = mm.user_id
    where mm.mesa = p_mesa and not coalesce(u.is_anonymous, false)
$$;

revoke all on function public.trophy_ranking(text) from public, anon, authenticated;
grant execute on function public.trophy_ranking(text) to service_role;
