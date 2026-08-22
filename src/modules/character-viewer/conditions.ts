import type { AbilityKey } from './helpers'

/**
 * Condições do Pathfinder 2e Remaster (apêndice do Player Core) e o efeito
 * mecânico de cada uma sobre os números da ficha.
 *
 * Como os guias de `combatGuides.ts` e a tabela de `unarmed.ts`, isto é escrito
 * à mão a partir das regras — nada vem do JSON do Pathbuilder, que não exporta
 * condição nenhuma. Nomes em pt-BR, `en` canônico para busca na AON.
 *
 * Duas regras de ouro do PF2e guiam o cálculo:
 * 1. **Bônus/penalidades do mesmo tipo não somam** — vale o pior. Status e
 *    circunstância são tipos diferentes, então esses sim se acumulam.
 * 2. **"Testes e CDs"** inclui a CA (que é uma CD) — por isso Amedrontado e
 *    Enjoado baixam a CA, e Fatigado (que fala só de CA e salvaguardas) não
 *    toca em perícias.
 */

export type ModType = 'status' | 'circumstance' | 'untyped'

/** Alvos atômicos — cada um corresponde a um número que a ficha exibe. */
export const MOD_TARGETS = [
    'ac',
    'perception',
    'fortitude',
    'reflex',
    'will',
    'speed',
    'attackStr',
    'attackDex',
    'attackSpell',
    'damageStr',
    'spellDc',
    'classDc',
    'skillStr',
    'skillDex',
    'skillCon',
    'skillInt',
    'skillWis',
    'skillCha',
] as const

export type ModTarget = (typeof MOD_TARGETS)[number]

/** Perícia afetada conforme o atributo que ela usa. */
export const SKILL_TARGET: Record<AbilityKey, ModTarget> = {
    str: 'skillStr',
    dex: 'skillDex',
    con: 'skillCon',
    int: 'skillInt',
    wis: 'skillWis',
    cha: 'skillCha',
}

export const TARGET_LABELS: Record<ModTarget, string> = {
    ac: 'CA',
    perception: 'Percepção',
    fortitude: 'Fortitude',
    reflex: 'Reflexos',
    will: 'Vontade',
    speed: 'Deslocamento',
    attackStr: 'Ataque (FOR)',
    attackDex: 'Ataque (DES)',
    attackSpell: 'Ataque mágico',
    damageStr: 'Dano (FOR)',
    spellDc: 'CD de magia',
    classDc: 'CD de classe',
    skillStr: 'Perícias de FOR',
    skillDex: 'Perícias de DES',
    skillCon: 'Perícias de CON',
    skillInt: 'Perícias de INT',
    skillWis: 'Perícias de SAB',
    skillCha: 'Perícias de CAR',
}

/** Atalhos usados nas definições; expandidos para alvos atômicos. */
type TargetGroup = 'all' | 'dexBased' | 'strBased' | 'conBased' | 'mental' | 'saves' | 'skills'

const SKILL_TARGETS: ModTarget[] = ['skillStr', 'skillDex', 'skillCon', 'skillInt', 'skillWis', 'skillCha']

const GROUPS: Record<TargetGroup, ModTarget[]> = {
    // "Todos os seus testes e CDs" — inclui a CA, exclui deslocamento e dano.
    all: [
        'ac', 'perception', 'fortitude', 'reflex', 'will',
        'attackStr', 'attackDex', 'attackSpell', 'spellDc', 'classDc',
        ...SKILL_TARGETS,
    ],
    // Desajeitado: testes e CDs baseados em Destreza.
    dexBased: ['ac', 'reflex', 'attackDex', 'skillDex'],
    // Enfraquecido: rolagens e CDs baseadas em Força (inclui o dano).
    strBased: ['attackStr', 'damageStr', 'skillStr'],
    // Drenado: testes baseados em Constituição.
    conBased: ['fortitude', 'skillCon'],
    // Estupefato: INT/SAB/CAR — Percepção é um teste de Sabedoria.
    mental: ['perception', 'will', 'attackSpell', 'spellDc', 'skillInt', 'skillWis', 'skillCha'],
    saves: ['fortitude', 'reflex', 'will'],
    skills: SKILL_TARGETS,
}

