-- Wiki da Mesa: o que a mesa inteira (GM e jogadores) escreve sobre o mundo — NPCs, locais, itens,
-- criaturas, facções, divindades, eventos, lore. Separada do catálogo do Diário de Campanha, que
-- continua secreto e só do GM; os dois se ligam por `[[Nome]]`.
--
-- `wiki_pages` é uma página por linha. O `body` é o Markdown COMPLETO, com os trechos `:::mestre`
-- (segredos do GM); o `body_public` é o mesmo texto já sem eles, calculado pelo SERVIDOR
-- (`api/_lib/wiki-secrets.js`) a cada escrita. Tudo o que o jogador lê, busca e vê nos backlinks
-- sai do `body_public` e do `links_public` — o segredo nunca sai do banco para ele.
--
-- `links_*` guardam os NOMES citados em `[[ ]]` já "dobrados" (minúsculas, sem acento), não ids:
-- uma página criada depois para um link vermelho ganha os backlinks sozinha.
--
-- `wiki_revisions` é o histórico (até 50 versões por página, aparadas em `wiki_save`). Salvamentos
-- seguidos da mesma pessoa em 10 minutos viram uma versão só.
--
-- Só o servidor lê e escreve (chave secreta), como o diário. O aviso do Realtime (`mesa:<mesa>:wiki`)
-- leva só o id: a página pode ser só do GM, e qualquer membro ouve o canal.

create table public.wiki_pages (
    mesa text not null references public.mesas (id) on delete cascade,
    id text not null check (id ~ '^w-[a-z0-9]{6,32}$'),
    kind text not null check (kind in ('npc', 'location', 'item', 'creature', 'faction', 'deity', 'event', 'lore', 'other')),
    title text not null check (char_length(title) between 1 and 120),
    aliases text[] not null default '{}' check (cardinality(aliases) <= 10),
    tags text[] not null default '{}' check (cardinality(tags) <= 12),
    summary text not null default '' check (char_length(summary) <= 300),
    image text check (image is null or char_length(image) <= 500),
    parent text check (parent is null or parent ~ '^w-[a-z0-9]{6,32}$'),
    fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object' and octet_length(fields::text) <= 16384),
    body text not null default '' check (octet_length(body) <= 131072),
    body_public text not null default '' check (octet_length(body_public) <= 131072),
    links_all text[] not null default '{}' check (cardinality(links_all) <= 400),
    links_public text[] not null default '{}' check (cardinality(links_public) <= 400),
    visibility text not null default 'public' check (visibility in ('public', 'gm')),
    locked boolean not null default false,
    rev integer not null default 1,
    created_by uuid references auth.users (id) on delete set null,
    -- Milissegundos, do servidor. `updated_at` é a versão da escrita condicional (409).
    created_at bigint not null,
    updated_by uuid references auth.users (id) on delete set null,
    updated_at bigint not null,
    -- Apagar é suave: a página vai para a lixeira do GM.
    deleted_at bigint,
    primary key (mesa, id)
);

create index wiki_pages_links_public on public.wiki_pages using gin (links_public);
create index wiki_pages_links_all on public.wiki_pages using gin (links_all);

alter table public.wiki_pages enable row level security;
grant select, insert, update, delete on public.wiki_pages to service_role;

create table public.wiki_revisions (
    mesa text not null,
    page text not null,
    rev integer not null,
    -- kind, title, aliases, tags, summary, image, parent, fields: o resto da página naquela versão.
    meta jsonb not null check (jsonb_typeof(meta) = 'object' and octet_length(meta::text) <= 32768),
    body text not null default '' check (octet_length(body) <= 131072),
    body_public text not null default '' check (octet_length(body_public) <= 131072),
    edited_by uuid references auth.users (id) on delete set null,
    edited_at bigint not null,
    primary key (mesa, page, rev),
    foreign key (mesa, page) references public.wiki_pages (mesa, id) on delete cascade
);

create index wiki_revisions_recent on public.wiki_revisions (mesa, edited_at desc);

alter table public.wiki_revisions enable row level security;
grant select, insert, update, delete on public.wiki_revisions to service_role;

-- Minúsculas e sem acento: a mesma dobra do `fold` de `api/_lib/wiki-secrets.js` (1 caractere → 1
-- caractere, então a posição achada no texto dobrado vale no original).
create function public.wiki_fold(t text)
returns text
language sql
immutable
set search_path = ''
as $$
    select translate(lower(coalesce(t, '')),
        'áàâãäåéèêëíìîïóòôõöúùûüçñý',
        'aaaaaaeeeeiiiiooooouuuucny')
$$;

revoke all on function public.wiki_fold(text) from public, anon, authenticated;
grant execute on function public.wiki_fold(text) to service_role;

