import jsPDF from 'jspdf'
import { getAonSearchUrl } from './types'
import type { BuildInfo, Weapon } from './types'

// ============================================================================
// DESIGN SYSTEM - Print Friendly (Monocromático)
// ============================================================================

const COLORS = {
    black: { r: 0, g: 0, b: 0 },
    darkGray: { r: 51, g: 51, b: 51 },
    gray: { r: 102, g: 102, b: 102 },
    lightGray: { r: 180, g: 180, b: 180 },
    veryLightGray: { r: 230, g: 230, b: 230 },
    white: { r: 255, g: 255, b: 255 },
}

const LAYOUT = {
    pageMargin: 10,
    contentWidth: 190,  // A4 width (210) - 2 * margin (10)
    lineHeight: 5,
    sectionGap: 6,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function setColor(doc: jsPDF, color: { r: number; g: number; b: number }, type: 'fill' | 'draw' | 'text' = 'text') {
    if (type === 'fill') {
        doc.setFillColor(color.r, color.g, color.b)
    } else if (type === 'draw') {
        doc.setDrawColor(color.r, color.g, color.b)
    } else {
        doc.setTextColor(color.r, color.g, color.b)
    }
}

function ensurePageSpace(doc: jsPDF, currentY: number, requiredSpace: number = 40): number {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (currentY + requiredSpace > pageHeight - LAYOUT.pageMargin - 10) {
        doc.addPage()
        return LAYOUT.pageMargin + 5
    }
    return currentY
}

function signed(n: number): string {
    return n >= 0 ? `+${n}` : String(n)
}

function abilityMod(value: number): number {
    return Math.floor((value - 10) / 2)
}

function getProficiencyLabel(bonus: number): string {
    if (bonus >= 8) return 'L'
    if (bonus >= 6) return 'M'
    if (bonus >= 4) return 'E'
    if (bonus >= 2) return 'T'
    return 'U'
}

function damageTypeLabel(t: string): string {
    const labels: Record<string, string> = { 'P': 'Perfurante', 'S': 'Cortante', 'B': 'Contundente' }
    return labels[t] || t
}

// ============================================================================
// DRAWING COMPONENTS
// ============================================================================

function drawHeader(doc: jsPDF, build: BuildInfo): number {
    const x = LAYOUT.pageMargin
    let y = LAYOUT.pageMargin
    
    // Linha superior decorativa
    setColor(doc, COLORS.black, 'draw')
    doc.setLineWidth(1)
    doc.line(x, y, x + LAYOUT.contentWidth, y)
    
    y += 6
    
    // Nome do personagem
    setColor(doc, COLORS.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text(build.name || 'Personagem', x, y + 5)
    
    // Nível no canto direito
    doc.setFontSize(14)
    doc.text(`Nível ${build.level}`, x + LAYOUT.contentWidth, y + 5, { align: 'right' })
    
    y += 10
    
    // Classe e informações básicas
    setColor(doc, COLORS.darkGray)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`${build.class} · ${build.ancestry} · ${build.heritage || ''} · ${build.background}`, x, y + 4)
    
    y += 6
    doc.setFontSize(9)
    setColor(doc, COLORS.gray)
    doc.text(`Alinhamento: ${build.alignment || '—'} | Tamanho: ${build.sizeName} | Atributo-Chave: ${build.keyability.toUpperCase()} | Divindade: ${build.deity || '—'}`, x, y + 4)
    
    y += 8
    
    // Linha inferior do header
    setColor(doc, COLORS.black, 'draw')
    doc.setLineWidth(0.5)
    doc.line(x, y, x + LAYOUT.contentWidth, y)
    
    return y + 4
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, width: number): number {
    // Fundo cinza claro
    setColor(doc, COLORS.veryLightGray, 'fill')
    doc.rect(x, y, width, 6, 'F')
    
    // Bordas
    setColor(doc, COLORS.darkGray, 'draw')
    doc.setLineWidth(0.3)
    doc.rect(x, y, width, 6, 'D')
    
    // Texto
    setColor(doc, COLORS.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title.toUpperCase(), x + 2, y + 4.2)
    
    return y + 8
}

function drawAbilityScores(doc: jsPDF, build: BuildInfo, y: number): number {
    const x = LAYOUT.pageMargin
    const sectionWidth = LAYOUT.contentWidth
    
    y = drawSectionTitle(doc, 'Atributos', x, y, sectionWidth)
    
    const abilities = [
        { key: 'FOR', name: 'Força', value: build.abilities.str },
        { key: 'DES', name: 'Destreza', value: build.abilities.dex },
        { key: 'CON', name: 'Constituição', value: build.abilities.con },
        { key: 'INT', name: 'Inteligência', value: build.abilities.int },
        { key: 'SAB', name: 'Sabedoria', value: build.abilities.wis },
        { key: 'CAR', name: 'Carisma', value: build.abilities.cha },
    ]
    
    const cols = 6
    const cellWidth = sectionWidth / cols
    const cellHeight = 16
    
    abilities.forEach((ability, idx) => {
        const cellX = x + idx * cellWidth
        const mod = abilityMod(ability.value)
        
        // Borda da célula
        setColor(doc, COLORS.lightGray, 'draw')
        doc.setLineWidth(0.2)
        doc.rect(cellX, y, cellWidth, cellHeight, 'D')
        
        // Abreviação
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.text(ability.key, cellX + cellWidth / 2, y + 4, { align: 'center' })
        
        // Modificador (grande)
        setColor(doc, COLORS.black)
        doc.setFontSize(12)
        doc.text(signed(mod), cellX + cellWidth / 2, y + 11, { align: 'center' })
        
        // Valor base (pequeno)
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(String(ability.value), cellX + cellWidth / 2, y + 15, { align: 'center' })
    })
    
    return y + cellHeight + LAYOUT.sectionGap
}

function drawDefensesAndHP(doc: jsPDF, build: BuildInfo, y: number): number {
    const x = LAYOUT.pageMargin
    const halfWidth = (LAYOUT.contentWidth - 4) / 2
    
    // Coluna esquerda: Defesas
    let leftY = drawSectionTitle(doc, 'Defesas', x, y, halfWidth)
    
    const levelB = build.level || 0
    
    // CA
    const acT = build.acTotal
    setColor(doc, COLORS.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`CA: ${acT?.acTotal || 10}`, x + 2, leftY + 4)
    leftY += 7
    
    // Saves com Normal e Mítico
    const saves = [
        { name: 'Fortitude', rank: build.proficiencies.fortitude, ability: abilityMod(build.abilities.con), abilityName: 'CON' },
        { name: 'Reflexos', rank: build.proficiencies.reflex, ability: abilityMod(build.abilities.dex), abilityName: 'DES' },
        { name: 'Vontade', rank: build.proficiencies.will, ability: abilityMod(build.abilities.wis), abilityName: 'SAB' },
    ]
    
    saves.forEach((save) => {
        const total = save.rank + levelB + save.ability
        const mythicTotal = 10 + levelB + save.ability
        const profLabel = getProficiencyLabel(save.rank)
        
        setColor(doc, COLORS.black)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`${save.name}:`, x + 2, leftY + 4)
        
        doc.setFont('helvetica', 'normal')
        doc.text(`${signed(total)} [${profLabel}]`, x + 28, leftY + 4)
        
        setColor(doc, COLORS.gray)
        doc.setFontSize(7)
        doc.text(`Mítico: ${signed(mythicTotal)}`, x + 50, leftY + 4)
        
        leftY += 6
    })
    
    // Percepção
    const percRank = build.proficiencies.perception || 0
    const percAbility = abilityMod(build.abilities.wis)
    const percTotal = percRank + levelB + percAbility
    const percMythic = 10 + levelB + percAbility
    const percLabel = getProficiencyLabel(percRank)
    
    setColor(doc, COLORS.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`Percepção:`, x + 2, leftY + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(`${signed(percTotal)} [${percLabel}]`, x + 28, leftY + 4)
    setColor(doc, COLORS.gray)
    doc.setFontSize(7)
    doc.text(`Mítico: ${signed(percMythic)}`, x + 50, leftY + 4)
    leftY += 6
    
    // Deslocamento
    setColor(doc, COLORS.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`Deslocamento:`, x + 2, leftY + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(`${build.attributes.speed} pés`, x + 32, leftY + 4)
    leftY += 6
    
    // Coluna direita: HP e CD
    const rightX = x + halfWidth + 4
    let rightY = drawSectionTitle(doc, 'Pontos de Vida & CD', rightX, y, halfWidth)
    
    // HP
    const conMod = abilityMod(build.abilities.con)
    const hp = (build.attributes.ancestryhp || 0) + ((build.attributes.classhp + conMod) * build.level)
    
    setColor(doc, COLORS.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(`HP: ${hp}`, rightX + 2, rightY + 6)
    rightY += 10
    
    // CD de Classe
    const classDCRank = build.proficiencies.classDC || 0
    const keyAbilityMod = abilityMod((build.abilities as any)[build.keyability] || 10)
    const classDC = 10 + levelB + classDCRank + keyAbilityMod
    const classDCLabel = getProficiencyLabel(classDCRank)
    
    setColor(doc, COLORS.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`CD de Classe: ${classDC} [${classDCLabel}]`, rightX + 2, rightY + 4)
    rightY += 7
    
    // Resistências (se houver)
    setColor(doc, COLORS.gray)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Resistências: —`, rightX + 2, rightY + 4)
    rightY += 6
    doc.text(`Imunidades: —`, rightX + 2, rightY + 4)
    rightY += 6
    
    return Math.max(leftY, rightY) + LAYOUT.sectionGap
}

function drawWeapons(doc: jsPDF, build: BuildInfo, y: number): number {
    if (!build.weapons?.length) return y
    
    y = ensurePageSpace(doc, y, 40)
    const x = LAYOUT.pageMargin
    const sectionWidth = LAYOUT.contentWidth
    
    y = drawSectionTitle(doc, 'Ataques', x, y, sectionWidth)
    
    const levelB = build.level || 0
    
    build.weapons.forEach((weapon) => {
        y = ensurePageSpace(doc, y, 20)
        
        // Calcular ataque
        const isRanged = weapon.display.toLowerCase().includes('ranged') || weapon.name.toLowerCase().includes('ranged')
        const abilityKey = isRanged ? 'dex' : 'str'
        const abilityVal = abilityMod((build.abilities as any)[abilityKey])
        const profRank = getWeaponProficiency(build, weapon)
        const itemBonus = weapon.pot || 0
        const attackTotal = abilityVal + levelB + profRank + itemBonus
        const profLabel = getProficiencyLabel(profRank)
        
        // Calcular dano
        const diceCount = getDiceCount(weapon)
        const baseSides = String(weapon.die).replace(/^d/i, '')
        
        // Linha 1: Nome completo e bônus de ataque
        setColor(doc, COLORS.black)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(weapon.display, x + 2, y + 4)
        
        // Bônus de ataque no final
        const attackText = `Ataque: ${signed(attackTotal)} [${profLabel}]`
        doc.text(attackText, x + sectionWidth - 2, y + 4, { align: 'right' })
        
        y += 6
        
        // Linha 3: Dano
        setColor(doc, COLORS.black)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        let damageText = `Dano: ${diceCount}d${baseSides} ${damageTypeLabel(weapon.damageType)}`
        if (weapon.damageBonus) damageText += ` ${signed(weapon.damageBonus)}`
        
        // Dano extra
        if (weapon.extraDamage?.length) {
            weapon.extraDamage.forEach((extra) => {
                damageText += ` + ${extra}`
            })
        }
        
        doc.text(damageText, x + 4, y + 3)
        
        y += 5
        
        // Linha 4: Runas e traits (se houver)
        if (weapon.runes?.length) {
            setColor(doc, COLORS.gray)
            doc.setFontSize(7)
            doc.text(`Runas: ${weapon.runes.join(', ')}`, x + 4, y + 3)
            y += 4
        }
        
        // Separador entre armas
        setColor(doc, COLORS.veryLightGray, 'draw')
        doc.setLineWidth(0.2)
        doc.line(x, y + 1, x + sectionWidth, y + 1)
        
        y += 4
    })
    
    return y + LAYOUT.sectionGap
}

function getWeaponProficiency(build: BuildInfo, weapon: Weapon): number {
    const sp = build.specificProficiencies || { trained: [], expert: [], master: [], legendary: [] }
    if (sp.legendary?.includes(weapon.name)) return 8
    if (sp.master?.includes(weapon.name)) return 6
    if (sp.expert?.includes(weapon.name)) return 4
    if (sp.trained?.includes(weapon.name)) return 2
    return 0
}

function getDiceCount(weapon: Weapon): number {
    const str = (weapon.str || '').toLowerCase()
    if (str.includes('greater')) return 3
    if (str.includes('striking')) return 2
    return 1
}

function drawSkills(doc: jsPDF, build: BuildInfo, y: number): number {
    y = ensurePageSpace(doc, y, 60)
    const x = LAYOUT.pageMargin
    const sectionWidth = LAYOUT.contentWidth
    
    y = drawSectionTitle(doc, 'Perícias', x, y, sectionWidth)
    
    const levelB = build.level || 0
    const skills = [
        { name: 'Acrobacia', key: 'acrobatics', ability: 'dex' },
        { name: 'Arcanismo', key: 'arcana', ability: 'int' },
        { name: 'Atletismo', key: 'athletics', ability: 'str' },
        { name: 'Artesanato', key: 'crafting', ability: 'int' },
        { name: 'Enganação', key: 'deception', ability: 'cha' },
        { name: 'Diplomacia', key: 'diplomacy', ability: 'cha' },
        { name: 'Intimidação', key: 'intimidation', ability: 'cha' },
        { name: 'Medicina', key: 'medicine', ability: 'wis' },
        { name: 'Natureza', key: 'nature', ability: 'wis' },
        { name: 'Ocultismo', key: 'occultism', ability: 'int' },
        { name: 'Atuação', key: 'performance', ability: 'cha' },
        { name: 'Religião', key: 'religion', ability: 'wis' },
        { name: 'Sociedade', key: 'society', ability: 'int' },
        { name: 'Furtividade', key: 'stealth', ability: 'dex' },
        { name: 'Sobrevivência', key: 'survival', ability: 'wis' },
        { name: 'Ladroagem', key: 'thievery', ability: 'dex' },
    ]
    
    const cols = 2
    const colWidth = sectionWidth / cols
    const rowHeight = 5
    
    skills.forEach((skill, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const skillX = x + col * colWidth
        const skillY = y + row * rowHeight
        
        const rank = (build.proficiencies as any)[skill.key] || 0
        const abilityVal = (build.abilities as any)[skill.ability] || 10
        const abilityBonus = abilityMod(abilityVal)
        const total = rank + levelB + abilityBonus
        const mythicTotal = 10 + levelB + abilityBonus
        const profLabel = getProficiencyLabel(rank)
        
        // Nome da perícia
        setColor(doc, rank > 0 ? COLORS.black : COLORS.gray)
        doc.setFont('helvetica', rank > 0 ? 'bold' : 'normal')
        doc.setFontSize(8)
        doc.text(skill.name, skillX + 2, skillY + 3.5)
        
        // Bônus e proficiência
        setColor(doc, COLORS.black)
        doc.setFont('helvetica', 'bold')
        doc.text(`${signed(total)} [${profLabel}]`, skillX + 42, skillY + 3.5)
        
        // Mítico
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(`M: ${signed(mythicTotal)}`, skillX + 65, skillY + 3.5)
    })
    
    const totalRows = Math.ceil(skills.length / cols)
    return y + totalRows * rowHeight + LAYOUT.sectionGap
}

function drawArmor(doc: jsPDF, build: BuildInfo, y: number): number {
    y = ensurePageSpace(doc, y, 30)
    const x = LAYOUT.pageMargin
    const sectionWidth = LAYOUT.contentWidth
    
    y = drawSectionTitle(doc, 'Armadura & Equipamentos', x, y, sectionWidth)
    
    // Armaduras
    if (build.armor?.length) {
        build.armor.forEach((armor) => {
            setColor(doc, COLORS.black)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            doc.text(`• ${armor.display}`, x + 2, y + 4)
            
            setColor(doc, COLORS.gray)
            doc.setFont('helvetica', 'normal')
            doc.text(armor.worn ? '[Vestindo]' : '[Na bolsa]', x + sectionWidth - 2, y + 4, { align: 'right' })
            
            if (armor.runes?.length) {
                doc.setFontSize(7)
                doc.text(`  Runas: ${armor.runes.join(', ')}`, x + 4, y + 8)
                y += 4
            }
            
            y += 6
        })
    } else {
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('Nenhuma armadura', x + 2, y + 4)
        y += 6
    }
    
    y += 2
    
    // Equipamentos
    if (build.equipment?.length) {
        setColor(doc, COLORS.black)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text('Equipamentos:', x + 2, y + 4)
        y += 5
        
        const equipText = build.equipment.map(([name, qty]) => qty > 1 ? `${name} (×${qty})` : name).join(', ')
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        const lines = doc.splitTextToSize(equipText, sectionWidth - 4)
        lines.forEach((line: string) => {
            doc.text(line, x + 4, y + 3)
            y += 4
        })
    }
    
    // Dinheiro
    if (build.money) {
        y += 2
        setColor(doc, COLORS.black)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        const moneyText = `Dinheiro: ${build.money.pp}pp | ${build.money.gp}gp | ${build.money.sp}sp | ${build.money.cp}cp`
        doc.text(moneyText, x + 2, y + 4)
        y += 6
    }
    
    return y + LAYOUT.sectionGap
}

function drawFeats(doc: jsPDF, build: BuildInfo, y: number): number {
    if (!build.feats?.length) return y
    
    y = ensurePageSpace(doc, y, 40)
    const x = LAYOUT.pageMargin
    const sectionWidth = LAYOUT.contentWidth
    
    y = drawSectionTitle(doc, 'Talentos (Feats)', x, y, sectionWidth)
    
    // Agrupar feats por tipo
    const featsByType: Record<string, Array<{ name: string; desc: string | null; level: number }>> = {}
    
    build.feats.forEach((f: any) => {
        const name = Array.isArray(f) ? String(f[0]) : String(f?.name ?? f)
        const type = Array.isArray(f) ? String(f[2] || 'Outro') : 'Outro'
        const level = Array.isArray(f) ? Number(f[3] || 1) : 1
        const desc = build.featDescriptions?.[name] || null
        
        if (!featsByType[type]) featsByType[type] = []
        featsByType[type].push({ name, desc, level })
    })
    
    Object.entries(featsByType).forEach(([type, feats]) => {
        y = ensurePageSpace(doc, y, 15)
        
        // Tipo como subtítulo
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.text(`— ${type.toUpperCase()} —`, x + 2, y + 3)
        y += 5
        
        feats.forEach((feat) => {
            y = ensurePageSpace(doc, y, 10)
            
            const url = getAonSearchUrl(feat.name)
            
            // Nome do feat
            setColor(doc, COLORS.black)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            doc.text(`• ${feat.name}`, x + 4, y + 3)
            
            // Nível
            setColor(doc, COLORS.gray)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            doc.text(`Nv ${feat.level}`, x + sectionWidth - 2, y + 3, { align: 'right' })
            
            // Link para AON
            const nameWidth = doc.getTextWidth(`• ${feat.name}`)
            doc.link(x + 4, y - 1, nameWidth, 5, { url })
            
            y += 4
            
            // Descrição (se houver)
            if (feat.desc) {
                setColor(doc, COLORS.gray)
                doc.setFontSize(7)
                const descLines = doc.splitTextToSize(feat.desc, sectionWidth - 10)
                descLines.slice(0, 2).forEach((line: string) => {
                    doc.text(line, x + 8, y + 3)
                    y += 3.5
                })
                if (descLines.length > 2) {
                    doc.text('...', x + 8, y + 3)
                    y += 3.5
                }
            }
        })
        
        y += 2
    })
    
    return y + LAYOUT.sectionGap
}

function drawSpecials(doc: jsPDF, build: BuildInfo, y: number): number {
    if (!build.specials?.length) return y
    
    y = ensurePageSpace(doc, y, 40)
    const x = LAYOUT.pageMargin
    const sectionWidth = LAYOUT.contentWidth
    
    y = drawSectionTitle(doc, 'Habilidades Especiais', x, y, sectionWidth)
    
    build.specials.forEach((special) => {
        y = ensurePageSpace(doc, y, 10)
        
        const name = String(special)
        const desc = build.specialDescriptions?.[name] || null
        const url = getAonSearchUrl(name)
        
        if (desc) {
            // Com descrição: "• Nome: descrição" (nome em bold, descrição normal)
            setColor(doc, COLORS.black)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            const nameText = `• ${name}: `
            doc.text(nameText, x + 2, y + 3)
            
            const nameWidth = doc.getTextWidth(nameText)
            
            // Descrição na mesma linha e continuando abaixo se necessário
            setColor(doc, COLORS.gray)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            
            const remainingWidth = sectionWidth - nameWidth - 6
            const firstLineDesc = doc.splitTextToSize(desc, remainingWidth)
            
            if (firstLineDesc.length > 0) {
                doc.text(firstLineDesc[0], x + 2 + nameWidth, y + 3)
            }
            
            // Se a descrição continua, mostra as linhas seguintes
            if (firstLineDesc.length > 1 || desc.length > firstLineDesc[0]?.length) {
                const remainingDesc = desc.slice(firstLineDesc[0]?.length || 0).trim()
                if (remainingDesc) {
                    const moreLines = doc.splitTextToSize(remainingDesc, sectionWidth - 8)
                    y += 4
                    moreLines.slice(0, 2).forEach((line: string) => {
                        doc.text(line, x + 6, y + 2.5)
                        y += 3.5
                    })
                    if (moreLines.length > 2) {
                        doc.text('...', x + 6, y + 2.5)
                        y += 3.5
                    }
                } else {
                    y += 4
                }
            } else {
                y += 4
            }
            
            // Link para AON (cobre o nome)
            doc.link(x + 2, y - 8, nameWidth, 5, { url })
        } else {
            // Sem descrição: apenas "• Nome" com link
            setColor(doc, COLORS.black)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            doc.text(`• ${name}`, x + 2, y + 3)
            
            const nameWidth = doc.getTextWidth(`• ${name}`)
            doc.link(x + 2, y - 1, nameWidth, 5, { url })
            
            y += 4
        }
    })
    
    return y + LAYOUT.sectionGap
}

function drawLores(doc: jsPDF, build: BuildInfo, y: number): number {
    if (!build.lores?.length) return y
    
    y = ensurePageSpace(doc, y, 20)
    const x = LAYOUT.pageMargin
    const halfWidth = LAYOUT.contentWidth / 2
    
    y = drawSectionTitle(doc, 'Conhecimentos (Lore)', x, y, halfWidth)
    
    const levelB = build.level || 0
    
    build.lores.forEach(([name, rank]) => {
        const intMod = abilityMod(build.abilities.int)
        const total = rank + levelB + intMod
        const mythicTotal = 10 + levelB + intMod
        const profLabel = getProficiencyLabel(rank)
        
        setColor(doc, COLORS.black)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`• ${name}`, x + 2, y + 4)
        
        doc.setFont('helvetica', 'bold')
        doc.text(`${signed(total)} [${profLabel}]`, x + 55, y + 4)
        
        setColor(doc, COLORS.gray)
        doc.setFontSize(7)
        doc.text(`M: ${signed(mythicTotal)}`, x + 80, y + 4)
        
        y += 5
    })
    
    return y + LAYOUT.sectionGap
}

function drawSpells(doc: jsPDF, build: BuildInfo, y: number): number {
    if (!build.spellCasters?.length) return y
    
    const x = LAYOUT.pageMargin
    const sectionWidth = LAYOUT.contentWidth
    
    build.spellCasters.forEach((caster) => {
        // Verificar se tem magias
        const hasSpells = caster.spells.some(lvl => lvl.list.length > 0)
        if (!hasSpells) return
        
        y = ensurePageSpace(doc, y, 35)
        
        // Header do spellcaster
        y = drawSectionTitle(doc, `Magias — ${caster.name}`, x, y, sectionWidth)
        
        // Info do caster
        const tradition = caster.magicTradition.charAt(0).toUpperCase() + caster.magicTradition.slice(1)
        const type = caster.spellcastingType === 'prepared' ? 'Preparado' : 'Espontâneo'
        const keyAbility = caster.ability.toUpperCase()
        const profRank = caster.proficiency || 0
        const abilityBonus = abilityMod((build.abilities as any)[caster.ability] || 10)
        const spellDC = 10 + (build.level || 0) + profRank + abilityBonus
        const spellAttack = (build.level || 0) + profRank + abilityBonus
        const profLabel = getProficiencyLabel(profRank)
        
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(`${tradition} | ${type} | Atributo: ${keyAbility} | Proficiência: [${profLabel}]`, x + 2, y + 3)
        y += 4
        
        setColor(doc, COLORS.black)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(`CD: ${spellDC}  |  Ataque: ${signed(spellAttack)}`, x + 2, y + 4)
        y += 6
        
        // Slots
        const slots = caster.perDay.map((n, i) => n > 0 ? `${i}°: ${n}` : null).filter(Boolean)
        if (slots.length) {
            setColor(doc, COLORS.gray)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            doc.text(`Slots: ${slots.join(' | ')}`, x + 2, y + 3)
            y += 5
        }
        
        // Magias por nível
        caster.spells.forEach((spellLevel) => {
            if (!spellLevel.list.length) return
            
            y = ensurePageSpace(doc, y, 10)
            
            // Nível
            setColor(doc, COLORS.black)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8)
            const levelText = spellLevel.spellLevel === 0 ? 'Truques' : `Nível ${spellLevel.spellLevel}`
            doc.text(`${levelText}:`, x + 2, y + 3)
            
            // Lista de magias
            setColor(doc, COLORS.gray)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            
            const spellsText = spellLevel.list.join(', ')
            const maxWidth = sectionWidth - 30
            const spellLines = doc.splitTextToSize(spellsText, maxWidth)
            
            spellLines.forEach((line: string, idx: number) => {
                doc.text(line, x + 25, y + 3 + idx * 3.5)
            })
            
            // Links para cada magia (invisíveis mas clicáveis)
            spellLevel.list.forEach((spellName) => {
                const url = getAonSearchUrl(spellName)
                doc.link(x + 25, y - 1, maxWidth, 5, { url })
            })
            
            y += Math.max(5, spellLines.length * 3.5 + 2)
        })
        
        y += LAYOUT.sectionGap
    })
    
    return y
}

function drawFocusSpells(doc: jsPDF, build: BuildInfo, y: number): number {
    if (!build.focus || !build.focusPoints) return y
    
    y = ensurePageSpace(doc, y, 20)
    const x = LAYOUT.pageMargin
    const sectionWidth = LAYOUT.contentWidth
    
    y = drawSectionTitle(doc, `Magias de Foco (${build.focusPoints} pontos)`, x, y, sectionWidth / 2)
    
    // Coletar todas as focus spells
    const focusSpells: string[] = []
    Object.values(build.focus).forEach((tradition: any) => {
        Object.values(tradition).forEach((abilityGroup: any) => {
            if (abilityGroup.focusSpells) {
                focusSpells.push(...abilityGroup.focusSpells)
            }
            if (abilityGroup.focusCantrips) {
                focusSpells.push(...abilityGroup.focusCantrips)
            }
        })
    })
    
    if (focusSpells.length) {
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        
        focusSpells.forEach((spell) => {
            const url = getAonSearchUrl(spell)
            doc.text(`• ${spell}`, x + 2, y + 3)
            doc.link(x + 2, y - 1, doc.getTextWidth(`• ${spell}`), 5, { url })
            y += 4
        })
    }
    
    return y + LAYOUT.sectionGap
}

function drawFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages()
    
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const pageHeight = doc.internal.pageSize.getHeight()
        const pageWidth = doc.internal.pageSize.getWidth()
        
        // Linha
        setColor(doc, COLORS.lightGray, 'draw')
        doc.setLineWidth(0.3)
        doc.line(LAYOUT.pageMargin, pageHeight - 10, pageWidth - LAYOUT.pageMargin, pageHeight - 10)
        
        // Texto
        setColor(doc, COLORS.gray)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.text('PF2e Toolkit — Descrições: https://2e.aonprd.com', LAYOUT.pageMargin, pageHeight - 5)
        doc.text(`Página ${i}/${pageCount}`, pageWidth - LAYOUT.pageMargin, pageHeight - 5, { align: 'right' })
    }
}

// ============================================================================
// MAIN EXPORT FUNCTIONS
// ============================================================================

export async function generateCharacterPdf(build: BuildInfo): Promise<ArrayBuffer> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    
    // PÁGINA 1: Informações principais de combate
    let y = drawHeader(doc, build)
    y = drawAbilityScores(doc, build, y)
    y = drawDefensesAndHP(doc, build, y)
    y = drawWeapons(doc, build, y)  // Ataques na primeira página!
    y = drawSkills(doc, build, y)
    
    // PÁGINA 2+: Lores, Equipamentos, Feats, Magias
    y = drawLores(doc, build, y)
    y = drawArmor(doc, build, y)
    y = drawFeats(doc, build, y)
    y = drawSpecials(doc, build, y)
    y = drawSpells(doc, build, y)
    y = drawFocusSpells(doc, build, y)
    
    drawFooter(doc)
    
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
