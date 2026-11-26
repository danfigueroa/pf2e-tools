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
import { compileFromCatalog, featListPaths, ITEM_LISTS, ruleListSlug, type CatalogReader } from './catalog'
import type { RulesIndex } from './types'

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
    // Dedicação de classe (Swashbuckler Dedication): Basic/Advanced Flair escolhem talentos da lista dessa classe.
    // Só os talentos que a ficha marca como "<Classe> Feat": a lista inteira traria homônimos (Flashy Dodge, antes Nimble
    // Dodge) para o índice e trocaria talentos da própria classe.
    const flairNames = new Set(b.feats.filter((f) => Array.isArray(f) && / Feat$/.test(String(f[2] ?? ''))
        && dedications.some((d) => String(f[2]).toLowerCase() === `${d.toLowerCase()} feat`)).map((f) => String((f as unknown as unknown[])[0])))
    const dedicatedClasses = dedications.filter((d) => c.some((x) => x.name.toLowerCase() === d.toLowerCase())).map((d) => `feats/class/${ruleListSlug(d)}`)
    const flair = (await Promise.all(dedicatedClasses.map(read))).flat().filter((e) => flairNames.has(e.name))
    const paths = [
        ...featListPaths({ className: b.class, ancestryName: b.ancestry, versatileHeritage: her && !her.heritage?.ancestry ? her.name : undefined, mythic: true,
            archetypes: dedications.map(ruleListSlug), traditions }),
        ...ITEM_LISTS.map((x) => `items/${x}`), 'companions/animal', 'companions/familiar', 'core/deities',
    ]
    const extra = await Promise.all(paths.map(read))
    const homebrew = ctx.homebrew ?? []
    const index = buildRulesIndex([a, h, bg, c, l, cf, ...extra, ar, homebrew, flair], l)
    const base = { mesaRules: ctx.mesaRules ?? undefined, classOptions: cf, tables: tables ?? undefined }
    const first = importPathbuilder(b, { rules: index, ...base }, { reconcile: false })
    // A reconciliação com a Ficha usa o índice da compilação de verdade (a do "Aplicar na mesa", com as listas que o
    // `locate` acrescenta), senão o número reconciliado aqui muda ao compilar.
    const compiled = await compileFromCatalog(first.state, { reader: ctx.reader, mesaRules: ctx.mesaRules, homebrew })
    const merged: RulesIndex = {
        get: (id) => compiled.index.get(id) ?? index.get(id),
        byName: (name, type) => compiled.index.byName(name, type) ?? index.byName(name, type),
        named: (name) => { const a = compiled.index.named(name); return a.length ? a : index.named(name) },
        languages: index.languages,
    }
    const { state, report } = importPathbuilder(b, { rules: merged, ...base })
    return { state, report, className: b.class || null, name: b.name }
}
