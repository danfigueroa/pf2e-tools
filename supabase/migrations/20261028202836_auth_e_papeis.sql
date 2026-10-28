-- Login, papéis e donos de ficha — PARTE ADITIVA.
--
-- Esta migration não tira nada de ninguém: o cliente antigo (sessão anônima, upsert
-- direto em `mesa_members`) segue funcionando até o cutover. O que ela já faz:
--   · dá um papel (`role`) e um nome a cada membro;
--   · cria os convites, que passam a ser o único caminho de entrada na mesa;
--   · dá a cada ficha publicada um dono (`owner_id`, nulo = só o GM mexe);
--   · impede que o aparelho promova a si mesmo (a coluna `role` só o servidor escreve).
-- O fechamento da escrita direta em `mesa_members` vem numa migration à parte, no
-- cutover (docs no plano: "Rollout", passo 6) — fazê-lo agora derrubaria o Realtime
-- dos aparelhos que ainda não têm o app novo.

alter table public.mesa_members
    add column role text not null default 'player' check (role in ('player', 'gm')),
    add column display_name text check (display_name is null or char_length(display_name) between 1 and 40);

-- `grant insert, update` da fundação valia para TODAS as colunas: com a coluna nova,
-- qualquer membro poderia gravar `role = 'gm'` na própria linha. Passa a valer só o
-- que o cliente de fato envia (o upsert do `joinMesa`: mesa, user_id, last_seen).
revoke insert, update on public.mesa_members from authenticated;
grant insert (mesa, user_id, last_seen), update (mesa, user_id, last_seen)
    on public.mesa_members to authenticated;

-- Convites: o GM gera um código, quem o resgata vira membro com o papel do convite.
create table public.mesa_invites (
    code text primary key check (code ~ '^[A-Za-z0-9]{8,32}$'),
    mesa text not null references public.mesas (id) on delete cascade,
    role text not null default 'player' check (role in ('player', 'gm')),
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    max_uses integer not null default 1 check (max_uses between 1 and 50),
    uses integer not null default 0 check (uses >= 0),
    revoked boolean not null default false
);

create index mesa_invites_mesa_idx on public.mesa_invites (mesa);

alter table public.mesa_invites enable row level security;
grant select, insert, update, delete on public.mesa_invites to service_role;

-- Resgate atômico: a linha do convite fica travada, então dois usos simultâneos de um
-- convite de uso único não passam os dois. Devolve a linha da mesa/papel de quem
-- entrou — ou NADA, se o código não existe, venceu, foi revogado ou esgotou. Quem já é
-- membro não consome o convite (abrir o mesmo link duas vezes é inofensivo).
create function public.accept_invite(p_code text, p_user uuid)
returns table (o_mesa text, o_role text)
language plpgsql
set search_path = ''
as $$
declare
    inv public.mesa_invites%rowtype;
    mine public.mesa_members%rowtype;
begin
    select * into inv from public.mesa_invites where code = p_code for update;
    if not found or inv.revoked or inv.expires_at < now() then
        return;
    end if;

    select * into mine from public.mesa_members where mesa = inv.mesa and user_id = p_user;
    if found then
        return query select mine.mesa, mine.role;
        return;
    end if;

    if inv.uses >= inv.max_uses then
        return;
    end if;

    update public.mesa_invites set uses = uses + 1 where code = p_code;
    insert into public.mesa_members (mesa, user_id, role) values (inv.mesa, p_user, inv.role);
    return query select inv.mesa, inv.role;
end;
$$;

revoke all on function public.accept_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_invite(text, uuid) to service_role;

-- Dono da ficha publicada. Nulo = sem dono (as já publicadas nascem assim): só o GM
-- mexe até atribuí-la a alguém. O `published_by` continua sendo quem publicou por
-- último — autoria, não permissão.
alter table public.sheets
    add column owner_id uuid references auth.users (id) on delete set null;

create index sheets_owner_id_idx on public.sheets (owner_id);
