// Conjuração do monstro: ranks, slots e a lista de magias no nível-alvo.
//
// O que o índice entrega é o bloco em prosa — "Occult Innate Spells DC 20"
// seguido de `- **Cantrips (2nd)**` e `- **2nd** Darkness (at will)`. Até aqui
// só a CD e o ataque mudavam de nível; a lista passava intacta, então um
// dragão levado para o 24 continuava com o cardápio de magias do 14.
//
// A REGRA (GM Core pg. 122, "Prepared and Spontaneous Spells"): o rank mais
// alto que a criatura conjura é METADE DO NÍVEL ARREDONDADA PARA CIMA, ela tem
// cinco truques, e os slots por rank saem do nível ser par ou ímpar — nível
// ímpar dá 2 slots no rank mais alto, par dá 3, e os ranks abaixo dão 3 cada.
//
// A ESCALA PRESERVA A FORMA DA ESCADA, não os ranks crus: todo grupo anda o
// mesmo tanto que o rank máximo andou. É a mesma ideia que rege o arquivo
// vizinho `scaling.ts` (preserva-se a diferença, não o benchmark) e é o que
// mantém no topo as magias que o designer pôs no topo. Quem preferir os ranks
// originais troca o modo no ajuste fino: magia INATA, pelo RAW, não é limitada
// pelo nível, então os dois comportamentos são legítimos.
//
// TRUQUE E MAGIA DE FOCO SÃO EXCEÇÃO NOS DOIS MODOS: RAW, os dois são sempre
// conjurados no rank máximo de quem conjura, então acompanham o nível sempre.
//
// RITUAL fica INTOCADO: é conjurado a partir de um livro, em downtime, e o rank
// dele não tem relação com o nível de quem conjura (GM Core pg. 123).
//
// E, como em todo o módulo, **a ferramenta não inventa**: slot que abriu fica
// VAZIO, marcado, esperando o GM escolher. Nada é apagado sozinho — lista que
// passou do número de slots vira aviso, não exclusão.

import type {
    EditedSpellBlock,
    ScaledSpellBlock,
    ScaledSpellGroup,
    SpellBlockKind,
    SpellEdits,
    SpellEntry,
    SpellGroupKind,
    SpellcastingBlock,
} from './types'

/** Truques que um conjurador de verdade tem (GM Core pg. 122). */
export const CANTRIPS_KNOWN = 5

const MAX_SPELL_RANK = 10

/** Rank mais alto que a criatura conjura: metade do nível, para cima. */
export const maxSpellRank = (level: number): number =>
    Math.min(MAX_SPELL_RANK, Math.max(1, Math.ceil(level / 2)))

/**
 * O BENCHMARK de slots de um rank (GM Core pg. 122), na primeira das duas
 * leituras do livro: nível ímpar dá 2 slots no rank mais alto, par dá 3, e cada
 * rank abaixo dá 3. A segunda leitura (3/4 no topo, 4 abaixo) não é um caso
 * especial aqui — ela aparece sozinha, porque a ficha preserva o DESVIO dela em
 * relação a esta tabela, exatamente como todo o resto do módulo faz com os
 * números. A Ryta tem 4 slots de 1º rank no nível 4 e continua com quatro,
 * sem que ninguém precise escolher "a opção generosa" num menu.
 */
export function slotsForRank(level: number, rank: number): number {
    const top = maxSpellRank(level)
    if (rank > top) return 0
    if (rank < top) return 3
    return level % 2 === 0 ? 3 : 2
}

const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'] as const

/** "Occult Innate Spells" → `occult`. Bloco de classe ("Druid…") não tem. */
export function traditionOf(label: string): string | null {
    const lower = label.toLowerCase()
    return TRADITIONS.find((t) => lower.includes(t)) ?? null
}

