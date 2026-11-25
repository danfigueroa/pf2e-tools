// Quais listas do catálogo um personagem usa e a compilação a partir de um leitor de listas. Puro (sem React, rede nem
// IndexedDB): o editor usa com o loader do navegador e o servidor usa no "Aplicar na mesa" (F10.1), com o pacote gerado
// por `scripts/build-engine.mjs`. Os dois decidem as listas pela mesma função, senão o número da mesa e o do editor
// divergiriam por uma lista que um baixou e o outro não.
import type { BuildState, MesaRules } from '../types'
import type { RuleEntry } from '../rules/types'
import type { Compiled, RulesIndex } from './types'
import type { SpellSlotTable } from './spells'
import { buildRulesIndex } from './rulesIndex'
import { compileBuild } from './compile'
import { exportBuild } from './export'
import { variantFlags } from './slots'
import { CLASS_ARCHETYPE, selectedClassArchetype } from './classArchetypes'
import { chosenRuleIds } from '../remaster'

/** Mesmo slug do `rules-packages.js` (`feats/class/<slug>`). */
export const ruleListSlug = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** O que o personagem usa e decide quais listas de talento baixar. */
export interface FeatListNeeds {
    references?: string[]
    className?: string
    ancestryName?: string
    /** Herança versátil (Aiuvarin, Nephilim…) tem talentos próprios. */
    versatileHeritage?: string
    mythic?: boolean
    /** Arquétipos dos talentos escolhidos (qualificador `archetype:<slug>`). */
    archetypes: string[]
    /** Tradições de magia do personagem (listas `spells/<tradição>`); o foco vem junto quando há alguma. */
    traditions?: string[]
    /** Inventário ou aba Equipamento: todas as listas de item (o inventário guarda só o id). */
    items?: boolean
    /** Companheiros: tipos de companheiro animal e familiares. */
    companions?: boolean
}

export const ITEM_LISTS = ['weapons', 'armor', 'shields', 'runes', 'materials', 'worn', 'held', 'consumables', 'gear', 'staves-wands', 'relics'] as const

/** Caminhos das listas de talento que o personagem pode usar. */
export function featListPaths(needs: FeatListNeeds): string[] {
    return [
        'feats/general', 'feats/skill',
        needs.mythic ? 'feats/mythic' : null,
        needs.className ? `feats/class/${ruleListSlug(needs.className)}` : null,
        needs.ancestryName ? `feats/ancestry/${ruleListSlug(needs.ancestryName)}` : null,
        needs.versatileHeritage ? `feats/ancestry/${ruleListSlug(needs.versatileHeritage)}` : null,
        ...needs.archetypes.map((a) => `feats/archetype/${ruleListSlug(a)}`),
        ...(needs.traditions ?? []).map((t) => `spells/${t}`),
        'spells/focus', 'spells/rituals',
        ...(needs.items ? ITEM_LISTS.map((l) => `items/${l}`) : []),
        ...(needs.companions ? ['companions/animal', 'companions/familiar'] : []),
    ].filter((p): p is string => Boolean(p))
}

/** As listas do núcleo, sempre carregadas. */
export interface CoreLists {
    ancestries: RuleEntry[]
    heritages: RuleEntry[]
    backgrounds: RuleEntry[]
    classes: RuleEntry[]
    languages: RuleEntry[]
    classFeatures: RuleEntry[]
    archetypes: RuleEntry[]
}

/**
 * As listas que o personagem salvo usa. `extra` é o que só a tela sabe: o arquétipo que o seletor navega, a aba de
 * Equipamento aberta e as tradições dos conjuradores que a compilação anterior achou (arquétipo incluído).
 */
export function needsOf(state: BuildState, core: CoreLists, mesaRules: MesaRules | null | undefined,
    extra: { browseArchetype?: string | null; itemsWanted?: boolean; traditions?: string[] } = {}): FeatListNeeds {
    const cls = core.classes.find((c) => c.id === state.class.id)
    const anc = core.ancestries.find((a) => a.id === state.origin.ancestry)
    const her = core.heritages.find((h) => h.id === state.origin.heritage)
    const archetypes = new Set<string>(extra.browseArchetype ? [extra.browseArchetype] : [])
    const selected = selectedClassArchetype(state.choices[CLASS_ARCHETYPE], cls)
    const archetype = core.archetypes.find((a) => a.id === selected)
    if (archetype) archetypes.add(archetype.name)
    for (const choice of Object.values(state.choices)) {
        if ('qualifier' in choice && choice.qualifier?.startsWith('archetype:')) archetypes.add(choice.qualifier.slice(10))
    }
    // Tradições: a da classe (uma) ou a escolhida pela subclasse, mais as dos outros conjuradores.
    const list = cls?.class?.casting?.traditions ?? []
    const chosen = state.choices['spell-tradition']
    const own = list.length === 1 ? list : chosen && 'value' in chosen ? [chosen.value] : []
    return {
        references: [...chosenRuleIds(state)].sort(),
        className: cls?.name, ancestryName: anc?.name, versatileHeritage: her && !her.heritage?.ancestry ? her.name : undefined,
        mythic: variantFlags(state, mesaRules ?? undefined).mythic, archetypes: [...archetypes].sort(),
        items: state.inventory.length > 0 || state.formulas.length > 0 || !!extra.itemsWanted,
        companions: state.companions.length > 0 || !!extra.itemsWanted,
        traditions: [...new Set([...own, ...(extra.traditions ?? [])])].map((t) => t.toLowerCase()),
    }
}

