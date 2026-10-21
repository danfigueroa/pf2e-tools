-- Fase 2: fichas publicadas pela mesa, com histórico.
--
-- No Redis a ficha guardava UMA versão anterior (`previous`), a salvaguarda de
-- não haver login. Aqui toda publicação substituída vai para `sheet_versions`
-- (até 30 por ficha), e o "Restaurar" pode voltar a qualquer uma.
--
-- `published_at` é em MILISSEGUNDOS (bigint), como o `publishedAt` que o cliente
-- já conhece: é também a identidade da versão na hora de gravar o guia (o guia
-- só entra se a ficha ainda for a que o gerou).

create table public.sheets (
    mesa text not null references public.mesas (id) on delete cascade,
    slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
    -- O teto real (64 KB) é conferido no handler sobre o JSON compacto; o texto
    -- do jsonb tem espaços, daí a folga.
    json jsonb not null check (octet_length(json::text) <= 98304),
    name text not null,
    class_name text not null default '',
    level integer not null,
    published_at bigint not null,
    -- { markdown, generatedAt } ou null (o guia é pedido logo depois de publicar).
    guide jsonb,
    published_by uuid references auth.users (id) on delete set null,
    primary key (mesa, slug)
);

create table public.sheet_versions (
    id bigint generated always as identity primary key,
    mesa text not null references public.mesas (id) on delete cascade,
    slug text not null,
    json jsonb not null,
    name text not null,
    class_name text not null default '',
    level integer not null,
    published_at bigint not null,
    guide jsonb,
    published_by uuid references auth.users (id) on delete set null,
    archived_at timestamptz not null default now()
);

create index sheet_versions_sheet_idx on public.sheet_versions (mesa, slug, id desc);

alter table public.sheets enable row level security;
alter table public.sheet_versions enable row level security;

grant select, insert, update, delete on public.sheets, public.sheet_versions to service_role;

-- A versão atual vai para o histórico. Chamado com a linha da ficha já travada.
create function public.archive_sheet(p_mesa text, p_slug text)
returns void
language sql
set search_path = ''
as $$
    insert into public.sheet_versions (mesa, slug, json, name, class_name, level, published_at, guide, published_by)
    select mesa, slug, json, name, class_name, level, published_at, guide, published_by
    from public.sheets
    where mesa = p_mesa and slug = p_slug;

    delete from public.sheet_versions
    where mesa = p_mesa and slug = p_slug
      and id not in (
          select id from public.sheet_versions
          where mesa = p_mesa and slug = p_slug
          order by id desc
          limit 30
      );
$$;

-- Publica uma versão nova: a atual vira histórico e o guia recomeça vazio (o
-- da ficha antiga não descreve a nova). Tudo numa transação — duas publicações
-- ao mesmo tempo se enfileiram na trava da linha em vez de arquivar a mesma
-- versão duas vezes.
create function public.publish_sheet(
    p_mesa text, p_slug text, p_json jsonb, p_name text, p_class text, p_level integer, p_by uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    r public.sheets;
begin
    perform 1 from public.sheets where mesa = p_mesa and slug = p_slug for update;
    perform public.archive_sheet(p_mesa, p_slug);

    insert into public.sheets (mesa, slug, json, name, class_name, level, published_at, guide, published_by)
    values (p_mesa, p_slug, p_json, p_name, p_class, p_level,
            floor(extract(epoch from clock_timestamp()) * 1000)::bigint, null, p_by)
    on conflict (mesa, slug) do update set
        json = excluded.json,
        name = excluded.name,
        class_name = excluded.class_name,
        level = excluded.level,
        published_at = excluded.published_at,
        guide = null,
        published_by = excluded.published_by
    returning * into r;

    return to_jsonb(r);
end
$$;

-- Volta a uma versão do histórico (a mais recente quando `p_version` é null).
-- A atual vai para o histórico e a escolhida sai dele: restaurar e restaurar
-- de novo desfaz o desfazer, como no Redis. `null` = não há para onde voltar.
create function public.restore_sheet(p_mesa text, p_slug text, p_version bigint, p_by uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v public.sheet_versions;
    r public.sheets;
begin
    perform 1 from public.sheets where mesa = p_mesa and slug = p_slug for update;
    if not found then
        return null;
    end if;

    select * into v from public.sheet_versions
    where mesa = p_mesa and slug = p_slug and (p_version is null or id = p_version)
    order by id desc
    limit 1;
    if not found then
        return null;
    end if;

    perform public.archive_sheet(p_mesa, p_slug);
    delete from public.sheet_versions where id = v.id;

    update public.sheets set
        json = v.json,
        name = v.name,
        class_name = v.class_name,
        level = v.level,
        published_at = floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
        guide = v.guide,
        published_by = p_by
    where mesa = p_mesa and slug = p_slug
    returning * into r;

    return to_jsonb(r);
end
$$;

revoke all on function public.archive_sheet(text, text) from public, anon, authenticated;
revoke all on function public.publish_sheet(text, text, jsonb, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.restore_sheet(text, text, bigint, uuid) from public, anon, authenticated;
grant execute on function public.archive_sheet(text, text) to service_role;
grant execute on function public.publish_sheet(text, text, jsonb, text, text, integer, uuid) to service_role;
grant execute on function public.restore_sheet(text, text, bigint, uuid) to service_role;