interface RawEffect {
    type: ModType
    /** Magnitude (negativa para penalidade). Com `perValue`, multiplica o valor da condição. */
    value: number
    perValue?: boolean
    targets: Array<ModTarget | TargetGroup>
    /** Só vale em certas situações: entra como aviso, nunca soma no número. */
    situational?: string
}

export type ConditionGroup = 'debuff' | 'senses' | 'movement' | 'death' | 'attitude'

export const GROUP_LABELS: Record<ConditionGroup, string> = {
    debuff: 'Penalidades',
    senses: 'Percepção e ocultação',
    movement: 'Movimento e controle',
    death: 'Morte e recuperação',
    attitude: 'Atitude',
}

export interface ConditionDef {
    id: string
    /** Nome em pt-BR. */
    name: string
    /** Nome canônico em inglês (o que se busca na AON). */
    en: string
    /** Condição com valor numérico (Amedrontado 2, Lento 1…). */
    valued?: boolean
    group: ConditionGroup
    /** O que a condição faz, em pt-BR. */
    summary: string
    effects?: RawEffect[]
    /** Condições que esta impõe automaticamente. */
    implies?: Array<{ id: string; value?: number }>
    /** Efeito real que a ficha não sabe calcular (ações perdidas, testes fixos…). */
    note?: string
    /** Drenado: PV máximos perdidos por nível, por ponto da condição. */
    hpPerLevel?: number
}

