// O `jsonb` do Postgres não guarda a ordem das chaves de um objeto (ordena por
// tamanho e depois alfabeticamente): `{ "name": …, "kind": … }` volta como
// `{ "kind": …, "name": … }`. Comparar com `JSON.stringify` acusaria mudança onde
// não há — e o "nada mudou, não regrave" deixaria de funcionar.

const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]))
    }
    return value
}

/** Mesmo conteúdo JSON, qualquer que seja a ordem das chaves. */
export const sameJson = (a, b) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null))