/** "Divine Prepared Spells" → `prepared`. */
export function blockKindOf(label: string): SpellBlockKind {
    const lower = label.toLowerCase()
    if (lower.includes('ritual')) return 'ritual'
    if (lower.includes('focus')) return 'focus'
    if (lower.includes('innate')) return 'innate'
    if (lower.includes('prepared')) return 'prepared'
    if (lower.includes('spontaneous')) return 'spontaneous'
    return 'other'
}

/** Só preparada e espontânea têm slots por rank; inata é uso livre. */
const hasSlots = (kind: SpellBlockKind) => kind === 'prepared' || kind === 'spontaneous'

const ORDINALS: Record<string, number> = {
    '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5,
    '6th': 6, '7th': 7, '8th': 8, '9th': 9, '10th': 10,
}

/**
 * O rótulo de um grupo: `Cantrips (2nd)`, `Constant (4th)`, `3rd`.
 * Rótulo que não casa com nenhum dos três devolve `null` e o grupo passa
 * intocado — melhor do que chutar um rank.
 */
export function parseGroupRank(raw: string): { kind: SpellGroupKind; rank: number } | null {
    const text = String(raw || '').trim()
    const cantrip = /^cantrips?\s*\(([^)]+)\)$/i.exec(text)
    if (cantrip) {
        const rank = ORDINALS[cantrip[1].toLowerCase().trim()]
        return rank ? { kind: 'cantrip', rank } : null
    }
    const constant = /^constant\s*\(([^)]+)\)$/i.exec(text)
    if (constant) {
        const rank = ORDINALS[constant[1].toLowerCase().trim()]
        return rank ? { kind: 'constant', rank } : null
    }
    const rank = ORDINALS[text.toLowerCase()]
    return rank ? { kind: 'rank', rank } : null
}

/**
 * "Darkness (at will)" → `{ name: 'Darkness', note: 'at will' }`.
 *
 * A anotação é preservada palavra por palavra: ela carrega a frequência
 * ("at will"), as cópias preparadas ("×2") e as ressalvas de alcance
 * ("self only", "to the Universe … only") que a ferramenta não tem como
 * recalcular.
 */
export function parseSpellEntry(raw: string): SpellEntry {
    const text = String(raw || '').trim()
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(text)
    if (!m || !m[1]) return { name: text, note: null }
    return { name: m[1].trim(), note: m[2].trim() || null }
}

export const formatSpellEntry = (entry: SpellEntry): string =>
    entry.note ? `${entry.name} (${entry.note})` : entry.name

/**
 * A contagem de CÓPIAS dentro da anotação — `×3`, `x2`, `2` —, que é quantos
 * slots a magia ocupa (preparada) ou quantas vezes por dia ela sai (inata).
 *
 * A contagem é um TOKEN da anotação, não a anotação inteira: o Wyrmwraith
 * escreve "Charm (×3; undead targets only)" e o Horned Archon põe a contagem no
 * fim, em "Charm (animals only; x3)". Ler a anotação inteira como número dava
 * uma cópia só nesses casos, e o slot que a magia ocupava sobrava como vazio.
 */
function copyToken(note: string | null): { index: number; prefix: string; count: number } | null {
    if (!note) return null
    const parts = note.split(';')
    for (let i = 0; i < parts.length; i += 1) {
        const m = /^\s*([×x]?)\s*(\d+)\s*$/i.exec(parts[i])
        // O prefixo sai como está, inclusive vazio: as três fichas que escrevem
        // "Fear (2)" continuam escrevendo "(3)", não "(×3)".
        if (m) return { index: i, prefix: m[1], count: parseInt(m[2], 10) }
    }
    return null
}

const copiesOf = (entry: SpellEntry): number => copyToken(entry.note)?.count ?? 1

/** Quantas vezes a magia aparece: 1 quando a anotação não diz nada. */
export const spellCopies = copiesOf

