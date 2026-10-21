-- Fase 5: mapas de combate em tempo real.
--
-- No Redis era um HASH por mapa, um campo por fatia, com donos diferentes
-- (`tok:` é da Iniciativa, `pos:` do mapa, `hp:` dos dois), e um contador que
-- todo aparelho lia a cada 0,7–2 s. Aqui o hash vira uma LINHA por campo
-- (`map_fields`) — a mesma lógica, campo a campo — e cada mudança é transmitida
-- pelo Realtime no canal privado `mesa:<mesa>:map:<id>` (evento `field`), já com
-- o valor e a REVISÃO da escrita que a fez. O poll vira plano B.
--
-- Toda escrita passa por `map_write`: sobe a revisão e grava os campos numa
-- transação, então o trigger de cada campo transmite a revisão certa — e o
-- cliente descarta o que for mais velho que o que já tem (dois arrastos seguidos
-- do mesmo token não voltam o token para trás com um eco atrasado). Campo que
-- não mudou não é regravado nem transmitido: a sincronia da Iniciativa reenvia a
-- lista inteira de tokens a cada vez.
--
-- A lista de mapas e o mapa ativo mudam pelo canal `mesa:<mesa>:maps` (evento
-- `changed`).
--
-- Mapa privado: o servidor não o entrega a quem não pede como GM, como antes. O
-- canal do mapa é o de qualquer membro da mesa — sem login de verdade, "GM" é
-- interface (o `gm=1` de antes também era).

