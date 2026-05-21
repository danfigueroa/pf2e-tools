// Parser que toma uma descrição "crua" do AON (já passou por backend cleanup,
// mas frequentemente ainda contém: nome duplicado no começo, "Fonte: <livro>
// p. NN" repetida em PT/EN, separadores "---" / "—", e cabeçalhos inline tipo
// "Sucesso Crítico:") e devolve uma estrutura visual estruturada.

export type DescriptionPart =
    | { kind: 'paragraph'; text: string }
    | { kind: 'labeled'; label: string; text: string }

export interface HeightenedEntry {
    level: string  // "+1", "3rd", "3º", "Nível 2", etc.
    text: string
}

export interface ParsedDescription {
    source?: string
    parts: DescriptionPart[]
    heightened: HeightenedEntry[]
}

// Cabeçalhos canônicos PF2e (PT-BR + EN) que aparecem inline e merecem destaque.
// Ordem importa: maiores antes (para "Sucesso Crítico" casar antes de "Sucesso").
const SECTION_LABELS = [
    'Sucesso Crítico', 'Falha Crítica', 'Acerto Crítico',
    'Critical Success', 'Critical Failure',
    'Conjurada em Nível Mais Alto', 'Conjurada com nível mais alto',
    'Sucesso', 'Acerto', 'Falha',
    'Success', 'Failure',
    'Elevado', 'Elevada', 'Aumentado', 'Aumentada', 'Heightened',
    'Nível Aumentado',
    'Frequência', 'Frequency',
    'Gatilho', 'Trigger',
    'Requisitos', 'Requirements',
    'Ativação', 'Activate',
    'Efeito', 'Effect',
    'Especial', 'Special',
    'Custo', 'Cost',
]

// Família de labels que deveriam virar "heightened entries" (não parágrafos normais).
const HEIGHTENED_LABELS = new Set([
    'Elevado', 'Elevada', 'Aumentado', 'Aumentada', 'Heightened',
    'Nível Aumentado',
    'Conjurada em Nível Mais Alto', 'Conjurada com nível mais alto',
])

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Captura: label + parens opcional (qualquer conteúdo) + ":?" + espaço.
// Group 1 = label. Group 2 = conteúdo dos parens (sem os parens).
const LABEL_RE = new RegExp(
    `\\b(${SECTION_LABELS.map(escapeRegExp).join('|')})\\b(?:\\s*\\(([^)]*)\\))?\\s*:?\\s+`,
    'g',
)

// Padrão A: "Fonte/Source <livro> p./pg. NN" — referência completa, alta confiança.
const SOURCE_WITH_PAGE_RE = /\b(?:Fonte|Source)s?:?\s+([^.—–\n]+?)\s+p(?:g)?\.\s*(\d+)/gi
// Padrão B: "Fonte/Source <livro>" terminado por separador "---" / em-dash.
const SOURCE_WITH_DASH_RE = /\b(?:Fonte|Source)s?:?\s+([^.—–\n]+?)(?=\s*(?:---+|[—–]+))/gi
// Padrão C: "Fonte/Source <livro>" sem ref de página nem separador (último recurso),
// limitado a algumas palavras Maiúsculas seguidas para evitar comer prosa.
const SOURCE_BARE_RE = /\b(?:Fonte|Source)s?:?\s+((?:[A-ZÁÉÍÓÚ][\w']*\s+){0,4}[A-ZÁÉÍÓÚ][\w']*)\b/g

export function parseDescription(raw: string | undefined, itemName: string): ParsedDescription {
    if (!raw) return { parts: [], heightened: [] }
    let text = raw.trim()

    // 0. Normalizar separadores ASCII "---" para em-dash, simplifica os regex abaixo.
    text = text.replace(/\s*-{2,}\s*/g, ' — ')

    // 1. Strip duplicação do nome no começo (até 3 vezes para casos extremos).
    const namePattern = new RegExp(`^${escapeRegExp(itemName)}(?:\\s+|\\s*[-—–]+\\s*)`, 'i')
    for (let i = 0; i < 3 && namePattern.test(text); i++) {
        text = text.replace(namePattern, '').trim()
    }

    // 2. Extrair TODAS as ocorrências de "Fonte/Source ..." em 3 passes
    //    (do mais específico ao mais genérico), removendo do corpo.
    let source: string | undefined
    const captureSource = (book: string, page?: string) => {
        const cleanedBook = book.trim().replace(/\s+/g, ' ')
        const candidate = page ? `${cleanedBook}, p. ${page}` : cleanedBook
        if (!source || candidate.length > source.length) source = candidate
    }

    text = text.replace(SOURCE_WITH_PAGE_RE, (_m, book: string, page: string) => {
        captureSource(book, page)
        return ' '
    })
    text = text.replace(SOURCE_WITH_DASH_RE, (_m, book: string) => {
        captureSource(book)
        return ' '
    })
    text = text.replace(SOURCE_BARE_RE, (_m, book: string) => {
        captureSource(book)
        return ' '
    })

    // Strip "nome do feat" leftover quando AON retornou outro feat (mismatch),
    // detectado por aparecer 2x seguidas (ex: "Gnome Poliglota Gnome Poliglota Suas..."
    // ou "Explorador de Ordem Explorador de Ordem Você..."). Aceita conectores lowercase
    // (de, da, do, of) no meio do nome.
    text = text.replace(
        /\b([A-ZÁÉÍÓÚ][\wáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ']*(?:\s+[\wáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ']+){1,5})\s+\1\b/g,
        '$1',
    )

    // 3. Remover separadores leftover.
    text = text.replace(/\s*(?:---+|[—–]+)\s*/g, ' ')

    // 4. Strip nome duplicado de novo (caso tenha vindo dentro do source removido).
    for (let i = 0; i < 3 && namePattern.test(text); i++) {
        text = text.replace(namePattern, '').trim()
    }

    // 5. Limpeza final.
    text = text
        .replace(/\bp(?:g)?\.\s*\d+\b/gi, '')
        .replace(/\.{2,}/g, '.')
        .replace(/\s+/g, ' ')
        .trim()

    // 5.5. Strip prefixo de metadata (nome traduzido, "Classe X", "Pré-requisitos [...]")
    //      até o primeiro marcador de prosa real (Você, Seus, Quando, etc.).
    //      Só atua quando o prefixo é curto (≤120 chars) — para não comer descrições
    //      legítimas que começam com prosa não-canônica.
    text = stripLeadingMetadata(text)

    // 6. Paragrafação: usa \n\n quando há, senão quebra antes de cada label
    //    conhecido (Sucesso Crítico:, etc.); senão, agrupa em chunks de ~3 frases.
    const paragraphs = paragraphify(text)

    // 7. Para cada parágrafo, separar partes labeled de partes prosa.
    const allParts: Array<DescriptionPart & { _level?: string }> = []
    for (const para of paragraphs) {
        allParts.push(...splitLabeledParts(para))
    }

    // 8. Extrair entries de heightened da cauda (última sequência contígua de
    //    parts labeled cujo label está em HEIGHTENED_LABELS).
    const heightened: HeightenedEntry[] = []
    while (allParts.length > 0) {
        const last = allParts[allParts.length - 1]
        if (last.kind !== 'labeled' || !HEIGHTENED_LABELS.has(last.label)) break
        const level = last._level || extractLevelFromText(last.text)
        const cleanedText = last._level
            ? last.text
            : last.text.replace(/^[\s,;.]*(?:Nível|Level)\s+\d+[º°]?\.?\s*/i, '').trim()
        heightened.unshift({
            level: level || last.label,
            text: cleanedText,
        })
        allParts.pop()
    }

    // Strip metadata (_level é interno) antes de devolver.
    const parts: DescriptionPart[] = allParts.map((p) =>
        p.kind === 'labeled'
            ? { kind: 'labeled', label: p.label, text: p.text }
            : { kind: 'paragraph', text: p.text },
    )

    return { source, parts, heightened }
}

