-- Campo novo no estado do personagem: `money`, o dinheiro que o jogador acerta na mesa
-- (`src/modules/character-viewer/money.ts`, `{ "purse": {pp,gp,sp,cp}, "of": {pp,gp,sp,cp} }`). O JSON do
-- Pathbuilder não é editado; `of` guarda o dinheiro da ficha sobre o qual a edição foi feita.
--
-- O CHECK de `field` é procurado pela definição em vez de pelo nome, como na `imagens_dos_itens_e_trechos_do_guia`.
-- A lista repete a do `FIELD_RE` de `api/_lib/table-store.js` — mudou um, muda o outro.

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
    check (field ~ '^(hp|slots|conditions|afflictions|persistent|mythic|consumed|shield|token|size|rage|psyche|energy|magus|ranger|rogue|investigator|names|art|guide|actions|uses|companions|gave|money|pet:[a-z0-9:#-]{1,80})$');
