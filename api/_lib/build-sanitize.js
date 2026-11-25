// `sanitizeBuildState`: a forma do BuildState que o servidor aceita (MODELO-DE-DADOS §1).
// PAR de `src/modules/character-builder/sanitize.ts` — mexeu num, mexe no outro; o `check-builder` roda os mesmos
// casos nos dois. O servidor é JS puro e não importa TS (regra global 7).
//
// Campo desconhecido sai; valor fora da forma sai (a entrada inteira, não o build). O build nunca é recusado por
// forma: só por tamanho (`MAX_BUILD_BYTES`, o handler responde 413) ou por não ser um objeto.

export const BUILD_SCHEMA = 1
export const MAX_BUILD_BYTES = 64 * 1024

const ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const VARIANTS = ['freeArchetype', 'ancestralParagon', 'abp', 'pwl', 'dualClass', 'gradualBoosts']
const FEAT_KINDS = ['general', 'class', 'ancestry', 'skill']
const EFFECT_KINDS = ['resistance', 'speed', 'hp', 'itemBonus', 'proficiency', 'sense', 'language', 'innateSpell']
const HISTORY_KINDS = ['retrain', 'override', 'gm-grant']
const COMPANION_KINDS = ['animal', 'familiar', 'eidolon', 'construct', 'other']
const DETAILS = ['age', 'gender', 'pronouns', 'ethnicity', 'nationality', 'portrait']

/** `feat:feat-4387`, `class-feature:class-feature-813`, `custom:<id>`. */
const ID_RE = /^[a-z][a-z-]{0,30}:[a-z0-9][a-z0-9-]{0,60}$/
/** `skill:athletics`, `lore:alcohol`, `weapon-group:sword`. */
const REF_RE = ID_RE
/** Chave de slot gerada pelo motor: `class-feat-2`, `class-choice:arcane-school`, `ancestry-feat-1/grant:feat`. */
const SLOT_RE = /^[a-z0-9][a-z0-9:/_-]{0,95}$/
const KEY_RE = /^[a-z0-9][a-z0-9:_-]{0,59}$/
const VERSION_RE = /^[0-9]{4}\.[0-9]{2}\.[0-9]{1,4}$/

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v, max) => {
    if (typeof v !== 'string') return undefined
    const t = v.trim()
    return t && t.length <= max ? t : undefined
}
const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : undefined)
const id = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : undefined)
const attr = (v) => (ATTRS.includes(v) ? v : undefined)
const bool = (v) => (typeof v === 'boolean' ? v : undefined)

/** Tira as chaves `undefined` (o jsonb e a comparação ficam limpos). */
const compact = (o) => {
    const out = {}
    for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
    return out
}
const list = (v, max, each) => {
    if (!Array.isArray(v)) return undefined
    const out = []
    for (const item of v.slice(0, max)) {
        const clean = each(item)
        if (clean !== undefined) out.push(clean)
    }
    return out
}
const uniq = (v, max, each) => {
    const out = list(v, max, each)
    return out && [...new Set(out)]
}
/** Record com chave validada; `limit` entradas no máximo. */
const record = (v, keyOk, limit, each) => {
    if (!isObj(v)) return undefined
    const out = {}
    let n = 0
    for (const [k, value] of Object.entries(v)) {
        if (n >= limit) break
        if (!keyOk(k)) continue
        const clean = each(value)
        if (clean === undefined) continue
        out[k] = clean
        n += 1
    }
    return out
}
const levelKey = (k) => /^(?:[1-9]|1[0-9]|20)$/.test(k)
const rankKey = (k) => /^(?:[0-9]|10)$/.test(k)

export function cleanChoice(v) {
    if (!isObj(v)) return undefined
    if (v.id !== undefined) {
        const choiceId = id(v.id)
        if (!choiceId) return undefined
        const qualifier = typeof v.qualifier === 'string' && REF_RE.test(v.qualifier) ? v.qualifier : undefined
        return compact({ id: choiceId, qualifier })
    }
    if (v.boosts !== undefined) {
        const boosts = list(v.boosts, 6, attr)
        return boosts ? { boosts } : undefined
    }
    if (v.skills !== undefined) {
        const skills = uniq(v.skills, 20, (s) => (typeof s === 'string' && REF_RE.test(s) ? s : undefined))
        return skills ? { skills } : undefined
    }
    if (v.lore !== undefined) {
        const lore = text(v.lore, 60)
        return lore ? { lore } : undefined
    }
    if (v.value !== undefined) {
        const value = text(v.value, 60)
        return value ? { value } : undefined
    }
    return undefined
}

const cleanChoices = (v, limit) => record(v, (k) => SLOT_RE.test(k), limit, cleanChoice) ?? {}

