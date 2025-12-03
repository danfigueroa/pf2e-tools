import jsPDF from 'jspdf'
import { formatAbilityScore, getAonSearchUrl } from './types'
import type { BuildInfo, SpellCaster, Weapon, Armor, Abilities } from './types'

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(title, 14, y)
    doc.setDrawColor(150)
    doc.line(14, y + 2, 196, y + 2)
}

function drawKeyValue(
    doc: jsPDF,
    label: string,
    value: string,
    x: number,
    y: number
) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(label + ':', x, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, x + Math.max(20, label.length * 2.5), y)
}

function addLink(doc: jsPDF, text: string, url: string, x: number, y: number) {
    doc.setTextColor(0, 102, 204)
    doc.text(text, x, y)
    const textWidth = doc.getTextWidth(text)
    doc.link(x, y - 3, textWidth, 6, { url })
    doc.setTextColor(255, 255, 255) // reset to default color for dark theme background; UI is dark but PDF is white
    doc.setTextColor(0, 0, 0)
}

function ensurePageSpace(doc: jsPDF, nextY: number, add = 60): number {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (nextY + add > pageHeight) {
        doc.addPage()
        return 20
    }
    return nextY
}

function drawList(doc: jsPDF, items: string[], x: number, y: number) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    let cursorY = y
    items.forEach((item) => {
        cursorY = ensurePageSpace(doc, cursorY, 10)
        doc.circle(x - 2.5, cursorY - 2.5, 0.8, 'F')
        doc.text(item, x, cursorY)
        cursorY += 6
    })
    return cursorY
}

function contentWidth(doc: jsPDF, x: number) {
    const pageW = doc.internal.pageSize.getWidth()
    return Math.max(0, pageW - x - 14)
}

function drawWrappedList(doc: jsPDF, items: string[], x: number, y: number) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    let cursorY = y
    const width = contentWidth(doc, x)
    items.forEach((item) => {
        cursorY = ensurePageSpace(doc, cursorY, 10)
        doc.circle(x - 2.5, cursorY - 2.5, 0.8, 'F')
        const lines = doc.splitTextToSize(String(item), width)
        lines.forEach((line, i) => {
            if (i > 0) cursorY = ensurePageSpace(doc, cursorY, 10)
            doc.text(line, x, cursorY)
            cursorY += 6
        })
    })
    return cursorY
}

function drawAbilitySummary(
    doc: jsPDF,
    build: BuildInfo,
    x: number,
    y: number
) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const mods = [
        ['Strength', build.abilities.str],
        ['Dexterity', build.abilities.dex],
        ['Constitution', build.abilities.con],
        ['Intelligence', build.abilities.int],
        ['Wisdom', build.abilities.wis],
        ['Charisma', build.abilities.cha],
    ].map(([n, v]) => {
        const m = Math.floor(((v as number) - 10) / 2)
        const sign = m >= 0 ? `+${m}` : String(m)
        return `${n} ${sign}`
    })
    const text = mods.join(', ')
    const lines = (doc as any).splitTextToSize(text, contentWidth(doc, x))
    let cursorY = y
    lines.forEach((line: string) => {
        cursorY = ensurePageSpace(doc, cursorY, 12)
        doc.text(line, x, cursorY)
        cursorY += 6
    })
    return cursorY
}

function drawFeatWithDescription(
    doc: jsPDF,
    name: string,
    description: string | null,
    url: string,
    x: number,
    y: number
) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const width = contentWidth(doc, x)
    const combined =
        description && description.trim().length
            ? `${name}: ${description.trim()}`
            : name
    const lines = doc.splitTextToSize(combined, width)
    let cursorY = y
    lines.forEach((line, i) => {
        if (i > 0) cursorY = ensurePageSpace(doc, cursorY, 10)
        doc.text(line, x, cursorY)
        cursorY += 6
    })
    doc.link(x, y - 3, width, Math.max(6, lines.length * 6), { url })
    return cursorY
}

