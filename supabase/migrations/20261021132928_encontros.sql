-- Encontros da Iniciativa na nuvem: o GM monta no computador e abre no tablet.
--
-- Até aqui o encontro morava só no `localStorage` de quem o montou (um por mapa,
-- mais o "Sem mapa"). Agora cada um é UMA linha, o documento inteiro, como o
-- aparelho já o guardava: o encontro muda numa ação do GM por vez, e quebrá-lo
-- em campos (como o mapa) só serviria para dois GMs editando juntos, que não é
-- como a mesa joga. A última escrita vence.
--
-- `map_key` é o id do mapa ou '' para o "Sem mapa" (chave primária não aceita
-- NULL). Apagar o mapa apaga o encontro dele (trigger abaixo).
--
-- O trigger transmite só QUE mudou (`mesa:<mesa>:encounters`, evento
-- `encounter`), não o documento: um encontro grande passaria do tamanho de uma
-- mensagem do Realtime, e quem não está com aquele encontro aberto não precisa
-- dele. Quem está, relê pela API.

create table public.encounters (
    mesa text not null references public.mesas (id) on delete cascade,
    map_key text not null check (map_key = '' or map_key ~ '^[a-z0-9]{6,16}$'),
    state jsonb not null check (octet_length(state::text) <= 262144),
    -- Milissegundos, do servidor.
    updated_at bigint not null,
    updated_by uuid references auth.users (id) on delete set null,
    primary key (mesa, map_key)
);

alter table public.encounters enable row level security;
grant select, insert, update, delete on public.encounters to service_role;

create function public.broadcast_encounter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.send(
        jsonb_build_object('map', new.map_key, 'updatedAt', new.updated_at, 'by', new.updated_by),
        'encounter',
        'mesa:' || new.mesa || ':encounters',
        true
    );
    return null;
end
$$;

revoke all on function public.broadcast_encounter() from public, anon, authenticated;

create trigger encounters_broadcast after insert or update on public.encounters
    for each row execute function public.broadcast_encounter();

create function public.drop_map_encounter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    delete from public.encounters where mesa = old.mesa and map_key = old.id;
    return null;
end
$$;

revoke all on function public.drop_map_encounter() from public, anon, authenticated;

create trigger maps_drop_encounter after delete on public.maps
    for each row execute function public.drop_map_encounter();

-- Encontro parado há 180 dias, como o estado de personagem.
select cron.schedule(
    'limpar-encontros',
    '23 4 * * *',
    $$ delete from public.encounters where updated_at < (extract(epoch from now() - interval '180 days') * 1000) $$
);
