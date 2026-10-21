import { useOutletContext } from 'react-router-dom'

/** O que o `MainLayout` entrega às páginas pelo `<Outlet context>`. */
export interface LayoutContext {
    /** Abre a gaveta de navegação (a barra fixa não existe em `/mapa`). */
    openMenu: () => void
}

/** `null` fora do `MainLayout` — a página decide se mostra o botão. */
export const useLayoutMenu = (): LayoutContext | null => useOutletContext<LayoutContext | null>() ?? null
