// Mesas: cada grupo de jogo enxerga só o que é dele — fichas publicadas,
// presets, estado dos personagens, mapas, encontro da Iniciativa, rolagens.
//
// A mesa é escolhida por aparelho (seletor da sidebar) ou pelo link
// `?mesa=<id>`, e vale para a página inteira: trocar RECARREGA, então ela é
// uma constante lida uma vez no boot e nenhum cache em memória dos serviços
// precisa saber dela.
//
// A separação é um namespace de chave, a mesma regra de `api/_lib/mesas.js`: a
// mesa legada (a que existia antes das mesas) fica sem prefixo, e as outras
// ganham `pf2e:m:<mesa>:`. A lista existe duas vezes — mudou aqui, muda lá.

export interface Mesa {
    id: string
    nome: string
    /** A mesa de antes das mesas: chaves sem prefixo, pedidos sem `?mesa=`. */
    legacy?: boolean
}

export const MESAS: Mesa[] = [
    { id: 'principal', nome: 'Mesa principal', legacy: true },
    { id: 'mesa-2', nome: 'Mesa 2' },
]

const LEGACY = MESAS.find((m) => m.legacy)!
const STORAGE_KEY = 'pf2e:mesa'

const byId = (id: string | null | undefined) => MESAS.find((m) => m.id === id) ?? null

function readStored(): string | null {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

function store(id: string) {
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* sem storage: vale só nesta carga */ }
}

/**
 * O `?mesa=` do link vira a escolha deste aparelho e sai da URL — o link
 * compartilhado no grupo não fica grudado em cada página que a pessoa abrir.
 * Id desconhecido é ignorado (cai na escolha guardada, senão na legada).
 */
function resolve(): Mesa {
    if (typeof window === 'undefined') return LEGACY
    const url = new URL(window.location.href)
    const fromLink = url.searchParams.get('mesa')
    if (fromLink !== null) {
        url.searchParams.delete('mesa')
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
        const mesa = byId(fromLink)
        if (mesa) {
            store(mesa.id)
            return mesa
        }
    }
    return byId(readStored()) ?? LEGACY
}

export const currentMesa: Mesa = resolve()

/** Troca a mesa deste aparelho e recarrega a página inteira nela. */
export function switchMesa(id: string) {
    if (!byId(id) || id === currentMesa.id) return
    store(id)
    window.location.reload()
}

/** O link que entra direto na mesa, para mandar no grupo. */
export const mesaLink = (mesa: Mesa = currentMesa) =>
    `${window.location.origin}/?mesa=${encodeURIComponent(mesa.id)}`

/**
 * A URL de `/api/state` com a mesa. `query` vem com o `?` (ou vazia). Na mesa
 * legada não acrescenta nada: o pedido fica idêntico ao de antes das mesas.
 */
export function stateApi(query = ''): string {
    if (currentMesa.legacy) return `/api/state${query}`
    return `/api/state${query ? `${query}&` : '?'}mesa=${encodeURIComponent(currentMesa.id)}`
}

/** A chave de `localStorage` na mesa: a mesma na legada, `pf2e:m:<mesa>:…` nas outras. */
export function mesaKey(key: string): string {
    if (currentMesa.legacy) return key
    return key.replace(/^pf2e:/, `pf2e:m:${currentMesa.id}:`)
}
