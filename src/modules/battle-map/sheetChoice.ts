import { mesaKey } from '../../services/mesa'

/**
 * Própria do mapa: a da Ficha Virtual (`pf2e:viewer:*`) guarda OUTRA escolha.
 * E da mesa: o personagem escolhido numa não existe na outra.
 */
const STORAGE_KEY = mesaKey('pf2e:map:sheet')
export const SHEET_OPEN_KEY = 'pf2e:map:sheet-open'

export const readSheetChoice = (): string | null => {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

export const writeSheetChoice = (slug: string | null) => {
    try {
        if (slug) localStorage.setItem(STORAGE_KEY, slug)
        else localStorage.removeItem(STORAGE_KEY)
    } catch { /* noop */ }
}
