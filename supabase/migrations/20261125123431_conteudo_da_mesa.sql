-- Conteúdo caseiro da mesa (Criador, 9.1): talentos, itens, backgrounds, heranças, magias e runas que o GM cria.
-- O `entry` tem a forma de um RuleEntry do catálogo (id `mesa:<uuid>`), já sanitizado pelo servidor
-- (`homebrew-store.js`). Só o servidor escreve; o cliente lê pela API (membro da mesa).
create table public.mesa_homebrew (
    id uuid primary key default gen_random_uuid(),
    mesa text not null references public.mesas (id) on delete cascade,
    kind text not null check (kind in ('feat', 'item', 'background', 'heritage', 'spell', 'rune')),
    entry jsonb not null check (octet_length(entry::text) <= 16384),
    created_by uuid references auth.users (id) on delete set null,
    updated_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index mesa_homebrew_mesa_idx on public.mesa_homebrew (mesa, kind);

alter table public.mesa_homebrew enable row level security;
grant select, insert, update, delete on public.mesa_homebrew to service_role;
