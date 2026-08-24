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

/** Slug do personagem: `Ghan Buri` → `ghan-buri`. */
export const charSlug = (build: BuildInfo): string => slugify(build.name || '') || 'sem-nome'

export const hpKeyFor = (build: BuildInfo): string => `${charSlug(build)}/hp`
export const slotsKeyFor = (build: BuildInfo): string => `${charSlug(build)}/slots`
export const conditionsKeyFor = (build: BuildInfo): string => `${charSlug(build)}/conditions`

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
