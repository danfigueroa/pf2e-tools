-- Início nova, notificações e configurações da mesa.
--
--   · `mesas` ganha a sessão em andamento e a próxima sessão (o GM liga e marca em /mesa);
--   · `mesa_members.events_seen`: até qual notificação a pessoa já leu, em qualquer aparelho;
--   · `mesa_events`: o registro do que a mesa precisa saber (ficha publicada, ficha atribuída,
--     mapa ativado ou revelado, combate começou, regra compartilhada). Quem escreve são TRIGGERS,
--     não o servidor: nenhum caminho de escrita esquece de avisar, e quem estava com o app
--     fechado acha a notificação ao abrir.
--
-- Só aditiva. Cada evento é transmitido no canal privado `mesa:<mesa>:events` (a política
-- "membros ouvem os canais da mesa" já cobre `mesa:<mesa>:*`), e a mudança de nome ou de
-- sessão sai no mesmo canal como `settings`, para a sidebar de todos acompanhar.

alter table public.mesas
    add column session_started_at timestamptz,
    add column next_session_at timestamptz;

alter table public.mesa_members
    add column events_seen bigint not null default 0;

create table public.mesa_events (
    id bigserial primary key,
    mesa text not null references public.mesas (id) on delete cascade,
    kind text not null check (kind in
        ('sheet-published', 'sheet-assigned', 'map-active', 'map-revealed', 'combat-started', 'rule-shared')),
    -- Nulo = para a mesa inteira; senão só aquela conta vê (a ficha atribuída a ela).
    target_user uuid references auth.users (id) on delete cascade,
    data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 8192),
    at timestamptz not null default now()
);

create index mesa_events_mesa_id_idx on public.mesa_events (mesa, id desc);

alter table public.mesa_events enable row level security;
grant select, insert, update, delete on public.mesa_events to service_role;
grant usage on sequence public.mesa_events_id_seq to service_role;

-- O aviso em tempo real de cada evento novo, já com o conteúdo (quem ouve não relê nada).
create function public.broadcast_mesa_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.send(
        jsonb_build_object('id', new.id, 'kind', new.kind, 'target', new.target_user,
            'data', new.data, 'at', new.at),
        'event', 'mesa:' || new.mesa || ':events', true);
    return null;
end
$$;

revoke all on function public.broadcast_mesa_event() from public, anon, authenticated;

create trigger mesa_events_broadcast after insert on public.mesa_events
    for each row execute function public.broadcast_mesa_event();

-- Fichas: versão nova (publicar ou restaurar) e dono novo.
create function public.sheet_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' or new.published_at is distinct from old.published_at then
        insert into public.mesa_events (mesa, kind, data)
        values (new.mesa, 'sheet-published',
            jsonb_build_object('slug', new.slug, 'name', new.name, 'level', new.level, 'by', new.published_by));
    end if;
    if new.owner_id is not null and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id) then
        insert into public.mesa_events (mesa, kind, target_user, data)
        values (new.mesa, 'sheet-assigned', new.owner_id,
            jsonb_build_object('slug', new.slug, 'name', new.name));
    end if;
    return null;
end
$$;

revoke all on function public.sheet_events() from public, anon, authenticated;

create trigger sheets_events after insert or update on public.sheets
    for each row execute function public.sheet_events();

-- Mesa: a mesa foi levada a um mapa; e o aviso de configurações (nome, sessão).
create function public.mesa_settings_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    map_name text;
begin
    if new.active_map_id is not null and new.active_map_id is distinct from old.active_map_id then
        select f.value->>'name' into map_name
        from public.map_fields f where f.map_id = new.active_map_id and f.field = 'meta';
        insert into public.mesa_events (mesa, kind, data)
        values (new.id, 'map-active', jsonb_build_object('map', new.active_map_id, 'name', map_name));
    end if;
    if new.name is distinct from old.name
        or new.session_started_at is distinct from old.session_started_at
        or new.next_session_at is distinct from old.next_session_at then
        perform realtime.send(
            jsonb_build_object('name', new.name, 'sessionStartedAt', new.session_started_at,
                'nextSessionAt', new.next_session_at),
            'settings', 'mesa:' || new.id || ':events', true);
    end if;
    return null;
end
$$;

revoke all on function public.mesa_settings_events() from public, anon, authenticated;

create trigger mesas_events after update on public.mesas
    for each row execute function public.mesa_settings_events();

-- Mapa revelado à mesa (privado → público).
create function public.map_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    map_name text;
begin
    if old.private and not new.private then
        select f.value->>'name' into map_name
        from public.map_fields f where f.map_id = new.id and f.field = 'meta';
        insert into public.mesa_events (mesa, kind, data)
        values (new.mesa, 'map-revealed', jsonb_build_object('map', new.id, 'name', map_name));
    end if;
    return null;
end
$$;

revoke all on function public.map_events() from public, anon, authenticated;

create trigger maps_events after update on public.maps
    for each row execute function public.map_events();

-- Combate começou: a rodada do encontro passou de 0 (ou nada) para 1.
create function public.encounter_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    before_round integer := 0;
    after_round integer;
begin
    -- A leitura fica no corpo: erro no `declare` escaparia do `exception` lá embaixo.
    after_round := coalesce((new.state->>'round')::integer, 0);
    if tg_op = 'UPDATE' then
        before_round := coalesce((old.state->>'round')::integer, 0);
    end if;
    if before_round = 0 and after_round >= 1 then
        insert into public.mesa_events (mesa, kind, data)
        values (new.mesa, 'combat-started', jsonb_build_object('map', nullif(new.map_key, '')));
    end if;
    return null;
exception when invalid_text_representation then
    -- `round` que não é número: não é o formato do app, e não vale derrubar a gravação.
    return null;
end
$$;

revoke all on function public.encounter_events() from public, anon, authenticated;

create trigger encounters_events after insert or update on public.encounters
    for each row execute function public.encounter_events();

-- Regra compartilhada: a referência inteira, para reabrir o cartão pela notificação.
create function public.share_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.mesa_events (mesa, kind, data) values (new.mesa, 'rule-shared', new.share);
    return null;
end
$$;

revoke all on function public.share_events() from public, anon, authenticated;

create trigger shares_events after insert on public.shares
    for each row execute function public.share_events();

-- Notificação é do momento: um mês basta.
select cron.schedule(
    'limpar-eventos-da-mesa',
    '17 4 * * *',
    $$ delete from public.mesa_events where at < now() - interval '30 days' $$
);
