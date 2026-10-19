/**
 * As ações de perícia do Player Core e quantas ações cada uma custa. Antes uma rolagem de perícia
 * nunca gastava ação ("não dá para saber se é uma ação"); agora o diálogo oferece um seletor
 * opcional — desligado por padrão, então teste fora de combate continua como era.
 *
 * Só entra o que cabe no turno (1–3 ações). Atividade de minutos ou de exploração (Impersonate,
 * Gather Information, Craft, Repair, Track…) não tem custo em ações e fica de fora.
 */
import type { MythicContext } from './mythicUse'

export interface SkillAction {
    id: string
    label: string
    /** Ações que a ação de perícia gasta. */
    actions: number
    /** O ✦ de talento específico que esta ação libera (salto, natação, Sense Motive). */
    mythic?: MythicContext
}

const recall: SkillAction = { id: 'recall', label: 'Recall Knowledge', actions: 1 }

/** Por `check.en` (o nome em inglês da perícia). */
export const SKILL_ACTIONS: Readonly<Record<string, ReadonlyArray<SkillAction>>> = {
    Athletics: [
        { id: 'climb', label: 'Climb', actions: 1 },
        { id: 'disarm', label: 'Disarm', actions: 1 },
        { id: 'force-open', label: 'Force Open', actions: 1 },
        { id: 'grapple', label: 'Grapple', actions: 1 },
        { id: 'high-jump', label: 'High Jump', actions: 2, mythic: 'jump' },
        { id: 'long-jump', label: 'Long Jump', actions: 2, mythic: 'jump' },
        { id: 'shove', label: 'Shove', actions: 1 },
        { id: 'swim', label: 'Swim', actions: 1, mythic: 'swim' },
        { id: 'trip', label: 'Trip', actions: 1 },
    ],
    Acrobatics: [
        { id: 'balance', label: 'Balance', actions: 1 },
        { id: 'maneuver-in-flight', label: 'Maneuver in Flight', actions: 1 },
        { id: 'tumble-through', label: 'Tumble Through', actions: 1 },
    ],
    Stealth: [
        { id: 'conceal', label: 'Conceal an Object', actions: 1 },
        { id: 'hide', label: 'Hide', actions: 1 },
        { id: 'sneak', label: 'Sneak', actions: 1 },
    ],
    Deception: [
        { id: 'diversion', label: 'Create a Diversion', actions: 1 },
        { id: 'feint', label: 'Feint', actions: 1 },
    ],
    Intimidation: [{ id: 'demoralize', label: 'Demoralize', actions: 1 }],
    Diplomacy: [
        { id: 'bon-mot', label: 'Bon Mot', actions: 1 },
        { id: 'request', label: 'Request', actions: 1 },
    ],
    Performance: [{ id: 'perform', label: 'Perform', actions: 1 }],
    Perception: [
        { id: 'seek', label: 'Seek', actions: 1 },
        { id: 'sense-motive', label: 'Sense Motive', actions: 1, mythic: 'sense-motive' },
    ],
    Thievery: [
        { id: 'disable', label: 'Disable a Device', actions: 2 },
        { id: 'lock', label: 'Pick a Lock', actions: 2 },
        { id: 'palm', label: 'Palm an Object', actions: 1 },
        { id: 'steal', label: 'Steal', actions: 1 },
    ],
    Medicine: [
        { id: 'first-aid', label: 'Administer First Aid', actions: 2 },
        { id: 'treat-poison', label: 'Treat Poison', actions: 1 },
    ],
    Arcana: [recall],
    Nature: [recall],
    Occultism: [recall],
    Religion: [recall],
    Society: [recall],
    Crafting: [recall],
    Survival: [],
}

/** As ações da perícia (e dos Saberes, que são todos Recall Knowledge); vazio = o seletor nem aparece. */
export function skillActionsFor(en: string): ReadonlyArray<SkillAction> {
    if (SKILL_ACTIONS[en]) return SKILL_ACTIONS[en]
    return /\bLore\b/i.test(en) ? [recall] : []
}
