import { createContext, useContext } from 'react'

/**
 * Ficha de outra pessoa: dá para LER tudo (abas, descrições, guia), mas rolar, gastar e
 * marcar é só do dono e do GM. O servidor recusa de qualquer jeito (`api/_lib/access.js`);
 * isto é para a tela não oferecer o que não vai funcionar.
 *
 * Três camadas, de propósito:
 *  - `useSharedState` vira só leitura (o setter não faz nada e nada sobe) — PV, slots,
 *    consumíveis, ações, usos… todo gasto passa por ele;
 *  - `RollTrigger` e o diálogo de rolagem não abrem;
 *  - o tema de `components/ReadOnlyTheme.tsx` tira o clique de todo botão da ficha, INCLUSIVE nos diálogos e na gaveta
 *    (que são portais, fora da árvore do DOM mas dentro da do React). Botão novo nasce
 *    travado; só o que serve para VER leva `data-view` (`VIEW_OK`).
 */
const SheetReadOnlyContext = createContext(false)

export const SheetReadOnlyProvider = SheetReadOnlyContext.Provider

export const useSheetReadOnly = () => useContext(SheetReadOnlyContext)

/** Marca um botão de VER (fechar, trocar ficha, carregar descrições…), que segue clicável na ficha alheia. */
export const VIEW_OK = { 'data-view': '' } as const
