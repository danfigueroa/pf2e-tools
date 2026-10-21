import type { BuildInfo } from '../../pathbuilder/types'

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

/**
 * Personagem que mudou de nome no Pathbuilder mantém a identidade antiga: o
 * token, o PV e a ficha publicada moram no slug de antes. Espelha
 * `SLUG_ALIASES` em `api/_lib/sheet-store.js` — mexeu num, mexe no outro.
 */
const SLUG_ALIASES: Record<string, string> = {
    'thalos-alba': 'thalos',
}

/** Slug a partir do nome cru — o gerenciador de iniciativa guarda só o nome. */
export const charSlugFromName = (name: string): string => {
    const slug = slugify(name || '') || 'sem-nome'
    return SLUG_ALIASES[slug] ?? slug
}

/** Slug do personagem: `Ghan Buri` → `ghan-buri`. */
export const charSlug = (build: BuildInfo): string => charSlugFromName(build.name)

export const hpKeyForSlug = (slug: string): string => `${slug}/hp`
export const conditionsKeyForSlug = (slug: string): string => `${slug}/conditions`
export const afflictionsKeyForSlug = (slug: string): string => `${slug}/afflictions`
export const persistentKeyForSlug = (slug: string): string => `${slug}/persistent`

export const hpKeyFor = (build: BuildInfo): string => hpKeyForSlug(charSlug(build))
export const slotsKeyFor = (build: BuildInfo): string => `${charSlug(build)}/slots`
export const mythicKeyFor = (build: BuildInfo): string => `${charSlug(build)}/mythic`
export const consumedKeyFor = (build: BuildInfo): string => `${charSlug(build)}/consumed`
export const shieldKeyForSlug = (slug: string): string => `${slug}/shield`
export const shieldKeyFor = (build: BuildInfo): string => shieldKeyForSlug(charSlug(build))
export const conditionsKeyFor = (build: BuildInfo): string => conditionsKeyForSlug(charSlug(build))
export const afflictionsKeyFor = (build: BuildInfo): string => afflictionsKeyForSlug(charSlug(build))
export const persistentKeyFor = (build: BuildInfo): string => persistentKeyForSlug(charSlug(build))
/** Enlarge/Shrink ligado (`sizeEffects.ts`) — o mapa lê o mesmo campo. */
export const sizeKeyForSlug = (slug: string): string => `${slug}/size`
export const sizeKeyFor = (build: BuildInfo): string => sizeKeyForSlug(charSlug(build))
/** Fúria do bárbaro (`rage.ts`) — a Iniciativa lê o mesmo campo. */
export const rageKeyForSlug = (slug: string): string => `${slug}/rage`
export const rageKeyFor = (build: BuildInfo): string => rageKeyForSlug(charSlug(build))
/** Unleash Psyche do Psíquico (`psyche.ts`). */
export const psycheKeyForSlug = (slug: string): string => `${slug}/psyche`
export const energyKeyForSlug = (slug: string): string => `${slug}/energy`
export const energyKeyFor = (build: BuildInfo): string => energyKeyForSlug(charSlug(build))
/** Arcane Cascade, Spellstrike e Summon Mythic Power do Magus (`magus.ts`). */
export const magusKeyForSlug = (slug: string): string => `${slug}/magus`
export const magusKeyFor = (build: BuildInfo): string => magusKeyForSlug(charSlug(build))
/** Hunt Prey e Gravity Weapon do Patrulheiro (`ranger.ts`). */
export const rangerKeyForSlug = (slug: string): string => `${slug}/ranger`
export const rangerKeyFor = (build: BuildInfo): string => rangerKeyForSlug(charSlug(build))
/** Veneno na arma do Ladino (`rogue.ts`). */
export const rogueKeyForSlug = (slug: string): string => `${slug}/rogue`
export const rogueKeyFor = (build: BuildInfo): string => rogueKeyForSlug(charSlug(build))
/** Ações do turno (`actions.ts`). */
export const actionsKeyForSlug = (slug: string): string => `${slug}/actions`
export const actionsKeyFor = (build: BuildInfo): string => actionsKeyForSlug(charSlug(build))
/** Atividades de uso limitado já gastas ("uma vez por dia") — `activities.ts`. */
export const usesKeyForSlug = (slug: string): string => `${slug}/uses`
export const usesKeyFor = (build: BuildInfo): string => usesKeyForSlug(charSlug(build))
/** Companheiros de combate (`companions.ts`). */
export const companionsKeyForSlug = (slug: string): string => `${slug}/companions`
export const companionsKeyFor = (build: BuildInfo): string => companionsKeyForSlug(charSlug(build))
/** O que o personagem já passou a cada colega (`gifts.ts`). */
export const gaveKeyForSlug = (slug: string): string => `${slug}/gave`
export const gaveKeyFor = (build: BuildInfo): string => gaveKeyForSlug(charSlug(build))
export const psycheKeyFor = (build: BuildInfo): string => psycheKeyForSlug(charSlug(build))

/**
 * Chave dos hooks que a página monta antes de haver ficha (são incondicionais).
 * Slug vazio, que nenhum nome gera: `useSharedState` não vai à rede com ele —
 * antes, a tela de upload pedia `/api/state?char=none` à toa.
 */
export const noCharKey = (field: string): string => `/${field}`

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
