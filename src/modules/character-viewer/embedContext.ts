import { createContext, useContext } from 'react'
import type { DialogProps, DrawerProps } from '@mui/material'

/**
 * Ficha embutida num painel (mapa de combate). Diálogos e gavetas do MUI vão
 * por padrão para o `body` e cobrem a janela inteira — inclusive o mapa ao lado.
 * Com um `container`, eles se prendem ao painel e o mapa segue usável.
 */
export const EmbedContext = createContext<HTMLElement | null>(null)

/** Elemento do painel que hospeda os overlays, ou `null` na página normal. */
export const useEmbedContainer = () => useContext(EmbedContext)

/** O `Modal` do MUI é `position: fixed` (e o fundo também): dentro do painel, absolute. */
const CONTAINED_SX = {
    position: 'absolute',
    '& .MuiBackdrop-root': { position: 'absolute' },
} as const

export const dialogEmbedProps = (container: HTMLElement | null): Partial<DialogProps> =>
    container
        ? {
            container,
            disableScrollLock: true,
            disableEnforceFocus: true,
            sx: CONTAINED_SX,
        }
        : {}

export const drawerEmbedProps = (container: HTMLElement | null): Partial<DrawerProps> =>
    container
        ? {
            ModalProps: {
                container,
                disableScrollLock: true,
                disableEnforceFocus: true,
            },
            sx: { ...CONTAINED_SX, '& .MuiDrawer-paper': { position: 'absolute' } },
        }
        : {}