-- A escrita condicional: grava se a página ainda for a que o cliente viu (`p_base`; null = página
-- nova) e registra a versão no histórico, numa transação. Devolve `{ updatedAt, rev }` ou
-- `{ conflict: true }`. O servidor já resolveu os segredos, o `body_public` e os links.
create function public.wiki_save(
    p_mesa text, p_page jsonb, p_base bigint, p_by uuid, p_now bigint, p_coalesce_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id text := p_page ->> 'id';
    v_meta jsonb := jsonb_build_object(
        'kind', p_page -> 'kind', 'title', p_page -> 'title', 'aliases', p_page -> 'aliases',
        'tags', p_page -> 'tags', 'summary', p_page -> 'summary', 'image', p_page -> 'image',
        'parent', p_page -> 'parent', 'fields', p_page -> 'fields');
    v_cur record;
    v_last record;
    v_rev integer;
begin
    if p_base is null then
        begin
            insert into public.wiki_pages (
                mesa, id, kind, title, aliases, tags, summary, image, parent, fields, body, body_public,
                links_all, links_public, visibility, rev, created_by, created_at, updated_by, updated_at)
            values (
                p_mesa, v_id, p_page ->> 'kind', p_page ->> 'title',
                array(select jsonb_array_elements_text(p_page -> 'aliases')),
                array(select jsonb_array_elements_text(p_page -> 'tags')),
                coalesce(p_page ->> 'summary', ''), p_page ->> 'image', p_page ->> 'parent',
                coalesce(p_page -> 'fields', '{}'::jsonb),
                coalesce(p_page ->> 'body', ''), coalesce(p_page ->> 'body_public', ''),
                array(select jsonb_array_elements_text(p_page -> 'links_all')),
                array(select jsonb_array_elements_text(p_page -> 'links_public')),
                coalesce(p_page ->> 'visibility', 'public'), 1, p_by, p_now, p_by, p_now);
        exception when unique_violation then
            return jsonb_build_object('conflict', true);
        end;
        insert into public.wiki_revisions (mesa, page, rev, meta, body, body_public, edited_by, edited_at)
        values (p_mesa, v_id, 1, v_meta, coalesce(p_page ->> 'body', ''), coalesce(p_page ->> 'body_public', ''), p_by, p_now);
        return jsonb_build_object('updatedAt', p_now, 'rev', 1);
    end if;

    select rev, updated_at into v_cur from public.wiki_pages
    where mesa = p_mesa and id = v_id and deleted_at is null
    for update;
    if not found or v_cur.updated_at <> p_base then
        return jsonb_build_object('conflict', true);
    end if;

    select rev, edited_by, edited_at into v_last from public.wiki_revisions
    where mesa = p_mesa and page = v_id order by rev desc limit 1;

    if found and v_last.rev = v_cur.rev and v_last.edited_by is not distinct from p_by
        and p_by is not null and p_now - v_last.edited_at < p_coalesce_ms then
        -- A mesma pessoa salvou de novo logo em seguida: a versão é a mesma.
        v_rev := v_cur.rev;
        update public.wiki_revisions set meta = v_meta, body = coalesce(p_page ->> 'body', ''),
            body_public = coalesce(p_page ->> 'body_public', ''), edited_at = p_now
        where mesa = p_mesa and page = v_id and rev = v_rev;
    else
        v_rev := v_cur.rev + 1;
        insert into public.wiki_revisions (mesa, page, rev, meta, body, body_public, edited_by, edited_at)
        values (p_mesa, v_id, v_rev, v_meta, coalesce(p_page ->> 'body', ''), coalesce(p_page ->> 'body_public', ''), p_by, p_now);
        delete from public.wiki_revisions where mesa = p_mesa and page = v_id and rev <= v_rev - 50;
    end if;

    update public.wiki_pages set
        kind = p_page ->> 'kind',
        title = p_page ->> 'title',
        aliases = array(select jsonb_array_elements_text(p_page -> 'aliases')),
        tags = array(select jsonb_array_elements_text(p_page -> 'tags')),
        summary = coalesce(p_page ->> 'summary', ''),
        image = p_page ->> 'image',
        parent = p_page ->> 'parent',
        fields = coalesce(p_page -> 'fields', '{}'::jsonb),
        body = coalesce(p_page ->> 'body', ''),
        body_public = coalesce(p_page ->> 'body_public', ''),
        links_all = array(select jsonb_array_elements_text(p_page -> 'links_all')),
        links_public = array(select jsonb_array_elements_text(p_page -> 'links_public')),
        rev = v_rev,
        updated_by = p_by,
        updated_at = p_now
    where mesa = p_mesa and id = v_id;

    return jsonb_build_object('updatedAt', p_now, 'rev', v_rev);
end
$$;

revoke all on function public.wiki_save(text, jsonb, bigint, uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.wiki_save(text, jsonb, bigint, uuid, bigint, bigint) to service_role;

-- A busca: título, apelidos, etiquetas, resumo e texto, sem acento nem caixa. `p_gm` busca no texto
-- completo e nas páginas só do GM; o jogador, só no `body_public` das páginas públicas. O trecho
-- (`snippet`) sai do mesmo texto em que achou.
create function public.wiki_search(p_mesa text, p_q text, p_gm boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    with q as (select public.wiki_fold(trim(p_q)) as q),
    hits as (
        select p.id, p.title, p.kind, p.summary, s.src,
            strpos(public.wiki_fold(s.src), q.q) as pos,
            strpos(public.wiki_fold(p.title), q.q) as tpos,
            strpos(public.wiki_fold(array_to_string(p.aliases, ' ') || ' ' || array_to_string(p.tags, ' ') || ' ' || p.summary), q.q) as mpos
        from public.wiki_pages p
        cross join q
        cross join lateral (select case when p_gm then p.body else p.body_public end as src) s
        where p.mesa = p_mesa and p.deleted_at is null and (p_gm or p.visibility = 'public')
          and char_length(q.q) > 0
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', h.id, 'title', h.title, 'kind', h.kind,
        'snippet', case when h.pos > 0 then substr(h.src, greatest(1, h.pos - 60), 180) else h.summary end
    ) order by (h.tpos = 1) desc, (h.tpos > 0) desc, (h.mpos > 0) desc, h.title), '[]'::jsonb)
    from (select * from hits where pos > 0 or tpos > 0 or mpos > 0 order by (tpos > 0) desc, title limit 40) h
$$;

revoke all on function public.wiki_search(text, text, boolean) from public, anon, authenticated;
grant execute on function public.wiki_search(text, text, boolean) to service_role;

-- Os nomes de quem escreveu, para a autoria ("Criada por …"): o nome na mesa, senão o usuário (a
-- parte do e-mail fictício antes do @). O jogador não tinha como transformar um uuid em nome.
create function public.member_names(p_mesa text, p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(jsonb_object_agg(u.id, coalesce(nullif(mm.display_name, ''), split_part(u.email, '@', 1))), '{}'::jsonb)
    from auth.users u
    left join public.mesa_members mm on mm.user_id = u.id and mm.mesa = p_mesa
    where u.id = any (p_ids)
$$;

revoke all on function public.member_names(text, uuid[]) from public, anon, authenticated;
grant execute on function public.member_names(text, uuid[]) to service_role;

-- O aviso do Realtime: só o id (a página pode ser só do GM).
create function public.broadcast_wiki()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        perform realtime.send(jsonb_build_object('page', old.id, 'removed', true),
            'wiki', 'mesa:' || old.mesa || ':wiki', true);
        return null;
    end if;
    perform realtime.send(jsonb_build_object('page', new.id, 'updatedAt', new.updated_at),
        'wiki', 'mesa:' || new.mesa || ':wiki', true);
    return null;
end
$$;

revoke all on function public.broadcast_wiki() from public, anon, authenticated;

create trigger wiki_pages_broadcast after insert or update or delete on public.wiki_pages
    for each row execute function public.broadcast_wiki();

-- O sino: página pública nova, ou página do GM revelada à mesa. Edição não notifica (seria ruído).
alter table public.mesa_events drop constraint mesa_events_kind_check;
alter table public.mesa_events add constraint mesa_events_kind_check check (kind in
    ('sheet-published', 'sheet-assigned', 'map-active', 'map-revealed', 'combat-started', 'rule-shared',
     'handout-shared', 'trophy-unlocked', 'wiki-created', 'wiki-revealed'));

create function public.wiki_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.deleted_at is not null or new.visibility <> 'public' then
        return null;
    end if;
    if tg_op = 'INSERT' then
        insert into public.mesa_events (mesa, kind, data)
        values (new.mesa, 'wiki-created',
            jsonb_build_object('id', new.id, 'title', new.title, 'kind', new.kind, 'by', new.created_by));
    elsif old.visibility = 'gm' then
        insert into public.mesa_events (mesa, kind, data)
        values (new.mesa, 'wiki-revealed',
            jsonb_build_object('id', new.id, 'title', new.title, 'kind', new.kind, 'by', new.updated_by));
    end if;
    return null;
end
$$;

revoke all on function public.wiki_events() from public, anon, authenticated;

create trigger wiki_pages_events after insert or update on public.wiki_pages
    for each row execute function public.wiki_events();

-- Imagens da Wiki: pasta `wiki/`, permanente como `tokens/`, e qualquer membro envia (todos editam a
-- Wiki). Política à parte (as permissivas somam), como a de `items/`.
create policy "membros enviam imagens da wiki" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'images'
        and (storage.foldername(name))[1] = 'wiki'
        and name ~ '^wiki/[a-z0-9-]{1,120}\.(webp|png|jpe?g)$'
        and exists (select 1 from public.mesa_members mm where mm.user_id = (select auth.uid()))
    );