export const CONDITIONS: ConditionDef[] = [
    // --- Penalidades numéricas ---
    {
        id: 'clumsy',
        name: 'Desajeitado',
        en: 'Clumsy',
        valued: true,
        group: 'debuff',
        summary: 'Penalidade de status igual ao valor em testes e CDs baseados em Destreza: CA, Reflexos, ataques de DES e Acrobacia, Furtividade e Roubo.',
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['dexBased'] }],
    },
    {
        id: 'enfeebled',
        name: 'Enfraquecido',
        en: 'Enfeebled',
        valued: true,
        group: 'debuff',
        summary: 'Penalidade de status igual ao valor em rolagens e CDs baseadas em Força: ataques corpo-a-corpo de FOR, dano de FOR e Atletismo.',
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['strBased'] }],
    },
    {
        id: 'stupefied',
        name: 'Estupefato',
        en: 'Stupefied',
        valued: true,
        group: 'debuff',
        summary: 'Penalidade de status igual ao valor em testes e CDs de INT, SAB e CAR — Vontade, Percepção, ataque e CD de magia e as perícias desses atributos.',
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['mental'] }],
        note: 'Para conjurar, faça um teste plano de CD 5 + valor; falhando, a magia é perdida.',
    },
    {
        id: 'drained',
        name: 'Drenado',
        en: 'Drained',
        valued: true,
        group: 'debuff',
        summary: 'Penalidade de status igual ao valor em testes de Constituição (Fortitude) e perda de PV máximos igual a valor × nível.',
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['conBased'] }],
        hpPerLevel: -1,
    },
    {
        id: 'frightened',
        name: 'Amedrontado',
        en: 'Frightened',
        valued: true,
        group: 'debuff',
        summary: 'Penalidade de status igual ao valor em TODOS os seus testes e CDs — inclusive a CA.',
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['all'] }],
        note: 'O valor cai em 1 ao final de cada um dos seus turnos.',
    },
    {
        id: 'sickened',
        name: 'Enjoado',
        en: 'Sickened',
        valued: true,
        group: 'debuff',
        summary: 'Penalidade de status igual ao valor em TODOS os seus testes e CDs — inclusive a CA. Não consegue ingerir nada de propósito.',
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['all'] }],
        note: 'Ação ◆ para vomitar: teste de Fortitude; sucesso reduz o valor em 1 (crítico, em 2).',
    },
    {
        id: 'fatigued',
        name: 'Fatigado',
        en: 'Fatigued',
        group: 'debuff',
        summary: 'Penalidade de status de −1 na CA e em todas as salvaguardas.',
        effects: [{ type: 'status', value: -1, targets: ['ac', 'saves'] }],
        note: 'Some após uma noite inteira de descanso.',
    },
    {
        id: 'off-guard',
        name: 'Desprevenido',
        en: 'Off-Guard',
        group: 'debuff',
        summary: 'Penalidade de circunstância de −2 na CA. (No Remaster substituiu o antigo Flat-Footed.)',
        effects: [{ type: 'circumstance', value: -2, targets: ['ac'] }],
    },
    {
        id: 'prone',
        name: 'Caído',
        en: 'Prone',
        group: 'movement',
        summary: 'Penalidade de circunstância de −2 nas rolagens de ataque; você fica Desprevenido.',
        effects: [{ type: 'circumstance', value: -2, targets: ['attackStr', 'attackDex'] }],
        implies: [{ id: 'off-guard' }],
        note: 'Só se move rastejando; Levantar ◆ provoca reações contra movimento.',
    },
    {
        id: 'fascinated',
        name: 'Fascinado',
        en: 'Fascinated',
        group: 'debuff',
        summary: 'Penalidade de status de −2 em Percepção e em todas as perícias.',
        effects: [{ type: 'status', value: -2, targets: ['perception', 'skills'] }],
        note: 'Não pode usar ações de concentração que não envolvam o objeto da fascinação.',
    },
    {
        id: 'encumbered',
        name: 'Sobrecarregado',
        en: 'Encumbered',
        group: 'movement',
        summary: 'Você fica Desajeitado 1 e sofre −10 pés em todos os seus deslocamentos.',
        effects: [{ type: 'status', value: -10, targets: ['speed'] }],
        implies: [{ id: 'clumsy', value: 1 }],
    },

    // --- Sentidos e ocultação ---
    {
        id: 'blinded',
        name: 'Cego',
        en: 'Blinded',
        group: 'senses',
        summary: 'Não enxerga. Falha automaticamente em testes de Percepção que dependam da visão e, se a visão for seu único sentido preciso, sofre −4 de status em Percepção.',
        effects: [{ type: 'status', value: -4, targets: ['perception'] }],
        note: 'Todo terreno normal vira terreno difícil. A penalidade de −4 assume visão como único sentido preciso.',
    },
    {
        id: 'deafened',
        name: 'Surdo',
        en: 'Deafened',
        group: 'senses',
        summary: 'Falha automaticamente em testes de Percepção que dependam só da audição; −2 de status em Percepção quando o som é parte do teste.',
        effects: [{
            type: 'status',
            value: -2,
            targets: ['perception'],
            situational: 'só quando o som faz parte do teste',
        }],
        note: 'Teste plano de CD 5 para conjurar magias com componente verbal.',
    },
    {
        id: 'dazzled',
        name: 'Ofuscado',
        en: 'Dazzled',
        group: 'senses',
        summary: 'Todas as criaturas e objetos estão Ocultados para você (teste plano de CD 5 ao mirar).',
    },
    {
        id: 'concealed',
        name: 'Ocultado',
        en: 'Concealed',
        group: 'senses',
        summary: 'Quem ataca você faz um teste plano de CD 5 antes de rolar o ataque.',
    },
    {
        id: 'hidden',
        name: 'Escondido',
        en: 'Hidden',
        group: 'senses',
        summary: 'Quem tenta afetar você faz um teste plano de CD 11 e só sabe sua localização aproximada.',
    },
    {
        id: 'undetected',
        name: 'Não Detectado',
        en: 'Undetected',
        group: 'senses',
        summary: 'Ninguém sabe onde você está; ataques contra você exigem escolher um quadrado e passar num teste plano de CD 11.',
    },
    {
        id: 'unnoticed',
        name: 'Despercebido',
        en: 'Unnoticed',
        group: 'senses',
        summary: 'A criatura nem sabe que você existe. Você também está Não Detectado para ela.',
    },
    {
        id: 'observed',
        name: 'Observado',
        en: 'Observed',
        group: 'senses',
        summary: 'Você está à vista — o estado padrão, sem penalidade.',
    },
    {
        id: 'invisible',
        name: 'Invisível',
        en: 'Invisible',
        group: 'senses',
        summary: 'Você está Não Detectado por todos; quem Procurar e acertar consegue no máximo deixá-lo Escondido.',
    },

    // --- Movimento e controle ---
    {
        id: 'immobilized',
        name: 'Imobilizado',
        en: 'Immobilized',
        group: 'movement',
        summary: 'Não pode usar nenhuma ação com o traço movimento.',
        note: 'Se algo o mover à força, ele consegue — a condição impede só o movimento voluntário.',
    },
    {
        id: 'grabbed',
        name: 'Agarrado',
        en: 'Grabbed',
        group: 'movement',
        summary: 'Você fica Desprevenido e Imobilizado.',
        implies: [{ id: 'off-guard' }, { id: 'immobilized' }],
        note: 'Ações de manipulação exigem teste plano de CD 5 ou a ação é perdida.',
    },
    {
        id: 'restrained',
        name: 'Restringido',
        en: 'Restrained',
        group: 'movement',
        summary: 'Você fica Desprevenido e Imobilizado, e não pode usar ações de ataque nem de manipulação (exceto Escapar ou Forçar).',
        implies: [{ id: 'off-guard' }, { id: 'immobilized' }],
    },
    {
        id: 'paralyzed',
        name: 'Paralisado',
        en: 'Paralyzed',
        group: 'movement',
        summary: 'Você fica Desprevenido e não pode agir, exceto por ações puramente mentais (como Relembrar Conhecimento).',
        implies: [{ id: 'off-guard' }],
    },
    {
        id: 'petrified',
        name: 'Petrificado',
        en: 'Petrified',
        group: 'movement',
        summary: 'Virou pedra: não pode agir nem perceber nada. Vira um objeto com Dureza 8 e PV iguais ao dobro dos seus.',
    },
    {
        id: 'confused',
        name: 'Confuso',
        en: 'Confused',
        group: 'movement',
        summary: 'Você fica Desprevenido, não distingue aliados de inimigos e ataca alvos aleatórios.',
        implies: [{ id: 'off-guard' }],
        note: 'Sofrer dano permite um teste plano de CD 11 para se recuperar.',
    },
    {
        id: 'controlled',
        name: 'Controlado',
        en: 'Controlled',
        group: 'movement',
        summary: 'Outra criatura decide o que você faz com suas ações.',
    },
    {
        id: 'fleeing',
        name: 'Fugindo',
        en: 'Fleeing',
        group: 'movement',
        summary: 'Gaste todas as suas ações fugindo da fonte do medo, o mais longe possível.',
    },
    {
        id: 'slowed',
        name: 'Lento',
        en: 'Slowed',
        valued: true,
        group: 'movement',
        summary: 'Perde um número de ações igual ao valor no início de cada turno.',
        note: 'Não afeta reações nem ações grátis.',
    },
    {
        id: 'stunned',
        name: 'Atordoado',
        en: 'Stunned',
        valued: true,
        group: 'movement',
        summary: 'Perde ações até esgotar o valor — cada ação perdida reduz o valor em 1.',
        note: 'Atordoado consome primeiro; ações perdidas por Lento no mesmo turno não somam.',
    },
    {
        id: 'quickened',
        name: 'Acelerado',
        en: 'Quickened',
        group: 'movement',
        summary: 'Ganha 1 ação extra por turno, usável apenas para o que o efeito descrever.',
    },

    // --- Morte e recuperação ---
    {
        id: 'dying',
        name: 'Morrendo',
        en: 'Dying',
        valued: true,
        group: 'death',
        summary: 'Está Inconsciente e à beira da morte. No início do turno, teste de recuperação (CD 10 + valor).',
        implies: [{ id: 'unconscious' }],
        note: 'Morre ao chegar em Morrendo 4 (ou menos, com Sentenciado). Ao se estabilizar, ganha Ferido 1 (ou +1).',
    },
    {
        id: 'wounded',
        name: 'Ferido',
        en: 'Wounded',
        valued: true,
        group: 'death',
        summary: 'Ao voltar a Morrendo, o valor de Morrendo já começa somado ao valor de Ferido.',
        note: 'Some ao recuperar todos os PV ou com um sucesso em Tratar Ferimentos.',
    },
    {
        id: 'doomed',
        name: 'Sentenciado',
        en: 'Doomed',
        valued: true,
        group: 'death',
        summary: 'O valor de Morrendo que mata você cai de 4 para 4 − valor.',
        note: 'O valor cai em 1 a cada noite inteira de descanso.',
    },
    {
        id: 'unconscious',
        name: 'Inconsciente',
        en: 'Unconscious',
        group: 'death',
        summary: 'Penalidade de status de −4 na CA, na Percepção e em Reflexos; você fica Cego, Desprevenido e Caído.',
        effects: [{ type: 'status', value: -4, targets: ['ac', 'perception', 'reflex'] }],
        implies: [{ id: 'blinded' }, { id: 'off-guard' }, { id: 'prone' }],
    },
    {
        id: 'persistent-damage',
        name: 'Dano Persistente',
        en: 'Persistent Damage',
        group: 'death',
        summary: 'Ao final de cada turno, sofre o dano de novo e faz um teste plano de CD 15 para acabar com ele.',
        note: 'Ajuda apropriada baixa a CD do teste plano para 10.',
    },

    // --- Atitude (NPCs) ---
    { id: 'helpful', name: 'Prestativo', en: 'Helpful', group: 'attitude', summary: 'Quer ajudar você e age a seu favor.' },
    { id: 'friendly', name: 'Amigável', en: 'Friendly', group: 'attitude', summary: 'Gosta de você, mas ainda precisa ser convencida a se arriscar.' },
    { id: 'indifferent', name: 'Indiferente', en: 'Indifferent', group: 'attitude', summary: 'Não liga para você — a atitude padrão.' },
    { id: 'hostile', name: 'Hostil', en: 'Hostile', group: 'attitude', summary: 'Age contra você e pode até atacar.' },
]

