-- Diário da sessão: as rolagens de um dia de jogo, para o resumo do fim da sessão
-- (quem tirou mais 20, quem rolou mais dano) e para conferir o que aconteceu.
--
-- `rolls` guarda toda rolagem para sempre (migration `feed_de_rolagens`); aqui só
-- se agrupa. O DIA DE JOGO vai das 6h às 6h no horário de Brasília: a mesa joga à
-- noite, e uma sessão que passa da meia-noite continua sendo uma só.

create function public.diary_day(p_at bigint)
returns date
language sql
immutable
set search_path = ''
as $$
    select ((to_timestamp(p_at / 1000.0) at time zone 'America/Sao_Paulo') - interval '6 hours')::date
$$;

create index rolls_mesa_day_idx on public.rolls (mesa, public.diary_day(at));

-- Os dias com rolagem, o mais recente primeiro, com quantas e de quantos.
create function public.diary_days(p_mesa text)
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
        where mesa = p_mesa
        group by 1
    ) d
$$;

-- As rolagens de um dia de jogo, na ordem em que aconteceram (até 3000).
create function public.diary_rolls(p_mesa text, p_day date)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select coalesce(jsonb_agg(r.roll order by r.seq), '[]'::jsonb)
    from (
        select roll, seq from public.rolls
        where mesa = p_mesa and public.diary_day(at) = p_day
        order by seq
        limit 3000
    ) r
$$;

revoke all on function public.diary_day(bigint) from public, anon, authenticated;
revoke all on function public.diary_days(text) from public, anon, authenticated;
revoke all on function public.diary_rolls(text, date) from public, anon, authenticated;
grant execute on function public.diary_day(bigint) to service_role;
grant execute on function public.diary_days(text) to service_role;
grant execute on function public.diary_rolls(text, date) to service_role;
