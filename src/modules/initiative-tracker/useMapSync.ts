import { useEffect, useRef, useState, type Dispatch } from 'react'
import { syncTokens, useMapData, type NpcHp, type TokenDescriptor } from '../../services/maps'
import { sizeSquares } from '../battle-map/geometry'
import type { EncounterAction } from './encounterReducer'
import type { CombatantView, EncounterState } from './types'

/** Junta as mudanças de um mesmo clique (dano em área em cinco alvos) num envio só. */
const PUSH_DEBOUNCE_MS = 400

type HpPayload = Omit<NpcHp, 'updatedAt'>

const hpKey = (hp: HpPayload) => `${hp.current}/${hp.temp}/${hp.max}`

function descriptors(state: EncounterState, views: CombatantView[]): Array<TokenDescriptor & { id: string }> {
    const maxById = new Map(views.map((v) => [v.combatant.id, v.maxHp]))
    return state.combatants.map((c) => c.kind === 'pc'
        ? {
            id: c.id,
            kind: 'pc',
            name: c.name,
            slug: c.slug,
            size: sizeSquares(c.size),
            maxHp: maxById.get(c.id) ?? c.baseMaxHp,
            defeated: c.defeated || undefined,
        }
        : {
            id: c.id,
            kind: 'npc',
            name: c.name,
            size: sizeSquares(c.size),
            image: c.tokenImage,
            defeated: c.defeated || undefined,
        })
}

function npcHps(views: CombatantView[]): Map<string, HpPayload> {
    const out = new Map<string, HpPayload>()
    for (const v of views) {
        if (v.combatant.kind !== 'npc') continue
        out.set(v.combatant.id, { current: v.current, temp: v.temp, max: v.maxHp })
    }
    return out
}

/**
 * Liga o encontro ao mapa de combate dele.
 *
 * - **Quem está no mapa** é o encontro: entrou um combatente, nasce o token;
 *   saiu, o token some. ONDE o token está é do mapa — daqui nunca sai posição.
 * - **PV do monstro** anda nos dois sentidos. Daqui sobe o que mudou desde o
 *   último envio; do mapa desce o que alguém mudou lá (o GM tocou no token).
 *
 * O efeito de envio lê só o estado LOCAL e escreve só no mapa, então não
 * realimenta a si mesmo — o laço que o CLAUDE.md proíbe é o de um efeito que
 * lê a mesa e escreve na mesa. O caminho de volta compara com o último valor
 * enviado, para o eco do próprio envio não virar "alguém mexeu no mapa".
 */
export function useMapSync(
    mapId: string | null,
    state: EncounterState,
    views: CombatantView[],
    dispatch: Dispatch<EncounterAction>,
): void {
    const { data } = useMapData(mapId)

    /** Último PV enviado (ou recebido) por monstro. */
    const lastHp = useRef(new Map<string, string>())
    const lastShape = useRef('')
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pushing = useRef(false)
    /** Revisão que a escrita mais recente gerou: leitura mais velha que ela é eco atrasado. */
    const waitRev = useRef(0)
    /** O mapa cujo PV já foi conciliado com o encontro na abertura. */
    const [readyFor, setReadyFor] = useState<string | null>(null)

    const latest = useRef({ state, views })
    latest.current = { state, views }

    // Trocou de mapa: começa do zero.
    useEffect(() => {
        lastHp.current = new Map()
        lastShape.current = ''
        waitRev.current = 0
        setReadyFor(null)
        return () => {
            if (timer.current) clearTimeout(timer.current)
            timer.current = null
        }
    }, [mapId])

    // --- Do mapa para cá --------------------------------------------------------
    useEffect(() => {
        if (!mapId || !data || data.id !== mapId) return
        if (pushing.current || timer.current || data.rev < waitRev.current) return

        const opening = readyFor !== mapId
        const local = npcHps(latest.current.views)
        for (const [id, mine] of local) {
            const remote = data.hp[id]
            if (!remote) continue
            const key = hpKey(remote)
            if (key === hpKey(mine)) { lastHp.current.set(id, key); continue }
            // Na abertura o mapa vence: tudo que a Iniciativa mudou já subiu, e
            // o que difere foi dano dado no token com a Iniciativa fechada.
            // Depois, só desce o que mudou desde o último envio daqui.
            if (opening || lastHp.current.get(id) !== key) {
                lastHp.current.set(id, key)
                dispatch({ type: 'npcSetVitals', id, current: remote.current, temp: remote.temp })
            }
        }
        if (opening) setReadyFor(mapId)
    }, [mapId, data, readyFor, dispatch])

    // --- Daqui para o mapa ------------------------------------------------------
    useEffect(() => {
        if (!mapId || readyFor !== mapId) return

        const send = async () => {
            timer.current = null
            const { state: s, views: v } = latest.current
            const tokens = descriptors(s, v)
            const shape = JSON.stringify([tokens, s.activeId])
            const hp: Record<string, HpPayload> = {}
            for (const [id, value] of npcHps(v)) {
                const key = hpKey(value)
                if (lastHp.current.get(id) !== key) {
                    hp[id] = value
                    lastHp.current.set(id, key)
                }
            }
            if (shape === lastShape.current && Object.keys(hp).length === 0) return
            lastShape.current = shape
            pushing.current = true
            try {
                waitRev.current = await syncTokens(mapId, tokens, s.activeId, hp)
            } catch {
                // Falhou: esquece o que achava ter enviado, para a próxima mudança levar tudo.
                lastShape.current = ''
                for (const id of Object.keys(hp)) lastHp.current.delete(id)
            } finally {
                pushing.current = false
            }
        }

        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { void send() }, PUSH_DEBOUNCE_MS)
    }, [mapId, readyFor, state, views])
}
