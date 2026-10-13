// Imagens do mapa de combate: o mapa em si e os tokens.
//
// Toda imagem é REDUZIDA no navegador antes de subir. Um mapa exportado de
// outro VTT chega fácil a 20 MB de PNG; reduzido para 4096 px em WebP fica na
// casa de 1–2 MB, que é o que cada jogador baixa no celular ao abrir o mapa.
//
// A subida vai direto do navegador para o Vercel Blob (o servidor só assina o
// pedido): passar o arquivo pela função esbarraria no limite de 4,5 MB do corpo.
// Sem Blob configurado a imagem fica no IndexedDB deste aparelho, com uma URL
// `idb:<chave>` — os outros veem o grid e as iniciais, como o resto do app
// funciona sem Redis.

import { useEffect, useState } from 'react'
import { deleteBlobImage, isBlobReady } from './maps'

export const MAP_MAX_SIDE = 4096
export const TOKEN_MAX_SIDE = 256

export interface ShrunkImage {
    blob: Blob
    width: number
    height: number
    /** Largura do arquivo ORIGINAL — o mapa usa para estimar quantos quadrados ele tem. */
    sourceWidth: number
}

/**
 * Reduz para caber em `maxSide` e recodifica. `square` recorta o centro num
 * quadrado — é o que vira o círculo do token.
 */
export async function shrinkImage(file: Blob, maxSide: number, square = false): Promise<ShrunkImage> {
    const bitmap = await decode(file)
    try {
        const { w: bw, h: bh } = dims(bitmap)
        const side = Math.min(bw, bh)
        const sx = square ? (bw - side) / 2 : 0
        const sy = square ? (bh - side) / 2 : 0
        const sw = square ? side : bw
        const sh = square ? side : bh
        const scale = Math.min(1, maxSide / Math.max(sw, sh))
        const width = Math.max(1, Math.round(sw * scale))
        const height = Math.max(1, Math.round(sh * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new ImageError('Este navegador não consegue reduzir a imagem.')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)

        // Safari não codifica WebP e devolve PNG calado — que seria MAIOR que o
        // original. Nesse caso, JPEG.
        let blob = await toBlob(canvas, 'image/webp', 0.85)
        if (blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85)
        return { blob, width, height, sourceWidth: bw }
    } finally {
        if ('close' in bitmap) bitmap.close()
    }
}

/** Erro com texto para a pessoa — o que aparece no aviso quando o envio falha. */
export class ImageError extends Error {}

type Decoded = ImageBitmap | HTMLImageElement

/**
 * Abre a imagem. `createImageBitmap` é o caminho rápido, mas há navegador que
 * o recusa para certos arquivos (PNG muito grande no Safari, JPEG com perfil de
 * cor exótico); aí tenta pelo `<img>`, que decodifica quase tudo que o
 * navegador consegue mostrar.
 */
async function decode(file: Blob): Promise<Decoded> {
    try {
        return await createImageBitmap(file)
    } catch {
        const url = URL.createObjectURL(file)
        try {
            const img = new Image()
            img.src = url
            await img.decode()
            if (!img.naturalWidth) throw new Error('vazia')
            return img
        } catch {
            throw new ImageError('Não deu para abrir esta imagem. Use PNG, JPG ou WebP.')
        } finally {
            URL.revokeObjectURL(url)
        }
    }
}

const dims = (d: Decoded) => ('naturalWidth' in d
    ? { w: d.naturalWidth, h: d.naturalHeight }
    : { w: d.width, h: d.height })

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao codificar a imagem'))), type, quality)
    })
}

const extOf = (type: string) => (type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg')

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'imagem'

/**
 * Onde cada imagem mora no Blob, pelo tempo que ela vive:
 * - `tokens/`   — token de PERSONAGEM: permanente, vale em todos os mapas;
 * - `maps/`     — a imagem de um mapa: some quando o mapa é apagado;
 * - `monsters/` — token de monstro: é do encontro de um mapa e some com ele.
 */
export type ImageFolder = 'tokens' | 'maps' | 'monsters'

/**
 * Sobe a imagem já reduzida e devolve a URL pública (ou `idb:` sem Blob).
 * O servidor só aceita as três pastas acima.
 */
export async function uploadImage(blob: Blob, folder: ImageFolder, name: string): Promise<string> {
    if (!(await isBlobReady())) return saveLocal(blob)
    // Import dinâmico: o cliente do Blob só pesa para quem de fato envia imagem.
    const { upload } = await import('@vercel/blob/client')
    try {
        const result = await upload(`${folder}/${slugify(name)}.${extOf(blob.type)}`, blob, {
            access: 'public',
            handleUploadUrl: '/api/state?blob=1',
            contentType: blob.type,
        })
        return result.url
    } catch (error) {
        // A mensagem crua do SDK vai junto: é ela que diz se foi o token, a
        // rede ou o tipo do arquivo.
        const detail = error instanceof Error ? error.message : String(error)
        throw new ImageError(`O envio falhou: ${detail}`)
    }
}

/** Texto do erro para mostrar a quem enviou. */
export const imageErrorText = (error: unknown) =>
    error instanceof ImageError ? error.message : 'Não foi possível enviar a imagem.'

/** Imagem que deixou de ser usada. */
export async function deleteImage(url: string | null | undefined): Promise<void> {
    if (!url) return
    if (url.startsWith('idb:')) return deleteLocal(url.slice(4))
    await deleteBlobImage(url)
}

export const isLocalImage = (url: string | null | undefined) => !!url?.startsWith('idb:')

// --- IndexedDB (sem Blob) -----------------------------------------------------

const DB_NAME = 'pf2e-images'
const STORE = 'images'

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

async function saveLocal(blob: Blob): Promise<string> {
    const key = crypto.randomUUID()
    await tx('readwrite', (s) => s.put(blob, key))
    return `idb:${key}`
}

async function deleteLocal(key: string): Promise<void> {
    objectUrls.delete(key)
    await tx('readwrite', (s) => s.delete(key)).catch(() => {})
}

// Uma object URL por chave durante a sessão: dez tokens com a mesma imagem
// não viram dez cópias do blob na memória.
const objectUrls = new Map<string, Promise<string | null>>()

function resolveLocal(key: string): Promise<string | null> {
    let p = objectUrls.get(key)
    if (!p) {
        p = tx<Blob | undefined>('readonly', (s) => s.get(key))
            .then((blob) => (blob ? URL.createObjectURL(blob) : null))
            .catch(() => null)
        objectUrls.set(key, p)
    }
    return p
}

/**
 * URL pronta para `<img src>`. Imagem `idb:` que não está neste aparelho
 * resolve para `null` — quem desenha cai nas iniciais.
 */
export function useImageUrl(url: string | null | undefined): string | null {
    const local = url?.startsWith('idb:') ? url.slice(4) : null
    const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null)

    useEffect(() => {
        if (!local) return
        let alive = true
        void resolveLocal(local).then((u) => { if (alive) setResolved({ key: local, url: u }) })
        return () => { alive = false }
    }, [local])

    if (!url) return null
    if (!local) return url
    return resolved?.key === local ? resolved.url : null
}
