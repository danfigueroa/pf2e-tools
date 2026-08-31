// Dano persistente do personagem na Ficha Virtual — mesma fatia da mesa que o
// gerenciador de Iniciativa escreve (`<slug>/persistent`).
//
// A ficha é a ponta de LEITURA, como nas aflições: quem aplica dano persistente
// é o GM, no combate, e é lá que o dano cai ao final de cada turno. O que o
// jogador precisa daqui é ver o que está queimando/sangrando nele e poder tirar
// quando o grupo apagar o fogo — o RAW deixa qualquer um encerrar o efeito.

import { useCallback } from 'react'
import { useSharedState } from './useSharedState'
import {
    sanitizePersistent,
    type PersistentDamage,
} from '../../initiative-tracker/persistentDamage'

export function usePersistentDamage(syncKey: string) {
    const [persistent, setPersistent] = useSharedState<PersistentDamage[]>(syncKey, {
        empty: () => [],
        sanitize: sanitizePersistent,
        isEmpty: (list) => list.length === 0,
    })

    const remove = useCallback((id: string) => {
        setPersistent((list) => list.filter((p) => p.id !== id))
    }, [setPersistent])

    const clear = useCallback(() => setPersistent(() => []), [setPersistent])

    return { persistent, remove, clear }
}
