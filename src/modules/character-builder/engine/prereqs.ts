// Pré-requisitos (MOTOR-DE-REGRAS §11). O texto vem da AON ("trained in Athletics; Power Attack"). Cada parte sai
// `ok | fail | unknown`; `unknown` vira aviso "confira", nunca reprova (regra global 8: avisa, não trava).
import { tr } from '../../../i18n'
import { SKILL_KEYS, type AttributeKey, type Rank, type SkillKey } from './types'

export type PrereqResult = 'ok' | 'fail' | 'unknown'

export interface PrereqPart {
    text: string
    result: PrereqResult
    /** Motivo legível quando reprova. */
    reason?: string
}

export interface PrereqContext {
    level: number
    className?: string
    ancestryName?: string
    heritageName?: string
    /** Nomes (minúsculas) de talentos e características que o personagem tem até o nível do slot. */
    has: Set<string>
    skillRank: (skill: SkillKey) => Rank
    loreRank: (lore: string) => Rank
    stat: Partial<Record<'perception' | 'fortitude' | 'reflex' | 'will', Rank>>
    attribute: Record<AttributeKey, number>
    deity?: string
}

const RANKS: Record<string, Rank> = { trained: 1, expert: 2, master: 3, legendary: 4 }
const RANK_PT: Record<string, string> = { trained: 'treinado', expert: 'perito', master: 'mestre', legendary: 'lendário' }
const ATTR: Record<string, AttributeKey> = {
    strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
}

/** Divide "A; B" e "A, B" (mas não "A or B", que é alternativa). */
function splitParts(text: string): string[] {
    return text.split(/;|,(?![^()]*\))/).map((p) => p.trim()).filter(Boolean)
}

function evalOne(raw: string, ctx: PrereqContext): PrereqPart {
    const text = raw.trim()
    const lower = text.toLowerCase().replace(/\.$/, '')
    // Alternativas: basta uma.
    if (/\bor\b/.test(lower) && !/^(trained|expert|master|legendary) in \w+ or \w+$/.test(lower)) {
        const alts = lower.split(/\s*,?\s*\bor\b\s*/).filter(Boolean)
        const results = alts.map((a) => evalOne(a, ctx).result)
        const result: PrereqResult = results.includes('ok') ? 'ok' : results.every((r) => r === 'fail') ? 'fail' : 'unknown'
        return { text, result, ...(result === 'fail' ? { reason: tr(`nenhuma das opções: ${text}`, `none of: ${text}`) } : {}) }
    }
    // Rank: "trained in Athletics", "expert in Perception", "master in Arcana or Occultism", "trained in Circus Lore".
    const rank = /^(trained|expert|master|legendary) in (?:the )?(.+)$/.exec(lower)
    if (rank) {
        const need = RANKS[rank[1]]
        const targets = rank[2].split(/\s+or\s+/)
        let anyKnown = false
        for (const target of targets) {
            const t = target.trim()
            let have: Rank | null = null
            if ((SKILL_KEYS as string[]).includes(t)) have = ctx.skillRank(t as SkillKey)
            else if (t === 'perception') have = ctx.stat.perception ?? 0
            else if (/^(fortitude|reflex|will)( saves?)?$/.test(t)) have = ctx.stat[t.split(' ')[0] as 'fortitude'] ?? 0
            else if (/ lore$/.test(t) && !/\ba lore\b|\bany\b/.test(t)) have = ctx.loreRank(t.replace(/ lore$/, ''))
            else if (t === 'at least one skill') have = Math.max(...SKILL_KEYS.map((s) => ctx.skillRank(s))) as Rank
            if (have === null) continue
            anyKnown = true
            if (have >= need) return { text, result: 'ok' }
        }
        if (!anyKnown) return { text, result: 'unknown' }
        return { text, result: 'fail', reason: tr(`precisa ser ${RANK_PT[rank[1]]} em ${rank[2]}`, `needs ${rank[1]} in ${rank[2]}`) }
    }
    // Atributo: "Strength +2", "Intelligence +3".
    const attr = /^(strength|dexterity|constitution|intelligence|wisdom|charisma) \+?(\d)$/.exec(lower)
    if (attr) {
        const have = ctx.attribute[ATTR[attr[1]]]
        return have >= Number(attr[2]) ? { text, result: 'ok' } : { text, result: 'fail', reason: tr(`${text} (tem ${have >= 0 ? '+' : ''}${have})`, `${text} (has ${have >= 0 ? '+' : ''}${have})`) }
    }
    // Herança/ancestralidade: "elf", "dwarf heritage", "Cavern Elf heritage".
    const heritage = /^(.+?) (heritage|ancestry)$/.exec(lower)
    if (heritage) {
        const name = heritage[1]
        const mine = [ctx.heritageName, ctx.ancestryName].filter(Boolean).map((n) => n!.toLowerCase())
        return mine.includes(name) ? { text, result: 'ok' } : { text, result: 'fail', reason: tr(`precisa de ${text}`, `needs ${text}`) }
    }
    if (ctx.ancestryName && lower === ctx.ancestryName.toLowerCase()) return { text, result: 'ok' }
    // Divindade.
    if (/^(you )?(follow|worship) a deity$/.test(lower)) return ctx.deity ? { text, result: 'ok' } : { text, result: 'fail', reason: tr('precisa de uma divindade', 'needs a deity') }
    // Talento ou característica possuída, pelo nome (inclui dedicação: "Wizard Dedication").
    if (ctx.has.has(lower)) return { text, result: 'ok' }
    // Nome com cara de talento (palavras com inicial maiúscula, sem verbo) que o personagem não tem: reprova.
    if (/^[A-Z][\w'’-]*( [A-Z(][\w'’()-]*)*$/.test(text) && text.split(' ').length <= 5) {
        return { text, result: 'fail', reason: tr(`precisa de ${text}`, `needs ${text}`) }
    }
    return { text, result: 'unknown' }
}

/** Avalia o texto inteiro. Resultado geral: fail se alguma parte reprova; unknown se alguma não foi entendida. */
export function evaluatePrereqs(text: string | undefined, ctx: PrereqContext): { result: PrereqResult; parts: PrereqPart[] } {
    if (!text?.trim()) return { result: 'ok', parts: [] }
    const parts = splitParts(text).map((p) => evalOne(p, ctx))
    const result: PrereqResult = parts.some((p) => p.result === 'fail') ? 'fail' : parts.some((p) => p.result === 'unknown') ? 'unknown' : 'ok'
    return { result, parts }
}
