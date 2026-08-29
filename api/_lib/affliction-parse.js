// Parse de aflições (venenos, doenças, maldições) do índice da AON.
//
// O índice já traz o essencial estruturado — `stage`, `saving_throw`,
// `onset_raw`, `duration_raw` —, então aqui não há scraping de prosa: só a
// leitura dos campos e a extração do que está DENTRO do texto de cada estágio
// (condições, valor e duração).
//
// A armadilha que define o arquivo: **só a primeira ocorrência de uma condição
// vira link**. No Giant Centipede Venom o estágio 2 traz
// `[fatigued](/Conditions.aspx?ID=15)` e o estágio 3 traz `clumsy 1, and
// fatigued`, cru. Casar por link perderia metade das condições, então o casamento
// é por TEXTO contra a lista canônica de `character-viewer/conditions.ts`.

/** Marcadores de template do AON: `<%CONDITIONS%N%%>sickened<%END>`. */
const stripTemplates = (text) =>
  String(text || '').replace(/<%[A-Z]+%\d*%*>([^<]*)<%END>/g, '$1')

const stripLinks = (text) =>
  String(text || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')

const clean = (text) =>
  stripLinks(stripTemplates(text))
    .replace(/<[^>]*>/g, '')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Condições do catálogo, em inglês canônico. `flat-footed` é o nome pré-Remaster
 * de `off-guard` e ainda aparece nas entradas antigas do índice.
 */
const CONDITION_WORDS = [
  ['clumsy', 'clumsy'], ['enfeebled', 'enfeebled'], ['stupefied', 'stupefied'],
  ['drained', 'drained'], ['frightened', 'frightened'], ['sickened', 'sickened'],
  ['fatigued', 'fatigued'], ['off-guard', 'off-guard'], ['flat-footed', 'off-guard'],
  ['prone', 'prone'], ['fascinated', 'fascinated'], ['encumbered', 'encumbered'],
  ['blinded', 'blinded'], ['deafened', 'deafened'], ['dazzled', 'dazzled'],
  ['concealed', 'concealed'], ['immobilized', 'immobilized'], ['grabbed', 'grabbed'],
  ['restrained', 'restrained'], ['paralyzed', 'paralyzed'], ['petrified', 'petrified'],
  ['confused', 'confused'], ['controlled', 'controlled'], ['fleeing', 'fleeing'],
  ['slowed', 'slowed'], ['stunned', 'stunned'], ['quickened', 'quickened'],
  ['dying', 'dying'], ['wounded', 'wounded'], ['doomed', 'doomed'],
  ['unconscious', 'unconscious'], ['invisible', 'invisible'],
]

/** Rodadas por unidade. Só rodada cabe no rastreador de combate. */
const UNIT_ROUNDS = { round: 1 }

/**
 * "1d4 poison damage, clumsy 1, and fatigued (1 round)" →
 *   { conditions: [{id:'clumsy',value:1},{id:'fatigued'}], durationRounds: 1 }
 *
 * Duração em minuto, hora ou dia devolve `durationRounds: null`: 65% dos
 * estágios são assim, e fingir que cabem no relógio do combate seria pior do
 * que dizer que não cabem — o GM avança esses à mão.
 */
export function parseStage(raw) {
  const text = clean(raw)

  const durationMatch = /\((\d+)\s*(round|minute|hour|day|week|month|year)s?\)\s*$/i.exec(text)
  const unit = durationMatch ? durationMatch[2].toLowerCase() : null
  const amount = durationMatch ? parseInt(durationMatch[1], 10) : null

  const conditions = []
  const seen = new Set()
  for (const [word, id] of CONDITION_WORDS) {
    // `\b` não fecha em "off-guard"/"flat-footed" por causa do hífen, então a
    // borda direita é "não-letra".
    const re = new RegExp(`\\b${word}(?![a-z])\\s*(\\d+)?`, 'i')
    const m = re.exec(text)
    if (!m || seen.has(id)) continue
    seen.add(id)
    conditions.push(m[1] ? { id, value: parseInt(m[1], 10) } : { id })
  }

  return {
    text,
    conditions,
    durationRounds: unit && UNIT_ROUNDS[unit] ? amount * UNIT_ROUNDS[unit] : null,
    durationRaw: durationMatch ? `${amount} ${unit}${amount > 1 ? 's' : ''}` : null,
  }
}

/**
 * "DC 17 Fortitude" → { dc: 17, save: 'fortitude' }
 *
 * O campo varia mais do que parece: aparece invertido ("Fortitude DC 22"), sem
 * a salvaguarda ("DC 20"), sem a CD ("Fortitude (DC equals that of the drug)")
 * e com marcadores de template. O que não der para ler vira `null` em vez de
 * número inventado — o GM confere na hora.
 */
export function parseSavingThrow(raw) {
  const text = clean(raw)
  if (!text) return { dc: null, save: null, raw: null }
  const dc = /DC\s*(\d+)/i.exec(text)
  const save = /\b(fortitude|reflex|will)\b/i.exec(text)
  return {
    dc: dc ? parseInt(dc[1], 10) : null,
    save: save ? save[1].toLowerCase() : null,
    raw: text,
  }
}

/** Entradas pré-Remaster apontam para a versão nova por `remaster_id`. */
const isLegacy = (s) =>
  (Array.isArray(s?.remaster_id) && s.remaster_id.length > 0)
  || (Array.isArray(s?.remaster_name) && s.remaster_name.length > 0)

const AON_BASE = 'https://2e.aonprd.com'

/**
 * @returns {object|null} aflição normalizada, ou `null` se o documento não tem
 *   estágio nenhum — sem estágios não é aflição rastreável.
 */
export function normalizeAffliction(hit) {
  const s = hit?._source
  if (!s?.name || !Array.isArray(s.stage) || s.stage.length === 0) return null

  const traits = Array.isArray(s.trait) ? s.trait : []
  const url = String(s.url || '')

  return {
    name: s.name,
    category: s.category || null,
    level: Number.isFinite(s.level) ? s.level : null,
    ...parseSavingThrow(s.saving_throw),
    // Virulento muda a regra de recuperação (ver applySave em afflictions.ts).
    virulent: traits.some((t) => /virulent/i.test(t)),
    traits,
    onsetRaw: s.onset_raw ? clean(s.onset_raw) : null,
    maxDurationRaw: s.duration_raw ? clean(s.duration_raw) : null,
    stages: s.stage.map(parseStage),
    source: s.primary_source || null,
    url: url.startsWith('http') ? url : AON_BASE + url,
  }
}

export { isLegacy }
