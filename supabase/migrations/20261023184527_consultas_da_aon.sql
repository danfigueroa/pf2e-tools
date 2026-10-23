-- Consultas à AON por NOME (armas, armaduras, itens, escudos): feitas UMA vez e guardadas.
-- Antes cada aparelho refazia a busca (cache só no localStorage e na memória da função).
-- GLOBAL, como `descriptions`: o Warhammer do Ghan Buri serve a qualquer mesa. `kind` leva a versão
-- do formato ('gear:v1'); subiu a versão, as linhas velhas deixam de ser lidas.
create table public.aon_lookups (
    kind text not null check (kind ~ '^[a-z]{2,12}:v\d{1,3}$'),
    name text not null check (char_length(name) between 1 and 120),
    payload jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (kind, name)
);

alter table public.aon_lookups enable row level security;
grant select, insert, update, delete on public.aon_lookups to service_role;
