// Aflições (venenos, doenças, maldições) e a progressão de estágios do PF2e.
//
// Motor puro: sem React, sem rede. A UI só desenha o que sai daqui.
//
// **O app não rola SALVAGUARDA** — essa é rolagem de quem está jogando, então o
// GM informa o GRAU e o motor aplica o RAW. O DANO do estágio é outra história:
// ele cai sozinho, com desfazer (ver o cabeçalho de `dice.ts`).

import { parseDamageEntries, type DamageEntry } from './dice'
import { CONDITIONS_BY_ID } from '../character-viewer/conditions'
import type { ConditionState } from '../character-viewer/components/useConditions'

/** Grau de sucesso de uma salvaguarda, informado pelo GM. */
export type SaveDegree = 'critSuccess' | 'success' | 'failure' | 'critFailure'

export const SAVE_DEGREES: Array<{ id: SaveDegree; label: string; short: string }> = [
    { id: 'critSuccess', label: 'Sucesso crítico', short: 'C✓' },
    { id: 'success', label: 'Sucesso', short: '✓' },
    { id: 'failure', label: 'Falha', short: '✗' },
    { id: 'critFailure', label: 'Falha crítica', short: 'C✗' },
]

export interface AfflictionStage {
    /** Prosa do estágio, em inglês (como vem da AON). */
    text: string
    conditions: Array<{ id: string; value?: number }>
    /** `null` quando a duração não é em rodadas — o combate não a acompanha. */
    durationRounds: number | null
    durationRaw: string | null
}

export interface AfflictionDef {
    name: string
    dc: number | null
    save: 'fortitude' | 'reflex' | 'will' | null
    /** Texto cru da salvaguarda, para o que o parse não conseguiu estruturar. */
    raw?: string | null
    virulent: boolean
    onsetRaw: string | null
    maxDurationRaw: string | null
    stages: AfflictionStage[]
    source?: string | null
    url?: string
}

/** Uma aflição ATIVA num combatente. */
export interface AfflictionState {
    /** Identidade da instância: a mesma aflição pode pegar duas vezes. */
    id: string
    def: AfflictionDef
    /** 1..stages.length. Zero ou menos significa curada, e some. */
    stage: number
    /** Rodadas até a próxima salvaguarda; `null` quando não é em rodadas. */
    roundsLeft: number | null
    /**
     * Rodadas até a DURAÇÃO MÁXIMA acabar e a aflição sumir sozinha, ou `null`
     * quando ela não cabe no relógio do combate (horas, dias) — aí quem tira é
     * o GM, como já acontece com os estágios não contados em rodadas.
     */
    maxRoundsLeft: number | null
    /** Virulento exige DOIS sucessos seguidos para melhorar um estágio. */
    successStreak: number
}

const lastStage = (def: AfflictionDef) => def.stages.length

/**
 * Estágio inicial, pela exposição.
 *
 * @returns o estágio, ou `null` quando a criatura não é afetada.
 */
export function initialStage(degree: SaveDegree): number | null {
    if (degree === 'critSuccess' || degree === 'success') return null
    return degree === 'critFailure' ? 2 : 1
}

/**
 * Quanto um grau move o estágio.
 *
 * RAW (Player Core, Aflições): crítico ✓ −2, ✓ −1, ✗ +1, crítico ✗ +2.
 *
 * **Virulento** troca a recuperação: o crítico melhora só 1 em vez de 2, e um
 * sucesso simples sozinho não melhora nada — são precisos DOIS seguidos.
 * Interpretação adotada onde a regra é omissa: qualquer mudança de estágio zera
 * a sequência, então dois sucessos separados por uma falha não se somam.
 */
function stageDelta(
    degree: SaveDegree,
    virulent: boolean,
    streak: number,
): { delta: number; streak: number } {
    switch (degree) {
        case 'critSuccess':
            return { delta: virulent ? -1 : -2, streak: 0 }
        case 'success':
            if (!virulent) return { delta: -1, streak: 0 }
            return streak + 1 >= 2 ? { delta: -1, streak: 0 } : { delta: 0, streak: streak + 1 }
        case 'failure':
            return { delta: 1, streak: 0 }
        case 'critFailure':
            return { delta: 2, streak: 0 }
    }
}

