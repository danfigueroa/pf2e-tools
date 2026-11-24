import { setTimeout as wait } from 'node:timers/promises'
import { AON_SEARCH_URL } from './aon.js'

const PAGE_SIZE = 100
const PAGE_INTERVAL_MS = 400
const REQUEST_TIMEOUT_MS = 12_000

let previousRequest = Promise.resolve()
let nextRequestAt = 0

// Importação é paginada e não compartilha o cache das consultas interativas.
// Uma falha precisa chegar ao job para preservar o último cursor confirmado.
function searchPage(body) {
    const pending = previousRequest.then(async () => {
        const delay = nextRequestAt - Date.now()
        if (delay > 0) await wait(delay)

        try {
            const response = await fetch(AON_SEARCH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'PF2e rules catalog' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            })
            if (!response.ok) throw new Error(`AON: falha na consulta (${response.status})`)
            return await response.json()
        } finally {
            nextRequestAt = Date.now() + PAGE_INTERVAL_MS
        }
    })
    previousRequest = pending.catch(() => {})
    return pending
}

async function readPage(filters, after) {
    const result = await searchPage({
        query: { bool: { filter: filters } },
        size: PAGE_SIZE,
        sort: [{ 'id.keyword': 'asc' }],
        track_total_hits: true,
        ...(after === null ? {} : { search_after: [after] }),
    })

    const hits = result?.hits?.hits
    const total = result?.hits?.total
    if (result?.timed_out || result?._shards?.failed || !Array.isArray(hits)
        || total?.relation !== 'eq' || !Number.isSafeInteger(total.value)) {
        throw new Error('AON: resposta incompleta na importação')
    }

    let lastId = after
    const entries = hits.map((hit) => {
        const id = hit?.sort?.[0]
        if (typeof id !== 'string' || !id || hit._source?.id !== id || (lastId !== null && id <= lastId)) {
            throw new Error('AON: ordenação inválida na importação')
        }
        lastId = id
        return hit._source
    })
    return { entries, total: total.value, nextCursor: hits.length === PAGE_SIZE ? lastId : null }
}

/** Passe nextCursor à chamada seguinte após concluir o processamento da página. */
export function readRuleSourcesPage(after = null) {
    return readPage([{ term: { category: 'source' } }], after)
}

/** O livro é o primary_source canônico da entrada, para importar cada ID uma vez. */
export function readRuleEntriesPage(source, category, after = null) {
    return readPage([
        { term: { category } },
        { term: { 'primary_source.keyword': source } },
    ], after)
}