function cleanOptions(v) {
    if (!isObj(v)) return {}
    const variants = record(v.variants, (k) => VARIANTS.includes(k), VARIANTS.length, bool)
    const m = isObj(v.mythic) ? v.mythic : null
    const mythic = m && typeof m.enabled === 'boolean'
        ? compact({ enabled: m.enabled, startLevel: int(m.startLevel, 1, 20), rank: int(m.rank, 0, 10) })
        : undefined
    return compact({
        variants: variants && Object.keys(variants).length ? variants : undefined,
        mythic,
        separateKits: bool(v.separateKits),
    })
}

function cleanOrigin(v) {
    if (!isObj(v)) return {}
    return compact({
        ancestry: id(v.ancestry),
        heritage: id(v.heritage),
        background: id(v.background),
        alternateBoosts: bool(v.alternateBoosts),
        voluntaryFlaws: uniq(v.voluntaryFlaws, 6, attr),
        languages: uniq(v.languages, 30, id),
        deity: id(v.deity),
        sanctification: v.sanctification === 'holy' || v.sanctification === 'unholy' || v.sanctification === null
            ? v.sanctification : undefined,
    })
}

function cleanClass(v) {
    if (!isObj(v)) return {}
    return compact({ id: id(v.id), keyAttribute: attr(v.keyAttribute), dual: id(v.dual) })
}

function cleanAdjustment(v) {
    if (!isObj(v) || !isObj(v.effect) || !EFFECT_KINDS.includes(v.effect.kind)) return undefined
    const adjId = typeof v.id === 'string' && KEY_RE.test(v.id) ? v.id : undefined
    const label = text(v.label, 80)
    const reason = text(v.reason, 200)
    if (!adjId || !label || !reason) return undefined
    const value = typeof v.effect.value === 'number' && Number.isFinite(v.effect.value) ? v.effect.value : text(v.effect.value, 60)
    return { id: adjId, label, reason, effect: compact({ kind: v.effect.kind, target: text(v.effect.target, 60), value }) }
}

function cleanManual(v) {
    if (!isObj(v)) return {}
    const override = record(v.attributeOverride, (k) => ATTRS.includes(k), 6, (n) => int(n, -5, 15))
    const extraBoosts = record(v.extraBoosts, levelKey, 20, (b) => list(b, 6, attr))
    const extraSkillIncreases = record(v.extraSkillIncreases, levelKey, 20, (n) => int(n, 0, 10))
    const extraFeatSlots = list(v.extraFeatSlots, 40, (s) => (isObj(s) && int(s.level, 1, 20) && FEAT_KINDS.includes(s.kind)
        ? { level: s.level, kind: s.kind } : undefined))
    const adjustments = list(v.adjustments, 50, cleanAdjustment)
    const nonEmpty = (o) => (o && Object.keys(o).length ? o : undefined)
    return compact({
        attributeOverride: nonEmpty(override),
        extraBoosts: nonEmpty(extraBoosts),
        extraSkillIncreases: nonEmpty(extraSkillIncreases),
        extraFeatSlots: extraFeatSlots?.length ? extraFeatSlots : undefined,
        adjustments: adjustments?.length ? adjustments : undefined,
    })
}

function cleanRunes(v) {
    if (!isObj(v)) return undefined
    const runes = compact({
        potency: int(v.potency, 0, 4),
        striking: int(v.striking, 0, 3),
        resilient: int(v.resilient, 0, 3),
        reinforcing: int(v.reinforcing, 0, 6),
        property: uniq(v.property, 4, id),
    })
    return Object.keys(runes).length ? runes : undefined
}

function cleanWeaponOptions(v) {
    if (!isObj(v)) return undefined
    const o = isObj(v.overrides) ? compact({
        attack: int(v.overrides.attack, -20, 60),
        damage: int(v.overrides.damage, -20, 60),
        proficiency: int(v.overrides.proficiency, 0, 4),
    }) : undefined
    const weapon = compact({
        attackAttribute: attr(v.attackAttribute),
        extraTraits: uniq(v.extraTraits, 10, (t) => text(t, 40)),
        extraDamage: list(v.extraDamage, 6, (t) => text(t, 40)),
        large: bool(v.large),
        increaseDice: bool(v.increaseDice),
        overrides: o && Object.keys(o).length ? o : undefined,
    })
    return Object.keys(weapon).length ? weapon : undefined
}

