// O encontro na nuvem: o GM monta no computador e abre no tablet.
//
// O `localStorage` continua sendo a primeira pintura e o encontro sem rede; a
// nuvem é a cópia que viaja. Quem vence quando os dois divergem não depende do
// relógio de nenhum aparelho, só de duas marcas guardadas por encontro
// (`EncounterSync`): o `updatedAt` da nuvem que este aparelho viu por último e
// se ele mexeu desde então.
//
//   nuvem vazia                   → sobe o daqui (se houver o que subir)
//   nuvem = a que eu vi, sem mexer → nada a fazer
//   nuvem = a que eu vi, mexi      → sobe o daqui
//   nuvem mudou, sem mexer         → baixa a da nuvem
//   nuvem mudou E eu mexi          → baixa a da nuvem e oferece "Desfazer" com
//                                    a daqui (o encontro de antes da nuvem cai
//                                    aqui: ainda não tinha subido)
//
// Depois da conferência, cada mudança sobe sozinha (800 ms de junção), e a de
// outro aparelho chega pelo aviso do banco (canal `encounters`) e é relida. A
// edição daqui ainda na fila vence o aviso, como no estado da mesa.
//
// É um efeito que lê a NUVEM e escreve no estado LOCAL (e vice-versa) — não o
// laço proibido de "efeito lê a mesa e escreve na mesa": o que sobe nunca volta
// como mudança, porque a versão baixada vira a referência (`lastJson`).

import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import type { EncounterAction } from './encounterReducer'
import type { EncounterState } from './types'
import { loadEncounterSync, sanitizeEncounter, saveEncounter, saveEncounterSync } from './encounterStorage'
import { fetchCloudEncounter, listenEncounters, pushCloudEncounter } from '../../services/encounters'
import { currentUserId } from '../../services/supabase'

/** `local`: sem nuvem (sem banco, ou ainda não deu para saber). */
export type CloudStatus = 'local' | 'saving' | 'saved' | 'offline'

const PUSH_DELAY = 800

const isEmpty = (s: EncounterState) => s.combatants.length === 0 && s.round === 0

/** O `jsonb` reordena as chaves: comparar o que veio da nuvem exige forma canônica. */
const canonical = (value: unknown): string => JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : v)

interface Sync {
    mapId: string | null
    /** Já conferiu com a nuvem: a partir daqui as mudanças sobem. */
    ready: boolean
    /** O encontro que a nuvem tem (ou o de partida, antes da conferência). */
    lastJson: string
    timer: ReturnType<typeof setTimeout> | null
    /** O que o timer vai subir, e para qual mapa — a página pode trocar de mapa no meio. */
    pending: { mapId: string | null; state: EncounterState } | null
    inFlight: boolean
    /** Aviso de outro aparelho que chegou com uma subida em andamento. */
    noticeAt: number
    reconciling: boolean
    again: boolean
}