function drawAbilityGrid(doc: jsPDF, build: BuildInfo, x: number, y: number) {
    const labels = [
        ['STR', build.abilities.str],
        ['DEX', build.abilities.dex],
        ['CON', build.abilities.con],
        ['INT', build.abilities.int],
        ['WIS', build.abilities.wis],
        ['CHA', build.abilities.cha],
    ]
    const width = contentWidth(doc, x)
    const cols = 3
    const cellW = Math.floor(width / cols) - 4
    const cellH = 22
    let cursorY = y
    doc.setDrawColor(200)
    labels.forEach((item, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        if (col === 0 && row > 0) cursorY += cellH + 6
        const cx = x + col * (cellW + 6)
        const cy = cursorY
        doc.rect(cx, cy, cellW, cellH)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(String(item[0]), cx + 4, cy + 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(16)
        doc.text(String(item[1]), cx + 4, cy + 16)
        const mod = Math.floor(((item[1] as number) - 10) / 2)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.text(`mod ${mod >= 0 ? '+' + mod : mod}`, cx + cellW - 28, cy + 16)
    })
    return cursorY + cellH + 6
}

function drawSkillsColumns(
    doc: jsPDF,
    skills: string[],
    bonuses: number[],
    x: number,
    y: number,
    cols = 3
) {
    const width = contentWidth(doc, x)
    const colW = Math.floor(width / cols)
    const rowsPerCol = Math.ceil(skills.length / cols)
    let baseY = y
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (let c = 0; c < cols; c++) {
        const cx = x + c * colW
        let cy = baseY
        for (let r = 0; r < rowsPerCol; r++) {
            const i = c * rowsPerCol + r
            if (i >= skills.length) break
            cy = ensurePageSpace(doc, cy, 12)
            const label = `${skills[i]}: +${bonuses[i]}`
            doc.text(label, cx, cy)
            cy += 6
        }
        baseY = Math.max(baseY, cy)
    }
    return baseY
}

function drawSkillsColumnsFixed(
    doc: jsPDF,
    build: BuildInfo,
    skills: string[],
    bonuses: number[],
    x: number,
    y: number,
    cols = 3
) {
    const width = contentWidth(doc, x)
    const colW = Math.floor(width / cols)
    const rowsPerCol = Math.ceil(skills.length / cols)
    const startY = y
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const endYs: number[] = []
    for (let c = 0; c < cols; c++) {
        const cx = x + c * colW
        let cy = startY
        for (let r = 0; r < rowsPerCol; r++) {
            const i = c * rowsPerCol + r
            if (i >= skills.length) break
            cy = ensurePageSpace(doc, cy, 12)
            const skillName = skills[i]
            const rankBonus = bonuses[i] || 0
            const key = skillAbilityKey(skillName)
            const ability = key
                ? abilityModFrom((build.abilities as any)[key])
                : 0
            const level = build.level || 0
            const totalStandard = ability + rankBonus + level
            const mythicTotal = ability + 10 + level
            doc.setFont('helvetica', 'bold')
            doc.text(`${skillName}: +${totalStandard}`, cx, cy)
            cy += 6
            cy = ensurePageSpace(doc, cy, 12)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            const breakdown = `Atr ${
                ability >= 0 ? '+' + ability : ability
            }, Nv +${level}, Prof ${
                rankBonus >= 0 ? '+' + rankBonus : rankBonus
            }, Item +0`
            const bLines = (doc as any).splitTextToSize(breakdown, colW)
            bLines.forEach((line: string) => {
                doc.text(line, cx, cy)
                cy += 5
            })
            doc.setFontSize(10)
            cy = ensurePageSpace(doc, cy, 12)
            const mythicText = `Mythic: +${mythicTotal}`
            doc.setFont('helvetica', 'italic')
            doc.text(mythicText, cx, cy)
            cy += 6
            doc.setFont('helvetica', 'normal')
        }
        endYs.push(cy)
    }
    return Math.max(...endYs, startY)
}

function drawFeatWithDescriptionBold(
    doc: jsPDF,
    name: string,
    description: string | null,
    url: string,
    x: number,
    y: number
) {
    doc.setFontSize(11)
    const width = contentWidth(doc, x)
    let cursorY = y
    const hasDesc = !!(description && description.trim().length)
    if (hasDesc) {
        const namePart = `${name}:`
        doc.setFont('helvetica', 'bold')
        doc.text(namePart, x, cursorY)
        const nameW = doc.getTextWidth(namePart)
        doc.setFont('helvetica', 'normal')
        const firstWidth = Math.max(0, width - nameW - 2)
        const desc = description!.trim()
        const firstLines = doc.splitTextToSize(desc, firstWidth)
        if (firstLines.length) {
            doc.text(firstLines[0], x + nameW + 2, cursorY)
        }
        cursorY += 6
        const remaining = firstLines.length
            ? desc.slice(firstLines[0].length)
            : desc
        const wrapped = doc.splitTextToSize(remaining, width)
        wrapped.forEach((line) => {
            cursorY = ensurePageSpace(doc, cursorY, 10)
            doc.text(line, x, cursorY)
            cursorY += 6
        })
    } else {
        doc.setFont('helvetica', 'bold')
        doc.text(name, x, cursorY)
        cursorY += 6
        doc.setFont('helvetica', 'normal')
    }
    doc.link(x, y - 3, width, Math.max(6, cursorY - y), { url })

    return cursorY
}

function drawTable(
    doc: jsPDF,
    headers: string[],
    rows: string[][],
    x: number,
    y: number
) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    let cursorY = y
    const colWidths = headers.map(() => 180 / headers.length)
    // Header
    headers.forEach((h, i) => {
        doc.text(h, x + i * colWidths[i] + 2, cursorY)
    })
    cursorY += 5
    doc.setDrawColor(200)
    doc.line(x, cursorY, x + colWidths.reduce((a, b) => a + b, 0), cursorY)
    doc.setFont('helvetica', 'normal')
    rows.forEach((row) => {
        cursorY = ensurePageSpace(doc, cursorY, 12)
        row.forEach((cell, i) => {
            const cx = x + i * colWidths[i] + 2
            doc.text(String(cell), cx, cursorY + 6)
        })
        cursorY += 10
        doc.setDrawColor(240)
        doc.line(x, cursorY, x + colWidths.reduce((a, b) => a + b, 0), cursorY)
    })
    return cursorY + 6
}