/**
 * Aplica a salvaguarda de fim de estágio.
 *
 * @returns o novo estado, ou `null` quando a aflição termina (estágio abaixo de 1).
 */
export function applySave(state: AfflictionState, degree: SaveDegree): AfflictionState | null {
    const { delta, streak } = stageDelta(degree, state.def.virulent, state.successStreak)
    const stage = state.stage + delta
    if (stage < 1) return null

    // Passar do último estágio não existe: a aflição fica no pior que tem.
    const capped = Math.min(stage, lastStage(state.def))
    return { ...state, stage: capped, successStreak: streak, roundsLeft: roundsFor(state.def, capped) }
}

/** Avança um estágio à mão — para as durações que não são em rodadas. */
export function advanceStage(state: AfflictionState, by = 1): AfflictionState | null {
    const stage = state.stage + by
    if (stage < 1) return null
    const capped = Math.min(stage, lastStage(state.def))
    return { ...state, stage: capped, successStreak: 0, roundsLeft: roundsFor(state.def, capped) }
}

/**
 * Dano escrito no estágio atual, lido da prosa da AON.
 *
 * O RAW aplica os efeitos de um estágio quando a criatura ENTRA nele — e "entra"
 * vale nos dois sentidos, porque um sucesso na salvaguarda também é entrar no
 * estágio anterior. Quem aplica é a view do combatente, no mesmo instante da
 * troca de estágio; aqui só se lê o que está escrito.
 */
export function stageDamage(state: AfflictionState): DamageEntry[] {
    return parseDamageEntries(stageOf(state)?.text ?? '')
}

/**
 * Rodadas da duração MÁXIMA, quando ela cabe no relógio do combate.
 *
 * Ao contrário das durações de estágio (que só contam rodadas, porque 65% delas
 * são em minutos ou dias e fingir o contrário seria pior), aqui o minuto entra:
 * um minuto são 10 rodadas exatas, a duração máxima é o corte definitivo da
 * aflição, e das 174 aflições reais do índice quase todas usam rodada ou minuto
 * ("6 rounds" em 59 delas, "6 minutes" em 20). Hora e dia continuam de fora.
 *
 * O casamento é pelo COMEÇO do texto, não pelo texto inteiro: há entrada como
 * "6 rounds (but see stage 3)" cuja ressalva não muda o número.
 */
const MAX_UNIT_ROUNDS: Record<string, number> = { round: 1, minute: 10 }

export function maxDurationRounds(def: AfflictionDef): number | null {
    const m = /^(\d+)\s*(round|minute)s?\b/i.exec((def.maxDurationRaw ?? '').trim())
    return m ? parseInt(m[1], 10) * MAX_UNIT_ROUNDS[m[2].toLowerCase()] : null
}

/** Rodadas do estágio, ou `null` se a duração dele não for em rodadas. */
export function roundsFor(def: AfflictionDef, stage: number): number | null {
    return def.stages[stage - 1]?.durationRounds ?? null
}

export function stageOf(state: AfflictionState): AfflictionStage | null {
    return state.def.stages[state.stage - 1] ?? null
}

/**
 * Condições impostas pelo estágio atual, prontas para o mapa de condições.
 * Ignora id que não existe no catálogo, em vez de quebrar a ficha.
 */
export function stageConditions(state: AfflictionState): Record<string, number> {
    const out: Record<string, number> = {}
    for (const c of stageOf(state)?.conditions ?? []) {
        if (!CONDITIONS_BY_ID[c.id]) continue
        out[c.id] = Math.max(1, c.value ?? 1)
    }
    return out
}

/**
 * Desce um round de cada aflição.
 *
 * Devolve três coisas: a lista nova, quais VENCERAM o estágio (pedem
 * salvaguarda agora) e quais ACABARAM por duração máxima. As que acabaram já
 * saem de `next` — a aflição some sozinha quando o tempo dela se esgota, sem o
 * GM precisar lembrar de tirá-la. Aflição sem contagem em rodadas passa intacta.
 */