/**
 * A mesma magia com outra contagem de cópias.
 *
 * A anotação é reescrita NO LUGAR, preservando o estilo do índice (`×3` vira
 * `×4`, `x3` vira `x4`) e o resto do texto ("undead targets only"). Uma cópia
 * só não escreve contagem nenhuma: "Fireball", não "Fireball (×1)".
 */
export function withCopies(entry: SpellEntry, count: number): SpellEntry {
    const n = Math.max(1, Math.round(count))
    const token = copyToken(entry.note)
    const parts = entry.note ? entry.note.split(';') : []

    if (token) {
        if (n > 1) parts[token.index] = `${token.prefix}${n}`
        else parts.splice(token.index, 1)
    } else if (n > 1) {
        parts.unshift(`×${n}`)
    } else {
        return entry
    }

    const note = parts.map((p) => p.trim()).filter(Boolean).join('; ')
    return { name: entry.name, note: note || null }
}

/**
 * A contagem de slots que a AON escreve na ÚLTIMA magia do rank
 * ("Ventriloquism (4 slots)") é do GRUPO, não da magia. Deixá-la como
 * anotação da magia faria a contagem viajar junto com ela numa troca.
 */
function extractSlotNote(spells: SpellEntry[]): { spells: SpellEntry[]; slots: number | null } {
    let slots: number | null = null
    const out = spells.map((entry) => {
        const m = entry.note && /^(\d+)\s*slots?$/i.exec(entry.note.trim())
        if (!m) return entry
        slots = parseInt(m[1], 10)
        return { name: entry.name, note: null }
    })
    return { spells: out, slots }
}

interface NormalizedGroup {
    kind: SpellGroupKind
    rank: number
    spells: SpellEntry[]
    /** Rótulo cru, para o grupo que não casou com nenhum formato conhecido. */
    raw: string | null
    slots: number | null
}

/** Bloco da AON (ou da edição do GM) na forma que a conta usa. */
function normalizeBlock(groups: { rank: string; spells: string[] }[]): NormalizedGroup[] {
    return groups.map((group) => {
        const parsed = parseGroupRank(group.rank)
        const entries = group.spells.map(parseSpellEntry)
        const { spells, slots } = extractSlotNote(entries)
        return {
            kind: parsed?.kind ?? 'rank',
            rank: parsed?.rank ?? 0,
            spells,
            raw: parsed ? null : group.rank,
            slots,
        }
    })
}

export interface SpellcastingOptions {
    /** Nível da ficha de onde a lista veio (o da AON, ou o da edição do GM). */
    fromLevel: number
    toLevel: number
    /** Por índice de bloco: os ranks acompanham o nível, ou ficam nos originais. */
    followRanks: (index: number) => boolean
    /** Lista editada pelo GM, quando existe. */
    edits?: SpellEdits | null
}

/**
 * Aplica o nível-alvo aos blocos de conjuração.
 *
 * @returns os blocos prontos para desenhar e os avisos do que ficou pendente.
 */
