/**
 * O que o Investigador faz com os Golpes.
 *
 * - **Devise a Stratagem** (Player Core 2 pg. 103, ação livre ou 1 ação, uma vez por
 *   rodada): escolhe-se uma criatura e rola-se um d20. O PRIMEIRO Golpe nela antes do
 *   próximo turno usa esse d20 no lugar da rolagem (traço *fortune*) e pode somar INT em
 *   vez de FOR/DES — mas só com arma corpo a corpo ágil ou de acuidade, desarmado ágil ou
 *   de acuidade, ou arma à distância. É ação livre se a criatura é parte de uma investigação
 *   ativa (Pursue a Lead). O Golpe e o estratagema saem no mesmo clique, então o d20 da
 *   rolagem JÁ É o do estratagema; o que o diálogo precisa fazer é cobrar a ação, trocar o
 *   atributo e somar o Strategic Strike.
 * - **Strategic Strike**: 1d6 de dano de precisão no Golpe que soma INT por causa do Devise
 *   a Stratagem, +1 dado nos níveis 5, 9, 13 e 17. Dobra no crítico, como toda precisão.
 *   Vale quando a arma PODE somar INT, mesmo que INT e DES empatem.
 * - **Known Weaknesses** e **Shared Stratagem** dependem do alvo e de um aliado, que a ficha
 *   não vê: viram anotação da rolagem.
 *
 * O app não conta a "uma vez por rodada": o chip vem desligado em todo Golpe e é do jogador.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { WeaponTraits } from './strikes'

const norm = (s: string) => s.trim().toLowerCase()
const hasSpecial = (b: BuildInfo, name: string) => (b.specials ?? []).some((s) => norm(s) === norm(name))
const hasFeat = (b: BuildInfo, name: string) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))

export const hasDeviseAStratagem = (b: BuildInfo) => hasSpecial(b, 'Devise a Stratagem')
export const hasStrategicStrike = (b: BuildInfo) => hasSpecial(b, 'Strategic Strike')
export const hasKnownWeaknesses = (b: BuildInfo) => hasFeat(b, 'Known Weaknesses')
export const hasSharedStratagem = (b: BuildInfo) => hasFeat(b, 'Shared Stratagem')

/** Chaves das escolhas por Golpe, guardadas junto dos chips de dano extra (não ficam lembradas). */
export const STRATAGEM_KEY = 'stratagem'
/** A criatura é parte de uma investigação ativa: o Devise a Stratagem é ação livre. */
export const LEAD_KEY = 'stratagem-lead'
export const KNOWN_WEAKNESSES_KEY = 'known-weaknesses'
export const SHARED_STRATAGEM_KEY = 'shared-stratagem'

/** Dados do Strategic Strike: 1, e mais 1 nos níveis 5, 9, 13 e 17. */
export const strategicStrikeDice = (level: number): number =>
    1 + [5, 9, 13, 17].filter((l) => level >= l).length

/**
 * A arma pode somar INT pelo Devise a Stratagem: à distância sempre; corpo a corpo, desarmado
 * e arremesso só com ágil ou acuidade. Sem os traços da arma (caseira) não dá para afirmar.
 */
export const stratagemQualifies = (traits: Pick<WeaponTraits, 'known' | 'ranged' | 'agile' | 'finesse'>): boolean =>
    traits.known && (traits.ranged || traits.agile || traits.finesse)

/** O estratagema de ataque está ligado neste Golpe. */
export const stratagemOn = (build: BuildInfo, on: Record<string, boolean>): boolean =>
    hasDeviseAStratagem(build) && on[STRATAGEM_KEY] === true

/** Ações que o Devise a Stratagem cobra: 1, ou 0 com uma investigação ativa sobre a criatura. */
export const stratagemCost = (on: Record<string, boolean>): number => (on[LEAD_KEY] === true ? 0 : 1)

