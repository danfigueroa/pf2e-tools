/* i18n-ignore-file */
// Importação reversa com o catálogo publicado (Ficha Virtual → Criador): o mesmo caminho do `ImportFromSheet`, mas sem
// React nem rede própria, para o servidor (ficha nova do Pathbuilder) e o script de carga (`import-sheets-to-builder.mjs`)
// criarem o build igual ao que a tela criaria.
import { parseCharacterJson, parseFeatEntry } from '../../../pathbuilder/types'
import type { BuildState, MesaRules } from '../types'
import type { RuleEntry } from '../rules/types'
import type { SpellSlotTable } from './spells'
import { buildRulesIndex } from './rulesIndex'
import { importPathbuilder, type ImportReport } from './import'
import { featListPaths, ITEM_LISTS, ruleListSlug, type CatalogReader } from './catalog'

export interface CatalogImport {
    state: BuildState
    report: ImportReport
    className: string | null
    name: string
}

/** Um export do Pathbuilder (`{ success, build }`) vira um `BuildState`, com as listas que o personagem usa. */
export async function importFromCatalog(json: unknown, ctx: { reader: CatalogReader; mesaRules?: MesaRules | null; homebrew?: RuleEntry[] }): Promise<CatalogImport> {
    const b = parseCharacterJson(json)
    const read = async (path: string): Promise<RuleEntry[]> => {
        const raw = await ctx.reader.read(path).catch(() => null)
        return Array.isArray(raw) ? raw as RuleEntry[] : []
    }
    const [a, h, bg, c, l, cf, ar] = await Promise.all(
        ['core/ancestries', 'core/heritages', 'core/backgrounds', 'core/classes', 'core/languages', 'core/class-features', 'core/archetypes'].map(read))
    const tables = await ctx.reader.read('core/tables').catch(() => null) as { spellSlots?: SpellSlotTable } | null
    const her = h.find((x) => x.name === b.heritage)
    const dedications = b.feats.map((f) => parseFeatEntry(f).name).filter((n) => / Dedication$/.test(n)).map((n) => n.replace(/ Dedication$/, ''))
    const traditions = [...new Set(b.spellCasters.map((x) => x.magicTradition).filter((t) => ['arcane', 'divine', 'occult', 'primal'].includes(t)))]
    const paths = [
        ...featListPaths({ className: b.class, ancestryName: b.ancestry, versatileHeritage: her && !her.heritage?.ancestry ? her.name : undefined, mythic: true,
            archetypes: dedications.map(ruleListSlug), traditions }),
        ...ITEM_LISTS.map((x) => `items/${x}`), 'companions/animal', 'companions/familiar', 'core/deities',
    ]
    const extra = await Promise.all(paths.map(read))
    const homebrew = ctx.homebrew ?? []
    const index = buildRulesIndex([a, h, bg, c, l, cf, ...extra, ar, homebrew], l)
    const { state, report } = importPathbuilder(b, { rules: index, mesaRules: ctx.mesaRules ?? undefined, classOptions: cf, tables: tables ?? undefined })
    return { state, report, className: b.class || null, name: b.name }
}
