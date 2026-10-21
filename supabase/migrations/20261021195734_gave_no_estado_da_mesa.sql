-- Passar item entre jogadores: o campo `gave` guarda, na fatia de quem ENVIA, o que ele
-- já passou a cada colega ({ destinatário: { item: quantidade } }). Cada jogador escreve
-- só na própria fatia, então dois remetentes nunca se atropelam; quem recebe soma o que
-- aponta para ele (`api/_lib/table-store.js`, `readIncoming`).
--
-- O CHECK de `field` é o da migration `estado_da_mesa` (anônimo, nome gerado pelo
-- Postgres); procura-se pela definição em vez de apostar no nome. A lista repete a do
-- `FIELD_RE` do table-store.js — mudou um, muda o outro.

do $$
declare
    c text;
begin
    for c in
        select conname from pg_constraint
        where conrelid = 'public.character_state'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) like '%field%~%'
    loop
        execute format('alter table public.character_state drop constraint %I', c);
    end loop;
end $$;

alter table public.character_state
    add constraint character_state_field_check
    check (field ~ '^(hp|slots|conditions|afflictions|persistent|mythic|consumed|shield|token|size|rage|psyche|energy|magus|ranger|rogue|actions|uses|companions|gave|pet:[a-z0-9:#-]{1,80})$');