create table public.maps (
    id text primary key check (id ~ '^[a-z0-9]{6,16}$'),
    mesa text not null references public.mesas (id) on delete cascade,
    private boolean not null default false,
    rev bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index maps_mesa_idx on public.maps (mesa);

create table public.map_fields (
    map_id text not null references public.maps (id) on delete cascade,
    mesa text not null,
    -- A mesma regra do `FIELD_RE` de api/_lib/map-store.js, mais `imgs` (o
    -- registro das imagens de monstro, que só o servidor escreve).
    field text not null check (field ~ '^(meta|turn|imgs|(tok|pos|hp|fit|drw|ping|roll):[a-z0-9-]{1,64})$'),
    value jsonb not null check (octet_length(value::text) <= 98304),
    updated_at bigint not null,
    primary key (map_id, field)
);

alter table public.mesas add column active_map_id text references public.maps (id) on delete set null;

alter table public.maps enable row level security;
alter table public.map_fields enable row level security;
grant select, insert, update, delete on public.maps, public.map_fields to service_role;

-- Grava e apaga campos de um mapa e sobe a revisão, numa transação. Devolve a
-- revisão nova; `null` se o mapa não existe; `-1` se passaria do teto de desenhos.
create function public.map_write(p_mesa text, p_id text, p_set jsonb, p_del text[], p_max_drawings integer)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
    v_rev bigint;
    v_now bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
    perform 1 from public.maps where id = p_id and mesa = p_mesa for update;
    if not found then
        return null;
    end if;
    if p_max_drawings is not null
       and exists (select 1 from jsonb_each(p_set) e where e.key like 'drw:%' and e.value <> 'null'::jsonb
                   and not exists (select 1 from public.map_fields f where f.map_id = p_id and f.field = e.key))
       and (select count(*) from public.map_fields where map_id = p_id and field like 'drw:%') >= p_max_drawings then
        return -1;
    end if;

    -- A revisão sobe ANTES das linhas: o trigger de cada campo a lê e transmite.
    update public.maps set rev = rev + 1, updated_at = now() where id = p_id returning rev into v_rev;

    insert into public.map_fields as f (map_id, mesa, field, value, updated_at)
    select p_id, p_mesa, e.key, e.value, v_now from jsonb_each(coalesce(p_set, '{}'::jsonb)) e
    on conflict (map_id, field) do update set value = excluded.value, updated_at = excluded.updated_at
    where f.value is distinct from excluded.value;

    if p_del is not null and cardinality(p_del) > 0 then
        delete from public.map_fields where map_id = p_id and field = any(p_del);
    end if;
    return v_rev;
end
$$;

-- Apaga todos os desenhos (fim do combate). Mesmos retornos de `map_write`.
create function public.map_clear_drawings(p_mesa text, p_id text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
    v_rev bigint;
begin
    perform 1 from public.maps where id = p_id and mesa = p_mesa for update;
    if not found then
        return null;
    end if;
    update public.maps set rev = rev + 1, updated_at = now() where id = p_id returning rev into v_rev;
    delete from public.map_fields where map_id = p_id and field like 'drw:%';
    return v_rev;
end
$$;

-- Esconde ou revela o mapa. Já como pedido (o "Levar a mesa" de sempre): não sobe
-- a revisão. Esconder o mapa onde a mesa está tira a mesa dele.
create function public.map_set_private(p_mesa text, p_id text, p_on boolean)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
    v_private boolean;
    v_rev bigint;
begin
    select private, rev into v_private, v_rev from public.maps where id = p_id and mesa = p_mesa for update;
    if not found then
        return null;
    end if;
    if p_on then
        update public.mesas set active_map_id = null where id = p_mesa and active_map_id = p_id;
    end if;
    if v_private = p_on then
        return v_rev;
    end if;
    update public.maps set private = p_on, rev = rev + 1, updated_at = now() where id = p_id returning rev into v_rev;
    return v_rev;
end
$$;

-- O "contador da mesa" do poll de reserva: a escrita mais recente no estado dos
-- personagens. É o que avisa o mapa (sem Realtime) que o PV de alguém mudou.
create function public.table_rev(p_mesa text)
returns bigint
language sql
stable
set search_path = ''
as $$
    select coalesce(max(updated_at), 0) from public.character_state where mesa = p_mesa
$$;

-- Os contadores do poll de reserva numa consulta.
create function public.map_revs(p_mesa text, p_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select jsonb_build_object(
        'rev', coalesce((select rev from public.maps where id = p_id and mesa = p_mesa), 0),
        'tableRev', public.table_rev(p_mesa),
        'activeId', (select active_map_id from public.mesas where id = p_mesa)
    )
$$;

-- O mapa inteiro numa consulta, coerente (um snapshot só): os contadores, os
-- campos e o `hp`/`token`/`size` dos personagens que estão nele. `null` se o
-- mapa não existe.
create function public.read_map(p_mesa text, p_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select jsonb_build_object(
        'rev', m.rev,
        'tableRev', public.table_rev(p_mesa),
        'activeId', (select active_map_id from public.mesas where id = p_mesa),
        'private', m.private,
        'fields', coalesce((
            select jsonb_object_agg(f.field, jsonb_build_object('data', f.value, 'updatedAt', f.updated_at))
            from public.map_fields f where f.map_id = m.id
        ), '{}'::jsonb),
        'pcs', coalesce((
            select jsonb_object_agg(c.slug, c.slices)
            from (
                select s.slug, jsonb_object_agg(s.field, s.data) as slices
                from public.character_state s
                where s.mesa = p_mesa
                  and s.field in ('hp', 'token', 'size')
                  and s.slug in (
                      select f.value ->> 'slug' from public.map_fields f
                      where f.map_id = m.id and f.field like 'tok:%' and f.value ->> 'kind' = 'pc'
                  )
                group by s.slug
            ) c
        ), '{}'::jsonb)
    )
    from public.maps m
    where m.id = p_id and m.mesa = p_mesa
$$;

-- A lista da mesa: id, nome, criação, se tem imagem e se é privado.
create function public.list_maps(p_mesa text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select jsonb_build_object(
        'activeId', (select active_map_id from public.mesas where id = p_mesa),
        'maps', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', m.id,
                'name', f.value ->> 'name',
                'createdAt', coalesce((f.value ->> 'createdAt')::bigint, 0),
                'hasImage', (f.value -> 'image') is not null and f.value -> 'image' <> 'null'::jsonb,
                'private', m.private
            ) order by coalesce((f.value ->> 'createdAt')::bigint, 0))
            from public.maps m
            join public.map_fields f on f.map_id = m.id and f.field = 'meta'
            where m.mesa = p_mesa
        ), '[]'::jsonb)
    )
$$;

-- --- Transmissões -------------------------------------------------------------

create function public.broadcast_map_field()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_rev bigint;
begin
    if tg_op = 'DELETE' then
        -- Apagar o mapa leva os campos junto (cascade): não há quem avisar campo a campo.
        select rev into v_rev from public.maps where id = old.map_id;
        if not found then
            return null;
        end if;
        perform realtime.send(
            jsonb_build_object('field', old.field, 'value', null, 'rev', v_rev),
            'field', 'mesa:' || old.mesa || ':map:' || old.map_id, true);
        return null;
    end if;
    select rev into v_rev from public.maps where id = new.map_id;
    perform realtime.send(
        jsonb_build_object('field', new.field, 'value', new.value, 'updatedAt', new.updated_at, 'rev', v_rev),
        'field', 'mesa:' || new.mesa || ':map:' || new.map_id, true);
    -- O nome e a imagem aparecem na lista de mapas.
    if new.field = 'meta' then
        perform realtime.send(jsonb_build_object('id', new.map_id), 'changed', 'mesa:' || new.mesa || ':maps', true);
    end if;
    return null;
end
$$;

create trigger map_fields_broadcast
    after insert or update or delete on public.map_fields
    for each row execute function public.broadcast_map_field();

create function public.broadcast_map()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'UPDATE' and new.private is not distinct from old.private then
        return null;
    end if;
    if tg_op = 'UPDATE' then
        perform realtime.send(jsonb_build_object('private', new.private, 'rev', new.rev),
            'private', 'mesa:' || new.mesa || ':map:' || new.id, true);
    end if;
    perform realtime.send(jsonb_build_object('id', coalesce(new.id, old.id)),
        'changed', 'mesa:' || coalesce(new.mesa, old.mesa) || ':maps', true);
    return null;
end
$$;

create trigger maps_broadcast
    after insert or update or delete on public.maps
    for each row execute function public.broadcast_map();

create function public.broadcast_active_map()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.active_map_id is not distinct from old.active_map_id then
        return null;
    end if;
    perform realtime.send(jsonb_build_object('activeId', new.active_map_id),
        'changed', 'mesa:' || new.id || ':maps', true);
    return null;
end
$$;

create trigger mesas_active_map_broadcast
    after update of active_map_id on public.mesas
    for each row execute function public.broadcast_active_map();

revoke all on function public.map_write(text, text, jsonb, text[], integer) from public, anon, authenticated;
revoke all on function public.map_clear_drawings(text, text) from public, anon, authenticated;
revoke all on function public.map_set_private(text, text, boolean) from public, anon, authenticated;
revoke all on function public.table_rev(text) from public, anon, authenticated;
revoke all on function public.map_revs(text, text) from public, anon, authenticated;
revoke all on function public.read_map(text, text) from public, anon, authenticated;
revoke all on function public.list_maps(text) from public, anon, authenticated;
revoke all on function public.broadcast_map_field() from public, anon, authenticated;
revoke all on function public.broadcast_map() from public, anon, authenticated;
revoke all on function public.broadcast_active_map() from public, anon, authenticated;
grant execute on function public.map_write(text, text, jsonb, text[], integer) to service_role;
grant execute on function public.map_clear_drawings(text, text) to service_role;
grant execute on function public.map_set_private(text, text, boolean) to service_role;
grant execute on function public.table_rev(text) to service_role;
grant execute on function public.map_revs(text, text) to service_role;
grant execute on function public.read_map(text, text) to service_role;
grant execute on function public.list_maps(text) to service_role;
