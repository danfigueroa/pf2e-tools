// O catálogo dos Troféus do Covil e as regras puras (sem banco): o que cada troféu mede, a
// partir dos fatos de uma conta (`trophy_facts`, migration `trofeus`). Uma fonte só — o GET
// devolve o catálogo junto, e o cliente não repete a lista.
//
// Pontos como na PSN: bronze 15, prata 30, ouro 90, platina 300. A platina de cada papel
// é "todos os outros daquele papel". `scripts/check-trophies.mjs` confere as regras.

export const TIER_POINTS = { bronze: 15, prata: 30, ouro: 90, platina: 300 }
export const TIERS = Object.keys(TIER_POINTS)

/** Média do d20 só vale com este mínimo de testes na sessão — o mesmo `MIN_CHECKS` do histórico. */
export const MIN_AVG_CHECKS = 8
/** Background que conta como "escrito" (e não um rascunho de uma linha). */
export const BACKGROUND_MIN = 300
export const BACKGROUND_LONG = 3000
export const NOTE_TAGS_NEEDED = ['npc', 'item', 'local', 'evento']

const t = (id, role, category, tier, title, description, goal, measure, extra = {}) =>
    ({ id, role, category, tier, title, description, goal, measure, ...extra })

/** `measure(f)` → o número que anda até o `goal` (f = `deriveFacts`). */
export const TROPHIES = [
    // --- Jogador: ficha
    t('primeira-ficha', 'player', 'ficha', 'bronze', 'Nasce um herói', 'Publique a sua primeira ficha para a mesa.', 1, (f) => f.sheets),
    t('subiu-nivel', 'player', 'ficha', 'bronze', 'Mais forte que ontem', 'Publique a ficha num nível acima do anterior.', 1, (f) => f.levels),
    t('tres-niveis', 'player', 'ficha', 'prata', 'Veterano', 'Suba três níveis.', 3, (f) => f.levels),
    // --- Jogador: background
    t('background', 'player', 'historia', 'bronze', 'Uma vida antes da aventura', `Escreva o background do personagem (${BACKGROUND_MIN}+ caracteres).`, 1, (f) => (f.backgroundMax >= BACKGROUND_MIN ? 1 : 0)),
    t('background-longo', 'player', 'historia', 'prata', 'Biógrafo', `Tenha um background com ${BACKGROUND_LONG}+ caracteres.`, BACKGROUND_LONG, (f) => f.backgroundMax),
    t('background-atualizado', 'player', 'historia', 'prata', 'A história continua', 'Atualize o background depois de subir de nível.', 1, (f) => f.backgroundAfterLevelUp),
    // --- Jogador: notas
    t('primeira-nota', 'player', 'historia', 'bronze', 'Pena e tinta', 'Crie a sua primeira anotação.', 1, (f) => f.notes),
    t('dez-notas', 'player', 'historia', 'prata', 'Cronista', 'Crie 10 anotações.', 10, (f) => f.notes),
    t('cinquenta-notas', 'player', 'historia', 'ouro', 'Arquivista', 'Crie 50 anotações.', 50, (f) => f.notes),
    t('todas-etiquetas', 'player', 'historia', 'prata', 'Olho para detalhes', 'Anote ao menos um NPC, um item, um local e um evento.', NOTE_TAGS_NEEDED.length, (f) => f.noteTags),
    t('notas-3-seguidas', 'player', 'historia', 'prata', 'Escriba fiel', 'Faça anotações em 3 sessões seguidas.', 3, (f) => f.notedStreak),
    t('notas-5-seguidas', 'player', 'historia', 'ouro', 'Memória da mesa', 'Faça anotações em 5 sessões seguidas.', 5, (f) => f.notedStreak),
    // --- Jogador: presença
    t('primeira-sessao', 'player', 'presenca', 'bronze', 'Rolem iniciativa!', 'Role os dados numa sessão oficial.', 1, (f) => f.attended),
    t('cinco-sessoes', 'player', 'presenca', 'prata', 'Frequentador', 'Participe de 5 sessões.', 5, (f) => f.attended),
    t('quinze-sessoes', 'player', 'presenca', 'ouro', 'Pilar da mesa', 'Participe de 15 sessões.', 15, (f) => f.attended),
    t('quatro-seguidas', 'player', 'presenca', 'ouro', 'Nunca falta', 'Participe de 4 sessões seguidas.', 4, (f) => f.attendStreak),
    // --- Jogador: dados (só com a sessão aberta)
    t('primeiro-20', 'player', 'dados', 'bronze', 'Os deuses sorriem', 'Tire um 20 natural numa sessão.', 1, (f) => f.nat20),
    t('dez-20', 'player', 'dados', 'prata', 'Abençoado', 'Tire 10 vezes um 20 natural.', 10, (f) => f.nat20),
    t('primeiro-1', 'player', 'dados', 'bronze', 'Faz parte', 'Tire um 1 natural numa sessão.', 1, (f) => f.nat1, { hidden: true }),
    t('tres-20-sessao', 'player', 'dados', 'ouro', 'Noite iluminada', 'Tire três 20 naturais na mesma sessão.', 3, (f) => f.bestNat20Session, { hidden: true }),
    t('cem-testes', 'player', 'dados', 'prata', 'Mãos calejadas', 'Faça 100 testes de d20 em sessão.', 100, (f) => f.checks),
    t('dez-miticas', 'player', 'dados', 'prata', 'Toque do destino', 'Faça 10 rolagens míticas (✦).', 10, (f) => f.mythic),
    // --- Jogador: destaques da sessão (eleitos ao encerrar)
    t('maior-dano', 'player', 'destaques', 'prata', 'Máquina de dano', 'Cause o maior dano do grupo numa sessão.', 1, (f) => f.topDamage),
    t('maior-dano-3', 'player', 'destaques', 'ouro', 'Devastador', 'Cause o maior dano do grupo em 3 sessões.', 3, (f) => f.topDamage),
    t('maior-golpe', 'player', 'destaques', 'prata', 'Golpe lendário', 'Faça a maior rolagem de dano da sessão.', 1, (f) => f.topHit),
    t('dado-quente', 'player', 'destaques', 'prata', 'Dado quente', `Tenha a melhor média do d20 da sessão (mín. ${MIN_AVG_CHECKS} testes).`, 1, (f) => f.bestAvg),
    // --- Jogador: a mesa
    t('generoso', 'player', 'mesa', 'bronze', 'Generoso', 'Passe um item a um colega.', 1, (f) => f.gave),
    t('advogado', 'player', 'mesa', 'bronze', 'Advogado de regras', 'Compartilhe 5 regras com a mesa.', 5, (f) => f.rules),
    t('revisor', 'player', 'mesa', 'bronze', 'Revisor', 'Corrija uma tradução.', 1, (f) => f.fixes),
    t('platina-jogador', 'player', 'platina', 'platina', 'Lenda do Covil', 'Conquiste todos os outros troféus de jogador.', null, null),

    // --- GM
    t('gm-sessao', 'gm', 'mestre', 'bronze', 'Atrás do escudo', 'Conduza a sua primeira sessão.', 1, (f) => f.gmSessions),
    t('gm-5-sessoes', 'gm', 'mestre', 'prata', 'Contador de histórias', 'Conduza 5 sessões.', 5, (f) => f.gmSessions),
    t('gm-15-sessoes', 'gm', 'mestre', 'ouro', 'Mestre veterano', 'Conduza 15 sessões.', 15, (f) => f.gmSessions),
    t('gm-combate', 'gm', 'mestre', 'bronze', 'Que comece o combate', 'Comece o seu primeiro combate.', 1, (f) => f.gmCombats),
    t('gm-20-combates', 'gm', 'mestre', 'ouro', 'Senhor da guerra', 'Comece 20 combates.', 20, (f) => f.gmCombats),
    t('gm-mapas', 'gm', 'mestre', 'prata', 'Cartógrafo', 'Revele 5 mapas à mesa.', 5, (f) => f.gmMaps),
    t('gm-diario', 'gm', 'mestre', 'prata', 'Planejador', 'Crie 5 sessões no Diário de Campanha.', 5, (f) => f.gmJournal),
    t('gm-mostrar', 'gm', 'mestre', 'bronze', 'Olhem isso!', 'Mostre à mesa 5 trechos do Diário.', 5, (f) => f.gmHandouts),
    t('platina-gm', 'gm', 'platina', 'platina', 'Mestre dos Mestres', 'Conquiste todos os outros troféus de mestre.', null, null),
]

