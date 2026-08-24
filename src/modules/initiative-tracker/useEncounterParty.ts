import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    loadCharacter,
    readLocal,
    refresh as refreshCharacter,
    saveField,
    subscribeSnapshot,
} from '../../services/tableState'
import { sanitizeHp, type HpStored } from '../character-viewer/components/useHpTracker'
import {
    sanitizeConditions,
    type ConditionState,
} from '../character-viewer/components/useConditions'

export interface PartySlice {
    /** `null` = ninguém mexeu ainda; resolve para PV cheio no render. */
    hp: HpStored | null
    conditions: ConditionState
}

const EMPTY_SLICE: PartySlice = { hp: null, conditions: {} }

/**
 * PV e condições de TODOS os personagens do encontro, no estado da mesa.
 *
 * Por que não usar `useHpTracker`/`useConditions` num componente por
 * combatente, como faz a seção de companheiros da Ficha Virtual: o diálogo de
 * dano em área precisa **ler** PV atual, PV temporário e resistências de todos
 * os alvos para montar a prévia antes de aplicar. Com o estado preso em hooks
 * de filhos, a página só alcançaria isso por um registro imperativo de refs,
 * vazio no primeiro paint. Companheiros nunca precisaram de operação entre
 * entidades; combate precisa o tempo todo.
 *
 * Por baixo são as MESMAS primitivas que o `useSharedState` usa (`readLocal`,
 * `loadCharacter`, `subscribeSnapshot`, `saveField`) e os MESMOS campos
 * (`hp`, `conditions`) — a Ficha Virtual e o gerenciador leem e escrevem o
 * mesmo byte, sem tocar no allow-list do `table-store.js`.
 */
export function useEncounterParty(slugs: string[]) {
    // A lista chega recriada a cada render; a chave estável evita reassinar o
    // snapshot de todo mundo a cada tecla digitada na página.
    const slugKey = useMemo(() => [...new Set(slugs)].sort().join(','), [slugs])
    const uniqueSlugs = useMemo(() => (slugKey ? slugKey.split(',') : []), [slugKey])

    const [party, setParty] = useState<Record<string, PartySlice>>({})

    // Duas escritas no mesmo slug dentro do MESMO handler (dano em dois PCs de
    // uma vez) perdem uma se cada `update` ler o estado do render anterior. O
    // ref é atualizado de forma síncrona, antes do `setState` — mesma manobra
    // do `useSharedState.update`.
    const partyRef = useRef(party)
    partyRef.current = party

    const readSlice = useCallback((slug: string): PartySlice => ({
        hp: sanitizeHp(readLocal(slug, 'hp')),
        conditions: sanitizeConditions(readLocal(slug, 'conditions') ?? {}),
    }), [])

    useEffect(() => {
        if (uniqueSlugs.length === 0) return

        // Pinta o cache local na hora e só depois deixa o servidor corrigir.
        setParty((prev) => {
            const next = { ...prev }
            for (const slug of uniqueSlugs) if (!next[slug]) next[slug] = readSlice(slug)
            return next
        })

        let cancelled = false
        const apply = (slug: string, snapshot: Record<string, unknown>) => {
            if (cancelled) return
            setParty((prev) => ({
                ...prev,
                [slug]: {
                    hp: snapshot.hp === undefined ? (prev[slug]?.hp ?? null) : sanitizeHp(snapshot.hp),
                    conditions: snapshot.conditions === undefined
                        ? (prev[slug]?.conditions ?? {})
                        : sanitizeConditions(snapshot.conditions),
                },
            }))
        }

        for (const slug of uniqueSlugs) void loadCharacter(slug).then((s) => apply(slug, s))
        const unsubscribes = uniqueSlugs.map((slug) => subscribeSnapshot(slug, (s) => apply(slug, s)))

        return () => {
            cancelled = true
            unsubscribes.forEach((off) => off())
        }
    }, [uniqueSlugs, readSlice])

    /** Grava uma fatia e sobe com debounce, mantendo o ref em dia na hora. */
    const write = useCallback((slug: string, patch: Partial<PartySlice>) => {
        const current = partyRef.current[slug] ?? EMPTY_SLICE
        const next: PartySlice = { ...current, ...patch }
        partyRef.current = { ...partyRef.current, [slug]: next }
        setParty(partyRef.current)
        if (patch.hp !== undefined) saveField(slug, 'hp', next.hp)
        if (patch.conditions !== undefined) saveField(slug, 'conditions', next.conditions)
    }, [])

    const get = useCallback(
        (slug: string): PartySlice => partyRef.current[slug] ?? EMPTY_SLICE,
        [],
    )

    /** PV atuais já clampados. `maxHp` nunca é gravado — é derivado da ficha. */
    const vitals = useCallback((slug: string, maxHp: number) => {
        const stored = partyRef.current[slug]?.hp ?? null
        return {
            current: Math.min(maxHp, Math.max(0, stored?.current ?? maxHp)),
            temp: Math.max(0, stored?.temp ?? 0),
        }
    }, [])

    const api = useMemo(() => ({
        /**
         * Os dados crus. Está aqui de propósito: o resto da API lê o ref (para
         * duas escritas no mesmo handler não se perderem), então sem este campo
         * o objeto teria identidade constante e quem memoriza em cima dele
         * nunca repintaria o que chega do servidor.
         */
        snapshot: party,
        get,
        vitals,

        applyDamage(slug: string, amount: number, maxHp: number) {
            const dmg = Math.max(0, Math.floor(amount))
            if (!dmg) return
            const { current, temp } = vitals(slug, maxHp)
            const absorbed = Math.min(temp, dmg)
            write(slug, { hp: { temp: temp - absorbed, current: Math.max(0, current - (dmg - absorbed)) } })
        },

        applyHealing(slug: string, amount: number, maxHp: number) {
            const heal = Math.max(0, Math.floor(amount))
            if (!heal) return
            const { current, temp } = vitals(slug, maxHp)
            write(slug, { hp: { temp, current: Math.min(maxHp, current + heal) } })
        },

        setTemp(slug: string, amount: number, maxHp: number) {
            const { current } = vitals(slug, maxHp)
            write(slug, { hp: { current, temp: Math.max(0, Math.floor(amount)) } })
        },

        setCondition(slug: string, id: string, value: number) {
            const conditions = { ...(partyRef.current[slug]?.conditions ?? {}) }
            if (value <= 0) delete conditions[id]
            else conditions[id] = value
            write(slug, { conditions })
        },

        clearConditions(slug: string) {
            write(slug, { conditions: {} })
        },

        /** Botão "Atualizar": relê a mesa inteira do encontro. */
        async refresh() {
            await Promise.all(uniqueSlugs.map((slug) => refreshCharacter(slug)))
        },
    }), [party, get, vitals, write, uniqueSlugs])

    return api
}

export type PartyApi = ReturnType<typeof useEncounterParty>