function drawWeaponsTable(doc: jsPDF, weapons: Weapon[], x: number, y: number) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    let cursorY = y
    const widths = [90, 20, 30, 40]
    const headers = ['Nome', 'Ataque', 'Dano', 'Runas']
    headers.forEach((h, i) => {
        doc.text(
            h,
            x + widths.slice(0, i).reduce((a, b) => a + b, 0) + 2,
            cursorY
        )
    })
    cursorY += 5
    doc.setDrawColor(200)
    doc.line(x, cursorY, x + widths.reduce((a, b) => a + b, 0), cursorY)
    doc.setFont('helvetica', 'normal')
    const pad = 2
    weapons.forEach((w) => {
        const nameLines = doc.splitTextToSize(w.display, widths[0] - pad)
        const atkLines = doc.splitTextToSize(`+${w.attack}`, widths[1] - pad)
        const dmgLines = doc.splitTextToSize(
            `${w.die} ${damageTypeLabel(w.damageType)} +${w.damageBonus}`,
            widths[2] - pad
        )
        const runesText = (w.runes || []).join(', ')
        const runesLines = doc.splitTextToSize(runesText, widths[3] - pad)
        const maxLines = Math.max(
            nameLines.length,
            atkLines.length,
            dmgLines.length,
            runesLines.length
        )
        for (let i = 0; i < maxLines; i++) {
            cursorY = ensurePageSpace(doc, cursorY, 12)
            const baseX = x
            const col0 = baseX
            const col1 = baseX + widths[0]
            const col2 = baseX + widths[0] + widths[1]
            const col3 = baseX + widths[0] + widths[1] + widths[2]
            const n = nameLines[i] ?? ''
            const a = atkLines[i] ?? ''
            const d = dmgLines[i] ?? ''
            const r = runesLines[i] ?? ''
            doc.text(n, col0 + pad, cursorY + 6)
            doc.text(a, col1 + pad, cursorY + 6)
            doc.text(d, col2 + pad, cursorY + 6)
            doc.text(r, col3 + pad, cursorY + 6)
            cursorY += 10
        }
        doc.setDrawColor(240)
        doc.line(x, cursorY, x + widths.reduce((a, b) => a + b, 0), cursorY)
    })
    return cursorY + 6
}

