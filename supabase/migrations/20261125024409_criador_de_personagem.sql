-- Criador de Personagem (F2): os builds (as ESCOLHAS do jogador, não os números), uma versão por publicação e as
-- regras de criação de cada mesa. Só o servidor escreve (chave secreta); o cliente lê pela API, que autoriza.
-- Esquema e regras do formato: docs/character-builder/MODELO-DE-DADOS.md §2–3.

-- Um build por personagem por mesa. O slug nasce no build-create e nunca muda: é a identidade do estado da mesa.
create table public.character_builds (
    id uuid primary key default gen_random_uuid(),
    mesa text not null references public.mesas (id) on delete cascade,
    slug text not null check (slug ~ '^[a-z0-9-]{1,48}$'),
    owner_id uuid references auth.users (id) on delete set null,
    name text not null check (char_length(name) between 1 and 80),
    class_name text,
    level smallint not null default 1 check (level between 1 and 20),
    state jsonb not null check (octet_length(state::text) <= 98304),
    rules_version text not null,
    rev integer not null default 1,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users (id) on delete set null,
    published_rev integer,
    deleted_at timestamptz,
    unique (mesa, slug)
);
create index character_builds_owner_idx on public.character_builds (mesa, owner_id);

-- O BuildState que gerou cada ficha aplicada na mesa.
create table public.character_build_versions (
    id bigint generated always as identity primary key,
    build_id uuid not null references public.character_builds (id) on delete cascade,
    mesa text not null references public.mesas (id) on delete cascade,
    state jsonb not null,
    rules_version text not null,
    level smallint not null,
    published_at timestamptz not null default now(),
    published_by uuid references auth.users (id) on delete set null
);
create index character_build_versions_build_idx on public.character_build_versions (build_id, published_at desc);

-- Regras de criação da mesa (livros, raridade, variantes, exceções).
create table public.mesa_rules (
    mesa text primary key references public.mesas (id) on delete cascade,
    rules jsonb not null default '{}'::jsonb check (octet_length(rules::text) <= 65536),
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users (id) on delete set null
);

-- Nulo = ficha de upload do Pathbuilder (sem modo editar até ser importada).
alter table public.sheets add column build_id uuid references public.character_builds (id) on delete set null;

alter table public.character_builds enable row level security;
alter table public.character_build_versions enable row level security;
alter table public.mesa_rules enable row level security;

grant select, insert, update, delete on public.character_builds, public.character_build_versions, public.mesa_rules
to service_role;
grant usage, select on sequence public.character_build_versions_id_seq to service_role;

-- Até 30 versões por build (como sheet_versions): a mais velha sai quando entra a 31ª.
create function public.trim_character_build_versions() returns trigger
language plpgsql set search_path = '' as $$
begin
    delete from public.character_build_versions
    where build_id = new.build_id
      and id not in (
          select id from public.character_build_versions
          where build_id = new.build_id
          order by published_at desc, id desc
          limit 30
      );
    return null;
end;
$$;

create trigger character_build_versions_trim
after insert on public.character_build_versions
for each row execute function public.trim_character_build_versions();

-- Lixeira: 30 dias. Build com ficha aplicada fica (a ficha depende dele).
select cron.schedule(
    'limpar-lixeira-de-builds',
    '47 4 * * *',
    $$ delete from public.character_builds b
       where b.deleted_at < now() - interval '30 days'
         and not exists (select 1 from public.sheets s where s.build_id = b.id) $$
);

-- Semente (F0.3, confirmada pelas duas mesas em 2026-11-24): Free Archetype, Mítico e Ancestral Paragon; todos os
-- livros Remaster da carga inicial (os que têm entradas importadas). Livro legado ou importado depois exige o GM.
insert into public.mesa_rules (mesa, rules)
select m.id, jsonb_build_object(
    'sources', jsonb_build_object('allow', coalesce((
        select jsonb_agg('source:' || s.aon_id order by s.aon_id)
        from public.rules_sources s
        where s.remaster and s.status = 'imported' and coalesce(s.our_count, 0) > 0
    ), '[]'::jsonb)),
    'legacy', false,
    'rarity', jsonb_build_object('uncommon', 'ask', 'rare', 'ask'),
    'variants', jsonb_build_object(
        'freeArchetype', true,
        'mythic', jsonb_build_object('enabled', true, 'progression', 'level'),
        'ancestralParagon', true,
        'abp', false, 'pwl', false, 'dualClass', false, 'gradualBoosts', false
    ),
    'startingLevel', 1,
    'wealth', 'table',
    'exceptions', '[]'::jsonb
)
from public.mesas m
where m.id in ('casa-do-gordo', 'arton-1515');