export const CONDITIONS_BY_ID: Record<string, ConditionDef> = Object.fromEntries(
    CONDITIONS.map((c) => [c.id, c]),
)

/** Condição ativa: valor 1 nas sem valor; `via` marca as impostas por outra. */
export interface ActiveCondition {
    id: string
    value: number
    /** Nome da condição que impôs esta (Inconsciente → Cego). */
    via?: string
}

export interface AppliedMod {
    from: string
    type: ModType
    value: number
}

export interface ConditionModifiers {
    active: ActiveCondition[]
    /** Modificador final por alvo (0 quando nada se aplica). */
    total: Record<ModTarget, number>
    /** De onde veio cada pedaço — inclusive os descartados por não empilharem. */
    parts: Record<ModTarget, AppliedMod[]>
    situational: Array<{ from: string; text: string }>
    notes: Array<{ from: string; text: string }>
    /** Variação dos PV máximos (Drenado). */
    hpMaxDelta: number
    /** Quantas condições o jogador marcou (sem contar as impostas). */
    count: number
}

const emptyTargets = <T,>(make: () => T): Record<ModTarget, T> =>
    Object.fromEntries(MOD_TARGETS.map((t) => [t, make()])) as Record<ModTarget, T>

export const NO_MODIFIERS: ConditionModifiers = {
    active: [],
    total: emptyTargets(() => 0),
    parts: emptyTargets(() => [] as AppliedMod[]),
    situational: [],
    notes: [],
    hpMaxDelta: 0,
    count: 0,
}

