import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, IconButton, Paper, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { TokenDescriptor } from '../../../services/maps'
import { gold, green, mapChrome, parchment } from '../../../theme'

interface Props {
    tokens: Record<string, TokenDescriptor>
    /** Id do token que está no turno (`null` = encontro não iniciado). */
    turn: string | null
}

const OPEN_KEY = 'pf2e:map:turns-open'

/** Tokens na ordem da Iniciativa. Sem `order` (gravado antes do campo), vai para o fim, por nome. */
function ordered(tokens: Record<string, TokenDescriptor>): Array<{ id: string; token: TokenDescriptor }> {
    return Object.entries(tokens)
        .map(([id, token]) => ({ id, token }))
        .sort((a, b) =>
            (a.token.order ?? Infinity) - (b.token.order ?? Infinity)
            || a.token.name.localeCompare(b.token.name))
}

/**
 * Resumo da ordem de turnos do encontro ligado ao mapa: só os nomes, na ordem
 * da Iniciativa, com o turno ativo em destaque. Somente leitura — quem muda o
 * turno é a Iniciativa.
 */
export const TurnOrder = ({ tokens, turn }: Props) => {
    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(OPEN_KEY) !== '0' } catch { return true }
    })
    const toggle = () => {
        setOpen((value) => {
            try { localStorage.setItem(OPEN_KEY, value ? '0' : '1') } catch { /* noop */ }
            return !value
        })
    }

    const list = useMemo(() => ordered(tokens), [tokens])
    const activeRef = useRef<HTMLLIElement | null>(null)
    useEffect(() => {
        activeRef.current?.scrollIntoView({ block: 'nearest' })
    }, [turn, open])

    if (list.length === 0) return null

    return (
        <Paper
            elevation={4}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
                position: 'absolute',
                left: 12,
                top: 64,
                zIndex: 2,
                width: 190,
                maxHeight: 'calc(100% - 200px)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: green.main,
                color: parchment.page,
                borderTop: `2px solid ${gold.main}`,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', pl: 1.25, pr: 0.25 }}>
                <Typography
                    component="h2"
                    variant="overline"
                    sx={{ flex: 1, color: gold.bright, fontWeight: 700, lineHeight: 2.2 }}
                >
                    Turnos
                </Typography>
                <IconButton
                    size="small"
                    aria-label={open ? 'Recolher a ordem de turnos' : 'Mostrar a ordem de turnos'}
                    aria-expanded={open}
                    onClick={toggle}
                    sx={{ color: gold.bright }}
                >
                    {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
            </Box>
            {open && (
                <Box
                    component="ol"
                    sx={{ listStyle: 'none', m: 0, p: 0, pb: 0.5, overflowY: 'auto' }}
                >
                    {list.map(({ id, token }, i) => {
                        const active = id === turn
                        return (
                            <Box
                                component="li"
                                key={id}
                                ref={active ? activeRef : undefined}
                                aria-current={active ? 'step' : undefined}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                    px: 1.25,
                                    py: 0.4,
                                    fontSize: '0.85rem',
                                    borderLeft: `3px solid ${active ? gold.bright : 'transparent'}`,
                                    backgroundColor: active ? green.mid : 'transparent',
                                    opacity: token.defeated ? 0.5 : 1,
                                }}
                            >
                                <Box
                                    component="span"
                                    sx={{ width: 18, flex: '0 0 auto', textAlign: 'right', color: gold.bright, fontVariantNumeric: 'tabular-nums' }}
                                >
                                    {i + 1}
                                </Box>
                                <Box
                                    component="span"
                                    aria-hidden
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        flex: '0 0 auto',
                                        borderRadius: '50%',
                                        // PC em dourado, criatura em branco-pergaminho: distingue sem texto extra.
                                        backgroundColor: token.kind === 'pc' ? gold.bright : mapChrome.text,
                                    }}
                                />
                                <Box
                                    component="span"
                                    sx={{
                                        minWidth: 0,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        fontWeight: active ? 700 : 400,
                                        textDecoration: token.defeated ? 'line-through' : 'none',
                                    }}
                                    title={token.name}
                                >
                                    {token.name}
                                </Box>
                            </Box>
                        )
                    })}
                </Box>
            )}
        </Paper>
    )
}
