-- Mais Troféus do Covil: os fatos novos que o catálogo ampliado lê (sequências de 20 e de 1
-- seguidos, redenção 1 → 20, maior teste e maior dano numa rolagem, dano somado numa sessão,
-- críticos com dano, raios, rolagens de iniciativa, rolagens de madrugada, médias da sessão,
-- maratonas, primeira rolagem da sessão, nível publicado, os três destaques na mesma sessão,
-- nota longa e as sessões longas conduzidas pelo GM).
--
-- Só substitui `trophy_facts` (migration `trofeus`); as chaves de antes continuam iguais.
-- "Seguidos" é dentro da MESMA sessão, na ordem em que foram rolados (cada raio do Blazing
-- Bolt é um teste, como no histórico).

create or replace function public.trophy_facts(p_user uuid)
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
        select s.id, s.mesa, s.started_at, coalesce(s.ended_at, (select v from now_ms)) as until, s.ended_at, s.started_by
        from public.mesa_sessions s
        where s.mesa in (select mesa from public.mesa_members where user_id = p_user)
    ),
    my_rolls as (
        select r.seq, r.at, r.roll, s.id as session_id,
            case when jsonb_typeof(r.roll->'rays') = 'array'
                then coalesce((select sum((x->'damage'->>'total')::int) from jsonb_array_elements(r.roll->'rays') x), 0)
                else coalesce((r.roll->'damage'->>'total')::int, 0)
            end as dmg
        from public.rolls r
        join sess s on s.mesa = r.mesa and r.at between s.started_at and s.until
        join owned o on o.mesa = r.mesa and o.slug = r.slug
        where r.in_session
    ),
    checks as (
        select m.session_id, m.seq, m.at, ch.ord, m.dmg,
            (ch.value->>'d20')::int as d20, (ch.value->>'total')::int as total, (ch.value->>'mythic') = 'true' as mythic
        from my_rolls m
        cross join lateral jsonb_array_elements(
            case
                when jsonb_typeof(m.roll->'rays') = 'array' then jsonb_path_query_array(m.roll, '$.rays[*].check')
                when jsonb_typeof(m.roll->'check') = 'object' then jsonb_build_array(m.roll->'check')
                else '[]'::jsonb
            end
        ) with ordinality as ch(value, ord)
    ),
    ordered as (
        select session_id, d20,
            row_number() over (partition by session_id order by at, seq, ord) as rn,
            lag(d20) over (partition by session_id order by at, seq, ord) as prev
        from checks
    ),
    -- Ilhas de faces iguais seguidas: rn menos a posição dentro da mesma face é constante na ilha.
    islands as (
        select session_id, d20, count(*) as len
        from (
            select session_id, d20, rn - row_number() over (partition by session_id, d20 order by rn) as grp
            from ordered where d20 in (1, 20)
        ) x
        group by session_id, d20, grp
    ),
    per_session as (
        select session_id, count(*) as checks, count(*) filter (where d20 = 20) as nat20, avg(d20) as avg
        from checks group by session_id
    ),
    session_damage as (
        select session_id, sum(greatest(dmg, 0)) as dmg from my_rolls group by session_id
    ),
    noted as (
        select distinct s.id
        from sess s
        join public.trophy_feats f on f.user_id = p_user and f.mesa = s.mesa
            and f.kind in ('note-created', 'note-edited', 'background') and f.at between s.started_at and s.until
    ),
    attended as (
        select distinct session_id as id from my_rolls
    ),
    -- A primeira rolagem com personagem de cada sessão, de quem quer que seja.
    first_rolls as (
        select s.id, (
            select r.mesa || '/' || r.slug from public.rolls r
            where r.mesa = s.mesa and r.in_session and r.slug is not null and r.at between s.started_at and s.until
            order by r.at, r.seq limit 1
        ) as who
        from sess s
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
        'maxLevel', coalesce((
            select max((data->>'level')::int) from public.trophy_feats where user_id = p_user and kind = 'sheet-published'
        ), 0),
        'noteMaxLength', coalesce((
            select max((data->>'length')::int) from public.trophy_feats where user_id = p_user and kind = 'note-length'
        ), 0),
        'sameSessionHighlights', coalesce((
            select max(n) from (
                select count(distinct kind) as n from public.trophy_feats
                where user_id = p_user and kind in ('session-top-damage', 'session-top-hit', 'session-best-avg')
                group by data->>'session'
            ) x
        ), 0),
        'sessions', coalesce((
            select jsonb_agg(jsonb_build_object(
                'mesa', s.mesa, 'id', s.id, 'startedAt', s.started_at, 'endedAt', s.ended_at,
                'attended', exists (select 1 from attended a where a.id = s.id),
                'noted', exists (select 1 from noted n where n.id = s.id)
            ) order by s.mesa, s.started_at)
            from sess s
        ), '[]'::jsonb),
        'rolls', (select count(*) from my_rolls),
        'checks', (select count(*) from checks),
        'nat20', (select count(*) from checks where d20 = 20),
        'nat1', (select count(*) from checks where d20 = 1),
        'mythic', (select count(distinct seq) from checks where mythic),
        'bestNat20Session', coalesce((select max(nat20) from per_session), 0),
        'run20', coalesce((select max(len) from islands where d20 = 20), 0),
        'run1', coalesce((select max(len) from islands where d20 = 1), 0),
        'redemption', (select count(*) from ordered where prev = 1 and d20 = 20),
        'bestCheck', coalesce((select max(total) from checks), 0),
        'bestHit', coalesce((select max(dmg) from my_rolls), 0),
        'bestSessionDamage', coalesce((select max(dmg) from session_damage), 0),
        'critStrikes', (select count(*) from checks where d20 = 20 and dmg > 0),
        'maxRays', coalesce((
            select max(jsonb_array_length(roll->'rays')) from my_rolls where jsonb_typeof(roll->'rays') = 'array'
        ), 0),
        'initiativeRolls', (select count(*) from my_rolls where (roll->>'initiative') = 'true'),
        'lateRolls', (
            select count(*) from my_rolls
            where extract(hour from to_timestamp(at / 1000.0) at time zone 'America/Sao_Paulo') < 5
        ),
        'bestSessionAvg', coalesce((select max(avg) from per_session where checks >= 10), 0),
        'worstSessionAvg', coalesce((select min(avg) from per_session where checks >= 10), 0),
        'marathons', (
            select count(*) from sess s
            where s.ended_at is not null and s.ended_at - s.started_at >= 4 * 3600 * 1000
              and exists (select 1 from attended a where a.id = s.id)
        ),
        'firstRolls', (
            select count(*) from first_rolls f where f.who in (select mesa || '/' || slug from owned)
        ),
        'gmLongSessions', (
            select count(*) from sess s
            where s.started_by = p_user and s.ended_at is not null and s.ended_at - s.started_at >= 4 * 3600 * 1000
        )
    )
$$;

revoke all on function public.trophy_facts(uuid) from public, anon, authenticated;
grant execute on function public.trophy_facts(uuid) to service_role;
