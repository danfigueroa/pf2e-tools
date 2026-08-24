import type { BuildInfo } from '../character-sheet/types'

/**
 * Identidade do personagem para o estado compartilhado da mesa.
 *
 * O JSON do Pathbuilder não exporta id nenhum, então o identificador tem que
 * sair da própria ficha. Usa **só o nome**: a chave antiga incluía o nível, e
 * qualquer level-up (re-upload do JSON) órfãva PV, slots e condições. Numa mesa
 * o estrago seria coletivo, então o nível fica de fora.
 *
 * As chaves entregues aos hooks têm o formato `"<slug>/<campo>"` — o serviço de
 * sincronia corta no primeiro `/`.
 */

const slugify = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64)

/** Slug a partir do nome cru — o gerenciador de iniciativa guarda só o nome. */
export const charSlugFromName = (name: string): string => slugify(name || '') || 'sem-nome'

/** Slug do personagem: `Ghan Buri` → `ghan-buri`. */
export const charSlug = (build: BuildInfo): string => charSlugFromName(build.name)

export const hpKeyForSlug = (slug: string): string => `${slug}/hp`
export const conditionsKeyForSlug = (slug: string): string => `${slug}/conditions`

export const hpKeyFor = (build: BuildInfo): string => hpKeyForSlug(charSlug(build))
export const slotsKeyFor = (build: BuildInfo): string => `${charSlug(build)}/slots`
export const mythicKeyFor = (build: BuildInfo): string => `${charSlug(build)}/mythic`
export const conditionsKeyFor = (build: BuildInfo): string => conditionsKeyForSlug(charSlug(build))

/** Companheiro/familiar, namespaced dentro do personagem dono. */
export const petKeyFor = (build: BuildInfo, kind: string, name: string, idx: number): string =>
    `${charSlug(build)}/pet:${kind}:${slugify(name) || 'sem-nome'}#${idx}`

// --- Chaves da versão local-only, lidas uma vez para migrar o estado ---------

/** Chave que `useHpTracker` usava antes da sincronia (com nível). */
export const legacyCharKey = (build: BuildInfo): string =>
    [build.name, build.class, build.level, build.ancestry].join('|')

export const legacyPetKey = (build: BuildInfo, kind: string, name: string, idx: number): string =>
    `${legacyCharKey(build)}|${kind}:${name}#${idx}`

/** Lê e faz parse de uma chave antiga do localStorage. */
export function readLegacy(prefix: string, key: string): unknown | null {
    try {
        const raw = localStorage.getItem(prefix + key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}
