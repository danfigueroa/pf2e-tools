-- Fase 1: cache de traduções e descrições pré-traduzidas, saindo do Redis.
--
-- Tudo aqui é do SERVIDOR (só o service_role lê e grava): o cliente continua
-- recebendo as descrições pelas mesmas rotas de sempre.

-- Cada trecho traduzido pelo LLM, pela chave de sempre: o sha1 do inglês com a
-- versão e o preâmbulo do prompt (`translationKey` em api/_lib/aon.js). No Redis
-- ele expirava em 180 dias; aqui fica — tradução é cara e não estraga. `en` é
-- guardado para uma correção à mão poder ser feita sabendo o que se traduziu
-- (vazio no que veio migrado do Redis, que só tinha o português).
create table public.translations (
    key text primary key check (key ~ '^[0-9a-f]{40}$'),
    en text,
    pt text not null check (char_length(pt) > 0),
    source text not null default 'llm' check (source in ('llm', 'human')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- A descrição pronta (o payload da API: tradução, `scaling` das magias, degrau
-- de bastão…), GLOBAL: Heal traduzida para o Thalos serve para o Ghan Buri e para
-- a outra mesa. Antes era uma cópia por ficha publicada. `version` é a
-- `CACHE_VERSION` do cliente (o formato do payload): subiu, as linhas velhas
-- deixam de ser lidas.
create table public.descriptions (
    version text not null check (version ~ '^v\d{1,4}$'),
    kind text not null check (kind in ('spell', 'feat', 'special', 'item')),
    name text not null check (char_length(name) between 1 and 120),
    payload jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (version, kind, name)
);

-- Nome que a AON não resolve (caseiro, grafia do Pathbuilder): só é tentado de
-- novo depois de 24 h. Global também — não existir na AON vale para todo mundo.
create table public.description_misses (
    kind text not null check (kind in ('spell', 'feat', 'special', 'item')),
    name text not null check (char_length(name) between 1 and 120),
    missed_at timestamptz not null default now(),
    primary key (kind, name)
);

-- O que cada ficha PUBLICADA descreve: os nomes por tipo, ACUMULADOS (a versão
-- anterior, do "Restaurar", continua coberta), com teto de 300 por tipo.
-- `names` = { "spell": [...], "feat": [...], "special": [...], "item": [...] }.
create table public.sheet_description_sets (
    mesa text not null references public.mesas (id) on delete cascade,
    slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
    version text not null check (version ~ '^v\d{1,4}$'),
    names jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (mesa, slug)
);

-- Travas curtas com validade (o SET NX EX do Redis): dois aparelhos não montam
-- o pacote da mesma ficha ao mesmo tempo.
create table public.locks (
    key text primary key check (char_length(key) <= 200),
    until timestamptz not null
);

alter table public.translations enable row level security;
alter table public.descriptions enable row level security;
alter table public.description_misses enable row level security;
alter table public.sheet_description_sets enable row level security;
alter table public.locks enable row level security;

grant select, insert, update, delete on
    public.translations, public.descriptions, public.description_misses,
    public.sheet_description_sets, public.locks
to service_role;

-- Pega a trava se ela está livre ou venceu. `true` = é sua.
create function public.try_lock(p_key text, p_seconds integer)
returns boolean
language sql
volatile
set search_path = ''
as $$
    with taken as (
        insert into public.locks as l (key, until)
        values (p_key, now() + make_interval(secs => p_seconds))
        on conflict (key) do update set until = excluded.until
        where l.until < now()
        returning true
    )
    select coalesce((select true from taken), false)
$$;

-- O pacote da ficha publicada, montado no banco num pedido só: `{ version,
-- entries: { tipo: { nome: payload } }, misses: { tipo: { nome: ms } } }` — o
-- MESMO formato que o Redis guardava, então o cliente não muda. `null` quando a
-- ficha ainda não tem pacote.
create function public.sheet_descriptions(p_mesa text, p_slug text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select jsonb_build_object(
        'version', s.version,
        'entries', (
            select jsonb_object_agg(k.kind, coalesce((
                select jsonb_object_agg(d.name, d.payload)
                from public.descriptions d
                where d.version = s.version
                  and d.kind = k.kind
                  and d.name in (select jsonb_array_elements_text(coalesce(s.names -> k.kind, '[]'::jsonb)))
            ), '{}'::jsonb))
            from unnest(array['spell', 'feat', 'special', 'item']) as k (kind)
        ),
        'misses', (
            select jsonb_object_agg(k.kind, coalesce((
                select jsonb_object_agg(m.name, floor(extract(epoch from m.missed_at) * 1000)::bigint)
                from public.description_misses m
                where m.kind = k.kind
                  and m.missed_at > now() - interval '24 hours'
                  and m.name in (select jsonb_array_elements_text(coalesce(s.names -> k.kind, '[]'::jsonb)))
            ), '{}'::jsonb))
            from unnest(array['spell', 'feat', 'special', 'item']) as k (kind)
        )
    )
    from public.sheet_description_sets s
    where s.mesa = p_mesa and s.slug = p_slug
$$;

revoke all on function public.try_lock(text, integer) from public, anon, authenticated;
revoke all on function public.sheet_descriptions(text, text) from public, anon, authenticated;
grant execute on function public.try_lock(text, integer) to service_role;
grant execute on function public.sheet_descriptions(text, text) to service_role;

-- Faxina diária: trava vencida e miss com mais de um dia não servem para nada.
select cron.schedule(
    'limpar-travas-e-misses',
    '37 7 * * *',
    $$
    delete from public.locks where until < now() - interval '1 hour';
    delete from public.description_misses where missed_at < now() - interval '2 days';
    $$
);
