/**
 * Traços de armas que a AON não tem (item caseiro ou de terceiros) — o jogador diz quais são e o
 * catálogo guarda, casado pelo NOME do personagem e da arma, como `customRunes.ts`. Sem isso a arma
 * rola "sem traços": corpo a corpo de FOR, sem acuidade e sem o estratagema do Investigador.
 *
 * - **Braço Sônico** (Miranda's Arm, a relíquia da Miranda): **acuidade**, informado pelo jogador
 *   em 2026-10-23. Não é ágil (o MAP é −5/−10), e não tem grupo nem traço de crítico conhecido.
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
]

/** Os traços da arma caseira do personagem, ou `null` quando ela é uma arma da AON. */
export function homebrewGear(build: BuildInfo, weaponName: string): WeaponGear | null {
    const hit = HOMEBREW_WEAPONS.find((h) => h.character(build) && h.weapon.toLowerCase() === weaponName.trim().toLowerCase())
    return hit ? { kind: 'weapon', name: hit.weapon, base: hit.weapon, ...hit.gear } : null
}
