import { tr } from '../../../i18n'
import type { BuildInfo, Weapon } from '../../../pathbuilder/types'
import { strikingDice } from '../../../pathbuilder/weapon'
import {
    giftMinLevel, giftUnlocked, houseRelicRunes, relicLevel, relicsOf, withRelicRunes,
    type RelicEntry, type RelicGift, type RelicRune,
} from '../../character-viewer/relics'
import type { ResolvedItem } from '../engine/equipment'

// Relíquias no Criador, pelo MESMO catálogo e as mesmas contas da Ficha (`character-viewer/relics.ts`): a Ficha é a
// referência. A relíquia mora num item pelo nome (o apelido do Pathbuilder, o nome do item) e as runas das dádivas e da
// regra da casa entram no golpe pelo `withRelicRunes`, nunca no gasto (não são compradas). Puro, sem React.

export interface RelicGiftView {
    gift: RelicGift
    index: number
    unlocked: boolean
    minLevel: number
}

export interface RelicView {
    relic: RelicEntry
    level: number
    gifts: RelicGiftView[]
    /** Runas fundamentais da regra da mesa (toda relíquia que é arma, na Casa do Gordo). */
    house: RelicRune | null
    /** Runas das dádivas liberadas. */
    runeGifts: RelicGiftView[]
    /** A arma como a Ficha mostra (com as runas da relíquia), se a relíquia é arma e está no retrato. */
    weapon?: { attack: number; damageBonus: number; dice: number; die: string; damageType: string; runes: string[]; extraDamage: string[]; pot: number; str: string }
}

const same = (a: string | undefined, b: string | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

function viewOf(relic: RelicEntry, build: BuildInfo, finalBuild: BuildInfo): RelicView {
    const level = relicLevel(build)
    const gifts = relic.gifts.map((gift, index) => ({ gift, index, unlocked: giftUnlocked(gift, index, level), minLevel: giftMinLevel(gift, index) }))
    let weapon: RelicView['weapon']
    if (relic.on?.kind === 'weapon') {
        const on = relic.on.weapon
        const w: Weapon | undefined = finalBuild.weapons?.find((x) => same(x.name, on) || same(x.display, on))
        if (w) {
            weapon = { attack: w.attack, damageBonus: w.damageBonus, dice: strikingDice(w.str), die: w.die, damageType: w.damageType, runes: w.runes ?? [], extraDamage: w.extraDamage ?? [], pot: w.pot, str: w.str ?? '' }
        }
    }
    return { relic, level, gifts, house: houseRelicRunes(relic), runeGifts: gifts.filter((g) => g.gift.kind === 'rune' && g.unlocked), weapon }
}

/** As relíquias do personagem: as que moram num item da mochila (pela chave dele) e as avulsas. */
export function relicViews(build: BuildInfo | null | undefined, items: ResolvedItem[]): { byItem: Map<string, RelicView>; loose: RelicView[] } {
    const byItem = new Map<string, RelicView>()
    const loose: RelicView[] = []
    if (!build) return { byItem, loose }
    const relics = relicsOf(build).filter((r) => !r.id.startsWith('player:'))
    if (!relics.length) return { byItem, loose }
    const finalBuild = withRelicRunes(build)
    for (const relic of relics) {
        const on = relic.on
        const names = (it: ResolvedItem) => [it.inv.customName, it.entry?.name, it.base?.name, it.name]
        const attached = items.find((it) => it.inv.relic?.legacyId === relic.id)
        const item = attached ?? (!on ? undefined : items.find((it) => {
            const ok = names(it).some((n) => same(n, on.kind === 'weapon' ? on.weapon : on.kind === 'armor' ? on.armor : on.name))
            if (!ok) return false
            if (on.kind === 'weapon') return !!it.base?.item?.weapon
            if (on.kind === 'armor') return !!it.base?.item?.armor
            return true
        }))
        const view = viewOf(relic, build, finalBuild)
        if (item && !byItem.has(item.key)) byItem.set(item.key, view)
        else loose.push(view)
    }
    return { byItem, loose }
}

/** "+1 · striking": as runas de uma dádiva ou da regra da mesa, para o cartão. */
export const relicRuneLabel = (r: RelicRune): string =>
    [r.potency && `+${r.potency}`, r.striking, ...(r.property ?? []), r.armorPotency && `+${r.armorPotency}`, r.resilient].filter(Boolean).join(' · ')

const aspects: Record<string, string> = {
  Air: tr('Ar', 'Air'), Beast: tr('Fera', 'Beast'), Celestial: tr('Celestial', 'Celestial'),
  Death: tr('Morte', 'Death'), Earth: tr('Terra', 'Earth'), Fiend: tr('Ínfero', 'Fiend'),
  Fire: tr('Fogo', 'Fire'), Life: tr('Vida', 'Life'), Mind: tr('Mente', 'Mind'),
  Plant: tr('Planta', 'Plant'), Shadow: tr('Sombra', 'Shadow'), Water: tr('Água', 'Water'),
};

export const relicAspectLabel = (aspect: string) => aspects[aspect] ?? aspect
