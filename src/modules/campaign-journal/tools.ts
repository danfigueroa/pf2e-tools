import { createContext, useContext } from 'react'

/**
 * O que todo editor do diário precisa da página: mostrar à mesa (com a prévia de
 * confirmação), abrir/criar a ficha de um `[[Nome]]` e saber que nomes existem.
 * Fornecido pela página por documento, que sabe de onde o trecho saiu.
 */
export interface JournalTools {
    shareBlock: (title: string, text: string) => void
    shareImage: (url: string, alt: string) => void
    openWiki: (name: string) => void
    /** Títulos do catálogo, em minúsculas. */
    knownNames: ReadonlySet<string>
}

const noop = () => {}

export const JournalToolsContext = createContext<JournalTools>({
    shareBlock: noop, shareImage: noop, openWiki: noop, knownNames: new Set(),
})

export const useJournalTools = () => useContext(JournalToolsContext)
