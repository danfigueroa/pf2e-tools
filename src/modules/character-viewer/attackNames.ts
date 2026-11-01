/**
 * Nome próprio das armas e ataques ("Fenrir" para a Longbow). O Pathbuilder manda só o nome do item, e o
 * jogador pode querer o dele. É APRESENTAÇÃO: as regras continuam casando pelo nome original (traços da
 * AON, `magicWeapons.ts`, `homebrewGear.ts`, runas), por isso o apelido é um campo à parte da mesa
 * (`names`, por personagem) — nunca um edit do JSON da ficha, que o próximo export desfaria.
 */
import type { BuildInfo, Weapon } from '../../pathbuilder/types'

export type AttackNamesStored = Record<string, string>

export const MAX_NAME_LENGTH = 40
export const MAX_NAMES = 30

export const NO_NAMES: AttackNamesStored = {}

export function sanitizeAttackNames(raw: unknown): AttackNamesStored {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NO_NAMES
    const out: AttackNamesStored = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (Object.keys(out).length >= MAX_NAMES) break
        if (typeof value !== 'string' || key.length > 120) continue
        const name = value.trim().slice(0, MAX_NAME_LENGTH)
        if (name) out[key] = name
    }
    return out
}

export const isAttackNamesEmpty = (s: AttackNamesStored) => Object.keys(s).length === 0

/**
 * A chave da arma: o `name` do Pathbuilder (que sobrevive a runa nova, ao contrário do `display`) mais a
 * ocorrência dele na lista — duas Daggers na ficha são dois apelidos.
 */
export function weaponNameKey(build: BuildInfo, weapon: Weapon): string {
    const same = (build.weapons ?? []).filter((w) => w.name === weapon.name)
    const nth = Math.max(0, same.indexOf(weapon))
    return `w:${weapon.name.toLowerCase()}#${nth}`
}

/** A chave de um ataque desarmado (`UnarmedAttack.id`). */
export const unarmedNameKey = (id: string): string => `u:${id}`

/**
 * O nome que vai ao feed e ao título do diálogo: o apelido seguido do nome da arma entre parênteses —
 * quem lê o histórico da mesa vê qual é a arma de verdade. Sem apelido, o nome de sempre.
 */
export const attackLabel = (nickname: string | undefined, original: string): string =>
    nickname ? `${nickname} (${original})` : original