function signed(n: number) {
    return n >= 0 ? `+${n}` : String(n)
}

function weaponAbilityKey(w: Weapon): keyof Abilities {
    const label = `${w.name} ${w.display}`.toLowerCase()
    return label.includes('ranged') ? 'dex' : 'str'
}

function rankFromSpecific(build: BuildInfo, w: Weapon): number {
    const name = w.name
    const sp = build.specificProficiencies || {
        trained: [],
        expert: [],
        master: [],
        legendary: [],
    }
    if (sp.legendary?.includes(name)) return 8
    if (sp.master?.includes(name)) return 6
    if (sp.expert?.includes(name)) return 4
    if (sp.trained?.includes(name)) return 2
    return 0
}

function strikeDiceCount(w: Weapon): number {
    const s = (w.str || '').toLowerCase()
    if (s.includes('greater')) return 3
    if (s.includes('striking')) return 2
    return 1
}

function drawWeaponsBlock(
    doc: jsPDF,
    build: BuildInfo,
    weapons: Weapon[],
    x: number,
    y: number
) {
    let cursorY = y
    const width = contentWidth(doc, x)
    weapons.forEach((w) => {
        cursorY = ensurePageSpace(doc, cursorY, 18)
        const abilityKey = weaponAbilityKey(w)
        const ability = abilityModFrom((build.abilities as any)[abilityKey])
        const level = build.level || 0
        const rank = rankFromSpecific(build, w)
        const item = w.pot || 0
        const atkTotal = ability + level + rank + item
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        const nameText = w.display
        doc.text(nameText, x, cursorY)
        const bonusText = signed(atkTotal)
        const badgeW = doc.getTextWidth(bonusText) + 8
        const bx = x + width - badgeW
        doc.setDrawColor(0)
        doc.setFillColor(240)
        doc.rect(bx, cursorY - 5, badgeW, 8, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(0, 0, 0)
        doc.text(bonusText, bx + 4, cursorY)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)
        cursorY += 8
        const breakdown = `Atr ${signed(ability)}, Nv +${level}, Prof ${signed(
            rank
        )}, Item ${signed(item)}`
        const bLines = (doc as any).splitTextToSize(breakdown, width)
        bLines.forEach((t: string) => {
            cursorY = ensurePageSpace(doc, cursorY, 10)
            doc.text(t, x, cursorY)
            cursorY += 6
        })
        // Damage line
        doc.setFont('helvetica', 'normal')
        const baseSides = String(w.die).replace(/^d/i, '')
        const diceCount = strikeDiceCount(w)
        const base = `${diceCount}d${baseSides} (${damageTypeLabel(
            w.damageType
        )})`
        const extras = (w.extraDamage || []).map((e) => {
            const m = e.match(/^(\d+d\d+)\s+(.*)$/i)
            return m ? `${m[1]} (${m[2]})` : e
        })
        const dmgParts = [base, ...extras]
        if (w.damageBonus) dmgParts.push(String(w.damageBonus))
        const line2 = `Dano: ${dmgParts.join(' + ')}`
        const l2 = (doc as any).splitTextToSize(line2, width)
        l2.forEach((t: string) => {
            cursorY = ensurePageSpace(doc, cursorY, 10)
            doc.text(t, x, cursorY)
            cursorY += 6
        })
        cursorY += 2
    })
    return cursorY
}

function summarizeSpellcaster(caster: SpellCaster) {
    const slots = caster.perDay
        .map((n, i) => (n ? `${i}:${n}` : null))
        .filter(Boolean)
        .join(' ')
    return `${caster.name} · Trad:${caster.magicTradition} · Tipo:${caster.spellcastingType} · A:${caster.ability} · Prof:+${caster.proficiency} · Slots ${slots}`
}

function damageTypeLabel(t: string) {
    switch (t) {
        case 'P':
            return 'Perfurante'
        case 'S':
            return 'Cortante'
        case 'B':
            return 'Esmagamento'
        default:
            return t
    }
}

