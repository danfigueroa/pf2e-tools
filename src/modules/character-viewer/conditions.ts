import { tr } from '../../i18n'
import type { AbilityKey } from './helpers'
import type { RageEffect } from './rage'
import type { PsycheEffect } from './psyche'
import type { CascadeEffect } from './magus'
import type { RangerEffect } from './ranger'

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
    ac: tr('CA', 'AC'),
    perception: tr('Percepção', 'Perception'),
    fortitude: 'Fortitude',
    reflex: tr('Reflexos', 'Reflex'),
    will: tr('Vontade', 'Will'),
    speed: tr('Deslocamento', 'Speed'),
    attackStr: tr('Ataque (FOR)', 'Attack (STR)'),
    attackDex: tr('Ataque (DES)', 'Attack (DEX)'),
    attackSpell: tr('Ataque mágico', 'Spell attack'),
    damageStr: tr('Dano (FOR)', 'Damage (STR)'),
    spellDc: tr('CD de magia', 'Spell DC'),
    classDc: tr('CD de classe', 'Class DC'),
    skillStr: tr('Perícias de FOR', 'STR skills'),
    skillDex: tr('Perícias de DES', 'DEX skills'),
    skillCon: tr('Perícias de CON', 'CON skills'),
    skillInt: tr('Perícias de INT', 'INT skills'),
    skillWis: tr('Perícias de SAB', 'WIS skills'),
    skillCha: tr('Perícias de CAR', 'CHA skills'),
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
    debuff: tr('Penalidades', 'Penalties'),
    senses: tr('Percepção e ocultação', 'Perception and concealment'),
    movement: tr('Movimento e controle', 'Movement and control'),
    death: tr('Morte e recuperação', 'Death and recovery'),
    attitude: tr('Atitude', 'Attitude'),
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
        name: tr('Desajeitado', 'Clumsy'),
        en: 'Clumsy',
        valued: true,
        group: 'debuff',
        summary: tr('Penalidade de status igual ao valor em testes e CDs baseados em Destreza: CA, Reflexos, ataques de DES e Acrobacia, Furtividade e Roubo.', 'Status penalty equal to the value to Dexterity-based checks and DCs: AC, Reflex, DEX attacks and Acrobatics, Stealth and Thievery.'),
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['dexBased'] }],
    },
    {
        id: 'enfeebled',
        name: tr('Enfraquecido', 'Enfeebled'),
        en: 'Enfeebled',
        valued: true,
        group: 'debuff',
        summary: tr('Penalidade de status igual ao valor em rolagens e CDs baseadas em Força: ataques corpo-a-corpo de FOR, dano de FOR e Atletismo.', 'Status penalty equal to the value to Strength-based rolls and DCs: STR melee attacks, STR damage and Athletics.'),
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['strBased'] }],
    },
    {
        id: 'stupefied',
        name: tr('Estupefato', 'Stupefied'),
        en: 'Stupefied',
        valued: true,
        group: 'debuff',
        summary: tr('Penalidade de status igual ao valor em testes e CDs de INT, SAB e CAR — Vontade, Percepção, ataque e CD de magia e as perícias desses atributos.', 'Status penalty equal to the value to INT, WIS and CHA checks and DCs — Will, Perception, spell attack and spell DC and those attributes\' skills.'),
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['mental'] }],
        note: tr('Para conjurar, faça um teste plano de CD 5 + valor; falhando, a magia é perdida.', 'To cast, attempt a DC 5 + value flat check; on a failure, the spell is lost.'),
    },
    {
        id: 'drained',
        name: tr('Drenado', 'Drained'),
        en: 'Drained',
        valued: true,
        group: 'debuff',
        summary: tr('Penalidade de status igual ao valor em testes de Constituição (Fortitude) e perda de PV máximos igual a valor × nível.', 'Status penalty equal to the value to Constitution-based checks (Fortitude) and you lose max HP equal to value × level.'),
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['conBased'] }],
        hpPerLevel: -1,
    },
    {
        id: 'frightened',
        name: tr('Amedrontado', 'Frightened'),
        en: 'Frightened',
        valued: true,
        group: 'debuff',
        summary: tr('Penalidade de status igual ao valor em TODOS os seus testes e CDs — inclusive a CA.', 'Status penalty equal to the value to ALL your checks and DCs — including AC.'),
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['all'] }],
        note: tr('O valor cai em 1 ao final de cada um dos seus turnos.', 'The value drops by 1 at the end of each of your turns.'),
    },
    {
        id: 'sickened',
        name: tr('Enjoado', 'Sickened'),
        en: 'Sickened',
        valued: true,
        group: 'debuff',
        summary: tr('Penalidade de status igual ao valor em TODOS os seus testes e CDs — inclusive a CA. Não consegue ingerir nada de propósito.', 'Status penalty equal to the value to ALL your checks and DCs — including AC. You can\'t willingly ingest anything.'),
        effects: [{ type: 'status', value: -1, perValue: true, targets: ['all'] }],
        note: tr('Ação ◆ para vomitar: teste de Fortitude; sucesso reduz o valor em 1 (crítico, em 2).', '◆ action to retch: Fortitude save; a success reduces the value by 1 (critical, by 2).'),
    },
    {
        id: 'fatigued',
        name: tr('Fatigado', 'Fatigued'),
        en: 'Fatigued',
        group: 'debuff',
        summary: tr('Penalidade de status de −1 na CA e em todas as salvaguardas.', '−1 status penalty to AC and all saving throws.'),
        effects: [{ type: 'status', value: -1, targets: ['ac', 'saves'] }],
        note: tr('Some após uma noite inteira de descanso.', 'Goes away after a full night\'s rest.'),
    },
    {
        id: 'off-guard',
        name: tr('Desprevenido', 'Off-Guard'),
        en: 'Off-Guard',
        group: 'debuff',
        summary: tr('Penalidade de circunstância de −2 na CA. (No Remaster substituiu o antigo Flat-Footed.)', '−2 circumstance penalty to AC. (In the Remaster it replaced the old flat-footed.)'),
        effects: [{ type: 'circumstance', value: -2, targets: ['ac'] }],
    },
    {
        id: 'prone',
        name: tr('Caído', 'Prone'),
        en: 'Prone',
        group: 'movement',
        summary: tr('Penalidade de circunstância de −2 nas rolagens de ataque; você fica Desprevenido.', '−2 circumstance penalty to attack rolls; you are off-guard.'),
        effects: [{ type: 'circumstance', value: -2, targets: ['attackStr', 'attackDex'] }],
        implies: [{ id: 'off-guard' }],
        note: tr('Só se move rastejando; Levantar ◆ provoca reações contra movimento.', 'You can only move by Crawling; Stand ◆ triggers reactions to movement.'),
    },
    {
        id: 'fascinated',
        name: tr('Fascinado', 'Fascinated'),
        en: 'Fascinated',
        group: 'debuff',
        summary: tr('Penalidade de status de −2 em Percepção e em todas as perícias.', '−2 status penalty to Perception and all skill checks.'),
        effects: [{ type: 'status', value: -2, targets: ['perception', 'skills'] }],
        note: tr('Não pode usar ações de concentração que não envolvam o objeto da fascinação.', 'You can\'t use concentrate actions unless they relate to the subject of your fascination.'),
    },
    {
        id: 'encumbered',
        name: tr('Sobrecarregado', 'Encumbered'),
        en: 'Encumbered',
        group: 'movement',
        summary: tr('Você fica Desajeitado 1 e sofre −10 pés em todos os seus deslocamentos.', 'You are clumsy 1 and take a −10-foot penalty to all your Speeds.'),
        effects: [{ type: 'status', value: -10, targets: ['speed'] }],
        implies: [{ id: 'clumsy', value: 1 }],
    },

    // --- Sentidos e ocultação ---
    {
        id: 'blinded',
        name: tr('Cego', 'Blinded'),
        en: 'Blinded',
        group: 'senses',
        summary: tr('Não enxerga. Falha automaticamente em testes de Percepção que dependam da visão e, se a visão for seu único sentido preciso, sofre −4 de status em Percepção.', 'You can\'t see. You automatically fail Perception checks that require sight and, if vision is your only precise sense, take a −4 status penalty to Perception.'),
        effects: [{ type: 'status', value: -4, targets: ['perception'] }],
        note: tr('Todo terreno normal vira terreno difícil. A penalidade de −4 assume visão como único sentido preciso.', 'All normal terrain is difficult terrain to you. The −4 penalty assumes vision is your only precise sense.'),
    },
    {
        id: 'deafened',
        name: tr('Surdo', 'Deafened'),
        en: 'Deafened',
        group: 'senses',
        summary: tr('Falha automaticamente em testes de Percepção que dependam só da audição; −2 de status em Percepção quando o som é parte do teste.', 'You automatically fail Perception checks that require only hearing; −2 status penalty to Perception when sound is part of the check.'),
        effects: [{
            type: 'status',
            value: -2,
            targets: ['perception'],
            situational: tr('só quando o som faz parte do teste', 'only when sound is part of the check'),
        }],
        note: tr('Teste plano de CD 5 para conjurar magias com componente verbal.', 'DC 5 flat check to cast spells with a verbal component.'),
    },
    {
        id: 'dazzled',
        name: tr('Ofuscado', 'Dazzled'),
        en: 'Dazzled',
        group: 'senses',
        summary: tr('Todas as criaturas e objetos estão Ocultados para você (teste plano de CD 5 ao mirar).', 'All creatures and objects are concealed from you (DC 5 flat check when targeting).'),
    },
    {
        id: 'concealed',
        name: tr('Ocultado', 'Concealed'),
        en: 'Concealed',
        group: 'senses',
        summary: tr('Quem ataca você faz um teste plano de CD 5 antes de rolar o ataque.', 'Whoever attacks you attempts a DC 5 flat check before rolling the attack.'),
    },
    {
        id: 'hidden',
        name: tr('Escondido', 'Hidden'),
        en: 'Hidden',
        group: 'senses',
        summary: tr('Quem tenta afetar você faz um teste plano de CD 11 e só sabe sua localização aproximada.', 'Whoever tries to affect you attempts a DC 11 flat check and only knows your approximate location.'),
    },
    {
        id: 'undetected',
        name: tr('Não Detectado', 'Undetected'),
        en: 'Undetected',
        group: 'senses',
        summary: tr('Ninguém sabe onde você está; ataques contra você exigem escolher um quadrado e passar num teste plano de CD 11.', 'Nobody knows where you are; attacks against you require picking a square and passing a DC 11 flat check.'),
    },
    {
        id: 'unnoticed',
        name: tr('Despercebido', 'Unnoticed'),
        en: 'Unnoticed',
        group: 'senses',
        summary: tr('A criatura nem sabe que você existe. Você também está Não Detectado para ela.', 'The creature doesn\'t even know you exist. You are also undetected by it.'),
    },
    {
        id: 'observed',
        name: tr('Observado', 'Observed'),
        en: 'Observed',
        group: 'senses',
        summary: tr('Você está à vista — o estado padrão, sem penalidade.', 'You are in plain view — the default state, no penalty.'),
    },
    {
        id: 'invisible',
        name: tr('Invisível', 'Invisible'),
        en: 'Invisible',
        group: 'senses',
        summary: tr('Você está Não Detectado por todos; quem Procurar e acertar consegue no máximo deixá-lo Escondido.', 'You are undetected by everyone; someone who Seeks and succeeds can at most make you hidden.'),
    },

    // --- Movimento e controle ---
    {
        id: 'immobilized',
        name: tr('Imobilizado', 'Immobilized'),
        en: 'Immobilized',
        group: 'movement',
        summary: tr('Não pode usar nenhuma ação com o traço movimento.', 'You can\'t use any action with the move trait.'),
        note: tr('Se algo o mover à força, ele consegue — a condição impede só o movimento voluntário.', 'If something moves you by force, it can — the condition only prevents voluntary movement.'),
    },
    {
        id: 'grabbed',
        name: tr('Agarrado', 'Grabbed'),
        en: 'Grabbed',
        group: 'movement',
        summary: tr('Você fica Desprevenido e Imobilizado.', 'You are off-guard and immobilized.'),
        implies: [{ id: 'off-guard' }, { id: 'immobilized' }],
        note: tr('Ações de manipulação exigem teste plano de CD 5 ou a ação é perdida.', 'Manipulate actions require a DC 5 flat check or the action is lost.'),
    },
    {
        id: 'restrained',
        name: tr('Restringido', 'Restrained'),
        en: 'Restrained',
        group: 'movement',
        summary: tr('Você fica Desprevenido e Imobilizado, e não pode usar ações de ataque nem de manipulação (exceto Escapar ou Forçar).', 'You are off-guard and immobilized, and can\'t use attack or manipulate actions (except to Escape or Force Open).'),
        implies: [{ id: 'off-guard' }, { id: 'immobilized' }],
    },
    {
        id: 'paralyzed',
        name: tr('Paralisado', 'Paralyzed'),
        en: 'Paralyzed',
        group: 'movement',
        summary: tr('Você fica Desprevenido e não pode agir, exceto por ações puramente mentais (como Relembrar Conhecimento).', 'You are off-guard and can\'t act, except for purely mental actions (like Recall Knowledge).'),
        implies: [{ id: 'off-guard' }],
    },
    {
        id: 'petrified',
        name: tr('Petrificado', 'Petrified'),
        en: 'Petrified',
        group: 'movement',
        summary: tr('Virou pedra: não pode agir nem perceber nada. Vira um objeto com Dureza 8 e PV iguais ao dobro dos seus.', 'Turned to stone: you can\'t act or sense anything. You become an object with Hardness 8 and HP equal to twice yours.'),
    },
    {
        id: 'confused',
        name: tr('Confuso', 'Confused'),
        en: 'Confused',
        group: 'movement',
        summary: tr('Você fica Desprevenido, não distingue aliados de inimigos e ataca alvos aleatórios.', 'You are off-guard, can\'t tell allies from enemies and attack random targets.'),
        implies: [{ id: 'off-guard' }],
        note: tr('Sofrer dano permite um teste plano de CD 11 para se recuperar.', 'Taking damage allows a DC 11 flat check to recover.'),
    },
    {
        id: 'controlled',
        name: tr('Controlado', 'Controlled'),
        en: 'Controlled',
        group: 'movement',
        summary: tr('Outra criatura decide o que você faz com suas ações.', 'Another creature decides what you do with your actions.'),
    },
    {
        id: 'fleeing',
        name: tr('Fugindo', 'Fleeing'),
        en: 'Fleeing',
        group: 'movement',
        summary: tr('Gaste todas as suas ações fugindo da fonte do medo, o mais longe possível.', 'Spend all your actions fleeing from the source of the fear, as far as possible.'),
    },
    {
        id: 'slowed',
        name: tr('Lento', 'Slowed'),
        en: 'Slowed',
        valued: true,
        group: 'movement',
        summary: tr('Perde um número de ações igual ao valor no início de cada turno.', 'You lose a number of actions equal to the value at the start of each turn.'),
        note: tr('Não afeta reações nem ações grátis.', 'Doesn\'t affect reactions or free actions.'),
    },
    {
        id: 'stunned',
        name: tr('Atordoado', 'Stunned'),
        en: 'Stunned',
        valued: true,
        group: 'movement',
        summary: tr('Perde ações até esgotar o valor — cada ação perdida reduz o valor em 1.', 'You lose actions until the value runs out — each lost action reduces the value by 1.'),
        note: tr('Atordoado consome primeiro; ações perdidas por Lento no mesmo turno não somam.', 'Stunned is used first; actions lost to slowed on the same turn don\'t add up.'),
    },
    {
        id: 'quickened',
        name: tr('Acelerado', 'Quickened'),
        en: 'Quickened',
        group: 'movement',
        summary: tr('Ganha 1 ação extra por turno, usável apenas para o que o efeito descrever.', 'You gain 1 extra action per turn, usable only for what the effect describes.'),
    },

    // --- Morte e recuperação ---
    {
        id: 'dying',
        name: tr('Morrendo', 'Dying'),
        en: 'Dying',
        valued: true,
        group: 'death',
        summary: tr('Está Inconsciente e à beira da morte. No início do turno, teste de recuperação (CD 10 + valor).', 'You are unconscious and at death\'s door. At the start of your turn, attempt a recovery check (DC 10 + value).'),
        implies: [{ id: 'unconscious' }],
        note: tr('Morre ao chegar em Morrendo 4 (ou menos, com Sentenciado). Ao se estabilizar, ganha Ferido 1 (ou +1).', 'You die upon reaching dying 4 (or less, with doomed). When you stabilize, you gain wounded 1 (or +1).'),
    },
    {
        id: 'wounded',
        name: tr('Ferido', 'Wounded'),
        en: 'Wounded',
        valued: true,
        group: 'death',
        summary: tr('Ao voltar a Morrendo, o valor de Morrendo já começa somado ao valor de Ferido.', 'When you become dying again, the dying value starts with your wounded value added.'),
        note: tr('Some ao recuperar todos os PV ou com um sucesso em Tratar Ferimentos.', 'Goes away when you\'re restored to full HP or with a successful Treat Wounds.'),
    },
    {
        id: 'doomed',
        name: tr('Sentenciado', 'Doomed'),
        en: 'Doomed',
        valued: true,
        group: 'death',
        summary: tr('O valor de Morrendo que mata você cai de 4 para 4 − valor.', 'The dying value at which you die drops from 4 to 4 − value.'),
        note: tr('O valor cai em 1 a cada noite inteira de descanso.', 'The value drops by 1 after each full night\'s rest.'),
    },
    {
        id: 'unconscious',
        name: tr('Inconsciente', 'Unconscious'),
        en: 'Unconscious',
        group: 'death',
        summary: tr('Penalidade de status de −4 na CA, na Percepção e em Reflexos; você fica Cego, Desprevenido e Caído.', '−4 status penalty to AC, Perception and Reflex; you are blinded, off-guard and prone.'),
        effects: [{ type: 'status', value: -4, targets: ['ac', 'perception', 'reflex'] }],
        implies: [{ id: 'blinded' }, { id: 'off-guard' }, { id: 'prone' }],
    },
    {
        id: 'persistent-damage',
        name: tr('Dano Persistente', 'Persistent Damage'),
        en: 'Persistent Damage',
        group: 'death',
        summary: tr('Ao final de cada turno, sofre o dano de novo e faz um teste plano de CD 15 para acabar com ele.', 'At the end of each turn, you take the damage again and attempt a DC 15 flat check to end it.'),
        note: tr('Ajuda apropriada baixa a CD do teste plano para 10.', 'Appropriate help lowers the flat check DC to 10.'),
    },

    // --- Atitude (NPCs) ---
    { id: 'helpful', name: tr('Prestativo', 'Helpful'), en: 'Helpful', group: 'attitude', summary: tr('Quer ajudar você e age a seu favor.', 'Wants to help you and acts in your favor.') },
    { id: 'friendly', name: tr('Amigável', 'Friendly'), en: 'Friendly', group: 'attitude', summary: tr('Gosta de você, mas ainda precisa ser convencida a se arriscar.', 'Likes you, but still needs to be convinced to take risks.') },
    { id: 'indifferent', name: tr('Indiferente', 'Indifferent'), en: 'Indifferent', group: 'attitude', summary: tr('Não liga para você — a atitude padrão.', 'Doesn\'t care about you — the default attitude.') },
    { id: 'hostile', name: tr('Hostil', 'Hostile'), en: 'Hostile', group: 'attitude', summary: tr('Age contra você e pode até atacar.', 'Acts against you and may even attack.') },
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
    /**
     * Bônus no dano dos Golpes corpo a corpo vindos de um EFEITO, não de
     * condição (o +4 de estado do Enlarge 4º, em `sizeEffects.ts`). Viaja aqui
     * porque `mods` já chega a todo lugar que monta um Golpe.
     */
    meleeDamage?: AppliedMod[]
    /**
     * Fúria ligada. Não é um número como o `meleeDamage`: o dano dela muda com a
     * arma (ágil, Grande), então viaja como regra e `meleeBonusParts` resolve
     * golpe a golpe.
     */
    rage?: RageEffect
    /** Psique liberada (Unleash Psyche): o dano das magias do Psíquico sobe, resolvido por magia. */
    psyche?: PsycheEffect
    /** Arcane Cascade ligada: dano extra de força (ou do tipo escolhido) nos Golpes corpo a corpo. */
    cascade?: CascadeEffect
    /** Presa marcada com Hunter's Edge: Precision e/ou Gravity Weapon ativa (`ranger.ts`). */
    ranger?: RangerEffect
    /** Escudo erguido com Reflexive Shield: o bônus dele vale nos Reflexos (`fighter.ts`). */
    reflexShield?: number
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