// ── Investigações (Pursue a Lead) ───────────────────────────────────────────
//
// Pursue a Lead (1 minuto, exploração): o mestre confirma que há um mistério maior, e a
// Investigadora abre uma **investigação** — até **duas** ativas. Cada uma dá +1 de
// circunstância em teste de Percepção ou de perícia (INT, SAB ou CAR) que a aproxime da
// resposta. Abandonar uma para abrir outra a deixa fora até a próxima preparação diária.
// Depois de achar um mistério maior, o Pursue a Lead só volta em 10 minutos.
//
// O estado é da MESA (campo `investigator`), porque Clue In e Detective's Readiness passam
// o bônus a aliados e o mestre precisa ver o que está aberto. **O app não conta o tempo**:
// os 10 minutos são só um relógio na faixa, e o jogador decide quando já passou.

export interface Lead {
    id: string
    name: string
}

export interface InvestigatorStored {
    leads: Lead[]
    /** Nomes (minúsculos) abandonados: não voltam até a próxima preparação diária. */
    dropped: string[]
    /** Quando o Pursue a Lead / Clue In / Expeditious Inspection foram usados (ms), para o relógio de 10 minutos. */
    pursuedAt: number | null
    clueAt: number | null
    inspectedAt: number | null
}

export const MAX_LEADS = 2
export const COOLDOWN_MS = 10 * 60 * 1000
/** Bônus de investigação de Pursue a Lead: +1 de circunstância. */
export const INVESTIGATION_BONUS = 1

export const NO_INVESTIGATOR: InvestigatorStored = { leads: [], dropped: [], pursuedAt: null, clueAt: null, inspectedAt: null }

const ts = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 4e12 ? Math.floor(v) : null

export function sanitizeInvestigator(raw: unknown): InvestigatorStored {
    if (!raw || typeof raw !== 'object') return NO_INVESTIGATOR
    const r = raw as Record<string, unknown>
    const leads: Lead[] = []
    for (const l of Array.isArray(r.leads) ? r.leads : []) {
        if (!l || typeof l !== 'object' || leads.length >= MAX_LEADS) continue
        const { id, name } = l as Record<string, unknown>
        const clean = typeof name === 'string' ? name.trim().slice(0, 80) : ''
        if (clean) leads.push({ id: typeof id === 'string' && id ? id.slice(0, 24) : `l${leads.length}`, name: clean })
    }
    const dropped = (Array.isArray(r.dropped) ? r.dropped : [])
        .filter((n): n is string => typeof n === 'string' && n.length > 0)
        .map((n) => n.trim().toLowerCase().slice(0, 80))
        .slice(0, 20)
    return { leads, dropped, pursuedAt: ts(r.pursuedAt), clueAt: ts(r.clueAt), inspectedAt: ts(r.inspectedAt) }
}

export const isInvestigatorEmpty = (s: InvestigatorStored): boolean =>
    s.leads.length === 0 && s.dropped.length === 0 && s.pursuedAt == null && s.clueAt == null && s.inspectedAt == null

export const hasPursueALead = (b: BuildInfo) => hasSpecial(b, 'Pursue a Lead')
export const hasClueIn = (b: BuildInfo) => hasSpecial(b, 'Clue In')
export const hasExpeditiousInspection = (b: BuildInfo) => hasSpecial(b, 'Expeditious Inspection')
export const hasDetectivesReadiness = (b: BuildInfo) => hasFeat(b, "Detective's Readiness")
export const hasInvestigatorFeatures = (b: BuildInfo) => hasPursueALead(b) || hasClueIn(b) || hasExpeditiousInspection(b)

/** Quanto falta (ms) para os 10 minutos de um recurso, ou 0 se já passou ou nunca foi usado. */
export const cooldownLeft = (at: number | null, now: number): number =>
    at == null ? 0 : Math.max(0, at + COOLDOWN_MS - now)

