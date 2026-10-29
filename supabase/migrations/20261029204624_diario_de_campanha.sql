-- Diário de Campanha: a preparação do GM (sessões e o catálogo da campanha) e o
-- que ele mostra à mesa.
--
-- `journal_docs` é um documento por linha — uma sessão ou uma ficha do catálogo
-- (NPC, local, item, facção, outro, gancho) —, o `data` inteiro, como o encontro
-- da Iniciativa. Só o GM lê e escreve, sempre pelo servidor (chave secreta).
--
-- O trigger avisa só QUE mudou (`mesa:<mesa>:journal`), SEM título: qualquer
-- membro da mesa pode ouvir os canais `mesa:<mesa>:*`, e o diário tem segredos.
-- O aparelho do GM que está com o documento aberto relê pela API.
--
-- `journal_reveals` guarda o que o GM mostrou à mesa (trecho marcado ou imagem):
-- é o que o cartão dos jogadores lê. O compartilhamento em `shares` leva só a
-- referência (`ref`), porque `shares.share` tem 4 KB e é copiado para
-- `mesa_events.data` (8 KB).

create table public.journal_docs (
    mesa text not null references public.mesas (id) on delete cascade,
    id text not null check (id ~ '^[a-z0-9-]{1,64}$'),
    kind text not null check (kind in ('session', 'npc', 'location', 'item', 'faction', 'other', 'thread')),
    title text not null check (char_length(title) <= 200),
    sort integer not null default 0,
    data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 262144),
    -- Milissegundos, do servidor.
    updated_at bigint not null,
    updated_by uuid references auth.users (id) on delete set null,
    primary key (mesa, id)
);

alter table public.journal_docs enable row level security;
grant select, insert, update, delete on public.journal_docs to service_role;

create function public.broadcast_journal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        perform realtime.send(
            jsonb_build_object('doc', old.id, 'deleted', true),
            'journal', 'mesa:' || old.mesa || ':journal', true);
        return null;
    end if;
    perform realtime.send(
        jsonb_build_object('doc', new.id, 'updatedAt', new.updated_at, 'by', new.updated_by),
        'journal', 'mesa:' || new.mesa || ':journal', true);
    return null;
end
$$;

revoke all on function public.broadcast_journal() from public, anon, authenticated;

create trigger journal_docs_broadcast after insert or update or delete on public.journal_docs
    for each row execute function public.broadcast_journal();

create table public.journal_reveals (
    mesa text not null references public.mesas (id) on delete cascade,
    id text not null check (id ~ '^[a-z0-9-]{1,64}$'),
    at timestamptz not null default now(),
    title text not null check (char_length(title) <= 120),
    markdown text not null default '' check (octet_length(markdown) <= 16384),
    image text check (image is null or char_length(image) <= 500),
    source text check (source is null or source ~ '^[a-z0-9-]{1,64}$'),
    by uuid references auth.users (id) on delete set null,
    primary key (mesa, id)
);

alter table public.journal_reveals enable row level security;
grant select, insert, update, delete on public.journal_reveals to service_role;

-- Notificação própria: "O GM mostrou …" em vez de "regra compartilhada".
alter table public.mesa_events drop constraint mesa_events_kind_check;
alter table public.mesa_events add constraint mesa_events_kind_check check (kind in
    ('sheet-published', 'sheet-assigned', 'map-active', 'map-revealed', 'combat-started', 'rule-shared',
     'handout-shared'));

create or replace function public.share_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.mesa_events (mesa, kind, data) values (
        new.mesa,
        case when new.share ->> 'type' = 'handout' then 'handout-shared' else 'rule-shared' end,
        new.share);
    return null;
end
$$;

revoke all on function public.share_events() from public, anon, authenticated;

-- Imagens do diário: pasta `journal/`, permanente como `tokens/`, e só o GM envia.
-- Política à parte (as permissivas somam): a de `tokens/maps/monsters` fica como está.
create policy "gm envia imagens do diario" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'images'
        and (storage.foldername(name))[1] = 'journal'
        and name ~ '^journal/[a-z0-9-]{1,120}\.(webp|png|jpe?g)$'
        and exists (select 1 from public.mesa_members mm where mm.user_id = (select auth.uid()) and mm.role = 'gm')
    );
