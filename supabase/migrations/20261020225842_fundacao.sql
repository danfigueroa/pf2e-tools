-- Fundação: as mesas e quem participa de cada uma.
--
-- O projeto foi criado com "Automatically expose new tables" DESLIGADO e com o
-- RLS automático (event trigger `ensure_rls`): tabela nova não dá privilégio a
-- papel nenhum, nem ao `service_role` das funções. Toda migration concede o que
-- usa, explicitamente — nada fica exposto por esquecimento.

-- A lista de mesas. Por enquanto é cópia de `MESA_IDS` (api/_lib/mesas.js) e de
-- `MESAS` (src/services/mesa.ts): mudou uma, muda as três.
create table public.mesas (
    id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
    name text not null,
    created_at timestamptz not null default now()
);

insert into public.mesas (id, name) values
    ('casa-do-gordo', 'Casa do Gordo Online'),
    ('arton-1515', 'Arton 1515');

-- Cada aparelho entra com uma sessão anônima (signInAnonymously) e se registra
-- na mesa que abriu. É a base dos canais privados do Realtime e da presença.
-- `last_seen` sobe a cada abertura do app.
create table public.mesa_members (
    mesa text not null references public.mesas (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    joined_at timestamptz not null default now(),
    last_seen timestamptz not null default now(),
    primary key (mesa, user_id)
);

create index mesa_members_user_id_idx on public.mesa_members (user_id);

alter table public.mesas enable row level security;
alter table public.mesa_members enable row level security;

grant select, insert, update, delete on public.mesas, public.mesa_members to service_role;
grant select on public.mesas to anon, authenticated;
grant select, insert, update on public.mesa_members to authenticated;

create policy "mesas são públicas" on public.mesas
    for select to anon, authenticated
    using (true);

-- O aparelho só enxerga e grava a PRÓPRIA participação. É a única escrita que
-- não passa pelo servidor: diz respeito só à sessão de quem a faz.
create policy "a própria participação" on public.mesa_members
    for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- Sessão anônima abandonada (navegador limpo, aparelho trocado) vira um usuário
-- órfão em auth.users. Sai depois de 180 dias sem abrir o app em mesa nenhuma.
create extension if not exists pg_cron;

select cron.schedule(
    'limpar-anonimos',
    '23 7 * * *',
    $$
    delete from auth.users u
    where u.is_anonymous
      and greatest(
            u.created_at,
            coalesce(u.last_sign_in_at, u.created_at),
            coalesce((select max(m.last_seen) from public.mesa_members m where m.user_id = u.id), u.created_at)
          ) < now() - interval '180 days'
    $$
);
