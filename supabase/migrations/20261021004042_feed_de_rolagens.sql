-- Fase 4: feed de rolagens e regras compartilhadas, em tempo real.
--
-- No Redis eram duas LISTAS com teto (30 rolagens que sumiam em 1 dia, 5
-- compartilhamentos de 1 hora) e um contador que todo aparelho lia a cada 1,5 s.
-- Aqui cada inserção é transmitida pelo Realtime no canal privado
-- `mesa:<mesa>:rolls` (eventos `roll` e `share`), e as rolagens ficam: é o
-- histórico do diário da sessão.
--
-- As duas tabelas tiram o `seq` da MESMA sequência: o maior `seq` da mesa é o
-- contador do poll de reserva (sem Realtime), e ele sobe com qualquer das duas.
-- Com sequências separadas, um compartilhamento abaixo da última rolagem não
-- mudaria o máximo e passaria despercebido.

create sequence public.feed_seq;

create table public.rolls (
    id text primary key check (id ~ '^[a-z0-9-]{1,64}$'),
    mesa text not null references public.mesas (id) on delete cascade,
    seq bigint not null default nextval('public.feed_seq'),
    -- Milissegundos, do servidor (`sanitizeRoll`), como o `at` da própria rolagem.
    at bigint not null,
    slug text,
    author uuid references auth.users (id) on delete set null,
    -- A rolagem inteira, já validada (`sanitizeRoll` / `sanitizeTableRoll`).
    roll jsonb not null check (octet_length(roll::text) <= 12288)
);

create index rolls_mesa_seq_idx on public.rolls (mesa, seq desc);
create index rolls_mesa_slug_idx on public.rolls (mesa, slug, at desc);

create table public.shares (
    id text primary key check (id ~ '^[a-z0-9-]{1,64}$'),
    mesa text not null references public.mesas (id) on delete cascade,
    seq bigint not null default nextval('public.feed_seq'),
    at bigint not null,
    author uuid references auth.users (id) on delete set null,
    share jsonb not null check (octet_length(share::text) <= 4096)
);

create index shares_mesa_seq_idx on public.shares (mesa, seq desc);

alter table public.rolls enable row level security;
alter table public.shares enable row level security;
grant select, insert, update, delete on public.rolls, public.shares to service_role;
grant usage on sequence public.feed_seq to service_role;

create function public.broadcast_feed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_table_name = 'rolls' then
        perform realtime.send(jsonb_build_object('roll', new.roll, 'seq', new.seq), 'roll', 'mesa:' || new.mesa || ':rolls', true);
    else
        perform realtime.send(jsonb_build_object('share', new.share, 'seq', new.seq), 'share', 'mesa:' || new.mesa || ':rolls', true);
    end if;
    return null;
end
$$;

revoke all on function public.broadcast_feed() from public, anon, authenticated;

create trigger rolls_broadcast after insert on public.rolls
    for each row execute function public.broadcast_feed();
create trigger shares_broadcast after insert on public.shares
    for each row execute function public.broadcast_feed();

-- O feed numa ida só, no formato de antes: `{ rev }` quando nada mudou desde
-- `p_known` (o caso comum do poll), senão também as últimas 30 rolagens e os
-- compartilhamentos da última hora (até 5), o mais novo primeiro.
create function public.read_feed(p_mesa text, p_known bigint)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
    v_rev bigint := greatest(
        coalesce((select max(seq) from public.rolls where mesa = p_mesa), 0),
        coalesce((select max(seq) from public.shares where mesa = p_mesa), 0)
    );
begin
    if p_known is not null and p_known = v_rev then
        return jsonb_build_object('rev', v_rev);
    end if;
    return jsonb_build_object(
        'rev', v_rev,
        'rolls', coalesce((
            select jsonb_agg(r.roll order by r.seq desc)
            from (select roll, seq from public.rolls where mesa = p_mesa order by seq desc limit 30) r
        ), '[]'::jsonb),
        'shares', coalesce((
            select jsonb_agg(s.share order by s.seq desc)
            from (
                select share, seq from public.shares
                where mesa = p_mesa and at > (extract(epoch from now() - interval '1 hour') * 1000)
                order by seq desc limit 5
            ) s
        ), '[]'::jsonb)
    );
end
$$;

revoke all on function public.read_feed(text, bigint) from public, anon, authenticated;
grant execute on function public.read_feed(text, bigint) to service_role;

-- Compartilhamento é coisa do momento (o cartão fica até o ×): sem histórico.
select cron.schedule(
    'limpar-compartilhamentos',
    '7 * * * *',
    $$ delete from public.shares where at < (extract(epoch from now() - interval '1 day') * 1000) $$
);
