// Wiki da Mesa: os segredos do GM dentro de uma página e os links `[[ ]]`. Puro, sem banco — o
// `check-rolls` confere.
//
//   :::mestre Título opcional      um trecho que só o GM vê. O SERVIDOR o tira antes de entregar a
//   …                              página a quem não é GM (`stripSecrets`): esconder só na tela
//   :::                            deixaria o segredo à mostra na aba Rede.
//
// `:::gm` é o mesmo bloco, para quem usa a plataforma em inglês. Dentro de bloco de código, `:::` é
// só texto (como o `:::jogadores` de `src/components/markdown/blocks.ts`).
//
// O jogador edita a página SEM ver os segredos. Ao salvar, `mergeSecrets` os põe de volta onde
// estavam: logo depois da última linha pública que vinha antes de cada um; se ela mudou, no fim da
// seção (o mesmo título); se o título também sumiu, no fim da página. Nenhum segredo se perde, e o
// jogador nem fica sabendo que eles existem. Um `:::mestre` escrito pelo jogador vira texto comum
// (`escapeSecrets`): senão ele esconderia texto do próprio GM.

const OPEN_RE = /^:::[ \t]*(?:mestre|gm)\b[ \t]*(.*)$/i
const CLOSE_RE = /^:::[ \t]*$/
const FENCE_RE = /^(```|~~~)/
const HEADING_RE = /^#{1,6}\s+\S/

export const WIKI_LINK_RE = /\[\[([^[\]\n]{1,120})\]\]/g

const FOLD_FROM = 'áàâãäåéèêëíìîïóòôõöúùûüçñý'
const FOLD_TO = 'aaaaaaeeeeiiiiooooouuuucny'
const FOLD_MAP = new Map([...FOLD_FROM].map((c, i) => [c, FOLD_TO[i]]))

/** Minúsculas, sem acento, espaços juntados: a mesma dobra do `wiki_fold` do banco (mais o trim). */
export function fold(text) {
    const lower = String(text ?? '').toLowerCase()
    let out = ''
    for (const c of lower) out += FOLD_MAP.get(c) ?? c
    return out.replace(/\s+/g, ' ').trim()
}

/**
 * As linhas da página separadas em públicas e blocos do GM. Cada bloco guarda as próprias linhas
 * (com a abertura e o fechamento), a última linha pública não vazia antes dele, o título de seção
 * em que estava e se tinha linha em branco antes e depois — um trecho escondido no meio de uma frase
 * fica colado nela, e as linhas em volta voltam a ser um parágrafo só para o jogador.
 */
function parse(md) {
    const lines = String(md ?? '').split('\n')
    const pub = []
    const blocks = []
    let block = null
    let fenced = false
    let prev = null
    let heading = null
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const t = line.trim()
        if (block) {
            block.lines.push(line)
            if (FENCE_RE.test(t)) fenced = !fenced
            else if (!fenced && CLOSE_RE.test(t)) {
                block.blankAfter = i + 1 >= lines.length || !lines[i + 1].trim()
                blocks.push(block)
                block = null
            }
            continue
        }
        if (FENCE_RE.test(t)) fenced = !fenced
        if (!fenced && OPEN_RE.test(t)) {
            block = { lines: [line], prev, heading, blankBefore: i === 0 || !lines[i - 1].trim(), blankAfter: true }
            continue
        }
        pub.push(line)
        if (t) prev = t
        if (!fenced && HEADING_RE.test(t)) heading = t
    }
    // Bloco sem fechamento vai até o fim (como no `splitSegments`); fecha para não engolir o que vier.
    if (block) { block.lines.push(':::'); blocks.push(block) }
    return { pub, blocks }
}

const tidy = (text) => text.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\s+$/, '')

/** A página sem os trechos do GM: o que o jogador lê, busca e vê nos backlinks. */
export const stripSecrets = (md) => tidy(parse(md).pub.join('\n'))

/** Há trecho do GM no texto? */
export const hasSecrets = (md) => parse(md).blocks.length > 0

/** Texto do jogador: um `:::mestre` dele vira texto comum (`\:::mestre`), fora de bloco de código. */
export function escapeSecrets(md) {
    let fenced = false
    return String(md ?? '').split('\n').map((line) => {
        const t = line.trim()
        if (FENCE_RE.test(t)) { fenced = !fenced; return line }
        return !fenced && OPEN_RE.test(t) ? line.replace(':::', '\\:::') : line
    }).join('\n')
}

/**
 * O texto que o jogador salvou (`incoming`, que nunca teve os segredos) com os segredos da versão
 * guardada (`stored`) de volta no lugar.
 */
export function mergeSecrets(stored, incoming) {
    const { blocks } = parse(stored)
    const safe = escapeSecrets(incoming)
    if (!blocks.length) return safe
    const out = safe.split('\n')
    let cursor = 0
    for (const b of blocks) {
        let at = -1
        if (b.prev !== null) {
            const i = out.findIndex((l, j) => j >= cursor && l.trim() === b.prev)
            if (i >= 0) at = i + 1
        } else at = cursor
        if (at < 0 && b.heading !== null) {
            const h = out.findIndex((l) => l.trim() === b.heading)
            if (h >= 0) {
                const next = out.findIndex((l, j) => j > h && HEADING_RE.test(l.trim()))
                at = next >= 0 ? next : out.length
                // No fim da seção, antes das linhas em branco que a separam da próxima.
                while (at > h + 1 && !out[at - 1].trim()) at--
            }
        }
        if (at < 0) at = out.length
        const chunk = [...(b.blankBefore ? [''] : []), ...b.lines, ...(b.blankAfter ? [''] : [])]
        out.splice(at, 0, ...chunk)
        cursor = at + chunk.length
    }
    return tidy(out.join('\n'))
}

/** O nome de um `[[…]]`: `[[Nome|rótulo]]` e `[[wiki:Nome]]` apontam para "Nome". */
export function linkTarget(inner) {
    let name = String(inner ?? '').split('|')[0].trim()
    if (/^wiki:/i.test(name)) name = name.slice(5).trim()
    return name
}

/** Os nomes citados em `[[ ]]`, dobrados e sem repetição. */
export function linkNames(...texts) {
    const names = new Set()
    for (const text of texts) {
        for (const m of String(text ?? '').matchAll(WIKI_LINK_RE)) {
            const n = fold(linkTarget(m[1]))
            if (n) names.add(n)
        }
    }
    return [...names].slice(0, 400)
}
