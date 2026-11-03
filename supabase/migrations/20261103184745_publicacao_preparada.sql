-- Publicação PREPARADA: o JSON enviado não vira a ficha da mesa na hora. Vira um rascunho
-- (`sheet_drafts`), e o servidor prepara tudo o que a ficha precisa — consultas da AON,
-- companheiros, descrições em português e em inglês, o guia "Como Jogar" nas duas línguas —
-- em passos que cabem no `maxDuration`, conduzidos pelo navegador de quem publicou. Só com
-- tudo pronto e conferido o rascunho é PROMOVIDO a `sheets` (`promote_sheet_draft`), numa
-- transação, já com o guia: o aviso `published`, a notificação e o dono saem só aí.
--
-- Num level-up a mesa continua com a versão anterior até a promoção. O andamento viaja no
-- canal `mesa:<mesa>:sheets` (evento `preparing`), para a mesa ver "em preparo".

create table public.sheet_drafts (
    mesa text not null references public.mesas (id) on delete cascade,
    slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
    json jsonb not null check (octet_length(json::text) <= 98304),
    name text not null,
    class_name text not null default '',
    level integer not null,
    -- As listas de nomes que a ficha descreve (`characterDescriptionNames`, do cliente) e os
    -- companheiros (pets e familiares do Pathbuilder).
    names jsonb not null,
    -- A `CACHE_VERSION` do cliente: a versão das descrições que a ficha vai ler.
    version text not null check (version ~ '^v\d{1,4}$'),
    companions jsonb not null default '[]'::jsonb,
    -- O guia curado que o cliente mostrava: base da primeira geração.
    base_guide text,
    base_guide_en text,
    -- O guia gerado no preparo, no formato de `sheets.guide` ({ markdown, generatedAt, en }).
    guide jsonb,
    -- { step, done, total, steps, waiting, reason, attempts, retryAt }
    progress jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (mesa, slug)
);

alter table public.sheet_drafts enable row level security;
grant select, insert, update, delete on public.sheet_drafts to service_role;

-- O rascunho vira a ficha da mesa: a atual vai para o histórico e a nova entra com o guia
-- preparado (o `publish_sheet` zerava o guia). Ficha NOVA ganha o dono `p_owner` (quem
-- publicou, com a cobrança ligada); ficha que já existe mantém o dono que tem.
-- `null` = não há rascunho.
create function public.promote_sheet_draft(p_mesa text, p_slug text, p_by uuid, p_owner uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    d public.sheet_drafts;
    r public.sheets;
begin
    select * into d from public.sheet_drafts where mesa = p_mesa and slug = p_slug for update;
    if not found then
        return null;
    end if;
    perform 1 from public.sheets where mesa = p_mesa and slug = p_slug for update;
    perform public.archive_sheet(p_mesa, p_slug);

    insert into public.sheets (mesa, slug, json, name, class_name, level, published_at, guide, published_by, owner_id)
    values (p_mesa, p_slug, d.json, d.name, d.class_name, d.level,
            floor(extract(epoch from clock_timestamp()) * 1000)::bigint, d.guide, p_by, p_owner)
    on conflict (mesa, slug) do update set
        json = excluded.json,
        name = excluded.name,
        class_name = excluded.class_name,
        level = excluded.level,
        published_at = excluded.published_at,
        guide = excluded.guide,
        published_by = excluded.published_by
    returning * into r;

    delete from public.sheet_drafts where mesa = p_mesa and slug = p_slug;
    return to_jsonb(r);
end
$$;

revoke all on function public.promote_sheet_draft(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.promote_sheet_draft(text, text, uuid, uuid) to service_role;

-- O andamento do preparo para a mesa: só referência e progresso, nunca o JSON.
create function public.broadcast_sheet_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        perform realtime.send(
            jsonb_build_object('slug', old.slug),
            'prepared', 'mesa:' || old.mesa || ':sheets', true);
        return null;
    end if;
    perform realtime.send(
        jsonb_build_object('slug', new.slug, 'name', new.name, 'level', new.level,
            'progress', new.progress, 'by', new.created_by),
        'preparing', 'mesa:' || new.mesa || ':sheets', true);
    return null;
end
$$;

revoke all on function public.broadcast_sheet_draft() from public, anon, authenticated;

create trigger sheet_drafts_broadcast after insert or update or delete on public.sheet_drafts
    for each row execute function public.broadcast_sheet_draft();

-- Miss por IDIOMA: em inglês não há LLM para completar uma entrada que a AON acha com a prosa
-- vazia, então ela é miss só em inglês. Sem isso o pacote inglês nunca fechava (o nome voltava
-- como "faltando" a cada rodada). Tudo o que já existe é português.
alter table public.description_misses
    add column lang text not null default 'pt' check (lang in ('pt', 'en'));

alter table public.description_misses drop constraint description_misses_pkey;
alter table public.description_misses add primary key (kind, name, lang);

-- O pacote num idioma lê os misses do português (o nome que a AON não acha não existe em
-- língua nenhuma) e os do próprio idioma. A de 2 argumentos chama esta com 'pt' e continua igual.
create or replace function public.sheet_descriptions(p_mesa text, p_slug text, p_lang text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select jsonb_build_object(
        'version', s.version,
        'lang', p_lang,
        'entries', (
            select jsonb_object_agg(k.kind, coalesce((
                select jsonb_object_agg(d.name, d.payload)
                from public.descriptions d
                where d.version = s.version
                  and d.lang = p_lang
                  and d.kind = k.kind
                  and d.name in (select jsonb_array_elements_text(coalesce(s.names -> k.kind, '[]'::jsonb)))
            ), '{}'::jsonb))
            from unnest(array['spell', 'feat', 'special', 'item']) as k (kind)
        ),
        'misses', (
            select jsonb_object_agg(k.kind, coalesce((
                select jsonb_object_agg(m.name, m.at)
                from (
                    select m.name, floor(extract(epoch from max(m.missed_at)) * 1000)::bigint as at
                    from public.description_misses m
                    where m.kind = k.kind
                      and m.lang in ('pt', p_lang)
                      and m.missed_at > now() - interval '24 hours'
                      and m.name in (select jsonb_array_elements_text(coalesce(s.names -> k.kind, '[]'::jsonb)))
                    group by m.name
                ) m
            ), '{}'::jsonb))
            from unnest(array['spell', 'feat', 'special', 'item']) as k (kind)
        )
    )
    from public.sheet_description_sets s
    where s.mesa = p_mesa and s.slug = p_slug
$$;

-- Rascunho abandonado (quem publicou fechou a aba e nunca voltou) sai depois de 14 dias.
select cron.schedule(
    'limpar-rascunhos-de-ficha',
    '41 4 * * *',
    $$ delete from public.sheet_drafts where updated_at < now() - interval '14 days' $$
);
