import { useMemo, useRef } from 'react'
import {
    applySave,
    advanceStage,
    mergeAfflictionConditions,
    stageDamage,
    type AfflictionState,
    type SaveDegree,
} from './afflictions'
import { computeDamage } from './damage'
import { rollFormula } from './dice'
import { computeConditionModifiers } from '../character-viewer/conditions'
import type { PersistentDamage } from './persistentDamage'
import type { EncounterAction } from './encounterReducer'
import type { PartyApi } from './useEncounterParty'
import type { Combatant, CombatantView, EncounterState, TargetDefense } from './types'

/**
 * Um dano que o app aplicou SOZINHO — o do estágio de uma aflição ou o
 * persistente do fim do turno. Vai para a página, que junta tudo num aviso só
 * com "Desfazer": nada que o GM não pediu acontece sem ele poder voltar atrás.
 */
export interface AutoDamage {
    combatantId: string
    name: string
    /** De onde veio: "Giant Centipede Venom · estágio 2", "Dano persistente". */
    source: string
    rolls: Array<{ formula: string; rolled: number; type: string; final: number; immune: boolean }>
    /** O que efetivamente saiu do PV, já com fraqueza e resistência. */
    total: number
    undo: () => void
}

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
    /** Chamado quando o app aplica dano por conta própria (aflição). */
    onAutoDamage?: (event: AutoDamage) => void,
): CombatantView[] {
    // Os callbacks vêm inline da página e mudam de identidade a cada render; os
    // refs mantêm a lista de views estável entre renders.
    const downedRef = useRef(onDowned)
    downedRef.current = onDowned
    const autoRef = useRef(onAutoDamage)
    autoRef.current = onAutoDamage

    return useMemo(
        () => state.combatants.map((c) => buildView(c, state, party, dispatch, downedRef, autoRef)),
        [state, party, dispatch],
    )
}

/**
 * Rola as parcelas de dano, passa cada uma pelas defesas e devolve o evento
 * pronto — sem aplicar nada. Quem aplica é o chamador, que sabe se ainda tem o
 * que aplicar (`total > 0`) e como desfazer.
 *
 * O dano PERSISTENTE fica de fora aqui: ele não é um golpe único, vira uma
 * entrada própria na lista de dano persistente (ver `persistentDamage.ts`).
 */
export function rollDamage(
    entries: Array<{ formula: string; type: string }>,
    defense: TargetDefense,
): { rolls: AutoDamage['rolls']; total: number } {
    const rolls: AutoDamage['rolls'] = []
    let total = 0
    for (const entry of entries) {
        const rolled = rollFormula(entry.formula)
        // `outcome: 'none'` — dano persistente e dano de estágio não têm
        // salvaguarda para dividir: a salvaguarda da aflição é a de ESTÁGIO,
        // que move o estágio em vez de reduzir o dano.
        const b = computeDamage({ amount: rolled, type: entry.type, outcome: 'none' }, defense)
        total += b.final
        rolls.push({ formula: entry.formula, rolled, type: entry.type, final: b.final, immune: b.immune })
    }
    return { rolls, total }
}

