// Avisos de ficha publicada (migration `aviso_de_ficha_publicada`): o banco conta,
// no canal `mesa:<mesa>:sheets`, quando uma ficha ganha versão nova (publicar ou
// restaurar) e quando o guia dela fica pronto. Só a referência viaja; a ficha é
// relida pela API (`fetchPublished`).
//
// Um canal só, aberto na primeira assinatura e mantido (mesmo motivo de
// `services/encounters.ts`: sair e entrar no mesmo tópico em seguida perdia o canal).

import { useSyncExternalStore } from 'react'
import { listenMesaChannel } from './supabase'

export interface SheetPublishedNotice {
    slug: string
    name: string
    level: number
    publishedAt: number
    /** A sessão de quem publicou (vazia quando o aparelho não mandou). */
    by: string | null
}

export type SheetNotice =
    | ({ kind: 'published' } & SheetPublishedNotice)
    | { kind: 'guide'; slug: string; publishedAt: number }

const latest = new Map<string, SheetPublishedNotice>()
const listeners = new Set<(notice: SheetNotice) => void>()
const storeListeners = new Set<() => void>()
let started = false

function start() {
    if (started) return
    started = true
    void listenMesaChannel('sheets', {
        published: (payload) => {
            const p = payload as Partial<SheetPublishedNotice> | null
            if (!p || typeof p.slug !== 'string' || typeof p.publishedAt !== 'number') return
            const notice: SheetPublishedNotice = {
                slug: p.slug,
                name: typeof p.name === 'string' ? p.name : p.slug,
                level: typeof p.level === 'number' ? p.level : 0,
                publishedAt: p.publishedAt,
                by: typeof p.by === 'string' ? p.by : null,
            }
            const known = latest.get(notice.slug)
            if (!known || known.publishedAt < notice.publishedAt) {
                latest.set(notice.slug, notice)
                storeListeners.forEach((l) => l())
            }
            listeners.forEach((l) => l({ kind: 'published', ...notice }))
        },
        guide: (payload) => {
            const p = payload as { slug?: unknown; publishedAt?: unknown } | null
            if (!p || typeof p.slug !== 'string' || typeof p.publishedAt !== 'number') return
            const notice: SheetNotice = { kind: 'guide', slug: p.slug, publishedAt: p.publishedAt }
            listeners.forEach((l) => l(notice))
        },
    }, () => {}).then((stop) => {
        // Sem Supabase: a próxima assinatura tenta de novo.
        if (!stop) started = false
    })
}

/** Ouve os avisos de ficha da mesa. Devolve quem para de ouvir. */
export function onSheetNotice(listener: (notice: SheetNotice) => void): () => void {
    listeners.add(listener)
    start()
    return () => { listeners.delete(listener) }
}

/** A versão mais nova anunciada nesta sessão para o personagem, ou `null`. */
export function useLatestPublished(slug: string): SheetPublishedNotice | null {
    return useSyncExternalStore(
        (listener) => {
            storeListeners.add(listener)
            start()
            return () => { storeListeners.delete(listener) }
        },
        () => latest.get(slug) ?? null,
        () => null,
    )
}
