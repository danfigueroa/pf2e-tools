/**
 * As ações de perícia do Player Core e quantas ações cada uma custa. Antes uma rolagem de perícia
 * nunca gastava ação ("não dá para saber se é uma ação"); agora o diálogo oferece um seletor
 * opcional — desligado por padrão, então teste fora de combate continua como era.
 *
 * Só entra o que cabe no turno (1–3 ações). Atividade de minutos ou de exploração (Impersonate,
 * Craft, Repair, Track…) não tem custo em ações e fica de fora — com uma exceção: as que um talento
 * mítico deixa rolar com ✦ (Mentir, Causar Impressão, Coletar Informações, pelo Unbelievably
 * Believable) entram com `actions: 0` e a duração em `time`, só para escolher o ✦. Não gastam ação.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { MythicContext } from './mythicUse'

export interface SkillAction {
    id: string
    label: string
    /** Ações que a ação de perícia gasta. */
    actions: number
    /** O ✦ de talento específico que esta ação libera (salto, natação, Sense Motive). */
    mythic?: MythicContext
    /** Quanto leva, para a que não gasta ação (`actions: 0`): "1 minuto", "2 horas". */
    time?: string
    /** Só aparece para quem tem este talento (Tamper, do arquétipo de Inventor). */
    feat?: string
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
        { id: 'lie', label: 'Lie', actions: 0, time: 'conversa', mythic: 'influence' },
    ],
    Intimidation: [{ id: 'demoralize', label: 'Demoralize', actions: 1 }],
    Diplomacy: [
        { id: 'bon-mot', label: 'Bon Mot', actions: 1 },
        { id: 'request', label: 'Request', actions: 1, mythic: 'influence' },
        { id: 'make-impression', label: 'Make an Impression', actions: 0, time: '1 minuto', mythic: 'influence' },
        { id: 'gather-information', label: 'Gather Information', actions: 0, time: '2 horas', mythic: 'influence' },
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
    Crafting: [recall, { id: 'tamper', label: 'Tamper (contra a CD de Reflexos)', actions: 1, feat: 'Tamper' }],
    Survival: [],
}

/** As ações da perícia (e dos Saberes, que são todos Recall Knowledge); vazio = o seletor nem aparece. */
export function skillActionsFor(en: string, build?: BuildInfo): ReadonlyArray<SkillAction> {
    const all = SKILL_ACTIONS[en] ?? (/\bLore\b/i.test(en) ? [recall] : [])
    const has = (name: string) => (build?.feats ?? []).some((f) => parseFeatEntry(f).name.trim().toLowerCase() === name.toLowerCase())
    const list = all.filter((a) => !a.feat || has(a.feat))
    // Keen Recollection: Recall Knowledge com QUALQUER perícia (o assunto fora da sua especialidade),
    // e a destreinada soma o nível em vez de +0 (`investigator.ts`).
    const keen = (build?.specials ?? []).some((n) => n.trim().toLowerCase() === 'keen recollection')
    return keen && !list.some((x) => x.id === 'recall') ? [...list, recall] : list
}
