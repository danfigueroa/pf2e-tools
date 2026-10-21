-- Fase 3: estado dos personagens da mesa (PV, slots, condições, ações…) em
-- tempo real.
--
-- No Redis era um HASH por personagem, um campo por fatia — para dois jogadores
-- editando coisas diferentes não se sobrescreverem. Aqui é uma LINHA por fatia,
-- pela mesma razão: o upsert de uma não toca nas outras, e a leitura do
-- personagem inteiro continua sendo uma consulta só.
--
-- Cada escrita é transmitida pelo Realtime (trigger abaixo) no canal privado
-- `mesa:<mesa>:state`, já com o valor novo: quem está com a ficha aberta recebe
-- sem pedir. É o que aposenta o "Atualizar" e o poll das ações do turno.

create table public.character_state (
    mesa text not null references public.mesas (id) on delete cascade,
    slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
    -- A mesma lista do `FIELD_RE` de api/_lib/table-store.js (mudou um, muda o outro).
    field text not null check (field ~ '^(hp|slots|conditions|afflictions|persistent|mythic|consumed|shield|token|size|rage|psyche|energy|magus|ranger|rogue|actions|uses|companions|pet:[a-z0-9:#-]{1,80})$'),
    -- O teto real (8 KB) é conferido no handler sobre o JSON compacto.
    data jsonb not null check (octet_length(data::text) <= 12288),
    -- Milissegundos, como o `updatedAt` que o cliente já conhece. É também o que
    -- ordena as transmissões: o cliente ignora uma mais velha que a que já tem.
    updated_at bigint not null,
    updated_by uuid references auth.users (id) on delete set null,
    primary key (mesa, slug, field)
);

alter table public.character_state enable row level security;
grant select, insert, update, delete on public.character_state to service_role;

create function public.broadcast_character_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.send(
        jsonb_build_object(
            'slug', new.slug,
            'field', new.field,
            'data', new.data,
            'updatedAt', new.updated_at,
            'by', new.updated_by
        ),
        'state',
        'mesa:' || new.mesa || ':state',
        true
    );
    return null;
end
$$;

revoke all on function public.broadcast_character_state() from public, anon, authenticated;

create trigger character_state_broadcast
    after insert or update on public.character_state
    for each row execute function public.broadcast_character_state();

-- Canais privados do Realtime: só quem se registrou na mesa (`mesa_members`,
-- feito pela sessão anônima ao abrir o app) ouve `mesa:<mesa>:…`. Ninguém
-- TRANSMITE por eles daqui — não há política de insert; quem transmite é o
-- banco, pelo trigger.
create policy "membros ouvem os canais da mesa" on realtime.messages
    for select to authenticated
    using (
        exists (
            select 1 from public.mesa_members mm
            where mm.user_id = (select auth.uid())
              and (select realtime.topic()) like 'mesa:' || mm.mesa || ':%'
        )
    );

-- O Redis expirava o personagem 180 dias depois da última escrita: ficha de
-- teste não acumula para sempre. Mesma regra, por personagem inteiro.
select cron.schedule(
    'limpar-estado-abandonado',
    '51 7 * * *',
    $$
    delete from public.character_state c
    using (
        select mesa, slug from public.character_state
        group by mesa, slug
        having max(updated_at) < (extract(epoch from now() - interval '180 days') * 1000)
    ) old
    where c.mesa = old.mesa and c.slug = old.slug
    $$
);
