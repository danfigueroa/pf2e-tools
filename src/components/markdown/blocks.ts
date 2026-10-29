// O Markdown do Diário de Campanha tem duas marcas próprias, resolvidas ANTES de
// o texto ir ao `react-markdown`:
//
//   :::jogadores Título            um trecho para os jogadores (texto lido em voz
//   …                              alta, carta, descrição): na prévia ganha o botão
//   :::                            de compartilhar; o resto da página segue secreto
//
//   [[Nome]]                       link para a ficha do catálogo com esse nome
//
// Puro, sem React: o diário também o usa para achar os nomes citados.

export interface MdSegment {
    kind: 'text' | 'players'
    text: string
    /** Só `players`: o que vem depois de `:::jogadores` (pode ser vazio). */
    title?: string
}

const OPEN_RE = /^:::[ \t]*jogadores\b[ \t]*(.*)$/i
const CLOSE_RE = /^:::[ \t]*$/
const FENCE_RE = /^(```|~~~)/

/** Separa o texto nos trechos para os jogadores e no resto. Bloco sem `:::` de fechamento vai até o fim. */
export function splitSegments(source: string): MdSegment[] {
    const out: MdSegment[] = []
    let text: string[] = []
    let block: string[] | null = null
    let title = ''
    let fenced = false
    const flushText = () => {
        if (text.join('').trim()) out.push({ kind: 'text', text: text.join('\n') })
        text = []
    }
    for (const line of source.split('\n')) {
        // Dentro de um bloco de código, `:::` é só texto.
        if (FENCE_RE.test(line.trim())) fenced = !fenced
        if (block) {
            if (!fenced && CLOSE_RE.test(line.trim())) {
                out.push({ kind: 'players', title, text: block.join('\n') })
                block = null
            } else block.push(line)
            continue
        }
        const open = fenced ? null : line.trim().match(OPEN_RE)
        if (open) {
            flushText()
            block = []
            title = open[1].trim()
        } else text.push(line)
    }
    if (block) out.push({ kind: 'players', title, text: block.join('\n') })
    flushText()
    return out
}

export const WIKI_RE = /\[\[([^[\]\n]{1,120})\]\]/g
export const WIKI_HREF = '#journal:'

/** `[[Nome]]` → `[Nome](#journal:Nome)`, que o componente desenha como link do catálogo. */
export const withWikiLinks = (text: string) =>
    text.replace(WIKI_RE, (_, name: string) => `[${name.trim()}](${WIKI_HREF}${encodeURIComponent(name.trim())})`)

/** Os nomes citados com `[[…]]`, sem repetição. */
export function wikiNames(text: string): string[] {
    const names = new Set<string>()
    for (const m of text.matchAll(WIKI_RE)) names.add(m[1].trim())
    return [...names]
}

/** O texto do trecho para os jogadores sem as marcas do diário (`[[Nome]]` vira só o nome). */
export const forPlayers = (text: string) => text.replace(WIKI_RE, (_, name: string) => name.trim()).trim()
