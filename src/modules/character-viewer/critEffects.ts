// O que um CRÍTICO acrescenta além do dobro e de deadly/fatal: o efeito das runas
// de propriedade e a especialização crítica do grupo da arma.
//
// O Pathbuilder não exporta nada disso — só `runes` (nomes) e o `extraDamage` do
// acerto comum. A tabela é escrita à mão a partir do texto da AON (GM Core
// pg. 237-239 para as runas, Player Core para os grupos), como `unarmed.ts` e
// `magicWeapons.ts`, e casa pelo NOME da runa e pelo GRUPO da arma (`search?gear=`).
//
// - **Runa**: vale sempre que o golpe é crítico — sem chip.
// - **Especialização**: só vale para quem a tem (característica de classe, que a
//   ficha não registra), então é chip, DESLIGADO por padrão e lembrado por arma.
// - O que vira número entra no crítico; o resto (salvaguarda, condição, empurrão)
//   sai como aviso na nota, nunca como número inventado.
// - Dano do crítico NÃO é dobrado: é somado por fora, como o deadly.

import type { DiceExpr } from '../../dice/roll'
import { parseDiceExpr } from '../../dice/roll'

export interface CritDamage {
    expr: DiceExpr
    /** Fixo por dado da arma (Pick: 2); soma-se ao `expr`. */
    perDie?: number
    /** Tipo em inglês canônico, para `translateDamageType`. */
    type: string
    persistent: boolean
    /** `target` = a criatura atingida; `armor` = a armadura/escudo dela (Corrosive). */
    to: 'target' | 'armor'
}

export interface CritEffect {
    key: string
    source: 'rune' | 'spec'
    /** Rótulo curto: "Flaming", "Grupo Faca". */
    label: string
    damage?: CritDamage
    /** Dano de outra criatura igual ao extra do tipo (Shock): rolado uma vez, repetido. */
    mirrors?: string
    /** O que não vira número: salvaguarda, condição, movimento. */
    note?: string
}

const PICK_PER_DIE = 2

const dice = (text: string): DiceExpr => parseDiceExpr(text) ?? { groups: [], flat: 0 }

/** "Greater Flaming", "Flaming (Greater)" → { base: 'flaming', greater: true }. */
export function runeParts(raw: string): { base: string; greater: boolean } {
    const text = raw.toLowerCase().trim()
    const greater = /\b(greater|major|true)\b/.test(text)
    return { base: text.replace(/\((greater|major|true)\)|\b(greater|major|true)\b/g, '').replace(/\s+/g, ' ').trim(), greater }
}

export function runeCritEffects(runes: string[] | undefined): CritEffect[] {
    const out: CritEffect[] = []
    for (const raw of runes ?? []) {
        const { base, greater } = runeParts(raw)
        const dc = greater ? 34 : 24
        const key = `rune:${base}`
        switch (base) {
            case 'flaming':
                out.push({
                    key, source: 'rune', label: 'Flaming',
                    damage: { expr: dice(greater ? '2d10' : '1d10'), type: 'fire', persistent: true, to: 'target' },
                })
                break
            case 'corrosive':
                out.push({
                    key, source: 'rune', label: 'Corrosive',
                    damage: { expr: dice(greater ? '6d6' : '3d6'), type: 'acid', persistent: false, to: 'armor' },
                })
                break
            case 'shock':
                out.push({ key, source: 'rune', label: 'Shock', mirrors: 'electricity' })
                break
            case 'frost':
                out.push({ key, source: 'rune', label: 'Frost', note: `Fortitude CD ${dc} ou lento 1 até o fim do seu próximo turno` })
                break
            case 'thundering':
                out.push({
                    key, source: 'rune', label: 'Thundering',
                    note: `Fortitude CD ${dc} ou surdo ${greater ? 'permanente' : 'por 1 min (1 h na falha crítica)'}`,
                })
                break
        }
    }
    return out
}