function expandTargets(targets: Array<ModTarget | TargetGroup>): ModTarget[] {
    const out = new Set<ModTarget>()
    for (const t of targets) {
        const group = GROUPS[t as TargetGroup]
        if (group) group.forEach((g) => out.add(g))
        else out.add(t as ModTarget)
    }
    return Array.from(out)
}

/**
 * Resolve as condições impostas (Inconsciente → Cego, Desprevenido, Caído) em
 * cascata. A escolha explícita do jogador sempre vence a imposta, e entre duas
 * impostas fica o maior valor.
 */
function resolveActive(state: Record<string, number>): ActiveCondition[] {
    const resolved = new Map<string, ActiveCondition>()

    for (const [id, raw] of Object.entries(state)) {
        if (!CONDITIONS_BY_ID[id]) continue
        const value = Math.max(1, Math.floor(raw) || 1)
        resolved.set(id, { id, value })
    }

    // Fila em largura: cada condição empurra as suas até estabilizar.
    const queue = Array.from(resolved.values())
    while (queue.length > 0) {
        const current = queue.shift()!
        const def = CONDITIONS_BY_ID[current.id]
        for (const imp of def.implies ?? []) {
            if (!CONDITIONS_BY_ID[imp.id]) continue
            const value = imp.value ?? 1
            const existing = resolved.get(imp.id)
            // Marcada pelo jogador continua como está; imposta só sobe de valor.
            if (existing && (!existing.via || existing.value >= value)) continue
            const next: ActiveCondition = { id: imp.id, value, via: def.name }
            resolved.set(imp.id, next)
            queue.push(next)
        }
    }

    // Ordena pela ordem do catálogo, com as escolhidas antes das impostas.
    const order = new Map(CONDITIONS.map((c, i) => [c.id, i]))
    return Array.from(resolved.values()).sort((a, b) => {
        if (!!a.via !== !!b.via) return a.via ? 1 : -1
        return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    })
}