export function tickAfflictions(
    afflictions: AfflictionState[],
): { next: AfflictionState[]; due: string[]; expired: AfflictionState[] } {
    const due: string[] = []
    const expired: AfflictionState[] = []
    const next: AfflictionState[] = []

    for (const a of afflictions) {
        const maxLeft = a.maxRoundsLeft === null ? null : a.maxRoundsLeft - 1
        if (maxLeft !== null && maxLeft <= 0) {
            expired.push(a)
            continue
        }
        if (a.roundsLeft === null) {
            next.push(maxLeft === a.maxRoundsLeft ? a : { ...a, maxRoundsLeft: maxLeft })
            continue
        }
        const left = a.roundsLeft - 1
        // Já em zero, a salvaguarda continua pendente a cada tique até o GM
        // informar o grau — não some por esquecimento.
        if (left <= 0) due.push(a.id)
        next.push({ ...a, roundsLeft: Math.max(0, left), maxRoundsLeft: maxLeft })
    }

    return { next, due, expired }
}

export function newAffliction(def: AfflictionDef, stage: number): AfflictionState {
    return {
        id: crypto.randomUUID(),
        def,
        stage,
        roundsLeft: roundsFor(def, stage),
        maxRoundsLeft: maxDurationRounds(def),
        successStreak: 0,
    }
}

/**
 * Junta as condições vindas das aflições às que o GM marcou à mão.
 *
 * As da aflição são DERIVADAS, nunca gravadas — mesma política das condições
 * impostas (Inconsciente → Cego, Desprevenido, Caído), que o CLAUDE.md descreve:
 * o armazenamento só guarda o que alguém escolheu, então tirar a aflição tira
 * as condições dela junto, sem precisar lembrar o que foi aplicado.
 *
 * Em conflito vale o PIOR valor: condição de mesmo nome não empilha no PF2e, e
 * um Enfraquecido 2 marcado à mão não pode ser rebaixado por um veneno que dá 1.
 */
export function mergeAfflictionConditions(
    base: ConditionState,
    afflictions: AfflictionState[],
): ConditionState {
    if (afflictions.length === 0) return base
    const out: ConditionState = { ...base }
    for (const affliction of afflictions) {
        for (const [id, value] of Object.entries(stageConditions(affliction))) {
            out[id] = Math.max(out[id] ?? 0, value)
        }
    }
    return out
}

/** Ids das condições que vêm de aflição — a UI as marca como derivadas. */
export function afflictionConditionIds(afflictions: AfflictionState[]): Set<string> {
    const ids = new Set<string>()
    for (const a of afflictions) for (const id of Object.keys(stageConditions(a))) ids.add(id)
    return ids
}

const isStage = (v: unknown): v is { text: string } => !!v && typeof v === 'object'

/** Descarta o que não se parece com aflição, em vez de quebrar a ficha. */
export function sanitizeAfflictions(raw: unknown): AfflictionState[] {
    if (!Array.isArray(raw)) return []
    const out: AfflictionState[] = []
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const a = item as Record<string, unknown>
        const def = a.def as AfflictionDef | undefined
        if (!def?.name || !Array.isArray(def.stages) || !def.stages.every(isStage)) continue
        const stage = Math.floor(Number(a.stage) || 1)
        if (stage < 1) continue
        out.push({
            id: typeof a.id === 'string' ? a.id : crypto.randomUUID(),
            def: {
                ...def,
                virulent: def.virulent === true,
                stages: def.stages.map((st) => ({
                    text: String(st.text ?? ''),
                    conditions: Array.isArray(st.conditions) ? st.conditions : [],
                    durationRounds: Number.isFinite(st.durationRounds as number)
                        ? (st.durationRounds as number)
                        : null,
                    durationRaw: st.durationRaw ?? null,
                })),
            },
            stage: Math.min(stage, def.stages.length),
            roundsLeft: Number.isFinite(a.roundsLeft as number) ? (a.roundsLeft as number) : null,
            // Aflição gravada antes desta versão não tem o campo: cai no que a
            // definição diz, em vez de virar "sem prazo" para sempre.
            maxRoundsLeft: Number.isFinite(a.maxRoundsLeft as number)
                ? (a.maxRoundsLeft as number)
                : maxDurationRounds(def),
            successStreak: Math.max(0, Math.floor(Number(a.successStreak) || 0)),
        })
    }
    return out
}
