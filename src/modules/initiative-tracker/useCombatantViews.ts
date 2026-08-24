import { useMemo, useRef } from 'react'
import { computeConditionModifiers } from '../character-viewer/conditions'
import type { EncounterAction } from './encounterReducer'
import type { PartyApi } from './useEncounterParty'
import type { Combatant, CombatantView, EncounterState } from './types'

/**
 * Une as duas origens de estado numa lista uniforme: o PV de um personagem vem
 * da mesa (Redis) e o de um monstro vem do próprio encontro, mas o cartão que
 * desenha os dois não precisa saber disso.
 */
export function useCombatantViews(
    state: EncounterState,
    party: PartyApi,
    dispatch: React.Dispatch<EncounterAction>,
    /** Chamado quando um combatente que tinha PV chega a zero. */
    onDowned?: (id: string) => void,
): CombatantView[] {
    // O callback vem inline da página e muda de identidade a cada render; o ref
    // mantém a lista de views estável entre renders.
    const downedRef = useRef(onDowned)
    downedRef.current = onDowned

    return useMemo(
        () => state.combatants.map((c) => buildView(c, state, party, dispatch, downedRef)),
        [state, party, dispatch],
    )
}

function buildView(
    combatant: Combatant,
    state: EncounterState,
    party: PartyApi,
    dispatch: React.Dispatch<EncounterAction>,
    onDowned: React.MutableRefObject<((id: string) => void) | undefined>,
): CombatantView {
    const isActive = state.activeId === combatant.id

    const conditions = combatant.kind === 'pc'
        ? party.get(combatant.slug).conditions
        : combatant.conditions

    const mods = computeConditionModifiers(conditions, combatant.level)

    // Drenado corta PV máximo. O máximo NUNCA é persistido: é derivado da ficha
    // e das condições a cada render, e o atual só é reclampado na exibição.
    const baseMax = combatant.kind === 'pc' ? combatant.baseMaxHp : combatant.maxHp
    const maxHp = Math.max(1, baseMax + mods.hpMaxDelta)

    const vitals = combatant.kind === 'pc'
        ? party.vitals(combatant.slug, maxHp)
        : { current: Math.min(maxHp, combatant.current), temp: combatant.temp }

    const shared = {
        combatant,
        isActive,
        current: vitals.current,
        temp: vitals.temp,
        maxHp,
        maxHpDelta: mods.hpMaxDelta,
        conditions,
        mods,
        defense: {
            resistances: combatant.resistances,
            weaknesses: combatant.weaknesses,
            immunities: combatant.immunities,
            current: vitals.current,
            temp: vitals.temp,
        },
        setDuration: (id: string, rounds: number | null) =>
            dispatch({ type: 'setDuration', id: combatant.id, conditionId: id, rounds }),
    }

    if (combatant.kind === 'pc') {
        const { slug } = combatant
        const setCondition = (id: string, value: number) => {
            party.setCondition(slug, id, value)
            if (value <= 0) dispatch({ type: 'setDuration', id: combatant.id, conditionId: id, rounds: null })
        }
        return {
            ...shared,
            applyDamage: (amount) => {
                party.applyDamage(slug, amount, maxHp)
                reportIfDowned(vitals, amount, combatant.id, onDowned)
            },
            applyHealing: (amount) => party.applyHealing(slug, amount, maxHp),
            setTemp: (amount) => party.setTemp(slug, amount, maxHp),
            setCondition,
            toggleCondition: (id) => setCondition(id, conditions[id] ? 0 : 1),
            adjustCondition: (id, delta) => setCondition(id, (conditions[id] ?? 0) + delta),
            clearConditions: () => party.clearConditions(slug),
        }
    }

    const id = combatant.id
    const setCondition = (conditionId: string, value: number) =>
        dispatch({ type: 'setNpcCondition', id, conditionId, value })

    return {
        ...shared,
        applyDamage: (amount) => {
            dispatch({ type: 'npcDamage', entries: [{ id, amount }] })
            reportIfDowned(vitals, amount, id, onDowned)
        },
        applyHealing: (amount) => dispatch({ type: 'npcHeal', entries: [{ id, amount }] }),
        setTemp: (amount) => dispatch({ type: 'npcSetTemp', id, amount }),
        setCondition,
        toggleCondition: (conditionId) => setCondition(conditionId, conditions[conditionId] ? 0 : 1),
        adjustCondition: (conditionId, delta) => setCondition(conditionId, (conditions[conditionId] ?? 0) + delta),
        clearConditions: () => {
            for (const conditionId of Object.keys(conditions)) setCondition(conditionId, 0)
        },
    }
}

/**
 * A queda a zero é detectada no ponto em que o dano é aplicado — assim vale
 * para o −/+ do cartão e para o diálogo em lote, sem observador nem efeito.
 * Os PV temporários absorvem primeiro, como na aplicação real.
 */
function reportIfDowned(
    before: { current: number; temp: number },
    amount: number,
    id: string,
    onDowned: React.MutableRefObject<((id: string) => void) | undefined>,
) {
    const dmg = Math.max(0, Math.floor(amount))
    if (before.current <= 0 || dmg <= 0) return
    if (before.current - Math.max(0, dmg - before.temp) <= 0) onDowned.current?.(id)
}
