// Imagens (mapas e tokens) no Supabase Storage — bucket público `images`, com as
// pastas `tokens/`, `maps/` e `monsters/` (migration `imagens`).
//
// O navegador envia direto (services/images.ts); o servidor só APAGA, com a
// chave secreta. Os arquivos vieram do Vercel Blob no MESMO caminho, então uma
// URL antiga do Blob (`https://<store>.public.blob.vercel-storage.com/tokens/…`)
// ainda aponta para um arquivo daqui: `imagePath` aceita as duas.

import { supabase } from './supabase.js'

export const IMAGE_BUCKET = 'images'

const BLOB_URL_RE = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(.+)$/
const PATH_RE = /^(tokens|maps|monsters)\/[A-Za-z0-9._-]{1,160}$/

/**
 * O caminho no bucket de uma URL NOSSA — do Storage deste projeto ou do Blob de
 * antes —, ou `null`. O endpoint é público: uma URL qualquer mandada aqui não
 * pode virar um DELETE em outra coisa.
 */
export function imagePath(url) {
    if (typeof url !== 'string') return null
    let path = url.match(BLOB_URL_RE)?.[1] ?? null
    const base = process.env.SUPABASE_URL
    const prefix = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/${IMAGE_BUCKET}/` : null
    if (!path && prefix && url.startsWith(prefix)) path = url.slice(prefix.length)
    if (!path) return null
    path = decodeURIComponent(path.split('?')[0])
    return PATH_RE.test(path) ? path : null
}

/**
 * Imagens que pertencem a um MAPA: a dele e as dos monstros. O token de
 * personagem (`tokens/`) é permanente e nunca sai junto com um mapa — a trava
 * fica aqui, no servidor, para valer mesmo se um token de PC aparecer por
 * engano na lista do mapa.
 */
export const isMapOwnedImage = (url) => /^(maps|monsters)\//.test(imagePath(url) ?? '')

/** Apaga do bucket as imagens destas URLs (as que forem nossas). Falha só vai para o log. */
export async function deleteImages(urls) {
    const paths = [...new Set(urls.map(imagePath).filter(Boolean))]
    const db = supabase()
    if (paths.length === 0 || !db) return
    const { error } = await db.storage.from(IMAGE_BUCKET).remove(paths)
    // Imagem órfã no bucket não pode impedir o mapa de sumir da lista.
    if (error) console.error('[images] Falha ao apagar:', error.message)
}
