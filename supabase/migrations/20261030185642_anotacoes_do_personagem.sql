-- Anotações do personagem (aba "Anotações" da Ficha Virtual): o background e as
-- notas de cada personagem, um documento por linha (mesa, slug).
--
-- O estado da mesa limita cada campo a 8 KB, pouco para um background longo e um
-- diário de campanha; por isso a tabela é própria, com teto de 128 KB.
-- Ler é de qualquer membro da mesa, escrever é do dono da ficha e do GM — a
-- regra mora no servidor (chave secreta), como no resto.
--
-- O trigger avisa só QUE mudou (`mesa:<mesa>:notes`), sem o texto: o aparelho
-- com aquele personagem aberto relê pela API.

create table public.character_notes (
    mesa text not null references public.mesas (id) on delete cascade,
    slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
    data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 262144),
    -- Milissegundos, do servidor.
    updated_at bigint not null,
    updated_by uuid references auth.users (id) on delete set null,
    primary key (mesa, slug)
);

alter table public.character_notes enable row level security;
grant select, insert, update, delete on public.character_notes to service_role;

create function public.broadcast_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.send(
        jsonb_build_object('slug', new.slug, 'updatedAt', new.updated_at, 'by', new.updated_by),
        'notes', 'mesa:' || new.mesa || ':notes', true);
    return null;
end
$$;

revoke all on function public.broadcast_notes() from public, anon, authenticated;

create trigger character_notes_broadcast after insert or update on public.character_notes
    for each row execute function public.broadcast_notes();
