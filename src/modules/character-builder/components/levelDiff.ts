import { tr } from '../../../i18n'
import type { Compiled } from '../engine/types'
import { featKindLabel } from '../engine/slots'
import { signed } from './uiTokens'

export interface DiffRow { label: string; from?: string; to: string; delta?: string }

const ordinalRank = (r: number) => tr(`${r}º rank`, `rank ${r}`)

/**
 * O que muda sozinho de um compilado para outro (subir de nível, revisão): números com antes → depois e delta, só os que
 * mudaram. Os três salvamentos juntam numa linha quando sobem igual.
 */
export function statDiff(a: Compiled, b: Compiled): DiffRow[] {
    const rows: DiffRow[] = []
    const num = (label: string, x: number | undefined, y: number | undefined, sign = false) => {
        if (x === undefined || y === undefined || x === y) return
        rows.push({ label, from: sign ? signed(x) : String(x), to: sign ? signed(y) : String(y), delta: signed(y - x) })
    }
    if (a.level !== b.level) num(tr('Nível', 'Level'), a.level, b.level)
    num(tr('PV', 'HP'), a.stats.hp.total, b.stats.hp.total)
    num(tr('CA', 'AC'), a.stats.ac.total, b.stats.ac.total)
    const saves = (['fortitude', 'reflex', 'will'] as const).map((k) => b.stats[k].total - a.stats[k].total)
    if (saves.every((d) => d !== 0 && d === saves[0])) {
        rows.push({ label: tr('Fortitude / Reflexos / Vontade', 'Fortitude / Reflex / Will'), to: tr('todos', 'all'), delta: signed(saves[0]) })
    } else {
        num(tr('Fortitude', 'Fortitude'), a.stats.fortitude.total, b.stats.fortitude.total, true)
        num(tr('Reflexos', 'Reflex'), a.stats.reflex.total, b.stats.reflex.total, true)
        num(tr('Vontade', 'Will'), a.stats.will.total, b.stats.will.total, true)
    }
    num(tr('Percepção', 'Perception'), a.stats.perception.total, b.stats.perception.total, true)
    num(tr('CD de classe', 'Class DC'), a.stats.classDC?.total, b.stats.classDC?.total)
    const ca = a.casters[0]
    const cb = b.casters.find((c) => c.key === ca?.key)
    if (ca && cb) num(tr('CD de magia', 'Spell DC'), ca.dc, cb.dc)
    const sa = a.equipment.strikes[0]
    const sb = b.equipment.strikes.find((s) => s.key === sa?.key)
    if (sa && sb) num(tr(`Golpe (${sa.name})`, `Strike (${sa.name})`), sa.attack, sb.attack, true)
    return rows
}

/** Espaços de magia novos por rank ("+1 espaço de 4º rank"). */
export function slotGains(a: Compiled, b: Compiled): string[] {
    const out: string[] = []
    for (const cb of b.casters) {
        const ca = a.casters.find((c) => c.key === cb.key)
        cb.perDay.forEach((n, r) => {
            const d = n - (ca?.perDay[r] ?? 0)
            if (r > 0 && d > 0) out.push(tr(`+${d} espaço${d > 1 ? 's' : ''} de ${ordinalRank(r)} (${cb.name})`, `+${d} ${ordinalRank(r)} slot${d > 1 ? 's' : ''} (${cb.name})`))
        })
    }
    return out
}

/** O que o nível `level` pede de escolha: os slots de talento dele e as escolhas de classe/salvaguarda/grupo. */
export function levelAsks(c: Compiled, level: number): { key: string; label: string }[] {
    return [
        ...c.featSlots.filter((s) => s.level === level).map((s) => ({ key: s.key, label: s.maxLevel ? `${s.label} (≤ ${s.maxLevel})` : featKindLabel(s.kind) })),
        ...c.classChoices.filter((s) => s.level === level && !s.fixed).map((s) => ({ key: s.key, label: s.label })),
        ...c.saveChoices.filter((s) => s.level === level).map((s) => ({ key: s.key, label: s.label })),
        ...c.groupChoices.filter((s) => s.level === level).map((s) => ({ key: s.key, label: s.label })),
        ...c.skillSlots.filter((s) => s.level === level && s.count > 0 && level > 1).map((s) => ({ key: s.key, label: s.label })),
        ...c.boostGroups.filter((g) => g.level === level && level > 1).map((g) => ({ key: g.key, label: g.label })),
    ]
}