/** "9:41" a partir de milissegundos. */
export function clock(ms: number): string {
    const s = Math.ceil(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Abre uma investigação; cheia (2), troca a escolhida, que fica fora até a próxima preparação. */
export function openLead(s: InvestigatorStored, name: string, replaceId: string | null, id: string): InvestigatorStored {
    const clean = name.trim().slice(0, 80)
    if (!clean) return s
    let leads = s.leads
    let dropped = s.dropped
    if (leads.length >= MAX_LEADS) {
        const out = leads.find((l) => l.id === replaceId)
        if (!out) return s
        leads = leads.filter((l) => l.id !== out.id)
        dropped = [...dropped, out.name.toLowerCase()]
    }
    return { ...s, leads: [...leads, { id, name: clean }], dropped }
}

/** O nome foi abandonado hoje: o Pursue a Lead não pode abri-lo de novo até a preparação. */
export const isDropped = (s: InvestigatorStored, name: string): boolean =>
    s.dropped.includes(name.trim().toLowerCase())

// ── Testes da investigação ──────────────────────────────────────────────────

/** Percepção e perícias de INT, SAB ou CAR (e Saberes, que são de INT) — o que "aproxima da resposta". */
export function investigationEligible(en: string, ability: string | null): boolean {
    if (en === 'Perception') return true
    if (/\bLore\b/i.test(en)) return true
    return ability === 'int' || ability === 'wis' || ability === 'cha'
}

/**
 * As parcelas da investigação num teste: o +1 de Pursue a Lead e, com o estratagema de perícia
 * (Devise a Stratagem, modo perícia), +1 — que, havendo o bônus da investigação, AUMENTA esse
 * bônus em vez de ser um segundo de circunstância. A soma é a mesma (+2); o rótulo diz de onde vem.
 */
export function investigationParts(investigating: boolean, skillStratagem: boolean): Array<{ label: string; value: number; kind: 'other' }> {
    const out: Array<{ label: string; value: number; kind: 'other' }> = []
    if (investigating) out.push({ label: 'Investigação ativa (circunstância)', value: INVESTIGATION_BONUS, kind: 'other' })
    if (skillStratagem) {
        out.push({
            label: investigating ? 'Estratagema de perícia (aumenta o bônus da investigação)' : 'Estratagema de perícia (circunstância)',
            value: 1,
            kind: 'other',
        })
    }
    return out
}

/** Detective's Readiness: o bônus da investigação vale nas salvaguardas contra a criatura ou o efeito dela. */
export const readinessApplies = (build: BuildInfo, isSave: boolean): boolean => isSave && hasDetectivesReadiness(build)

// ── Keen Recollection e Assurance ───────────────────────────────────────────

/** Recall Knowledge em perícia destreinada soma o nível no lugar de +0. */
export const keenRecollectionBonus = (build: BuildInfo, rank: number): number =>
    hasSpecial(build, 'Keen Recollection') && rank === 0 ? Math.max(0, build.level ?? 0) : 0

/** As perícias em que há Assurance: o talento guarda a escolha na segunda posição ("Medicine"). */
export function assuranceSkills(build: BuildInfo): string[] {
    const out: string[] = []
    for (const f of build.feats ?? []) {
        if (!Array.isArray(f) || norm(String(f[0] ?? '')) !== 'assurance') continue
        const choice = norm(String(f[1] ?? ''))
        if (choice) out.push(choice)
    }
    return out
}

/**
 * Assurance: abrir mão de rolar e ficar com 10 + proficiência (nível + rank), sem nenhum outro
 * bônus ou penalidade. Só em perícia treinada ou melhor. `null` = não há Assurance neste teste.
 */
export function assuranceResult(build: BuildInfo, en: string, rank: number): { proficiency: number; total: number } | null {
    if (rank < 2 || !assuranceSkills(build).includes(norm(en))) return null
    const proficiency = (build.level ?? 0) + rank
    return { proficiency, total: 10 + proficiency }
}