export function scaleSpellcasting(
    blocks: SpellcastingBlock[],
    options: SpellcastingOptions,
): { blocks: ScaledSpellBlock[]; warnings: string[] } {
    const warnings: string[] = []
    const { toLevel } = options
    const topRank = maxSpellRank(toLevel)

    const out = blocks.map((block, index) => {
        const kind = blockKindOf(block.label)
        const edited = options.edits?.blocks[index] ?? null
        // A edição do GM traz o próprio nível: é dele que a escada parte.
        const fromLevel = edited ? options.edits!.level : options.fromLevel
        const source: NormalizedGroup[] = edited
            ? editedToNormalized(edited)
            : normalizeBlock(block.groups)

        const scaled = kind === 'ritual'
            ? source
            : shiftGroups(source, fromLevel, toLevel, options.followRanks(index))

        const merged = mergeByRank(scaled, block.label, warnings)

        // O bloco ganha ranks NOS DOIS MODOS — o que muda é de que lado. Em
        // "acompanham", a escada inteira sobe e o que abre são os ranks de
        // baixo; em "originais", cada magia fica onde estava e o que abre são os
        // de cima. Nos dois casos o monstro ganha o que o nível novo dá.
        const follow = options.followRanks(index)
        const delta = maxSpellRank(toLevel) - maxSpellRank(fromLevel)
        const groups = hasSlots(kind)
            ? applySlots(merged, source, fromLevel, toLevel, delta, follow, kind, block.label, warnings)
            : merged.map((g) => toGroup(g, null))

        if (kind === 'innate' && options.followRanks(index)
            && maxSpellRank(fromLevel) !== topRank && source.some((g) => g.kind === 'rank')) {
            warnings.push(
                `As magias inatas de "${block.label}" subiram de rank junto com o nível. `
                + 'O RAW permite (inata não é limitada por nível), mas confira se cada uma '
                + 'ganha alguma coisa ao ser elevada.',
            )
        }

        return {
            label: block.label,
            kind,
            tradition: traditionOf(block.label),
            dc: block.dc,
            attack: block.attack,
            groups,
        }
    })

    return { blocks: out, warnings }
}

function editedToNormalized(edited: EditedSpellBlock): NormalizedGroup[] {
    return edited.groups.map((group) => ({
        kind: group.kind,
        rank: group.rank,
        spells: group.spells,
        raw: null,
        // A contagem de slots viaja na edição: sem ela, a ficha da Ryta (4 slots
        // de 1º rank, que é a opção generosa do livro) perderia o quarto slot na
        // primeira vez que o GM trocasse qualquer magia.
        slots: group.slots ?? null,
    }))
}

/**
 * A lista atual vira a nova ORIGEM da escada, junto com o nível em que ela está.
 *
 * É o que faz a escolha do GM sobreviver a uma troca de nível-alvo: a conta
 * passa a partir daqui, com a mesma regra de deslocamento. Editar no nível 12 e
 * depois ir para o 16 desloca a lista editada, não a da AON.
 */
export function buildSpellEdits(blocks: ScaledSpellBlock[], level: number): SpellEdits {
    return {
        level,
        blocks: blocks.map((block) => ({
            groups: block.groups.map((group) => ({
                kind: group.kind,
                rank: group.rank,
                spells: group.spells,
                slots: group.slots,
            })),
        })),
    }
}

/**
 * Move a escada: cada grupo anda o mesmo tanto que o rank máximo do NÍVEL andou.
 *
 * O TRUQUE anda nos dois modos, e não só no "acompanham": truque é conjurado no
 * rank de quem conjura, sempre (Player Core). Andar preservando a diferença é
 * também o que mantém a identidade — e a diferença existe de verdade. O Mitflit
 * é nível -1 e tem truque de 1º com uma inata de 2º (inata não é limitada por
 * nível); a Sacuishu é nível 9, teto 5º, e escreve "Cantrips (4th)". Mandar o
 * truque para o teto do nível, ou para o topo do bloco, reescrevia a ficha
 * desses dois no PRÓPRIO nível.
 */
function shiftGroups(
    groups: NormalizedGroup[],
    fromLevel: number,
    toLevel: number,
    follow: boolean,
): NormalizedGroup[] {
    const levelDelta = maxSpellRank(toLevel) - maxSpellRank(fromLevel)
    return groups.map((group) => {
        const delta = group.kind === 'cantrip' ? levelDelta : (follow ? levelDelta : 0)
        if (group.rank === 0 || delta === 0) return group
        return { ...group, rank: Math.min(MAX_SPELL_RANK, Math.max(1, group.rank + delta)) }
    })
}

/**
 * Dois grupos podem cair no mesmo rank depois do deslocamento — o teto de 10
 * junta o 9º e o 10º de quem sobe demais. Juntar é o único caminho honesto:
 * descartar apagaria magia, e manter dois grupos de "10º" desenharia uma ficha
 * que não existe.
 */
