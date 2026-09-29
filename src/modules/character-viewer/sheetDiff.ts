import { parseFeatEntry, type BuildInfo } from '../character-sheet/types'

/**
 * O que muda entre a ficha da mesa e o JSON que alguém quer publicar — é o que
 * o diálogo mostra antes de sobrescrever. Não há login, então a confirmação
 * com a diferença à vista é a salvaguarda (junto da versão anterior guardada
 * no servidor): publicar a ficha errada por engano tem de ser visível.
 */
export interface SheetChange {
    label: string
    added: string[]
    removed: string[]
}

export interface SheetDiff {
    levelFrom: number
    levelTo: number
    changes: SheetChange[]
    /** Nada além do que o diff enxerga mudou (pode ser só um número). */
    identical: boolean
}

const feats = (b: BuildInfo) => (b.feats ?? []).map((f) => parseFeatEntry(f).name).filter(Boolean)

function spells(b: BuildInfo): string[] {
    const out: string[] = []
    for (const caster of b.spellCasters ?? []) {
        for (const lvl of caster.spells ?? []) out.push(...(lvl.list ?? []))
    }
    for (const tradition of Object.values(b.focus ?? {})) {
        for (const ability of Object.values(tradition ?? {})) {
            out.push(...(ability.focusCantrips ?? []), ...(ability.focusSpells ?? []))
        }
    }
    return out
}

/** Itens com quantidade no rótulo: "Elixir of Life (Lesser) ×2". */
function items(b: BuildInfo): string[] {
    const withQty = (name: string, qty: number) => (qty > 1 ? `${name} ×${qty}` : name)
    return [
        ...(b.weapons ?? []).map((w) => withQty(w.display || w.name, w.qty)),
        ...(b.armor ?? []).map((a) => withQty(a.display || a.name, a.qty)),
        ...(b.equipment ?? []).map(([name, qty]) => withQty(name, qty)),
    ]
}

/** Diferença de multiconjunto: repetidos contam (duas Breastplates). */
function compare(label: string, before: string[], after: string[]): SheetChange | null {
    const count = (list: string[]) => list.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())
    const a = count(before)
    const b = count(after)
    const added: string[] = []
    const removed: string[] = []
    for (const [name, n] of b) for (let i = a.get(name) ?? 0; i < n; i++) added.push(name)
    for (const [name, n] of a) for (let i = b.get(name) ?? 0; i < n; i++) removed.push(name)
    return added.length || removed.length ? { label, added, removed } : null
}

export function diffSheets(before: BuildInfo, after: BuildInfo): SheetDiff {
    const changes = [
        compare('Talentos', feats(before), feats(after)),
        compare('Habilidades', before.specials ?? [], after.specials ?? []),
        compare('Magias', spells(before), spells(after)),
        compare('Itens', items(before), items(after)),
    ].filter((c): c is SheetChange => c !== null)

    return {
        levelFrom: before.level,
        levelTo: after.level,
        changes,
        identical: changes.length === 0 && before.level === after.level
            && JSON.stringify(before) === JSON.stringify(after),
    }
}
