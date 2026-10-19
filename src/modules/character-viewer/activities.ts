/**
 * Atividades de talentos e habilidades (Sudden Charge, Nimble Dodge, Terrifying Howl,
 * Correct the Story…): o que custam NO TURNO — ações, a reação ou um Ponto Mítico —
 * lido da própria AON. O pacote de descrições já traz `actions`, `traits` e `frequency`
 * de cada talento (e o texto traduzido ainda cita o "Ponto Mítico"), então nada aqui é
 * catálogo à mão: o botão "Usar" nasce do dado.
 *
 * Só o que NÃO tem um caminho próprio na ficha entra aqui. Rage, Hunt Prey, Shield Block,
 * Divert Destiny… já gastam ação/reação/ponto onde acontecem (a faixa ou o diálogo do
 * Golpe), e um segundo botão geraria cobrança em dobro: ficam em `DEDICATED`, que o
 * `check-economy.mjs` confere.
 */
import type { FeatDescription } from '../character-sheet/types'
import { castTimeOf, type CastTime } from './spellCast'

export interface ActivityInfo {
    time: CastTime
    /** Talento mítico que gasta um Ponto Mítico ao ser usado. */
    mythicPoint: boolean
    /** "Uma vez por dia": fica marcado até o Novo dia. */
    daily: boolean
    /** A atividade inclui um Golpe (Sudden Charge, Vicious Swing…): o custo dela já o paga. */
    includesStrike: boolean
    trigger?: string
}

/** Quem trata cada atividade por um caminho próprio (nome em minúsculas → onde). */
export const DEDICATED: Readonly<Record<string, string>> = {
    'rage': 'RageBar',
    'hunt prey': 'RangerBar',
    'gravity weapon': 'RangerBar',
    'arcane cascade': 'MagusBar',
    'spellstrike': 'diálogo do Golpe',
    'poison weapon': 'diálogo do Golpe',
    'exacting strike': 'diálogo do Golpe',
    "hunter's aim": 'diálogo do Golpe',
    'debilitating strike': 'diálogo do Golpe',
    'reactive strike': 'diálogo do Golpe (reação)',
    'battle medicine': 'diálogo de Medicina',
    'shield block': 'ShieldCard',
    'reactive shield': 'ShieldCard',
    'quick shield block': 'ShieldCard',
    'divert destiny': 'MagusBar',
    'fiery rebirth': 'MagusBar',
    'summon mythic power': 'MagusBar',
    'unleash psyche': 'PsycheBar',
    'rewrite fate': '✦ dos diálogos',
    'mythic strike': '✦ do diálogo do Golpe',
    'mythic magic': 'conjuração',
    'godspeed': 'MythicFeatsBar',
    'correct the story': 'MythicFeatsBar',
    'arc of destruction': 'MythicFeatsBar',
    'become destiny': 'MythicFeatsBar',
    "we've met before": 'MythicFeatsBar',
}

export const isDedicated = (name: string): boolean => name.trim().toLowerCase() in DEDICATED

// O texto do pacote vem traduzido ("Gaste um Ponto Mítico") mas às vezes mantém o nome em inglês.
const MYTHIC_SPEND = /\b(?:gast\w*|spend\w*|expend\w*)\s+(?:um|uma|1|a|one)\s+(?:ponto\s+m[ií]tico|mythic\s+point)/i
const DAILY = /uma vez por dia|once per day/i

type ActivitySource = Pick<FeatDescription, 'actions' | 'traits' | 'description' | 'frequency' | 'trigger'>

/** O talento gasta Ponto Mítico quando usado (traço Mythic + o texto manda gastar). */
export function spendsMythicPoint(desc: Pick<FeatDescription, 'traits' | 'description'>): boolean {
    const mythic = (desc.traits ?? []).some((t) => t.toLowerCase() === 'mythic')
    return mythic && MYTHIC_SPEND.test(desc.description ?? '')
}

/**
 * O que a atividade custa, ou `null` quando não há o que cobrar: sem descrição baixada, sem
 * custo (passivo), ação livre sem recurso (nada a contar) ou com caminho próprio.
 */
export function activityOf(name: string, desc: ActivitySource | null | undefined): ActivityInfo | null {
    if (!desc || isDedicated(name)) return null
    const time = castTimeOf(desc.actions)
    const mythicPoint = spendsMythicPoint(desc)
    const daily = DAILY.test(desc.frequency ?? '')
    const charges = time.kind === 'actions' || time.kind === 'reaction' || time.kind === 'variable'
    // Ação livre só interessa se gasta ponto ou tem limite diário; senão o botão não contaria nada.
    const free = time.kind === 'free' && (mythicPoint || daily)
    if (!charges && !free) return null
    return {
        time,
        mythicPoint,
        daily,
        includesStrike: charges && /\bStrike\b/.test(desc.description ?? '') && !(desc.traits ?? []).some((t) => t.toLowerCase() === 'metamagic'),
        trigger: desc.trigger || undefined,
    }
}

/** "1 ação", "2 ações + 1 ponto", "reação": o rótulo do botão. */
export function costLabel(info: ActivityInfo): string {
    const t = info.time
    const parts: string[] = []
    if (t.kind === 'actions') parts.push(`${t.n} ${t.n === 1 ? 'ação' : 'ações'}`)
    else if (t.kind === 'variable') parts.push(`${t.min}–${t.max} ações`)
    else if (t.kind === 'reaction') parts.push('reação')
    else if (t.kind === 'free') parts.push('ação livre')
    if (info.mythicPoint) parts.push('1 ponto')
    return parts.join(' + ')
}