/**
 * Modificadores das condições ativas. Penalidades do mesmo tipo não empilham
 * (vale a pior); tipos diferentes somam. `level` é usado só pelo Drenado.
 */
export function computeConditionModifiers(state: Record<string, number>, level: number): ConditionModifiers {
    const active = resolveActive(state)
    if (active.length === 0) return { ...NO_MODIFIERS, count: 0 }

    const parts = emptyTargets(() => [] as AppliedMod[])
    const situational: ConditionModifiers['situational'] = []
    const notes: ConditionModifiers['notes'] = []
    let hpMaxDelta = 0

    for (const entry of active) {
        const def = CONDITIONS_BY_ID[entry.id]
        const from = def.valued ? `${def.name} ${entry.value}` : def.name

        if (def.hpPerLevel) hpMaxDelta += def.hpPerLevel * entry.value * level
        if (def.note) notes.push({ from, text: def.note })

        for (const effect of def.effects ?? []) {
            const value = effect.perValue ? effect.value * entry.value : effect.value
            if (effect.situational) {
                situational.push({ from, text: `${formatSigned(value)} ${effect.situational}` })
                continue
            }
            for (const target of expandTargets(effect.targets)) {
                parts[target].push({ from, type: effect.type, value })
            }
        }
    }

    const total = emptyTargets(() => 0)
    for (const target of MOD_TARGETS) {
        // Por tipo, vale só o pior (mais negativo); tipos diferentes se somam.
        const worst = new Map<ModType, number>()
        for (const part of parts[target]) {
            const current = worst.get(part.type)
            if (current == null || part.value < current) worst.set(part.type, part.value)
        }
        total[target] = Array.from(worst.values()).reduce((sum, v) => sum + v, 0)
    }

    return {
        active,
        total,
        parts,
        situational,
        notes,
        hpMaxDelta,
        count: Object.keys(state).filter((id) => CONDITIONS_BY_ID[id]).length,
    }
}

function formatSigned(n: number): string {
    return n >= 0 ? `+${n}` : `−${Math.abs(n)}`
}

/** Só os pedaços que de fato entraram na conta do alvo (o pior de cada tipo). */
export function effectiveParts(mods: ConditionModifiers, target: ModTarget): AppliedMod[] {
    const worst = new Map<ModType, AppliedMod>()
    for (const part of mods.parts[target]) {
        const current = worst.get(part.type)
        if (!current || part.value < current.value) worst.set(part.type, part)
    }
    return Array.from(worst.values())
}

/**
 * Modificador que vale para **todos** os alvos da lista — a interseção das
 * fontes. Usado nas armas, onde a ficha do Pathbuilder não diz se o ataque é
 * de Força ou de Destreza: aplicamos só o que penaliza os dois casos.
 */
export function sharedMod(mods: ConditionModifiers, targets: ModTarget[]): number {
    if (targets.length === 0) return 0
    const key = (m: AppliedMod) => `${m.from}|${m.type}|${m.value}`
    const common = mods.parts[targets[0]].filter((part) =>
        targets.every((t) => mods.parts[t].some((other) => key(other) === key(part))),
    )
    const worst = new Map<ModType, number>()
    for (const part of common) {
        const current = worst.get(part.type)
        if (current == null || part.value < current) worst.set(part.type, part.value)
    }
    return Array.from(worst.values()).reduce((sum, v) => sum + v, 0)
}

/** Alvos com modificador diferente de zero, na ordem do catálogo de alvos. */
export function affectedTargets(mods: ConditionModifiers): ModTarget[] {
    return MOD_TARGETS.filter((t) => mods.total[t] !== 0)
}