/** Uma entrada de `core/remaster`: o id legado, a lista dele e os destinos com as listas deles. */
export interface RemasterRow { id: string; list?: string; targets: { id: string; list?: string }[] }

export interface CatalogReader {
    /** Lê uma lista publicada (`core/classes`, `feats/general`…). Lista inexistente = `null`. */
    read: (path: string) => Promise<unknown>
}

export interface CatalogCompile {
    compiled: Compiled
    index: RulesIndex
    sheet: ReturnType<typeof exportBuild>
}

/**
 * As entradas de `ids` que estão em listas que a carga habitual não traz: pela lista de cada uma no `core/locations`
 * (versões do catálogo sem ele caem no `core/remaster`, que só cobre o legado). Editor e servidor usam a mesma.
 */
export async function locate(ids: Set<string>, reader: CatalogReader, read: (path: string) => Promise<RuleEntry[]>): Promise<RuleEntry[]> {
    const paths = new Set<string>()
    const locations = await reader.read('core/locations') as Record<string, string> | null
    for (const id of ids) if (locations?.[id]) paths.add(locations[id])
    const rows = (await reader.read('core/remaster') as RemasterRow[] | null) ?? []
    for (const row of rows) {
        if (ids.has(row.id) && row.list) paths.add(row.list)
        for (const target of row.targets ?? []) if (ids.has(target.id) && target.list) paths.add(target.list)
    }
    return (await Promise.all([...paths].map(read))).flat().filter((e) => ids.has(e.id))
}

/**
 * Compila o personagem salvo lendo o catálogo por `reader`, com o conteúdo da mesa e as regras de criação: o mesmo
 * caminho do editor, com todas as listas que o estado pede (nada depende da aba aberta). Repete enquanto a compilação
 * achar uma tradição nova (conjurador de arquétipo) e busca, pelo `core/remaster`, a lista de referências que a carga
 * habitual não resolveu.
 */
export async function compileFromCatalog(state: BuildState, ctx: {
    reader: CatalogReader
    mesaRules?: MesaRules | null
    homebrew?: RuleEntry[]
    buildId?: string
}): Promise<CatalogCompile> {
    const lists = new Map<string, RuleEntry[]>()
    const read = async (path: string): Promise<RuleEntry[]> => {
        if (!lists.has(path)) {
            const raw = await ctx.reader.read(path)
            lists.set(path, Array.isArray(raw) ? raw as RuleEntry[] : [])
        }
        return lists.get(path)!
    }
    const [ancestries, heritages, backgrounds, classes, languages, classFeatures, archetypes] = await Promise.all(
        ['core/ancestries', 'core/heritages', 'core/backgrounds', 'core/classes', 'core/languages', 'core/class-features', 'core/archetypes'].map(read))
    const tables = await ctx.reader.read('core/tables') as { spellSlots?: SpellSlotTable } | null
    const homebrew = ctx.homebrew ?? []
    const of = (type: string) => homebrew.filter((e) => e.type === type)
    const core: CoreLists = {
        ancestries, heritages: [...heritages, ...of('heritage')], backgrounds: [...backgrounds, ...of('background')], classes, languages, classFeatures, archetypes,
    }
    const loose = homebrew.filter((e) => e.type !== 'background' && e.type !== 'heritage')
    const supplement: RuleEntry[] = []

    let traditions: string[] = []
    let result: CatalogCompile | null = null
    let remasterTried = false
    for (let round = 0; round < 4; round += 1) {
        const needs = needsOf(state, core, ctx.mesaRules, { traditions })
        const loaded = await Promise.all(featListPaths(needs).map(read))
        const index = buildRulesIndex([core.ancestries, core.heritages, core.backgrounds, core.classes, core.languages, core.classFeatures,
            loaded.flat(), loose, core.archetypes, supplement], core.languages)
        // Escolhas salvas fora das listas habituais (talento de outro arquétipo, magia de outra tradição, divindade, uma
        // revisão que mudou a entrada de lista): a lista vem do `core/locations`, e o legado, do `core/remaster`.
        const missing = new Set((needs.references ?? []).filter((id) => !id.startsWith('custom:') && !id.startsWith('mesa:') && !index.get(id)))
        if (missing.size && !remasterTried) {
            remasterTried = true
            const found = await locate(missing, ctx.reader, read)
            if (found.length) { supplement.push(...found); continue }
        }
        const compiled = compileBuild(state, {
            rules: index, mesaRules: ctx.mesaRules ?? undefined, classOptions: core.classFeatures, tables: tables ?? undefined, buildId: ctx.buildId,
        })
        result = { compiled, index, sheet: exportBuild(state, compiled, { rules: index, buildId: ctx.buildId }) }
        const next = [...new Set([...traditions, ...compiled.casters.map((c) => c.tradition).filter((t): t is NonNullable<typeof t> => !!t)])].sort()
        if (next.length === traditions.length) break
        traditions = next
    }
    return result!
}