function buildView(
    combatant: Combatant,
    state: EncounterState,
    party: PartyApi,
    dispatch: React.Dispatch<EncounterAction>,
    onDowned: React.MutableRefObject<((id: string) => void) | undefined>,
    onAutoDamage: React.MutableRefObject<((event: AutoDamage) => void) | undefined>,
): CombatantView {
    const isActive = state.activeId === combatant.id
    // As duas origens, lidas uma vez: o personagem tem uma fatia na mesa, o
    // monstro carrega o próprio estado dentro do encontro.
    const slice = combatant.kind === 'pc' ? party.get(combatant.slug) : null
    const npc = combatant.kind === 'npc' ? combatant : null

    const afflictions = slice ? slice.afflictions : (npc?.afflictions ?? [])
    const persistent = slice ? slice.persistent : (npc?.persistent ?? [])

    // `stored` é o que alguém marcou à mão; `conditions` é o que VALE, já com as
    // condições derivadas do estágio da aflição. Os setters mexem no `stored`,
    // senão desmarcar um Enfraquecido que veio do veneno gravaria uma remoção
    // de algo que nunca foi gravado.
    const stored = slice ? slice.conditions : (npc?.conditions ?? {})
    const conditions = mergeAfflictionConditions(stored, afflictions)

    const mods = computeConditionModifiers(conditions, combatant.level)

    // Drenado corta PV máximo. O máximo NUNCA é persistido: é derivado da ficha
    // e das condições a cada render, e o atual só é reclampado na exibição.
    const baseMax = combatant.kind === 'pc' ? combatant.baseMaxHp : combatant.maxHp
    const maxHp = Math.max(1, baseMax + mods.hpMaxDelta)

    const vitals = combatant.kind === 'pc'
        ? party.vitals(combatant.slug, maxHp)
        : { current: Math.min(maxHp, combatant.current), temp: combatant.temp }

    const defense: TargetDefense = {
        resistances: combatant.resistances,
        weaknesses: combatant.weaknesses,
        immunities: combatant.immunities,
        current: vitals.current,
        temp: vitals.temp,
    }

    const shared = {
        combatant,
        isActive,
        current: vitals.current,
        temp: vitals.temp,
        maxHp,
        maxHpDelta: mods.hpMaxDelta,
        conditions,
        afflictions,
        persistent,
        mods,
        defense,
        setDuration: (id: string, rounds: number | null) =>
            dispatch({ type: 'setDuration', id: combatant.id, conditionId: id, rounds }),
    }

    // As duas origens de estado, atrás da mesma assinatura. Daqui para baixo o
    // resto da view não sabe mais de onde o PV vem.
    const core = combatant.kind === 'pc'
        ? pcCore(combatant, party, dispatch, maxHp, vitals, stored, onDowned)
        : npcCore(combatant, dispatch, vitals, stored, onDowned)

    const applyTypedDamage = (amount: number, type: string) => {
        const breakdown = computeDamage({ amount, type, outcome: 'none' }, defense)
        if (breakdown.final > 0) core.applyDamage(breakdown.final)
        return breakdown
    }

    /**
     * Dano do estágio em que a aflição ACABOU de entrar.
     *
     * RAW (Player Core, Aflições): os efeitos de um estágio valem quando a
     * criatura entra nele — e um sucesso na salvaguarda também é entrar num
     * estágio, o anterior. Por isso a condição é a mudança de número, nos dois
     * sentidos, e não "piorou". Estágio que não mudou (o sucesso simples de uma
     * aflição virulenta, que só conta para a sequência) não causa dano nenhum.
     *
     * O dano PERSISTENTE escrito no estágio não entra aqui: ele vira entrada na
     * lista de dano persistente, montada por `syncFromAffliction`.
     */
    const enterStage = (before: AfflictionState, after: AfflictionState | null) => {
        if (!after || after.stage === before.stage) return
        const entries = stageDamage(after).filter((e) => !e.persistent)
        if (entries.length === 0) return

        const { rolls, total } = rollDamage(entries, defense)
        if (total > 0) core.applyDamage(total)
        onAutoDamage.current?.({
            combatantId: combatant.id,
            name: combatant.name,
            source: `${after.def.name} · estágio ${after.stage}`,
            rolls,
            total,
            undo: () => core.setVitals(vitals.current, vitals.temp),
        })
    }

    return {
        ...shared,
        ...core,
        applyTypedDamage,
        setPersistent: core.setPersistent,

        addAffliction: (affliction) => {
            core.addAffliction(affliction)
            // Aplicar a aflição já É entrar no primeiro estágio dela: o dano do
            // estágio cai agora, junto com as condições.
            enterStage({ ...affliction, stage: 0 }, affliction)
        },
        removeAffliction: (afflictionId) => core.removeAffliction(afflictionId),
        // O estado muda primeiro e o dano vem depois: as duas escritas caem no
        // mesmo handler, e nessa ordem o "Desfazer" do dano não desfaz o estágio.
        saveAffliction: (afflictionId, degree: SaveDegree) => {
            const before = afflictions.find((a: AfflictionState) => a.id === afflictionId)
            core.saveAffliction(afflictionId, degree)
            if (before) enterStage(before, applySave(before, degree))
        },
        advanceAffliction: (afflictionId, by: number) => {
            const before = afflictions.find((a: AfflictionState) => a.id === afflictionId)
            core.advanceAffliction(afflictionId, by)
            if (before) enterStage(before, advanceStage(before, by))
        },
    }
}

