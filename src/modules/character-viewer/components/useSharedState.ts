import { useCallback, useEffect, useRef, useState } from 'react'
import {
    loadCharacter,
    readLocal,
    saveField,
    splitSyncKey,
    subscribeField,
    subscribeSnapshot,
} from '../../../services/tableState'
import { currentMesa } from '../../../services/mesa'
import { useSheetReadOnly } from '../sheetAccess'

export interface SharedStateOptions<T> {
    /** Valor quando ninguém na mesa mexeu nesta fatia ainda. */
    empty: () => T
    /** Valida/normaliza o que veio do servidor ou do cache — o mesmo saneamento
     *  que cada hook já fazia ao ler do localStorage. */
    sanitize: (raw: unknown) => T
    /** Valor gravado pela versão local-only, para subir na primeira sincronização. */
    legacy?: () => T | null
    /** Fatia sem nada que valha a pena compartilhar (não migra nem grava à toa). */
    isEmpty?: (value: T) => boolean
}

const DEFAULT_IS_EMPTY = (value: unknown) => value == null

/**
 * Uma fatia do estado compartilhado da mesa, endereçada por `"<slug>/<campo>"`.
 *
 * Ordem de pintura: cache local (instantâneo) → o que o servidor devolver. Cada
 * alteração atualiza a tela na hora e sobe com debounce, então a ficha nunca
 * fica esperando rede e continua utilizável offline.
 */
export function useSharedState<T>(
    syncKey: string,
    options: SharedStateOptions<T>,
): [T, (updater: (prev: T) => T) => void] {
    const { slug, field } = splitSyncKey(syncKey)
    // Ficha de outra pessoa (ver sheetAccess.tsx): lê e acompanha a mesa, mas não escreve
    // nada — nem a edição na tela, nem a subida do cache antigo, que o servidor recusaria.
    const readOnly = useSheetReadOnly()
    const readOnlyRef = useRef(readOnly)
    readOnlyRef.current = readOnly

    // As opções vêm inline do componente e mudam de identidade a cada render;
    // guardá-las num ref mantém os efeitos presos só a `slug`/`field`.
    const optionsRef = useRef(options)
    optionsRef.current = options

    const [state, setState] = useState<T>(() => fromCache(slug, field, options))

    const stateRef = useRef(state)
    stateRef.current = state

    // A chave que o `useState` acima já leu do cache: na montagem, reler daria
    // o mesmo valor num objeto novo e um render a mais de quem usa o hook — na
    // página da ficha, a árvore inteira.
    const readKey = useRef<string | null>(`${slug}/${field}`)

    // Troca de personagem (ou de fatia): recomeça do cache e puxa do servidor.
    useEffect(() => {
        const opts = optionsRef.current
        if (readKey.current === `${slug}/${field}`) readKey.current = null
        else setState(fromCache(slug, field, opts))

        // Sem ficha aberta (`noCharKey`): só o cache local, nada de rede.
        if (!slug) return

        let cancelled = false
        void loadCharacter(slug).then((snapshot) => {
            if (cancelled) return

            if (snapshot[field] !== undefined) {
                setState(opts.sanitize(snapshot[field]))
                return
            }

            // O servidor ainda não conhece esta fatia. Se este aparelho tem
            // estado (inclusive o da versão que só gravava local), ele sobe em
            // vez de ser descartado — ninguém perde o dano já marcado.
            const local = fromCacheOrLegacy(slug, field, opts)
            const isEmpty = opts.isEmpty ?? DEFAULT_IS_EMPTY
            if (local !== null && !isEmpty(local) && !readOnlyRef.current) {
                setState(local)
                saveField(slug, field, local)
            }
        })

        return () => { cancelled = true }
    }, [slug, field])

    // Botão "Atualizar" (ou qualquer releitura) traz estado novo para a tela.
    useEffect(() => subscribeSnapshot(slug, (snapshot) => {
        if (snapshot[field] === undefined) return
        setState(optionsRef.current.sanitize(snapshot[field]))
    }), [slug, field])

    // Edição feita por OUTRA instância desta fatia neste aparelho. A própria
    // instância recebe o mesmo valor que acabou de gravar e o ignora.
    useEffect(() => subscribeField(slug, field, (data) => {
        if (Object.is(data, stateRef.current)) return
        const next = optionsRef.current.sanitize(data)
        stateRef.current = next
        setState(next)
    }), [slug, field])

    const update = useCallback((updater: (prev: T) => T) => {
        if (readOnlyRef.current) return
        const next = updater(stateRef.current)
        if (Object.is(next, stateRef.current)) return
        stateRef.current = next
        setState(next)
        if (slug) saveField(slug, field, next)
    }, [slug, field])

    return [state, update]
}

function fromCache<T>(slug: string, field: string, options: SharedStateOptions<T>): T {
    const raw = readLocal(slug, field)
    return raw === null ? options.empty() : options.sanitize(raw)
}

function fromCacheOrLegacy<T>(slug: string, field: string, options: SharedStateOptions<T>): T | null {
    const raw = readLocal(slug, field)
    if (raw !== null) return options.sanitize(raw)
    // O que a versão local-only gravou é da mesa de antes das mesas: migrar numa
    // outra levaria o PV de lá para um personagem de mesmo nome aqui.
    return currentMesa.legacy ? options.legacy?.() ?? null : null
}
