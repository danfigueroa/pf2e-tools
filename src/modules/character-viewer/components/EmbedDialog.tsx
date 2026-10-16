import { Dialog, type DialogProps } from '@mui/material'
import { dialogEmbedProps, useEmbedContainer } from '../embedContext'

/** `Dialog` que, dentro de um painel embutido (mapa), fica preso a ele em vez de cobrir a janela. */
export const EmbedDialog = (props: DialogProps) => (
    <Dialog {...dialogEmbedProps(useEmbedContainer())} {...props} />
)
