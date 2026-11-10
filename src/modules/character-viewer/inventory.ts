// As linhas do Inventário. Mora fora da `InventorySection` porque a lista de
// descrições pré-traduzidas (`descriptionNames.ts`) precisa dos MESMOS nomes que
// a aba busca na AON ao tocar num item.

import type { BuildInfo, Weapon } from '../../pathbuilder/types'
import { itemDisplayName } from './customRunes'
import { relicNameOfWeapon, relicOfArmor, relicOfWeapon } from './relics'
import { tr } from '../../i18n'

/** Uma linha do inventário, já normalizada venha de onde vier. */
export interface ItemRow {
    /** Como aparece na lista (pode trazer runas: "+2 Striking Warhammer"). */
    label: string
    /** Nome canônico, o que se busca na AON. */
    name: string
    /** Quantidade que a pessoa tem AGORA: a da ficha mais o que recebeu menos o que passou (`gifts.ts`). */
    qty: number
    /** A quantidade da ficha, que é a chave do contador de uso (`consumed.of`). */
    sheetQty: number
    /** Chips à direita: "Invested", "Vestida", "Arma"… */
    tags: string[]
    /** Só o equipamento pode ser consumível — arma e armadura nunca são. */
    equipment: boolean
}

/**
 * Armas e armaduras são inventário como qualquer outro item, mas o Pathbuilder
 * as exporta em listas próprias (`weapons`/`armor`, usadas na aba de Combate) —
 * então elas sumiam daqui. A lista junta as três, sem tocar no JSON da ficha.
 */
function relicLabel(build: BuildInfo, w: Weapon): string {
    const technical = itemDisplayName(build, w, 'weapon')
    const relic = relicNameOfWeapon(build, w)
    return relic && relic !== technical ? `${relic} — ${technical}` : technical
}

export function inventoryRows(build: BuildInfo): ItemRow[] {
    const weapons = (build.weapons ?? []).map((w) => ({
        // Relíquia: o nome próprio, com o nome técnico (runas e tudo) ao lado — é aqui que ele mora.
        label: relicLabel(build, w),
        name: w.name,
        qty: w.qty,
        sheetQty: w.qty,
        tags: [tr('Arma', 'Weapon'), ...(relicOfWeapon(build, w)?.aspects ?? [])],
        equipment: false,
    }))
    const armor = (build.armor ?? []).map((a) => {
        // Runa homebrew (`customRunes.ts`) no lugar da que ela substituiu.
        const technical = itemDisplayName(build, a, 'armor')
        const relic = relicOfArmor(build, a)
        const clothing = relic?.on?.kind === 'armor' && relic.on.clothing
        return {
            label: relic && relic.name !== technical ? `${relic.name} — ${technical}` : technical,
            name: a.name,
            qty: a.qty,
            sheetQty: a.qty,
            tags: [
                tr('Armadura', 'Armor'),
                ...(a.worn ? [tr('Vestida', 'Worn')] : []),
                ...(clothing ? [tr('Roupa', 'Clothing')] : []),
                ...(relic?.aspects ?? []),
            ],
            equipment: false,
        }
    })
    const equipment = (build.equipment ?? []).map(([name, qty, status]) => ({
        label: name,
        name,
        qty,
        sheetQty: qty,
        tags: status ? [status] : [],
        equipment: true,
    }))
    return [...weapons, ...armor, ...equipment]
}
