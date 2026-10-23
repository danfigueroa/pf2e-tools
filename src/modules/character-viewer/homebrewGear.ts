/**
 * Traços de armas que a AON não tem (item caseiro ou de terceiros) — o jogador diz quais são e o
 * catálogo guarda, casado pelo NOME do personagem e da arma, como `customRunes.ts`. Sem isso a arma
 * rola "sem traços": corpo a corpo de FOR, sem acuidade e sem o estratagema do Investigador.
 *
 * - **Braço Sônico** (Miranda's Arm, a relíquia da Miranda): **acuidade**, informado pelo jogador
 *   em 2026-10-23. Não é ágil (o MAP é −5/−10), e não tem grupo nem traço de crítico conhecido.
 * - **Special Unarmed (1d6)** (Hearts Folly): o ataque desarmado dela, criado à mão no Pathbuilder. O jogador pediu
 *   para tratá-lo **como o Punho normal** (2026-10-23): na AON, Fist é ágil, de acuidade e não letal, do grupo
 *   brawling (Core Rulebook pg. 280 / Player Core pg. 277) — então MAP −4/−8 e a especialização crítica do Monge.
 */
import type { BuildInfo } from '../../pathbuilder/types'
import type { WeaponGear } from '../../services/gear'
import { nameStarts } from './customRunes'

interface HomebrewWeapon {
    character: (b: BuildInfo) => boolean
    /** O `name` da arma no Pathbuilder. */
    weapon: string
    gear: Omit<WeaponGear, 'kind' | 'name' | 'base'>
}

const HOMEBREW_WEAPONS: HomebrewWeapon[] = [
    {
        character: nameStarts('miranda'),
        weapon: 'Braço Sônico',
        gear: { traits: ['Finesse'], weaponType: 'melee', group: null },
    },
    {
        character: nameStarts('hearts'),
        weapon: 'Special Unarmed (1d6)',
        gear: { traits: ['Agile', 'Finesse', 'Nonlethal', 'Unarmed'], weaponType: 'melee', group: 'Brawling' },
    },
]

/** Os traços da arma caseira do personagem, ou `null` quando ela é uma arma da AON. */
export function homebrewGear(build: BuildInfo, weaponName: string): WeaponGear | null {
    const hit = HOMEBREW_WEAPONS.find((h) => h.character(build) && h.weapon.toLowerCase() === weaponName.trim().toLowerCase())
    return hit ? { kind: 'weapon', name: hit.weapon, base: hit.weapon, ...hit.gear } : null
}