function cleanInventoryEntry(v) {
    if (!isObj(v)) return undefined
    const key = typeof v.key === 'string' && KEY_RE.test(v.key) ? v.key : undefined
    const item = id(v.item)
    const qty = int(v.qty, 0, 9999)
    if (!key || !item || qty === undefined) return undefined
    const grade = ['low', 'standard', 'high'].includes(v.material?.grade) ? v.material.grade : undefined
    const material = isObj(v.material) && id(v.material.id) ? compact({ id: v.material.id, grade }) : undefined
    return compact({
        key,
        item,
        qty,
        container: typeof v.container === 'string' && KEY_RE.test(v.container) && v.container !== key ? v.container : undefined,
        worn: bool(v.worn),
        invested: bool(v.invested),
        equipped: bool(v.equipped),
        acquired: v.acquired === 'given' ? 'given' : 'bought',
        runes: cleanRunes(v.runes),
        material,
        weapon: cleanWeaponOptions(v.weapon),
        customName: text(v.customName, 80),
    })
}

function cleanInventory(v) {
    const entries = list(v, 300, cleanInventoryEntry) ?? []
    const seen = new Set()
    return entries.filter((e) => !seen.has(e.key) && seen.add(e.key))
}

function cleanMoney(v) {
    const m = isObj(v) ? v : {}
    const coin = (n) => int(n, 0, 10_000_000) ?? 0
    return { pp: coin(m.pp), gp: coin(m.gp), sp: coin(m.sp), cp: coin(m.cp) }
}

const spellIds = (v) => uniq(v, 80, id)
const byRank = (v) => record(v, rankKey, 11, spellIds)

function cleanCaster(v) {
    if (!isObj(v)) return undefined
    return compact({
        repertoire: byRank(v.repertoire),
        signature: spellIds(v.signature),
        spellbook: uniq(v.spellbook, 300, id),
        // Preparadas repetem de propósito (várias cópias da mesma magia).
        prepared: record(v.prepared, rankKey, 11, (s) => list(s, 40, id)),
        bonusSlots: record(v.bonusSlots, rankKey, 11, (n) => int(n, 0, 10)),
    })
}

function cleanCompanion(v) {
    if (!isObj(v)) return undefined
    const key = typeof v.key === 'string' && KEY_RE.test(v.key) ? v.key : undefined
    const name = text(v.name, 80)
    if (!key || !name || !COMPANION_KINDS.includes(v.kind)) return undefined
    return compact({ key, kind: v.kind, name, type: id(v.type), choices: cleanChoices(v.choices, 100) })
}

function cleanDetails(v) {
    if (!isObj(v)) return {}
    const out = {}
    for (const k of DETAILS) {
        const t = text(v[k], k === 'portrait' ? 500 : 80)
        if (t) out[k] = t
    }
    return out
}

function cleanHistory(v) {
    return list(v, 100, (h) => {
        if (!isObj(h) || !HISTORY_KINDS.includes(h.kind)) return undefined
        const at = typeof h.at === 'string' && !Number.isNaN(Date.parse(h.at)) && h.at.length <= 40 ? h.at : undefined
        const by = text(h.by, 60)
        const note = text(h.note, 200)
        return at && by && note ? { at, by, note, kind: h.kind } : undefined
    }) ?? []
}

/** Um BuildState vazio para personagem novo. */
export function emptyBuildState(name, rulesVersion) {
    return {
        schema: BUILD_SCHEMA, rulesVersion, name, level: 1, xp: 0, options: {}, origin: {}, class: {}, choices: {},
        manual: {}, inventory: [], money: { pp: 0, gp: 0, sp: 0, cp: 0 }, spellcasting: {}, companions: [], details: {}, history: [],
    }
}

/** Converte formatos antigos (`schema` menor) para o atual. Hoje só existe o 1. */
export function migrateBuildState(state) {
    return state
}

/**
 * O BuildState na forma aceita, ou `null` se não for um objeto com nome. Campos ausentes ganham o padrão.
 * Não confere o tamanho: quem grava compara com `MAX_BUILD_BYTES`.
 */
export function sanitizeBuildState(input) {
    if (!isObj(input)) return null
    const v = migrateBuildState(input)
    const name = text(v.name, 80)
    if (!name) return null
    return {
        schema: BUILD_SCHEMA,
        rulesVersion: typeof v.rulesVersion === 'string' && VERSION_RE.test(v.rulesVersion) ? v.rulesVersion : '',
        name,
        level: int(v.level, 1, 20) ?? 1,
        xp: int(v.xp, 0, 1_000_000) ?? 0,
        options: cleanOptions(v.options),
        origin: cleanOrigin(v.origin),
        class: cleanClass(v.class),
        choices: cleanChoices(v.choices, 600),
        manual: cleanManual(v.manual),
        inventory: cleanInventory(v.inventory),
        money: cleanMoney(v.money),
        spellcasting: record(v.spellcasting, (k) => KEY_RE.test(k), 12, cleanCaster) ?? {},
        companions: list(v.companions, 10, cleanCompanion) ?? [],
        details: cleanDetails(v.details),
        history: cleanHistory(v.history),
    }
}

export const buildBytes = (state) => Buffer.byteLength(JSON.stringify(state), 'utf8')
