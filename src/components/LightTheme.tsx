// O tema CLARO de sempre, para o que fica claro nos dois temas: os stat blocks que o
// `html2canvas` exporta em PNG (Transformação, Escalar Monstro e a ficha do monstro no
// cartão da Iniciativa). Eles são uma folha de pergaminho com hex literal de propósito, e o
// PNG não pode mudar com o tema de quem exporta; sem isto, o que eles não pintam à mão
// (texto secundário, ícones, a caixinha de regra num portal) herdaria a tinta clara do
// tema escuro.

import { ThemeProvider } from '@mui/material'
import type { ReactNode } from 'react'
import { isDark, lightTheme } from '../theme'

export function LightTheme({ children }: { children: ReactNode }) {
    return isDark ? <ThemeProvider theme={lightTheme}>{children}</ThemeProvider> : <>{children}</>
}