function mergeByRank(
    groups: NormalizedGroup[],
    label: string,
    warnings: string[],
): NormalizedGroup[] {
    const byKey = new Map<string, NormalizedGroup>()
    let merges = 0
    for (const group of groups) {
        const key = `${group.kind}:${group.rank}:${group.raw ?? ''}`
        const existing = byKey.get(key)
        if (!existing) {
            byKey.set(key, { ...group, spells: [...group.spells] })
            continue
        }
        merges += 1
        existing.spells.push(...group.spells)
        existing.slots = existing.slots ?? group.slots
    }
    if (merges > 0) {
        warnings.push(
            `Em "${label}", ranks diferentes caíram no mesmo rank depois do ajuste `
            + '(o rank 10 é o teto) e as listas foram juntadas — confira se não sobrou magia demais.',
        )
    }
    return [...byKey.values()]
}

/**
 * Quantos slots a ficha ORIGINAL declara num rank.
 *
 * Espontânea escreve o número na última magia do rank ("(4 slots)"); em
 * preparada, o número de magias preparadas É o número de slots (com `×2`
 * valendo dois). `null` quando o rank não existe na ficha original.
 */
function declaredSlots(group: NormalizedGroup | undefined, kind: SpellBlockKind): number | null {
    if (!group) return null
    if (group.slots !== null) return group.slots
    if (kind !== 'prepared') return null
    const used = group.spells.reduce((sum, entry) => sum + copiesOf(entry), 0)
    return used > 0 ? used : null
}

/**
 * Slots e ranks novos de um bloco com slot (preparada/espontânea).
 *
 * SÓ ABRE O QUE O NÍVEL ABRIU. Completar a escada de 1 até o topo parecia a
 * leitura óbvia do livro, mas reescreve fichas publicadas: o Elder Child of
 * Belcorra é nível 9 e conjura do 2º ao 4º, o Fortune Archdragon é nível 23 e
 * tem UM grupo, de 10º rank. O próprio GM Core diz que a criatura fica pouco
 * tempo em cena e que não é preciso preencher todo slot (pg. 122) — inventar os
 * ranks que faltam encheria a ficha de vazio que o designer deixou de fora de
 * propósito, e quebraria a identidade no próprio nível.
 *
 * O que abre são os ranks que o deslocamento liberou: em "acompanham", os que
 * ficaram abaixo da escada quando ela subiu; em "originais", os que apareceram
 * acima do topo antigo. Com nível igual, o deslocamento é zero e nada abre.
 */