export function useEncounterCloud(
    mapId: string | null,
    state: EncounterState,
    dispatch: Dispatch<EncounterAction>,
    /** A nuvem venceu um encontro daqui que tinha mudanças: quem chama oferece o "Desfazer". */
    onReplaced: (previous: EncounterState, mapId: string | null) => void,
): CloudStatus {
    const [status, setStatus] = useState<CloudStatus>('local')
    const stateRef = useRef(state)
    stateRef.current = state
    const replacedRef = useRef(onReplaced)
    replacedRef.current = onReplaced
    // `push` precisa reconferir quando outro aparelho gravou no meio, e `reconcile` chama `push`.
    const reconcileRef = useRef<(target: string | null) => Promise<void>>(async () => {})
    const sync = useRef<Sync>({
        mapId, ready: false, lastJson: JSON.stringify(state), timer: null, pending: null,
        inFlight: false, noticeAt: 0, reconciling: false, again: false,
    })

    const push = useCallback(async (target: string | null, snapshot: EncounterState) => {
        const s = sync.current
        const json = JSON.stringify(snapshot)
        s.inFlight = true
        if (s.mapId === target) setStatus('saving')
        const updatedAt = await pushCloudEncounter(target, snapshot)
        s.inFlight = false
        if (updatedAt === null) {
            // Continua marcado como mexido: sobe na próxima mudança ou reconexão.
            if (s.mapId === target) setStatus('offline')
            return
        }
        const current = s.mapId === target ? JSON.stringify(stateRef.current) : json
        // A marca "igual à nuvem" só vale junto do encontro que ela descreve: a página grava o
        // `localStorage` com 300 ms de junção, e um recarregar no meio deixaria os dois desencontrados.
        if (current === json) saveEncounter(snapshot, target)
        saveEncounterSync(target, { cloudAt: updatedAt, dirty: current !== json })
        if (s.mapId !== target) return
        s.lastJson = json
        s.ready = true
        setStatus(current === json ? 'saved' : 'saving')
        // Outro aparelho gravou depois de nós: o dele é o mais novo.
        if (s.noticeAt > updatedAt) {
            s.noticeAt = 0
            void reconcileRef.current(target)
        }
    }, [])

    const flush = useCallback(() => {
        const s = sync.current
        if (!s.timer || !s.pending) return
        clearTimeout(s.timer)
        s.timer = null
        const { mapId: target, state: snapshot } = s.pending
        s.pending = null
        void push(target, snapshot)
    }, [push])

    const adopt = useCallback((target: string | null, next: EncounterState, updatedAt: number) => {
        const s = sync.current
        s.lastJson = JSON.stringify(next)
        s.ready = true
        saveEncounter(next, target)
        saveEncounterSync(target, { cloudAt: updatedAt, dirty: false })
        dispatch({ type: 'hydrate', state: next })
        setStatus('saved')
    }, [dispatch])

    const reconcile = useCallback(async (target: string | null): Promise<void> => {
        const s = sync.current
        if (s.reconciling) { s.again = true; return }
        s.reconciling = true
        try {
            const cloud = await fetchCloudEncounter(target)
            if (s.mapId !== target) return
            if (cloud === undefined) {
                if (!s.ready) setStatus('local')
                return
            }
            // Mudança daqui esperando para subir vence: ela sobe logo depois e é a mais nova.
            if (s.timer || s.inFlight) return
            const meta = loadEncounterSync(target)
            const local = stateRef.current
            const localJson = JSON.stringify(local)
            const dirty = meta.dirty || localJson !== s.lastJson
            if (cloud === null || cloud.updatedAt === meta.cloudAt) {
                // Nuvem vazia (encontro nunca subiu, ou a limpeza de 180 dias o levou) recebe o daqui.
                if (cloud === null ? !isEmpty(local) : dirty) {
                    await push(target, local)
                } else {
                    s.lastJson = localJson
                    s.ready = true
                    saveEncounter(local, target)
                    saveEncounterSync(target, { cloudAt: cloud?.updatedAt ?? 0, dirty: false })
                    setStatus('saved')
                }
                return
            }
            const next = sanitizeEncounter(cloud.state)
            if (dirty && !isEmpty(local) && canonical(local) !== canonical(next)) replacedRef.current(local, target)
            adopt(target, next, cloud.updatedAt)
        } finally {
            s.reconciling = false
            if (s.again) {
                s.again = false
                void reconcile(s.mapId)
            }
        }
    }, [adopt, push])
    reconcileRef.current = reconcile

    // Trocou de mapa (ou abriu a página): sobe o que ficou pendente do anterior e
    // confere o novo com a nuvem.
    useEffect(() => {
        const s = sync.current
        s.mapId = mapId
        s.ready = false
        s.lastJson = JSON.stringify(stateRef.current)
        void reconcile(mapId)
        return () => flush()
    }, [mapId, reconcile, flush])

    // Cada mudança daqui: marca como mexido (para valer depois de um recarregar)
    // e, já conferido, sobe com junção.
    useEffect(() => {
        const s = sync.current
        if (s.mapId !== mapId) return
        const json = JSON.stringify(state)
        if (json === s.lastJson) return
        const meta = loadEncounterSync(mapId)
        if (!meta.dirty) saveEncounterSync(mapId, { ...meta, dirty: true })
        if (!s.ready) return
        if (s.timer) clearTimeout(s.timer)
        s.pending = { mapId, state }
        setStatus('saving')
        s.timer = setTimeout(() => {
            s.timer = null
            const pending = s.pending
            s.pending = null
            if (pending) void push(pending.mapId, pending.state)
        }, PUSH_DELAY)
    }, [state, mapId, push])

    // O aviso de outro aparelho, e a releitura a cada (re)conexão.
    useEffect(() => listenEncounters((notice) => {
        const s = sync.current
        if (notice.map !== s.mapId) return
        if (notice.by && notice.by === currentUserId()) return
        if (notice.updatedAt <= loadEncounterSync(s.mapId).cloudAt) return
        if (s.inFlight) { s.noticeAt = Math.max(s.noticeAt, notice.updatedAt); return }
        void reconcile(s.mapId)
    }, (live) => {
        if (live) void reconcile(sync.current.mapId)
    }), [reconcile])

    // Aba escondida (fechar, trocar de app no tablet): não espera a junção.
    useEffect(() => {
        const onHide = () => { if (document.visibilityState === 'hidden') flush() }
        document.addEventListener('visibilitychange', onHide)
        return () => document.removeEventListener('visibilitychange', onHide)
    }, [flush])

    return status
}
