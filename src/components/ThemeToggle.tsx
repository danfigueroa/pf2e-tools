// Seletor de tema: Claro | Escuro | Sistema. Trocar recarrega a página (o tema é constante
// por carga, ver `theme/mode`), e a escolha é do APARELHO, não da conta.
//
// Mesma forma do `LanguageToggle`, ao lado dele. Sem Tooltip do MUI (puxa o popper.js para o
// chunk principal): `title` nativo.

import { useState } from 'react'
import { Box, ButtonBase } from '@mui/material'
import LightIcon from '@mui/icons-material/LightModeOutlined'
import DarkIcon from '@mui/icons-material/DarkModeOutlined'
import SystemIcon from '@mui/icons-material/SettingsBrightnessOutlined'
import { tr } from '../i18n'
import { chrome, gold, green, greenInk, ink, onFrame, parchment, setThemePref, themePref, type ThemePref } from '../theme'

const OPTIONS: { id: ThemePref; label: string; Icon: typeof LightIcon }[] = [
    { id: 'light', label: tr('Tema claro', 'Light theme'), Icon: LightIcon },
    { id: 'dark', label: tr('Tema escuro', 'Dark theme'), Icon: DarkIcon },
    { id: 'system', label: tr('Tema do sistema', 'System theme'), Icon: SystemIcon },
]

/**
 * `compact`: um botão só, que passa para a PRÓXIMA opção (a sidebar recolhida não tem largura
 * para as três).
 */
export function ThemeToggle({ tone = 'chrome', compact }: { tone?: 'chrome' | 'paper'; compact?: boolean }) {
    // Local: escolher a opção que dá no mesmo tema (Sistema com o sistema já escuro) não
    // recarrega, e o botão tem de acompanhar.
    const [pref, setPref] = useState<ThemePref>(themePref)
    const onChrome = tone === 'chrome'
    const choose = (next: ThemePref) => {
        if (next === pref) return
        setPref(next)
        setThemePref(next)
    }
    if (compact) {
        const current = OPTIONS.find((o) => o.id === pref) ?? OPTIONS[2]
        const next = OPTIONS[(OPTIONS.indexOf(current) + 1) % OPTIONS.length]
        const label = `${current.label} · ${tr('trocar para', 'switch to')} ${next.label.toLowerCase()}`
        return (
            <ButtonBase
                title={label}
                aria-label={label}
                onClick={() => choose(next.id)}
                sx={{
                    minWidth: 40, height: 28, px: 1, borderRadius: 999,
                    color: onChrome ? chrome.textMuted : ink.secondary,
                    border: `1px solid ${onChrome ? chrome.lineStrong : parchment.sunken}`,
                }}
            >
                <current.Icon sx={{ fontSize: 16 }} />
            </ButtonBase>
        )
    }
    return (
        <Box
            role="group"
            aria-label={tr('Tema', 'Theme')}
            sx={{
                display: 'inline-flex', flexShrink: 0, borderRadius: 999, p: '2px',
                border: `1px solid ${onChrome ? chrome.lineStrong : parchment.sunken}`,
                bgcolor: onChrome ? green.deepest : parchment.paper,
            }}
        >
            {OPTIONS.map((o) => {
                const active = o.id === pref
                return (
                    <ButtonBase
                        key={o.id}
                        aria-pressed={active}
                        aria-label={o.label}
                        title={o.label}
                        onClick={() => choose(o.id)}
                        sx={{
                            minWidth: 34, height: 26, px: 1, borderRadius: 999,
                            color: active ? (onChrome ? green.deepest : onFrame.paper) : (onChrome ? chrome.textMuted : ink.secondary),
                            bgcolor: active ? (onChrome ? gold.bright : green.main) : 'transparent',
                            '&:hover': active ? undefined : { color: onChrome ? chrome.text : greenInk.main },
                            '@media (pointer: coarse)': { height: 32, minWidth: 40 },
                        }}
                    >
                        <o.Icon sx={{ fontSize: 16 }} />
                    </ButtonBase>
                )
            })}
        </Box>
    )
}
