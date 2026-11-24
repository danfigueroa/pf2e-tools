-- Catálogo global. O servidor importa as regras e publica os pacotes de leitura.
create extension if not exists pg_trgm with schema extensions;

-- Livros da AON e o estado de cada um na nossa base.
create table public.rules_sources (
    aon_id text primary key,                    -- 'source-1'
    name text not null,                         -- 'Player Core'
    product_line text,                          -- 'Rulebooks' | 'Lost Omens' | 'Adventures' | ...
    release_date date,
    errata text,                                -- 'Latest Errata 4.0 - 2023-01-03' (como a AON publica)
    remaster boolean not null,                  -- lançado a partir de 2023-11-15 (Player Core) ou marcado à mão
    aon_count integer,                          -- entradas de jogador na AON na última verificação
    our_count integer,                          -- entradas importadas
    status text not null default 'available'    -- 'available' | 'imported' | 'outdated' | 'ignored'
        check (status in ('available','imported','outdated','ignored')),
    checked_at timestamptz,
    imported_at timestamptz,
    imported_by uuid references auth.users (id) on delete set null
);

-- Uma linha por entrada da AON.
create table public.rules_entries (
    aon_id text primary key,                    -- 'feat-4775' (id estável da AON)
    id text not null unique,                    -- 'feat:vicious-swing' (id do Criador, MODELO-DE-DADOS)
    category text not null,                     -- categoria da AON
    name text not null,                         -- nome canônico em inglês
    level smallint,
    rarity text,
    traits text[] not null default '{}',
    source_id text references public.rules_sources (aon_id),
    remaster boolean not null,
    legacy_ids text[] not null default '{}',    -- entradas antigas que esta substitui
    legacy_names text[] not null default '{}',  -- 'Power Attack' → útil na importação do Pathbuilder
    replaced_by text,                           -- se é legado com versão Remaster
    data jsonb not null,                        -- campos estruturados enxutos (§1), sem HTML
    markdown text,                              -- texto da regra em inglês (descrição offline e base da tradução)
    hash text not null,                         -- sha1 de data+markdown (detectar mudança)
    imported_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    removed_at timestamptz                      -- sumiu da AON numa reimportação (não apaga: builds podem usar)
);
create index rules_entries_category_idx on public.rules_entries (category, level);
create index rules_entries_source_idx on public.rules_entries (source_id);
create index rules_entries_name_trgm on public.rules_entries using gin (name extensions.gin_trgm_ops);  -- busca "Navegador"

-- Mecânica: o que a entrada faz no motor. Separada porque tem outra origem e outro ritmo.
create table public.rules_mechanics (
    aon_id text primary key references public.rules_entries (aon_id) on delete cascade,
    origin text not null check (origin in ('foundry','manual','derived')),
    rules jsonb not null default '[]',          -- rule elements suportados (MOTOR-DE-REGRAS §10)
    unsupported text[] not null default '{}',
    prereq jsonb,                               -- pré-requisitos já interpretados
    progression jsonb,                          -- classe: níveis de talento, aumentos, características por nível
    reviewed boolean not null default false,    -- conferido por alguém contra a AON
    updated_at timestamptz not null default now()
);

-- Importações e verificações (uma por vez).
create table public.rules_import_jobs (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('check','import','reimport')),
    sources text[] not null,
    status text not null default 'running' check (status in ('running','done','failed','cancelled')),
    cursor jsonb,                               -- onde parou (livro, categoria, search_after)
    counts jsonb not null default '{}',         -- novas, alteradas, sem mudança, removidas, sem mecânica
    report jsonb,                               -- lista legível do que mudou
    started_by uuid references auth.users (id) on delete set null,
    started_at timestamptz not null default now(),
    finished_at timestamptz
);

-- Versão do catálogo: sobe a cada importação que muda algo; os pacotes (§5) são gerados por versão.
create table public.rules_catalog_versions (
    version text primary key,                   -- '2026.12.1'
    created_at timestamptz not null default now(),
    job_id uuid references public.rules_import_jobs (id),
    summary jsonb                               -- contagens por categoria, livros incluídos
);

-- Quem administra a plataforma (a base de regras é de todas as mesas, então não é papel de GM).
create table public.platform_admins (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

-- A F1 e a F1B compartilham a mesma fila de importação global.
create unique index rules_import_jobs_one_running_idx
    on public.rules_import_jobs (status) where status = 'running';

alter table public.rules_sources enable row level security;
alter table public.rules_entries enable row level security;
alter table public.rules_mechanics enable row level security;
alter table public.rules_import_jobs enable row level security;
alter table public.rules_catalog_versions enable row level security;
alter table public.platform_admins enable row level security;

grant select, insert, update, delete on
    public.rules_sources,
    public.rules_entries,
    public.rules_mechanics,
    public.rules_import_jobs,
    public.rules_catalog_versions,
    public.platform_admins
to service_role;

-- D9: resolve o ID da conta confirmada no próprio banco.
insert into public.platform_admins (user_id)
select id from auth.users
where lower(email) = 'danfigueroa@covil.local' and not coalesce(is_anonymous, false);

-- Os pacotes públicos são JSON. O service_role publica sem política de escrita no cliente.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('rules', 'rules', true, array['application/json']);