function applySlots(
    groups: NormalizedGroup[],
    sourceGroups: NormalizedGroup[],
    fromLevel: number,
    toLevel: number,
    delta: number,
    follow: boolean,
    kind: SpellBlockKind,
    label: string,
    warnings: string[],
): ScaledSpellGroup[] {
    const sourceRanks = sourceGroups
        .filter((g) => g.kind === 'rank' && g.rank > 0)
        .map((g) => g.rank)
        .sort((a, b) => a - b)

    // Onde a ficha original diverge do benchmark de slots, a divergência é
    // preservada — a mesma regra que vale para CA, PV e todo o resto. O desvio
    // do rank MAIS BAIXO que declara um número vale para os ranks que abrirem:
    // é ele que o livro descreve como "3 slots de cada rank inferior" (ou 4, na
    // opção generosa).
    const shift = follow ? delta : 0
    const deviations = new Map<number, number>()
    let lowestDeviation = 0
    let lowestSeen = false
    for (const group of [...sourceGroups].sort((a, b) => a.rank - b.rank)) {
        if (group.kind !== 'rank' || group.rank < 1) continue
        const declared = declaredSlots(group, kind)
        if (declared === null) continue
        const deviation = declared - slotsForRank(fromLevel, group.rank)
        deviations.set(group.rank + shift, deviation)
        if (!lowestSeen) {
            lowestDeviation = deviation
            lowestSeen = true
        }
    }

    const slotsOf = (rank: number) =>
        Math.max(1, slotsForRank(toLevel, rank) + (deviations.get(rank) ?? lowestDeviation))

    const emptyOf = (group: NormalizedGroup | null, slots: number) => {
        const used = group ? group.spells.reduce((sum, e) => sum + copiesOf(e), 0) : 0
        // ESPONTÂNEA não tem slot vazio enquanto souber ALGUMA magia do rank: o
        // repertório não é a lista de slots, e quatro slots de 1º com três
        // magias conhecidas é uma ficha normal — o Virulak Necromancer é assim.
        // Só um rank sem magia nenhuma deixa slots inúteis.
        if (kind !== 'prepared') {
            return { used, empty: used > 0 ? 0 : slots }
        }
        return { used, empty: Math.max(0, slots - used) }
    }

    // Os grupos que já existiam, na ORDEM DA FICHA — a AON põe "Constant (6th)"
    // depois dos ranks no Stirvyn Banyan, e reordenar por rank reescreveria o
    // bloco dele no próprio nível.
    const out: ScaledSpellGroup[] = groups.map((group) => {
        if (group.kind !== 'rank' || group.rank < 1) return toGroup(group, null)
        const slots = slotsOf(group.rank)
        const { used, empty } = emptyOf(group, slots)
        if (kind === 'prepared' && used > slots) {
            warnings.push(
                `"${label}" tem ${used} magia(s) preparada(s) de ${rankLabel(group.rank)} rank `
                + `para ${slots} slot(s) no nível ${toLevel} — tire ${used - slots}.`,
            )
        }
        return { ...toGroup(group, slots), empty }
    })

    if (sourceRanks.length === 0 || delta <= 0) return out

    // Ranks que o nível novo abriu, e que ainda não estão na lista.
    const taken = new Set(out.filter((g) => g.kind === 'rank').map((g) => g.rank))
    const first = sourceRanks[0]
    const last = sourceRanks[sourceRanks.length - 1]
    const opened: number[] = []
    for (let i = 0; i < delta; i += 1) {
        const rank = follow ? first + i : last + 1 + i
        if (rank >= 1 && rank <= MAX_SPELL_RANK && !taken.has(rank)) opened.push(rank)
    }
    if (opened.length === 0) return out

    let emptyTotal = 0
    for (const rank of opened) {
        const slots = slotsOf(rank)
        emptyTotal += slots
        const group: ScaledSpellGroup = {
            kind: 'rank', rank, label: null, spells: [], slots, empty: slots,
        }
        // Entra ao lado do vizinho de rank mais próximo, para a escada continuar
        // legível: depois do último rank menor, ou antes do primeiro maior.
        const before = out.findIndex((g) => g.kind === 'rank' && g.rank > rank)
        out.splice(before < 0 ? out.length : before, 0, group)
    }

    warnings.push(
        `O nível ${toLevel} abriu ${opened.length} rank(s) em "${label}" `
        + `(${opened.map(rankLabel).join(', ')}), com ${emptyTotal} slot(s) vazio(s): `
        + 'escolha as magias em "Editar magias".',
    )

    return out
}

const toGroup = (group: NormalizedGroup, slots: number | null): ScaledSpellGroup => ({
    kind: group.kind,
    rank: group.rank,
    label: group.raw,
    spells: group.spells,
    slots: slots ?? group.slots,
    empty: 0,
})

/** `5` → "5º". */
export const rankLabel = (rank: number): string => `${rank}º`

/** O rótulo em pt-BR de um grupo: "Truques (5º)", "Constante (4º)", "5º". */
export function groupLabel(group: ScaledSpellGroup): string {
    if (group.label) return group.label
    if (group.kind === 'cantrip') return `Truques (${rankLabel(group.rank)})`
    if (group.kind === 'constant') return `Constante (${rankLabel(group.rank)})`
    return rankLabel(group.rank)
}
