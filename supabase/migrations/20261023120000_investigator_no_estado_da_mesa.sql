-- Investigador: o campo `investigator` guarda, na ficha de quem investiga, as investigações
-- abertas (Pursue a Lead, até duas), as abandonadas do dia e os relógios de 10 minutos do
-- Pursue a Lead, do Clue In e do Expeditious Inspection (`src/modules/character-viewer/investigator.ts`).
--
-- O CHECK de `field` é o da migration `gave_no_estado_da_mesa`, procurado pela definição em vez
-- de pelo nome. A lista repete a do `FIELD_RE` de `api/_lib/table-store.js` — mudou um, muda o outro.

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
    check (field ~ '^(hp|slots|conditions|afflictions|persistent|mythic|consumed|shield|token|size|rage|psyche|energy|magus|ranger|rogue|investigator|actions|uses|companions|gave|pet:[a-z0-9:#-]{1,80})$');
