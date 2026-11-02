// Efeitos de fortuna que a ficha automatiza: "role duas vezes e fique com o melhor".
//
// Textos conferidos na AON (nov/2026):
//   - Sure Strike (Player Core pg. 361; True Strike no pré-Remaster), magia de 1º rank, 1 ação, traço fortune:
//     "The next time you make an attack roll before the end of your turn, roll it twice and use the better
//     result. The attack ignores circumstance penalties to the attack roll and any flat check required due to the
//     target being concealed or hidden. You are then temporarily immune to sure strike for 10 minutes."
//   - Wish for Luck (antecedente Genie-Blessed, Secrets of Magic pg. 30), ação livre, fortune, 1×/dia:
//     "Trigger You are about to roll an attack roll, saving throw, or skill check; Effect … Roll the check twice
//     and take the higher result."  (Percepção não é perícia: fica de fora.)
//
// Efeitos de fortuna não se somam (só um vale numa rolagem): os chips se excluem, e o estratagema de ataque do
// Investigador (que também é fortuna) os desliga. O d20 descartado vai em `check.discarded`, que as estatísticas
// nunca leem.

import type { BuildInfo } from '../../pathbuilder/types'
import type { TableRoll } from '../../dice/tableRoll'
import { rollDie } from '../../dice/roll'
import { slotKey, type SpellSlotsApi } from './components/useSpellSlots'
import type { CastResource } from './spellCast'
import { tr } from '../../i18n'

export type FortuneContext = 'attack' | 'save' | 'skill'
export type FortuneId = 'sure-strike' | 'wish-for-luck'

export interface FortuneSource {
    id: FortuneId
    label: string
    /** O que custa, para o chip. */
    cost: string
    /** O que a mesa lê junto da rolagem. */
    note: string
}

/** Nome da magia (Remaster e o pré-Remaster) — a mesma regra. */
const SURE_STRIKE_NAMES = ['sure strike', 'true strike']
export const WISH_FOR_LUCK = 'Wish for Luck'
/** Chave no campo `uses` (zerado pelo Novo dia). */
export const WISH_FOR_LUCK_USE = 'wish for luck'

/** A magia na ficha (preparada, no repertório ou no grimório), com o nome como a ficha a escreve. */
export function sureStrikeName(build: BuildInfo): string | null {
    for (const c of build.spellCasters ?? []) {
        for (const l of [...(c.spells ?? []), ...(c.prepared ?? [])]) {
            const hit = l.list.find((n) => SURE_STRIKE_NAMES.includes(n.trim().toLowerCase()))
            if (hit) return hit
        }
    }
    return null
}

export const hasWishForLuck = (build: BuildInfo): boolean =>
    (build.specials ?? []).some((s) => s.trim().toLowerCase() === WISH_FOR_LUCK_USE)

/** As fontes de fortuna que a ficha tem para esta rolagem. */
export function fortuneSourcesFor(build: BuildInfo, ctx: FortuneContext): FortuneSource[] {
    const out: FortuneSource[] = []
    const sure = ctx === 'attack' ? sureStrikeName(build) : null
    if (sure) {
        out.push({
            id: 'sure-strike',
            label: sure,
            cost: tr('magia · 1 ação + slot', 'spell · 1 action + slot'),
            note: tr(
                `${sure} (fortuna): o maior de 2d20; ignora penalidades de circunstância no ataque e o teste simples de alvo oculto ou escondido. Imune a ${sure} por 10 min.`,
                `${sure} (fortune): the higher of 2d20; ignores circumstance penalties to the attack and the flat check for a concealed or hidden target. Immune to ${sure} for 10 min.`,
            ),
        })
    }
    if (hasWishForLuck(build)) {
        out.push({
            id: 'wish-for-luck',
            label: WISH_FOR_LUCK,
            cost: tr('ação livre · 1×/dia', 'free action · 1/day'),
            note: tr(`${WISH_FOR_LUCK} (fortuna, 1×/dia): o maior de 2d20.`, `${WISH_FOR_LUCK} (fortune, 1/day): the higher of 2d20.`),
        })
    }
    return out
}

/**
 * Rola o segundo d20 e fica com o maior: o mesmo que rolar os dois juntos. Vale no `check` (ou no primeiro raio —
 * "the next attack roll"). O total segue `d20 + mod`, que os dois validadores conferem.
 */
export function withFortune(roll: TableRoll, note: string, second = rollDie(20)): TableRoll {
    const apply = (c: NonNullable<TableRoll['check']>): NonNullable<TableRoll['check']> => {
        const hi = Math.max(c.d20, second)
        const lo = Math.min(c.d20, second)
        return { ...c, d20: hi, total: hi + c.mod, discarded: lo }
    }
    const noted = (roll.note ? `${roll.note} · ${note}` : note).slice(0, 300)
    if (roll.check) return { ...roll, check: apply(roll.check), note: noted }
    if (roll.rays?.length) return { ...roll, rays: roll.rays.map((r, i) => (i === 0 ? { ...r, check: apply(r.check) } : r)), note: noted }
    return roll
}

/**
 * De onde sai a conjuração do Sure Strike, quando ela é paga pelo chip do Golpe: a cópia preparada ainda livre
 * (preparado) ou o slot do rank (espontâneo), do rank mais baixo que tiver. `null` = nada livre (o app avisa e
 * não desconta, como toda conjuração).
 */
export function sureStrikeResource(build: BuildInfo, slots: Pick<SpellSlotsApi, 'usedOf'>, name: string): CastResource | null {
    const casters = build.spellCasters ?? []
    for (let idx = 0; idx < casters.length; idx++) {
        const c = casters[idx]
        const levels = [...(c.spells ?? [])].filter((l) => l.spellLevel > 0).sort((a, b) => a.spellLevel - b.spellLevel)
        for (const l of levels) {
            const copies = l.list.filter((n) => n === name).length
            if (!copies) continue
            if (c.spellcastingType === 'spontaneous') {
                const total = c.perDay?.[l.spellLevel] ?? 0
                const key = slotKey(idx, c.name, l.spellLevel)
                if (total > slots.usedOf(key)) return { kind: 'spontaneous', key, total }
            } else {
                const key = slotKey(idx, c.name, l.spellLevel, name)
                if (copies > slots.usedOf(key)) return { kind: 'slot', key, total: copies }
            }
        }
    }
    return null
}

// ── A conjuração recente do Sure Strike ────────────────────────────────────────
//
// Quem conjura pelo "Conjurar" (ou marca o slot na lista) e DEPOIS rola o Golpe com o chip não pode pagar duas
// vezes. A conjuração deixa um crédito que o próximo ataque com o chip consome — como o "Golpe pago" das
// atividades (`prepayStrike`). A magia vale até o fim do turno; o crédito, por 5 minutos (o app não conta o turno).

const CAST_TTL_MS = 5 * 60 * 1000
const recentCasts: number[] = []

/** `useSpellCast` chama ao registrar uma conjuração nova de Sure Strike. */
export function noteSureStrikeCast(name: string, now = Date.now()): void {
    if (SURE_STRIKE_NAMES.includes(name.trim().toLowerCase())) recentCasts.push(now)
}

/** Consome a conjuração recente, se houver. `true` = já paga. */
export function takeSureStrikeCast(now = Date.now()): boolean {
    while (recentCasts.length && now - recentCasts[0] > CAST_TTL_MS) recentCasts.shift()
    return recentCasts.shift() != null
}

export const hasSureStrikeCast = (now = Date.now()): boolean => recentCasts.some((t) => now - t <= CAST_TTL_MS)