/** Especialização crítica por grupo de arma (Player Core). `bonus` = bônus de item de ataque. */
export function specCritEffect(group: string | null | undefined, bonus: number): CritEffect | null {
    const g = (group || '').toLowerCase().trim()
    if (!g) return null
    const label = `Especialização · ${group}`
    const key = 'spec'
    const bleed = (die: string): CritEffect => ({
        key, source: 'spec', label,
        // O bônus de item do ataque soma ao sangramento (regra do grupo).
        damage: { expr: { ...dice(die), flat: Math.max(0, bonus) }, type: 'bleed', persistent: true, to: 'target' },
    })
    const note = (text: string): CritEffect => ({ key, source: 'spec', label, note: text })
    switch (g) {
        case 'knife': case 'dart': return bleed('1d6')
        case 'crossbow': return bleed('1d8')
        case 'pick':
            return { key, source: 'spec', label, damage: { expr: dice('0'), perDie: PICK_PER_DIE, type: 'piercing', persistent: false, to: 'target' } }
        case 'axe': return note('Outra criatura adjacente ao alvo e ao alcance, com CA menor que o ataque, sofre dano igual ao nº de dados da arma')
        case 'bomb': return note('Raio do respingo vai a 3 m')
        case 'bow': return note('Alvo preso a uma superfície adjacente fica imobilizado (Atletismo/Fuga para soltar)')
        case 'brawling': return note('Fortitude contra sua CD de classe ou lento 1 até o fim do seu próximo turno')
        case 'club': return note('Empurra o alvo até 3 m (movimento forçado)')
        case 'firearm': case 'sling': return note('Fortitude contra sua CD de classe ou atordoado 1')
        case 'flail': return note('Reflexos contra sua CD de classe ou cai caído')
        case 'hammer': return note('Fortitude contra sua CD de classe ou cai caído')
        case 'polearm': return note('Move o alvo 1,5 m numa direção à sua escolha (movimento forçado)')
        case 'shield': return note('Empurra o alvo 1,5 m para longe de você (movimento forçado)')
        case 'spear': return note('Alvo fica desajeitado 1 até o início do seu próximo turno')
        case 'sword': return note('Alvo fica desprevenido até o início do seu próximo turno')
    }
    return null
}

/**
 * De onde a ficha tira a especialização crítica, lido das características de
 * classe (`build.specials`) — para o jogador não ter de ligar o chip a cada golpe.
 *
 * - `always`: vale em todo golpe desta arma (Fighter Weapon Mastery, Swashbuckler).
 * - `raging`: vale em Fúria (Brutality, corpo a corpo).
 * - `prey`: vale contra a presa caçada (Ranger Weapon Expertise) — o caso comum,
 *   então começa ligada, com o chip para desligar.
 * - `situational`: depende do alvo ou de um efeito (Rogue contra desprevenido,
 *   Bard com composição) que a ficha não vê — chip desligado.
 * `null` = nada na ficha dá a especialização, e o chip nem aparece.
 */
export type SpecSource =
    | { kind: 'always' | 'raging' | 'prey' | 'situational'; reason: string }

export interface SpecContext {
    group: string | null | undefined
    ranged: boolean
    thrown: boolean
    agile: boolean
    finesse: boolean
}

export function specSourceFor(
    build: { class: string; specials: string[] },
    ctx: SpecContext,
): SpecSource | null {
    const has = (name: string) => build.specials.some((x) => x.toLowerCase() === name.toLowerCase())
    const cls = build.class.toLowerCase()
    const group = (ctx.group || '').toLowerCase()
    if (cls === 'fighter' && group && build.specials.some((x) => x.toLowerCase() === group)) {
        return { kind: 'always', reason: `Fighter Weapon Mastery (${ctx.group})` }
    }
    if (cls === 'swashbuckler' && has('Weapon Expertise')) {
        return { kind: 'always', reason: 'Weapon Expertise' }
    }
    if (cls === 'gunslinger' && has('Gunslinger Weapon Mastery') && ['firearm', 'crossbow'].includes(group)) {
        return { kind: 'always', reason: 'Gunslinger Weapon Mastery' }
    }
    if (cls === 'barbarian' && has('Brutality') && !ctx.ranged && !ctx.thrown) {
        return { kind: 'raging', reason: 'Brutality, em Fúria' }
    }
    if (cls === 'ranger' && has('Ranger Weapon Expertise')) {
        return { kind: 'prey', reason: 'Ranger Weapon Expertise, contra a presa caçada' }
    }
    if (cls === 'rogue' && has('Weapon Tricks') && (ctx.agile || ctx.finesse)) {
        return { kind: 'situational', reason: 'Weapon Tricks, contra alvo desprevenido' }
    }
    if (cls === 'bard' && has('Bard Weapon Expertise')) {
        return { kind: 'situational', reason: 'Bard Weapon Expertise, com uma composição ativa' }
    }
    return null
}
