/**
 * A economia de uma conjuração: quantas ações (ou a reação) a magia custa e de
 * onde sai o recurso — slot, ponto de foco ou Ponto Mítico.
 *
 * Uma conjuração pode ser registrada por DOIS caminhos: a rolagem do diálogo da
 * magia (`roll`) e a marcação à mão na lista (`mark`: o pip do slot, o botão de
 * gastar). Quem rola costumava marcar o slot depois — e quem não tem o que
 * rolar só marcava —, então as ações da magia sem dano nunca eram contadas.
 * Agora os dois pagam, e o `pairCast` casa um com o outro: uma conjuração paga
 * UMA vez, na ordem em que vierem (rolar e depois marcar, ou o contrário).
 */
import { actionCost } from './actions'
import { actionRange } from './actionVariants'

/** De onde sai o que a magia gasta ao ser conjurada. */
export type CastResource =
    | { kind: 'none' }
    /** Preparado: cada cópia preparada é um slot (a chave é a da linha). */
    | { kind: 'slot'; key: string; total: number }
    /** Espontâneo: os slots são do nível. */
    | { kind: 'spontaneous'; key: string; total: number }
    | { kind: 'focus' }
    /** Mythic Magic: cada conjuração gasta 1 Ponto Mítico. */
    | { kind: 'mythic' }

export const NO_RESOURCE: CastResource = { kind: 'none' }

export type CastTime =
    | { kind: 'actions'; n: number }
    | { kind: 'reaction' }
    | { kind: 'free' }
    | { kind: 'variable'; min: number; max: number }
    /** Minutos, rodadas ou horas: não cabe no turno, não gasta ação. */
    | { kind: 'long' }
    | { kind: 'unknown' }

/** Lê o campo `actions` da AON ("Two Actions", "Reaction", "Single Action to Three Actions", "10 minutes"). */
export function castTimeOf(actions: string | number | undefined | null): CastTime {
    if (actions == null || String(actions).trim() === '') return { kind: 'unknown' }
    const range = actionRange(actions)
    if (range) return { kind: 'variable', ...range }
    const n = actionCost(actions)
    if (n != null) return { kind: 'actions', n }
    const s = String(actions).toLowerCase()
    if (/reaction/.test(s)) return { kind: 'reaction' }
    if (/free/.test(s)) return { kind: 'free' }
    if (/minute|hour|round|day/.test(s)) return { kind: 'long' }
    return { kind: 'unknown' }
}

// ── O casamento entre rolar e marcar ──────────────────────────────────────────

/** Curto de propósito: o par é "rolei e marquei o slot", segundos. Longo demais, uma rolagem antiga engoliria a conjuração seguinte. */
const PAIR_TTL_MS = 90_000

type Side = 'roll' | 'mark'
const credits = new Map<string, { side: Side; at: number }[]>()

/**
 * Registra uma conjuração de `name` por um dos dois caminhos. Se o OUTRO caminho
 * já a registrou (nos últimos 90 s), é a mesma conjuração: consome o crédito e
 * devolve `true` — quem chama NÃO paga de novo. Senão guarda o seu crédito e
 * devolve `false`: é uma conjuração nova.
 *
 * Duas conjurações seguidas da mesma magia não se confundem: cada rolagem sem
 * marcação guarda um crédito, e cada marcação consome um. O total pago é sempre
 * o maior entre as rolagens e as marcações.
 */
export function pairCast(name: string, side: Side, now = Date.now()): boolean {
    const key = name.trim().toLowerCase()
    const list = (credits.get(key) ?? []).filter((c) => now - c.at < PAIR_TTL_MS)
    const other = list.findIndex((c) => c.side !== side)
    if (other >= 0) {
        list.splice(other, 1)
        credits.set(key, list)
        return true
    }
    list.push({ side, at: now })
    credits.set(key, list)
    return false
}

/** Só para o `check-rolls`: esquece tudo. */
export const resetCastLedger = () => credits.clear()