/** O lado do PERSONAGEM: tudo passa pelo estado da mesa (Redis). */
function pcCore(
    combatant: Extract<Combatant, { kind: 'pc' }>,
    party: PartyApi,
    dispatch: React.Dispatch<EncounterAction>,
    maxHp: number,
    vitals: { current: number; temp: number },
    stored: Record<string, number>,
    onDowned: React.MutableRefObject<((id: string) => void) | undefined>,
) {
    const { slug, id } = combatant
    const setCondition = (conditionId: string, value: number) => {
        party.setCondition(slug, conditionId, value)
        if (value <= 0) dispatch({ type: 'setDuration', id, conditionId, rounds: null })
    }

    return {
        applyDamage: (amount: number) => {
            party.applyDamage(slug, amount, maxHp)
            reportIfDowned(vitals, amount, id, onDowned)
        },
        applyHealing: (amount: number) => party.applyHealing(slug, amount, maxHp),
        setTemp: (amount: number) => party.setTemp(slug, amount, maxHp),
        setVitals: (current: number, temp: number) => party.setVitals(slug, current, temp, maxHp),
        setCondition,
        toggleCondition: (conditionId: string) => setCondition(conditionId, stored[conditionId] ? 0 : 1),
        adjustCondition: (conditionId: string, delta: number) =>
            setCondition(conditionId, (stored[conditionId] ?? 0) + delta),
        clearConditions: () => party.clearConditions(slug),
        setPersistent: (list: PersistentDamage[]) => party.setPersistent(slug, list),
        addAffliction: (a: AfflictionState) => party.addAffliction(slug, a),
        removeAffliction: (afflictionId: string) => party.removeAffliction(slug, afflictionId),
        saveAffliction: (afflictionId: string, degree: SaveDegree) =>
            party.saveAffliction(slug, afflictionId, degree),
        advanceAffliction: (afflictionId: string, by: number) =>
            party.advanceAffliction(slug, afflictionId, by),
    }
}

/** O lado do MONSTRO: tudo vive dentro do encontro, no reducer. */
function npcCore(
    combatant: Extract<Combatant, { kind: 'npc' }>,
    dispatch: React.Dispatch<EncounterAction>,
    vitals: { current: number; temp: number },
    stored: Record<string, number>,
    onDowned: React.MutableRefObject<((id: string) => void) | undefined>,
) {
    const { id } = combatant
    const setCondition = (conditionId: string, value: number) =>
        dispatch({ type: 'setNpcCondition', id, conditionId, value })

    return {
        applyDamage: (amount: number) => {
            dispatch({ type: 'npcDamage', entries: [{ id, amount }] })
            reportIfDowned(vitals, amount, id, onDowned)
        },
        applyHealing: (amount: number) => dispatch({ type: 'npcHeal', entries: [{ id, amount }] }),
        setTemp: (amount: number) => dispatch({ type: 'npcSetTemp', id, amount }),
        setVitals: (current: number, temp: number) => dispatch({ type: 'npcSetVitals', id, current, temp }),
        setCondition,
        toggleCondition: (conditionId: string) => setCondition(conditionId, stored[conditionId] ? 0 : 1),
        adjustCondition: (conditionId: string, delta: number) =>
            setCondition(conditionId, (stored[conditionId] ?? 0) + delta),
        clearConditions: () => {
            for (const conditionId of Object.keys(combatant.conditions)) setCondition(conditionId, 0)
        },
        setPersistent: (list: PersistentDamage[]) => dispatch({ type: 'setPersistent', id, list }),
        addAffliction: (affliction: AfflictionState) => dispatch({ type: 'addAffliction', id, affliction }),
        removeAffliction: (afflictionId: string) => dispatch({ type: 'removeAffliction', id, afflictionId }),
        saveAffliction: (afflictionId: string, degree: SaveDegree) =>
            dispatch({ type: 'saveAffliction', id, afflictionId, degree }),
        advanceAffliction: (afflictionId: string, by: number) =>
            dispatch({ type: 'advanceAffliction', id, afflictionId, by }),
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
