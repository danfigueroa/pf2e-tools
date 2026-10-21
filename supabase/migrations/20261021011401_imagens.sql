-- Fase 6: imagens (mapas e tokens) no Supabase Storage, no lugar do Vercel Blob.
--
-- Um bucket PÚBLICO só, com as três pastas de sempre — o caminho de cada arquivo
-- é o MESMO que ele tinha no Blob (`tokens/thalos-AbC123.webp`). É o que deixa o
-- cliente traduzir uma URL antiga do Blob para a do Storage sem tabela de
-- tradução, inclusive as que só existem no `localStorage` dos encontros da
-- Iniciativa.
--   tokens/    token de PERSONAGEM (e de companheiro): permanente
--   maps/      a imagem de um mapa: some quando o mapa é apagado
--   monsters/  token de monstro: é do mapa e some com ele
--
-- O navegador ENVIA direto (sem passar pela função, que esbarraria no limite de
-- 4,5 MB do corpo), com a sessão anônima: a regra abaixo só aceita as três
-- pastas, só quem está registrado numa mesa, e só arquivo novo — não há política
-- de update nem de delete, então ninguém sobrescreve nem apaga a imagem de
-- outro. Apagar é do servidor (chave secreta), com a trava de sempre: `tokens/`
-- nunca sai junto com um mapa.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 8388608, array['image/webp', 'image/png', 'image/jpeg']);

create policy "membros enviam imagens" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'images'
        and (storage.foldername(name))[1] in ('tokens', 'maps', 'monsters')
        and name ~ '^(tokens|maps|monsters)/[a-z0-9-]{1,120}\.(webp|png|jpe?g)$'
        and exists (select 1 from public.mesa_members mm where mm.user_id = (select auth.uid()))
    );