function abilityModFrom(value: number) {
    return Math.floor((value - 10) / 2)
}

function skillAbilityKey(name: string): keyof Abilities | null {
    const map: Record<string, keyof Abilities> = {
        acrobatics: 'dex',
        arcana: 'int',
        athletics: 'str',
        crafting: 'int',
        deception: 'cha',
        diplomacy: 'cha',
        intimidation: 'cha',
        medicine: 'wis',
        nature: 'wis',
        occultism: 'int',
        performance: 'cha',
        religion: 'wis',
        society: 'int',
        stealth: 'dex',
        survival: 'wis',
        thievery: 'dex',
    }
    return map[name.toLowerCase()] ?? null
}

function skillBreakdown(build: BuildInfo, name: string, total: number) {
    const key = skillAbilityKey(name)
    const ability = key ? abilityModFrom((build.abilities as any)[key]) : 0
    const item = 0
    const prof = total - ability - item
    return { ability, prof, item }
}

function saveBreakdown(
    build: BuildInfo,
    label: 'Fortitude' | 'Reflex' | 'Will',
    total: number
) {
    const abilityKey: Record<'Fortitude' | 'Reflex' | 'Will', keyof Abilities> =
        {
            Fortitude: 'con',
            Reflex: 'dex',
            Will: 'wis',
        }
    const ability = abilityModFrom((build.abilities as any)[abilityKey[label]])
    const item = Number(
        (build.mods && (build.mods as any)[label]?.['Item Bonus']) || 0
    )
    const prof = total - ability - item
    return { ability, prof, item }
}

