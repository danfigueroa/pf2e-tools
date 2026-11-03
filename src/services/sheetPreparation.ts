// O preparo de uma publicação, conduzido por ESTE aparelho (ver `api/_lib/sheet-draft.js`): chama
// `draft-step` em laço até a ficha ser promovida. O estado mora no servidor, então o laço é só um
// motor: fechar a aba e voltar, ou outro aparelho continuar, retoma de onde parou.
//
// Um laço por ficha na aba inteira (`runs`), independente de quem o mostra: fechar o diálogo de
// preparo não para nada — o laço segue enquanto a aba estiver aberta, e o diálogo reaberto (o
// cartão "Em preparo" da Ficha Virtual) só volta a assinar. Falha da IA ou da rede nunca encerra: o
// laço espera o que o servidor mandar (`retryIn`) e tenta de novo (decisão do usuário).

import { useSyncExternalStore } from 'react'
import {
    SheetApiError,
    stepDraft,
    type DraftWaitReason,
    type PublishedSheet,
    type SheetDraft,
} from './sheets'

export type PreparationPhase = 'working' | 'waiting' | 'error' | 'ready' | 'gone'

export interface PreparationView {
    phase: PreparationPhase
    draft: SheetDraft | null
    /** Por que espera (só em `waiting`). */
    reason: DraftWaitReason | null
    /** Quando tenta de novo (ms, relógio deste aparelho). */
    retryAt: number | null
    error: string | null
    /** A ficha da mesa, quando promovida. */
    sheet: PublishedSheet | null
}

interface Run {
    slug: string
    view: PreparationView
    active: boolean
    /** Acorda a espera em curso (parar o laço). */
    wake: (() => void) | null
}

const runs = new Map<string, Run>()
const listeners = new Map<string, Set<() => void>>()
/** Quem quer saber que um preparo daqui terminou (promovido ou sumiu): a lista de fichas relê. */
const finishedListeners = new Set<(slug: string) => void>()
const notify = (slug: string) => listeners.get(slug)?.forEach((l) => l())
const MAX_WAIT_MS = 130_000
const NETWORK_WAIT_MS = [5_000, 10_000, 30_000, 60_000]

const initial = (draft: SheetDraft | null): PreparationView => ({
    phase: 'working', draft, reason: null, retryAt: null, error: null, sheet: null,
})

function emit(run: Run, next: Partial<PreparationView>) {
    run.view = { ...run.view, ...next }
    notify(run.slug)
    if (next.phase === 'ready' || next.phase === 'gone') finishedListeners.forEach((l) => l(run.slug))
}

/** Avisa quando um preparo conduzido NESTA aba termina. Devolve quem para de ouvir. */
export function onPreparationFinished(listener: (slug: string) => void): () => void {
    finishedListeners.add(listener)
    return () => { finishedListeners.delete(listener) }
}

/** Espera `ms` ou até o laço ser parado. */
const sleep = (ms: number, run: Run) => new Promise<void>((resolve) => {
    const t = setTimeout(() => { run.wake = null; resolve() }, ms)
    run.wake = () => { clearTimeout(t); run.wake = null; resolve() }
})

async function loop(slug: string, run: Run) {
    let networkFails = 0
    while (run.active) {
        let r
        try {
            r = await stepDraft(slug)
            networkFails = 0
        } catch (e) {
            const status = e instanceof SheetApiError ? e.status : 0
            // Sem resposta, 5xx (o 504 de uma função que passou do tempo) e 429: passageiro, tenta de novo.
            if (status === 0 || status >= 500 || status === 429) {
                const ms = NETWORK_WAIT_MS[Math.min(networkFails++, NETWORK_WAIT_MS.length - 1)]
                emit(run, { phase: 'waiting', reason: 'network', retryAt: Date.now() + ms, error: null })
                await sleep(ms, run)
                continue
            }
            emit(run, { phase: 'error', error: e instanceof Error ? e.message : String(e), reason: null, retryAt: null })
            run.active = false
            return
        }
        const draft = 'draft' in r && r.draft ? r.draft : run.view.draft
        if (r.state === 'ready') {
            emit(run, { phase: 'ready', sheet: r.sheet, reason: null, retryAt: null, error: null })
            run.active = false
            return
        }
        if (r.state === 'gone') {
            emit(run, { phase: 'gone', reason: null, retryAt: null })
            run.active = false
            return
        }
        if (r.state === 'error') {
            emit(run, { phase: 'error', draft, error: r.error, reason: null, retryAt: null })
            run.active = false
            return
        }
        if (r.state === 'working') {
            emit(run, { phase: 'working', draft, reason: null, retryAt: null, error: null })
            continue
        }
        // `waiting` (a IA/AON não avançou) ou `busy` (outra aba no mesmo rascunho).
        const ms = Math.min(Math.max(r.retryIn ?? 15_000, 1_000), MAX_WAIT_MS)
        const reason: DraftWaitReason = r.state === 'busy' ? 'busy' : (draft?.progress.waiting ?? 'translation')
        emit(run, { phase: 'waiting', draft, reason, retryAt: Date.now() + ms, error: null })
        await sleep(ms, run)
    }
}

/**
 * Começa (ou retoma) o preparo de `slug` neste aparelho. Já rodando, não faz nada; depois de um
 * erro, recomeça (é o "Tentar de novo").
 */
export function startPreparation(slug: string, draft: SheetDraft | null = null) {
    const existing = runs.get(slug)
    if (existing?.active) return
    const run: Run = { slug, view: initial(draft ?? existing?.view.draft ?? null), active: true, wake: null }
    runs.set(slug, run)
    notify(slug)
    void loop(slug, run)
}

/** Para o laço (ao descartar o rascunho). */
export function stopPreparation(slug: string) {
    const run = runs.get(slug)
    if (!run) return
    run.active = false
    run.wake?.()
    runs.delete(slug)
    notify(slug)
}

/** Este aparelho está conduzindo o preparo de `slug`? */
export const isPreparing = (slug: string) => !!runs.get(slug)?.active

/** O andamento do preparo de `slug` neste aparelho (`null` = não está rodando aqui). */
export function usePreparation(slug: string | null): PreparationView | null {
    return useSyncExternalStore(
        (listener) => {
            if (!slug) return () => {}
            let set = listeners.get(slug)
            if (!set) listeners.set(slug, (set = new Set()))
            set.add(listener)
            return () => { set.delete(listener) }
        },
        () => (slug ? runs.get(slug)?.view ?? null : null),
    )
}
