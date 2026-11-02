// Seletor de idioma: "PT | EN". Trocar recarrega a página (o idioma é constante por
// carga, ver `src/i18n`), e logado a escolha vai para a conta.
//
// Sem Tooltip do MUI (puxa o popper.js para o chunk principal): `title` nativo.

import { useState } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { lang, tr, type Lang } from '../i18n'
import { setLanguage } from '../services/auth'
import { chrome, gold, green, ink, onFrame, parchment } from '../theme'

const OPTIONS: { id: Lang; short: string; label: string }[] = [
    { id: 'pt', short: 'PT', label: 'Português' },
    { id: 'en', short: 'EN', label: 'English' },
]

/**
 * `compact`: um botão só, com o OUTRO idioma (a sidebar recolhida não tem largura para os dois).
 */
export function LanguageToggle({ tone = 'chrome', compact }: { tone?: 'chrome' | 'paper'; compact?: boolean }) {
    const [busy, setBusy] = useState(false)
    const onChrome = tone === 'chrome'
    if (compact) {
        const other = OPTIONS.find((o) => o.id !== lang)!
        return (
            <ButtonBase
                lang={other.id === 'en' ? 'en' : 'pt-BR'}
                title={other.label}
                aria-label={other.label}
                disabled={busy}
                onClick={() => { setBusy(true); void setLanguage(other.id) }}
                sx={{
                    minWidth: 40, height: 28, px: 1, borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
                    letterSpacing: '0.06em', color: onChrome ? chrome.textMuted : ink.secondary,
                    border: `1px solid ${onChrome ? chrome.lineStrong : parchment.sunken}`,
                }}
            >
                {other.short}
            </ButtonBase>
        )
    }
    return (
        <Box
            role="group"
            aria-label={tr('Idioma', 'Language')}
            sx={{
                display: 'inline-flex', flexShrink: 0, borderRadius: 999, p: '2px',
                border: `1px solid ${onChrome ? chrome.lineStrong : parchment.sunken}`,
                bgcolor: onChrome ? green.deepest : parchment.paper,
            }}
        >
            {OPTIONS.map((o) => {
                const active = o.id === lang
                return (
                    <ButtonBase
                        key={o.id}
                        lang={o.id === 'en' ? 'en' : 'pt-BR'}
                        aria-pressed={active}
                        title={o.label}
                        disabled={busy}
                        onClick={() => {
                            if (active) return
                            setBusy(true)
                            void setLanguage(o.id)
                        }}
                        sx={{
                            minWidth: 34, height: 26, px: 1, borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: active ? (onChrome ? green.deepest : onFrame.paper) : (onChrome ? chrome.textMuted : ink.secondary),
                            bgcolor: active ? (onChrome ? gold.bright : green.main) : 'transparent',
                            '@media (pointer: coarse)': { height: 32, minWidth: 40 },
                        }}
                    >
                        {o.short}
                    </ButtonBase>
                )
            })}
        </Box>
    )
}
