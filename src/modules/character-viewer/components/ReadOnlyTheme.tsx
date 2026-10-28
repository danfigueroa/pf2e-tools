import type { ReactNode } from 'react'
import { ThemeProvider, type Theme } from '@mui/material'

// O tema da ficha de outra pessoa: todo controle que gasta ou marca perde o clique, menos os
// de VER (`data-view`, ver `VIEW_OK` em sheetAccess.ts). Por ser tema, vale também nos
// diálogos e na gaveta, que são portais.

const LOCKED = { '&:not([data-view])': { pointerEvents: 'none', opacity: 0.45 } }

// Os controles que gastam ou marcam alguma coisa. Tabs, acordeões, linhas da lista (que
// abrem a descrição) e o `ButtonBase` do guia não estão aqui: são de ver.
const LOCKED_COMPONENTS = [
    'MuiButton',
    'MuiIconButton',
    'MuiSwitch',
    'MuiCheckbox',
    'MuiRadio',
    'MuiToggleButton',
    'MuiFab',
    'MuiSlider',
    'MuiFormControlLabel',
] as const

type Overrides = { styleOverrides?: { root?: unknown } } & Record<string, unknown>

/** O tema de fora com a trava somada ao `root` de cada controle (sem perder o que o tema já define). */
function lockedTheme(outer: Theme): Theme {
    const components = { ...(outer.components ?? {}) } as Record<string, Overrides | undefined>
    for (const name of LOCKED_COMPONENTS) {
        const prev = components[name]
        const prevRoot = prev?.styleOverrides?.root
        components[name] = {
            ...prev,
            styleOverrides: {
                ...prev?.styleOverrides,
                root: (props: unknown) => ({
                    ...(typeof prevRoot === 'function' ? prevRoot(props) : (prevRoot as object | undefined)),
                    ...LOCKED,
                }),
            },
        }
    }
    return { ...outer, components } as Theme
}

export const ReadOnlyTheme = ({ on, children }: { on: boolean; children: ReactNode }) =>
    on ? <ThemeProvider theme={lockedTheme}>{children}</ThemeProvider> : <>{children}</>
