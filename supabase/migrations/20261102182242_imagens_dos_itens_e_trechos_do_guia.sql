-- Dois campos novos no estado do personagem e a pasta das imagens de item.
--
-- `art`: a imagem que o jogador escolheu para cada arma, armadura ou item do Inventário
-- (`src/modules/character-viewer/itemArt.ts`, `{ "<w|a|e>:<nome>": url }`).
-- `guide`: os trechos que o jogador escreveu no guia "Como Jogar" (`guideNotes.ts`). Ficam no estado, e
-- não na ficha publicada, porque sobrevivem a toda publicação — a IA nunca os reescreve.
--
-- O CHECK de `field` é o da migration `nomes_dos_ataques`, procurado pela definição em vez de pelo nome.
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
    check (field ~ '^(hp|slots|conditions|afflictions|persistent|mythic|consumed|shield|token|size|rage|psyche|energy|magus|ranger|rogue|investigator|names|art|guide|actions|uses|companions|gave|pet:[a-z0-9:#-]{1,80})$');

-- Imagens dos itens: pasta `items/`, permanente como `tokens/` (é do personagem, não de um mapa), e qualquer
-- membro envia — quem escreve o campo `art` é o servidor, que confere o dono da ficha. Política à parte (as
-- permissivas somam): a de `tokens/maps/monsters` fica como está.
create policy "membros enviam imagens de item" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'images'
        and (storage.foldername(name))[1] = 'items'
        and name ~ '^items/[a-z0-9-]{1,120}\.(webp|png|jpe?g)$'
        and exists (select 1 from public.mesa_members mm where mm.user_id = (select auth.uid()))
    );
