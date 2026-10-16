// A rolagem que viaja pela mesa: a ficha rola, o feed (`services/rolls.ts`)
// leva, e todo aparelho aberto na plataforma mostra — no Mapa, numa ficha, na
// Iniciativa.
//
// Já vem SORTEADA. Quem recebe só apresenta (a animação conta até o número que
// chegou), e o memorial (`check.parts`) vai junto para a mesa conferir a conta.
//
// O que vem da rede é dado, não código: `sanitizeTableRoll` valida tudo antes
// de desenhar. O backend tem a MESMA validação em `api/_lib/roll-store.js` —
// espelhada à mão porque o servidor é JS puro; mudou aqui, muda lá.

export const DICE_FACES = [4, 6, 8, 10, 12, 20, 100] as const

/** Teto de dados numa rolagem inteira — o rolador do mapa vai até 100. */
export const MAX_ROLL_DICE = 120
export const MAX_ROLL_BYTES = 4096
/** Quantas rolagens a mesa guarda (o histórico). */
export const ROLL_HISTORY = 30

export interface RollDie {
    faces: number
    value: number
}

/** Uma parcela rolada: "2d8+8 contundente", "1d6 eletricidade". */
export interface RolledPart {
    label: string
    dice: RollDie[]
    flat: number
    /** Soma crua (dados + fixo), sem piso. */
    total: number
    persistent?: boolean
}

export interface TableRoll {
    id: string
    /** Hora do servidor (ms). */
    at: number
    /** Quem rolou: o personagem, ou o nome livre do rolador do mapa. */
    by: string
    slug?: string
    /** Cor dos dados (hex de 6 dígitos). */
    color: string
    /** "Fortitude", "Golpe — Warhammer", "Fireball". */
    title: string
    /** "2º ataque · ✦ mítico", "rank 5". */
    sub?: string
    /** Teste de d20: o dado, o modificador e a conta. */
    check?: {
        d20: number
        mod: number
        total: number
        mythic: boolean
        parts: { label: string; value: number }[]
    }
    damage?: {
        parts: RolledPart[]
        /** Dano imediato (sem persistente), com o piso já aplicado. */
        total: number
        crit?: { total: number; note: string }
        /** Salvaguarda básica: a mesa vê ½ e ×2 junto. */
        basic?: boolean
    }
    /** Rolagem livre (rolador de dados do mapa). */
    free?: RolledPart
}

const HEX = /^#[0-9a-fA-F]{6}$/
const isInt = (v: unknown, max = 99999): v is number => Number.isInteger(v) && Math.abs(v as number) <= max
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

function sanitizeDice(raw: unknown, budget: { left: number }): RollDie[] | null {
    if (!Array.isArray(raw)) return null
    if (raw.length > budget.left) return null
    const out: RollDie[] = []
    for (const d of raw) {
        if (!d || typeof d !== 'object') return null
        const { faces, value } = d as Record<string, unknown>
        if (typeof faces !== 'number' || !(DICE_FACES as readonly number[]).includes(faces)) return null
        if (!isInt(value) || (value as number) < 1 || (value as number) > faces) return null
        out.push({ faces, value: value as number })
    }
    budget.left -= out.length
    return out
}

function sanitizePart(raw: unknown, budget: { left: number }): RolledPart | null {
    if (!raw || typeof raw !== 'object') return null
    const p = raw as Record<string, unknown>
    const dice = sanitizeDice(p.dice, budget)
    if (!dice || !isInt(p.flat) || !isInt(p.total)) return null
    // A soma tem que fechar: número que não confere com os dados não vai à mesa.
    if (dice.reduce((s, d) => s + d.value, p.flat as number) !== p.total) return null
    return {
        label: str(p.label, 60),
        dice,
        flat: p.flat as number,
        total: p.total as number,
        ...(p.persistent === true ? { persistent: true } : {}),
    }
}