export async function generateCharacterPdf(
    build: BuildInfo
): Promise<ArrayBuffer> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(build.name || 'Personagem', 14, 20)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(
        `${build.class} (Nível ${build.level}) · ${build.ancestry} · ${build.background}`,
        14,
        28
    )
    doc.text(
        `Alinhamento: ${build.alignment || '—'} · Tamanho: ${
            build.sizeName
        } · Chave: ${build.keyability.toUpperCase()}`,
        14,
        34
    )

    // Abilities
    drawSectionTitle(doc, 'Atributos', 44)
    let y = 52
    y = drawAbilitySummary(doc, build, 14, y)
    y += 12

    // Defenses & Speed
    y = ensurePageSpace(doc, y, 40)
    drawSectionTitle(doc, 'Defesas e Movimento', y)
    y += 12
    const acT = build.acTotal
    if (acT) {
        const acLine = `${acT.acTotal} (Prof +${acT.acProfBonus}, Abl +${acT.acAbilityBonus}, Item +${acT.acItemBonus})`
        drawKeyValue(doc, 'CA', acLine, 14, y)
        y += 8
    }
    const levelB = build.level || 0
    const fortRank = build.proficiencies.fortitude || 0
    const refRank = build.proficiencies.reflex || 0
    const willRank = build.proficiencies.will || 0
    const fortB = saveBreakdown(build, 'Fortitude', fortRank + levelB)
    const refB = saveBreakdown(build, 'Reflex', refRank + levelB)
    const willB = saveBreakdown(build, 'Will', willRank + levelB)
    drawKeyValue(
        doc,
        'Fortitude',
        `+${fortRank + levelB + fortB.ability + fortB.item} (Atr ${
            fortB.ability >= 0 ? '+' + fortB.ability : fortB.ability
        }, Nível +${levelB}, Prof ${fortRank >= 0 ? '+' + fortRank : fortRank}${
            fortB.item
                ? `, Item ${fortB.item >= 0 ? '+' + fortB.item : fortB.item}`
                : ''
        })`,
        14,
        y
    )
    y += 6
    drawKeyValue(
        doc,
        'Mythic Fortitude',
        `+${10 + levelB + fortB.ability + fortB.item} (Atr ${
            fortB.ability >= 0 ? '+' + fortB.ability : fortB.ability
        }, Nível +${levelB}, Prof +10${
            fortB.item
                ? `, Item ${fortB.item >= 0 ? '+' + fortB.item : fortB.item}`
                : ''
        })`,
        14,
        y
    )
    y += 8
    drawKeyValue(
        doc,
        'Reflexos',
        `+${refRank + levelB + refB.ability + refB.item} (Atr ${
            refB.ability >= 0 ? '+' + refB.ability : refB.ability
        }, Nível +${levelB}, Prof ${refRank >= 0 ? '+' + refRank : refRank}${
            refB.item
                ? `, Item ${refB.item >= 0 ? '+' + refB.item : refB.item}`
                : ''
        })`,
        14,
        y
    )
    y += 6
    drawKeyValue(
        doc,
        'Mythic Reflexos',
        `+${10 + levelB + refB.ability + refB.item} (Atr ${
            refB.ability >= 0 ? '+' + refB.ability : refB.ability
        }, Nível +${levelB}, Prof +10${
            refB.item
                ? `, Item ${refB.item >= 0 ? '+' + refB.item : refB.item}`
                : ''
        })`,
        14,
        y
    )
    y += 8
    drawKeyValue(
        doc,
        'Vontade',
        `+${willRank + levelB + willB.ability + willB.item} (Atr ${
            willB.ability >= 0 ? '+' + willB.ability : willB.ability
        }, Nível +${levelB}, Prof ${willRank >= 0 ? '+' + willRank : willRank}${
            willB.item
                ? `, Item ${willB.item >= 0 ? '+' + willB.item : willB.item}`
                : ''
        })`,
        14,
        y
    )
    y += 6
    drawKeyValue(
        doc,
        'Mythic Vontade',
        `+${10 + levelB + willB.ability + willB.item} (Atr ${
            willB.ability >= 0 ? '+' + willB.ability : willB.ability
        }, Nível +${levelB}, Prof +10${
            willB.item
                ? `, Item ${willB.item >= 0 ? '+' + willB.item : willB.item}`
                : ''
        })`,
        14,
        y
    )
    y += 8
    const percRank = build.proficiencies.perception || 0
    const percAbility = abilityModFrom(build.abilities.wis)
    drawKeyValue(
        doc,
        'Percepção',
        `+${percRank + levelB + percAbility} (Atr ${
            percAbility >= 0 ? '+' + percAbility : percAbility
        }, Nível +${levelB}, Prof ${
            percRank >= 0 ? '+' + percRank : percRank
        }, Item +0)`,
        14,
        y
    )
    y += 12
    drawKeyValue(doc, 'Deslocamento', `${build.attributes.speed} pés`, 14, y)
    y += 12

    y = ensurePageSpace(doc, y, 70)
    drawSectionTitle(doc, 'Perícias', y)
    y += 12
    const skillNames = [
        'Acrobatics',
        'Arcana',
        'Athletics',
        'Crafting',
        'Deception',
        'Diplomacy',
        'Intimidation',
        'Medicine',
        'Nature',
        'Occultism',
        'Performance',
        'Religion',
        'Society',
        'Stealth',
        'Survival',
        'Thievery',
    ]
    const skillBonuses = [
        build.proficiencies.acrobatics,
        build.proficiencies.arcana,
        build.proficiencies.athletics,
        build.proficiencies.crafting,
        build.proficiencies.deception,
        build.proficiencies.diplomacy,
        build.proficiencies.intimidation,
        build.proficiencies.medicine,
        build.proficiencies.nature,
        build.proficiencies.occultism,
        build.proficiencies.performance,
        build.proficiencies.religion,
        build.proficiencies.society,
        build.proficiencies.stealth,
        build.proficiencies.survival,
        build.proficiencies.thievery,
    ]
    y = drawSkillsColumnsFixed(doc, build, skillNames, skillBonuses, 14, y, 3)

    y = ensurePageSpace(doc, y, 50)
    drawSectionTitle(doc, 'Armas', y)
    y += 10
    y = drawWeaponsBlock(doc, build, build.weapons || [], 14, y)

    y = ensurePageSpace(doc, y, 50)
    drawSectionTitle(doc, 'Armadura e Equipamentos', y)
    y += 10

    const armorRows = (build.armor || []).map((a: Armor) => [
        a.display,
        a.worn ? 'Vestindo' : 'Bolsa',
        (a.runes || []).join(', '),
    ])
    if (armorRows.length) {
        y = drawTable(doc, ['Nome', 'Estado', 'Runas'], armorRows, 14, y)
    } else {
        y = drawList(doc, ['— nenhuma armadura listada —'], 18, y)
    }

    y = ensurePageSpace(doc, y, 20)
    const equipRows = (build.equipment || []).map(([name, qty, tag]) => [
        String(qty),
        name,
        tag ?? '',
    ])
    if (equipRows.length) {
        y = drawTable(doc, ['Qtd', 'Item', 'Tag'], equipRows, 14, y)
    } else {
        y = drawList(doc, ['— nenhum equipamento listado —'], 18, y)
    }

    // Feats & Specials
    y = ensurePageSpace(doc, y, 80)
    drawSectionTitle(doc, 'Feats e Especiais', y)
    y += 10
    const featsLines = (build.feats || []).map((f: any) => {
        const name = Array.isArray(f) ? String(f[0]) : String(f?.name ?? f)
        const desc =
            build.featDescriptions?.[name] ??
            (Array.isArray(f)
                ? typeof f[1] === 'string'
                    ? f[1]
                    : null
                : typeof f?.description === 'string'
                ? f.description
                : null)
        return { name, desc }
    })
    const specialsLines = (build.specials || []).map((s) => String(s))
    const featsHeaderY = y
    if (featsLines.length) {
        let cursorY = featsHeaderY
        featsLines.forEach((item: any) => {
            const url = getAonSearchUrl(item.name)
            cursorY = ensurePageSpace(doc, cursorY, 20)
            cursorY = drawFeatWithDescriptionBold(
                doc,
                item.name,
                item.desc ?? null,
                url,
                18,
                cursorY
            )
        })
        y = cursorY
    } else {
        y = drawList(doc, ['— nenhum feat —'], 18, featsHeaderY)
    }
    y = ensurePageSpace(doc, y, 40)
    const specialsHeaderY = y
    doc.setFont('helvetica', 'bold')
    doc.text('Especiais', 18, specialsHeaderY)
    doc.setFont('helvetica', 'normal')
    y = drawWrappedList(
        doc,
        specialsLines.length ? specialsLines : ['— nenhum especial —'],
        18,
        specialsHeaderY + 4
    )

    // Lores
    y = ensurePageSpace(doc, y, 30)
    drawSectionTitle(doc, 'Conhecimentos (Lore)', y)
    y += 10
    const loreRows = (build.lores || []).map(([name, prof]) => [
        name,
        `+${prof}`,
    ])
    y = drawTable(doc, ['Nome', 'Bônus'], loreRows, 14, y)

    // Spellcasting
    y = ensurePageSpace(doc, y, 80)
    drawSectionTitle(doc, 'Magias', y)
    y += 10
    ;(build.spellCasters || []).forEach((caster) => {
        y = ensurePageSpace(doc, y, 40)
        doc.setFont('helvetica', 'bold')
        doc.text(summarizeSpellcaster(caster), 18, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        caster.spells.forEach((lvl) => {
            y = ensurePageSpace(doc, y, 20)
            doc.text(`Nível ${lvl.spellLevel}:`, 20, y)
            y += 6
            if (!lvl.list.length) {
                doc.text('—', 24, y)
                y += 6
            } else {
                lvl.list.forEach((name) => {
                    y = ensurePageSpace(doc, y, 10)
                    const url = getAonSearchUrl(name)
                    addLink(doc, `• ${name}`, url, 24, y)
                    y += 6
                })
            }
        })
        y += 4
    })

    // Footer hint to AON
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    const footerY = doc.internal.pageSize.getHeight() - 10
    doc.text(
        'Descrições completas podem ser acessadas via AON: https://2e.aonprd.com',
        14,
        footerY
    )

    return doc.output('arraybuffer')
}

export async function downloadCharacterPdf(build: BuildInfo) {
    const buffer = await generateCharacterPdf(build)
    const blob = new Blob([buffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${build.name.replace(/\s+/g, '_')}_ficha.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}