export const TROPHY_BY_ID = new Map(TROPHIES.map((x) => [x.id, x]))

/** O catálogo como vai para o cliente (sem as funções). */
export function catalogWire() {
    return TROPHIES.map(({ id, role, category, tier, title, description, hidden }) => ({
        id, role, category, tier, title, description, hidden: hidden === true,
        goal: goalOf(TROPHY_BY_ID.get(id)),
    }))
}

function goalOf(trophy) {
    if (trophy.goal !== null) return trophy.goal
    return TROPHIES.filter((x) => x.role === trophy.role && x.tier !== 'platina').length
}

/** A maior sequência de sessões seguidas (por mesa, em ordem) em que `pick(sessão)` vale. */
export function longestStreak(sessions, pick) {
    let best = 0
    const byMesa = new Map()
    for (const s of sessions) {
        if (!byMesa.has(s.mesa)) byMesa.set(s.mesa, [])
        byMesa.get(s.mesa).push(s)
    }
    for (const list of byMesa.values()) {
        list.sort((a, b) => a.startedAt - b.startedAt)
        let run = 0
        for (const s of list) {
            run = pick(s) ? run + 1 : 0
            best = Math.max(best, run)
        }
    }
    return best
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Os fatos crus do banco → os números que o catálogo lê. */
export function deriveFacts(raw = {}) {
    const feats = raw.feats ?? {}
    const feat = (k) => num(feats[k])
    const sessions = Array.isArray(raw.sessions) ? raw.sessions : []
    const tags = new Set(Array.isArray(raw.noteTags) ? raw.noteTags : [])
    return {
        sheets: feat('sheet-published'),
        levels: num(raw.levelsGained),
        backgroundMax: num(raw.backgroundMax),
        backgroundAfterLevelUp: num(raw.backgroundAfterLevelUp),
        notes: feat('note-created'),
        noteTags: NOTE_TAGS_NEEDED.filter((x) => tags.has(x)).length,
        notedStreak: longestStreak(sessions, (s) => s.noted),
        attended: sessions.filter((s) => s.attended).length,
        attendStreak: longestStreak(sessions, (s) => s.attended),
        nat20: num(raw.nat20),
        nat1: num(raw.nat1),
        bestNat20Session: num(raw.bestNat20Session),
        checks: num(raw.checks),
        mythic: num(raw.mythic),
        topDamage: feat('session-top-damage'),
        topHit: feat('session-top-hit'),
        bestAvg: feat('session-best-avg'),
        gave: feat('gave-item'),
        rules: feat('rule-shared'),
        fixes: feat('translation-fix'),
        gmSessions: feat('gm-session'),
        gmCombats: feat('gm-combat'),
        gmMaps: feat('gm-map-revealed'),
        gmJournal: feat('gm-journal'),
        gmHandouts: feat('gm-handout'),
    }
}

/**
 * O progresso de cada troféu (`{ id: n }`, limitado ao `goal`) e os que já valem. A platina
 * conta os já desbloqueados do papel, os de antes E os que valem agora.
 */
export function evaluateFacts(facts, alreadyUnlocked = new Set()) {
    const progress = {}
    const earned = new Set(alreadyUnlocked)
    for (const x of TROPHIES) {
        if (x.tier === 'platina') continue
        const n = Math.max(0, Math.min(x.goal, x.measure(facts)))
        progress[x.id] = n
        if (n >= x.goal) earned.add(x.id)
    }
    for (const x of TROPHIES) {
        if (x.tier !== 'platina') continue
        const goal = goalOf(x)
        const n = TROPHIES.filter((y) => y.role === x.role && y.tier !== 'platina' && earned.has(y.id)).length
        progress[x.id] = n
        if (n >= goal) earned.add(x.id)
    }
    return { progress, earned }
}

/** Pontos de uma lista de ids desbloqueados, separados por papel. */
export function pointsOf(ids) {
    const out = { player: 0, gm: 0 }
    for (const id of ids) {
        const x = TROPHY_BY_ID.get(id)
        if (x) out[x.role] += TIER_POINTS[x.tier]
    }
    return out
}

/**
 * Os destaques de uma sessão a partir do `session_rollup`: maior dano somado, maior dano
 * numa rolagem e melhor média do d20 (com o mínimo de testes). Empate não elege ninguém,
 * como os troféus do histórico. Só personagem com dono. → `{ kind: ownerId }`.
 */
export function sessionHighlights(rows) {
    const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r.owner)
    const winner = (value, eligible = () => true) => {
        const pool = list.filter(eligible).map((r) => ({ r, v: value(r) })).filter((x) => x.v > 0)
        if (pool.length === 0) return null
        const top = Math.max(...pool.map((x) => x.v))
        const at = pool.filter((x) => x.v === top)
        return at.length === 1 ? at[0].r.owner : null
    }
    return {
        'session-top-damage': winner((r) => num(r.damage)),
        'session-top-hit': winner((r) => num(r.topHit)),
        'session-best-avg': winner((r) => num(r.d20Sum) / Math.max(1, num(r.checks)), (r) => num(r.checks) >= MIN_AVG_CHECKS),
    }
}