export function sanitizeTableRoll(raw: unknown): TableRoll | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (typeof r.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(r.id)) return null
    if (typeof r.color !== 'string' || !HEX.test(r.color)) return null
    const budget = { left: MAX_ROLL_DICE }
    const out: TableRoll = {
        id: r.id,
        at: typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : 0,
        by: str(r.by, 40),
        color: r.color,
        title: str(r.title, 60),
    }
    if (typeof r.slug === 'string' && /^[a-z0-9-]{1,64}$/.test(r.slug)) out.slug = r.slug
    if (typeof r.sub === 'string' && r.sub) out.sub = str(r.sub, 80)

    if (r.check !== undefined) {
        const c = r.check as Record<string, unknown>
        if (!c || typeof c !== 'object') return null
        if (!isInt(c.d20) || (c.d20 as number) < 1 || (c.d20 as number) > 20) return null
        if (!isInt(c.mod, 999) || !isInt(c.total)) return null
        if ((c.d20 as number) + (c.mod as number) !== c.total) return null
        const parts = Array.isArray(c.parts) ? c.parts.slice(0, 12) : []
        out.check = {
            d20: c.d20 as number,
            mod: c.mod as number,
            total: c.total as number,
            mythic: c.mythic === true,
            parts: parts
                .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && isInt((p as Record<string, unknown>).value, 999))
                .map((p) => ({ label: str(p.label, 60), value: p.value as number })),
        }
    }

    if (r.damage !== undefined) {
        const d = r.damage as Record<string, unknown>
        if (!d || typeof d !== 'object' || !Array.isArray(d.parts) || d.parts.length > 8) return null
        const parts: RolledPart[] = []
        for (const p of d.parts) {
            const part = sanitizePart(p, budget)
            if (!part) return null
            parts.push(part)
        }
        if (!isInt(d.total)) return null
        out.damage = { parts, total: d.total as number }
        if (d.crit !== undefined) {
            const c = d.crit as Record<string, unknown>
            if (!c || typeof c !== 'object' || !isInt(c.total)) return null
            out.damage.crit = { total: c.total as number, note: str(c.note, 200) }
        }
        if (d.basic === true) out.damage.basic = true
    }

    if (r.free !== undefined) {
        const part = sanitizePart(r.free, budget)
        if (!part) return null
        out.free = part
    }

    if (!out.check && !out.damage && !out.free) return null
    return out
}

/** Id curto e legível no Redis: tempo + acaso. */
export const newRollId = (): string =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** "1d20+15", "2d8+1d6+4" — a fórmula de uma parcela, para leitura. */
export function partFormula(part: Pick<RolledPart, 'dice' | 'flat'>): string {
    const counts = new Map<number, number>()
    for (const d of part.dice) counts.set(d.faces, (counts.get(d.faces) ?? 0) + 1)
    const dice = [...counts].map(([faces, n]) => `${n}d${faces}`).join(' + ')
    if (!part.flat) return dice || '0'
    const sign = part.flat > 0 ? ' + ' : ' − '
    return dice ? `${dice}${sign}${Math.abs(part.flat)}` : String(part.flat)
}

/** Os quatro graus de uma salvaguarda básica sobre o dano rolado (½ arredondado para baixo). */
export const basicSaveLine = (total: number): string =>
    `Falha ${total} · Sucesso ${Math.floor(total / 2)} · Falha crítica ${2 * total} · Sucesso crítico 0`

/** Texto para leitor de tela e para o histórico: "Fortitude: 23 (d20 8 + 15)". */
export function rollSummaryText(r: TableRoll): string {
    const bits: string[] = []
    if (r.check) bits.push(`${r.check.total} (d20 ${r.check.d20} ${r.check.mod >= 0 ? '+' : '−'} ${Math.abs(r.check.mod)})`)
    if (r.damage) {
        bits.push(`dano ${r.damage.total}${r.damage.crit ? `, crítico ${r.damage.crit.total}` : ''}`)
    }
    if (r.free) bits.push(`${partFormula(r.free)} = ${r.free.total}`)
    return `${r.by || 'Alguém'} — ${r.title}: ${bits.join('; ')}`
}
