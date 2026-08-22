import { createTheme } from '@mui/material/styles'
import { green, parchment, gold, ink, rule, status } from './palette'

export * from './palette'

/** Serifada versalete dos títulos oficiais (capas e cabeçalhos da Paizo). */
export const displayFont = '"Cinzel", "Spectral", Georgia, serif'
export const bodyFont = '"Source Sans 3", "Roboto", system-ui, sans-serif'

/** Espelha os breakpoints padrão do MUI — usado antes do tema existir. */
const UP_SM = '@media (min-width:600px)'
const UP_MD = '@media (min-width:900px)'

/**
 * Título que encolhe no celular. Cinzel é largo e versalete: no tamanho de
 * desktop um `h1` estoura a linha numa tela de 360px. A escala cresce por
 * breakpoint em vez de usar `clamp()` porque o `html2canvas` da exportação
 * não entende funções de tamanho modernas.
 */
const fluidTitle = (mobile: string, tablet: string, desktop: string) => ({
    fontSize: mobile,
    [UP_SM]: { fontSize: tablet },
    [UP_MD]: { fontSize: desktop },
})

/**
 * Tema PF2e Remaster: moldura verde escura com conteúdo em pergaminho.
 * Cores vêm todas de `./palette` — nada de hex literal aqui.
 */
export const pathfinderTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: green.main,
            light: green.light,
            dark: green.deepest,
            contrastText: parchment.paper,
        },
        secondary: {
            main: gold.main,
            light: gold.bright,
            dark: gold.deep,
            contrastText: '#1E1809',
        },
        background: {
            default: parchment.page,
            paper: parchment.paper,
        },
        surface: {
            main: parchment.sunken,
        },
        text: {
            primary: ink.primary,
            secondary: ink.secondary,
            disabled: ink.disabled,
        },
        error: { main: status.error },
        warning: { main: status.warning },
        success: { main: status.success },
        info: { main: status.info },
        divider: rule,
    },
    typography: {
        fontFamily: bodyFont,
        h1: {
            fontFamily: displayFont,
            ...fluidTitle('1.85rem', '2.15rem', '2.5rem'),
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '0.02em',
        },
        h2: {
            fontFamily: displayFont,
            ...fluidTitle('1.45rem', '1.65rem', '1.875rem'),
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: '0.02em',
        },
        h3: {
            fontFamily: displayFont,
            ...fluidTitle('1.2rem', '1.3rem', '1.4rem'),
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: '0.015em',
        },
        h4: {
            ...fluidTitle('1.05rem', '1.125rem', '1.125rem'),
            fontWeight: 600,
            lineHeight: 1.4,
        },
        h5: {
            fontWeight: 600,
        },
        h6: {
            fontWeight: 600,
        },
        body1: {
            fontSize: '1rem',
            lineHeight: 1.6,
        },
        body2: {
            fontSize: '0.875rem',
            lineHeight: 1.5,
        },
        button: {
            fontWeight: 600,
            letterSpacing: '0.02em',
        },
        overline: {
            fontFamily: displayFont,
            fontWeight: 700,
            letterSpacing: '0.12em',
        },
    },
    shape: {
        borderRadius: 6,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    scrollbarColor: `${rule} ${parchment.sunken}`,
                    '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                        backgroundColor: parchment.sunken,
                        width: '10px',
                    },
                    '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                        borderRadius: 6,
                        backgroundColor: rule,
                        minHeight: 24,
                    },
                    '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
                        backgroundColor: ink.disabled,
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: parchment.paper,
                    border: `1px solid ${rule}`,
                    boxShadow: '0 1px 2px rgba(35, 32, 26, 0.06), 0 2px 10px rgba(35, 32, 26, 0.05)',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                        borderColor: gold.main,
                        boxShadow: '0 2px 4px rgba(35, 32, 26, 0.08), 0 6px 18px rgba(27, 59, 42, 0.10)',
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 6,
                    // Dedo não acerta botão de 31px: em telas de toque todo
                    // botão (inclusive os `size="small"`) vira alvo de 40px.
                    '@media (pointer: coarse)': {
                        minHeight: 40,
                    },
                },
                contained: {
                    boxShadow: '0 1px 3px rgba(20, 40, 29, 0.28)',
                    '&:hover': {
                        boxShadow: '0 3px 10px rgba(20, 40, 29, 0.32)',
                    },
                },
                outlined: {
                    borderColor: rule,
                    '&:hover': {
                        borderColor: green.main,
                        backgroundColor: 'rgba(27, 59, 42, 0.06)',
                    },
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: green.deepest,
                    color: parchment.paper,
                    borderBottom: `2px solid ${gold.bright}`,
                    boxShadow: 'none',
                },
            },
        },
        // Sem override global de MuiDrawer: o drawer de navegação (moldura
        // verde) é pintado no MainLayout, e o DescriptionDrawer é conteúdo e
        // fica no pergaminho padrão.
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 600,
                },
                outlined: {
                    borderColor: rule,
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(27, 59, 42, 0.10)',
                        '&:hover': {
                            backgroundColor: 'rgba(27, 59, 42, 0.16)',
                        },
                    },
                    '&:hover': {
                        backgroundColor: 'rgba(35, 32, 26, 0.05)',
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    backgroundColor: gold.bright,
                    height: 3,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    fontFamily: displayFont,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'none',
                    // Cabem mais abas na faixa rolável do tablet.
                    fontSize: '0.82rem',
                    minWidth: 0,
                    paddingLeft: 12,
                    paddingRight: 12,
                    [UP_MD]: {
                        fontSize: '0.875rem',
                        paddingLeft: 16,
                        paddingRight: 16,
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                // A margem padrão (32px de cada lado) come metade de um celular.
                // O `:not` preserva o `fullScreen`, que precisa de margem zero.
                paper: {
                    '&:not(.MuiDialog-paperFullScreen)': {
                        margin: 16,
                        width: 'calc(100% - 32px)',
                        maxHeight: 'calc(100% - 32px)',
                        [UP_SM]: {
                            margin: 32,
                            width: 'calc(100% - 64px)',
                            maxHeight: 'calc(100% - 64px)',
                        },
                    },
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: {
                    borderColor: rule,
                },
            },
        },
    },
})

// Extend the theme interface to include custom colors
declare module '@mui/material/styles' {
    interface Palette {
        surface: Palette['primary']
    }

    interface PaletteOptions {
        surface?: PaletteOptions['primary']
    }
}