// Marcadores típicos de início de prosa em descrições PF2e (PT-BR + EN).
// Sem \b final: caracteres acentuados (ê, ã, ç) não são \w em ASCII e
// quebrariam o match. Lookahead exige separador depois.
const PROSE_START_RE = /\b(?:Você|Vocês|Seu|Sua|Seus|Suas|Quando|Caso|Cada|Antes|Após|Enquanto|Para|Em|Se|Como|Pode|Deve|Faça|You|Your|When|If|While|Each|Before|After|Make|This|These|That|Those|There|Há)(?=\s|[.,;:!?])/

function stripLeadingMetadata(text: string): string {
    if (!text) return text
    const m = text.match(PROSE_START_RE)
    if (!m || m.index === undefined || m.index === 0) return text
    // Prefixo > 120 chars provavelmente é prosa real, não metadata.
    if (m.index > 400) return text
    return text.slice(m.index).trim()
}

// Tenta extrair o nível de heightened do texto residual, ex.: "Nível 2." → "2"
function extractLevelFromText(text: string): string | undefined {
    const m = text.match(/^(?:Nível|Level)\s+(\d+)/i)
    return m ? m[1] : undefined
}

function paragraphify(body: string): string[] {
    if (!body) return []
    if (body.includes('\n\n')) {
        return body.split(/\n\n+/).map(s => s.trim()).filter(Boolean)
    }

    // Insere \n\n antes de cada label (preserva estrutura de degraus de sucesso).
    const withBreaks = body.replace(LABEL_RE, '\n\n$&')
    if (withBreaks.includes('\n\n')) {
        return withBreaks.split(/\n\n+/).map(s => s.trim()).filter(Boolean)
    }

    if (body.length < 320) return [body]

    // Quebra a cada ~3 frases.
    const sentences = body.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ])/)
    const out: string[] = []
    for (let i = 0; i < sentences.length; i += 3) {
        out.push(sentences.slice(i, i + 3).join(' '))
    }
    return out
}

function splitLabeledParts(paragraph: string): Array<DescriptionPart & { _level?: string }> {
    const parts: Array<DescriptionPart & { _level?: string }> = []
    LABEL_RE.lastIndex = 0
    let cursor = 0
    let pendingLabel: string | null = null
    let pendingLevel: string | undefined
    let m: RegExpExecArray | null

    while ((m = LABEL_RE.exec(paragraph)) !== null) {
        const before = paragraph.slice(cursor, m.index).trim()
        if (before) {
            if (pendingLabel) {
                parts.push({ kind: 'labeled', label: pendingLabel, text: before, _level: pendingLevel })
            } else {
                parts.push({ kind: 'paragraph', text: before })
            }
        }
        pendingLabel = m[1]
        pendingLevel = m[2]?.trim() || undefined
        cursor = m.index + m[0].length
    }

    const tail = paragraph.slice(cursor).trim()
    if (tail) {
        if (pendingLabel) {
            parts.push({ kind: 'labeled', label: pendingLabel, text: tail, _level: pendingLevel })
        } else {
            parts.push({ kind: 'paragraph', text: tail })
        }
    } else if (pendingLabel) {
        parts.push({ kind: 'paragraph', text: pendingLabel })
    }

    return parts
}
