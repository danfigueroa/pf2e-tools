import { useEffect, useRef, useState } from 'react'
import { Alert, Button, ButtonBase, Card, CardContent, Chip, Snackbar, Stack, Tooltip, Typography } from '@mui/material'
import { gold, green, MAGUS_COLOR, SHIELD_COLOR } from '../../../theme'
import type { ActionsApi } from './useActions'
import { useSheetReadOnly } from '../sheetAccess'
import { tr } from '../../../i18n'

interface Props {
    actions: ActionsApi
    /** Quick Shield Block: a reação extra, só para Shield Block, ganha o próprio pip. */
    shieldReaction?: boolean
}

const PIP = 30

/** Um pip: cheio = ação disponível, vazio = gasta, tracejado = perdida (Lento/Atordoado). */
const Pip = ({ state, label, color, onClick, glyph }: {
    state: 'free' | 'spent' | 'lost'
    label: string
    color: string
    onClick?: () => void
    glyph?: string
}) => {
    // Ficha de outra pessoa: os pips mostram as ações do turno, sem gastar nenhuma.
    const readOnly = useSheetReadOnly()
    return (
    <Tooltip title={label}>
        <span>
            <ButtonBase
                disabled={!onClick || state === 'lost' || readOnly}
                onClick={onClick}
                aria-label={label}
                aria-pressed={state === 'spent'}
                sx={{
                    width: PIP,
                    height: PIP,
                    borderRadius: '50%',
                    border: `2px ${state === 'lost' ? 'dashed' : 'solid'} ${state === 'lost' ? 'rgba(120,120,120,0.7)' : color}`,
                    bgcolor: state === 'free' ? color : 'transparent',
                    color: state === 'free' ? '#FFFFFF' : color,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    opacity: state === 'lost' ? 0.55 : 1,
                    transition: 'background-color 120ms',
                    '@media (pointer: coarse)': { width: 36, height: 36 },
                }}
            >
                {glyph}
            </ButtonBase>
        </span>
    </Tooltip>
    )
}

/**
 * As ações do turno: 3 pips (menos o que Lento/Atordoado tiram), a ação extra do
 * Acelerado (só Golpe ou Andar) e a reação. Fora das abas, porque o jogador gasta
 * ação de qualquer aba. O app só conta: o que a ficha rola (Golpe, magia) desconta
 * sozinho, e o resto (Andar, Interagir, Sacar) tem botão.
 *
 * Ao zerar, avisa. O aviso só dispara por mudança depois da primeira pintura: o
 * contador chega do cache e do servidor, e isso não é "acabaram as ações".
 */
export const ActionsBar = ({ actions, shieldReaction }: Props) => {
    const { stored, budget, left } = actions
    const [notice, setNotice] = useState(false)
    const previous = useRef<number | null>(null)
    const armedAt = useRef(Date.now())

    useEffect(() => {
        const before = previous.current
        previous.current = left.total
        if (before !== null && before > 0 && left.total === 0 && Date.now() - armedAt.current > 1000) setNotice(true)
    }, [left.total])

    const spentBase = Math.min(stored.used, budget.base)
    const out = left.total === 0
    const lostLabel = budget.lost > 0
        ? [budget.stunned > 0 ? tr(`Atordoado ${budget.stunned}`, `Stunned ${budget.stunned}`) : null, budget.slowed > 0 ? tr(`Lento ${budget.slowed}`, `Slowed ${budget.slowed}`) : null]
            .filter(Boolean).join(' / ')
        : null

    return (
        <Card sx={{ mb: 3, borderColor: out ? 'error.main' : undefined, borderWidth: out ? 2 : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1.25 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mr: 0.5 }}>{tr('Ações', 'Actions')}</Typography>

                        <Stack direction="row" spacing={0.75} alignItems="center">
                            {Array.from({ length: budget.base }, (_, i) => (
                                <Pip
                                    key={i}
                                    state={i < spentBase ? 'spent' : 'free'}
                                    color={green.main}
                                    label={i < spentBase ? tr('Ação gasta — toque para devolver', 'Action spent — tap to give it back') : tr('Ação disponível — toque para gastar', 'Action available — tap to spend')}
                                    // Tocar num pip gasto devolve até ele; num livre, gasta até ele.
                                    onClick={() => actions.setUsed(i < spentBase ? i : i + 1)}
                                    glyph="◆"
                                />
                            ))}
                            {Array.from({ length: budget.lost }, (_, i) => (
                                <Pip key={`lost-${i}`} state="lost" color="#777777" label={tr(`Ação perdida (${lostLabel})`, `Action lost (${lostLabel})`)} />
                            ))}
                            {budget.quick && (
                                <Pip
                                    state={stored.quickUsed ? 'spent' : 'free'}
                                    color={MAGUS_COLOR}
                                    label={tr("Ação extra do Acelerado: só para Golpe ou Andar", 'Quickened\'s extra action: only for Strike or Stride')}
                                    onClick={actions.toggleQuick}
                                    glyph="+"
                                />
                            )}
                        </Stack>

                        <Pip
                            state={stored.reacted ? 'spent' : 'free'}
                            color={gold.deep}
                            label={stored.reacted ? tr('Reação usada nesta rodada — toque para devolver', 'Reaction used this round — tap to give it back') : tr('Reação disponível', 'Reaction available')}
                            onClick={actions.toggleReaction}
                            glyph="⤴"
                        />
                        {shieldReaction && (
                            <Pip
                                state={stored.shieldReacted ? 'spent' : 'free'}
                                color={SHIELD_COLOR}
                                label={stored.shieldReacted
                                    ? tr('Reação extra do Quick Shield Block usada — toque para devolver', 'Quick Shield Block\'s extra reaction used — tap to give it back')
                                    : tr('Reação extra do Quick Shield Block: só para Shield Block', 'Quick Shield Block\'s extra reaction: only for Shield Block')}
                                onClick={actions.toggleShieldReaction}
                                glyph="🛡"
                            />
                        )}

                        {out && <Chip label={tr("Sem ações neste turno", 'No actions this turn')} color="error" size="small" sx={{ fontWeight: 700 }} />}
                    </Stack>

                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }} alignItems="center">
                        <Tooltip title={budget.quick ? tr('Usa a ação extra do Acelerado primeiro', 'Uses Quickened\'s extra action first') : 'Andar (Stride)'}>
                            <Button size="small" variant="outlined" onClick={() => actions.spend(1, 'move-attack')}>Andar</Button>
                        </Tooltip>
                        <Button size="small" variant="outlined" onClick={() => actions.spend(1)}>{tr('−1 ação', '−1 action')}</Button>
                        <Button size="small" variant="outlined" onClick={() => actions.spend(2)}>−2</Button>
                        <Button size="small" variant="outlined" onClick={() => actions.spend(3)}>−3</Button>
                        <Button size="small" variant="contained" onClick={actions.startTurn} sx={{ ml: 'auto' }}>
                            {tr('Novo turno', 'New turn')}</Button>
                    </Stack>

                    {lostLabel && (
                        <Typography variant="caption" color="text.secondary">
                            {lostLabel}: {tr(`${budget.base} ${budget.base === 1 ? 'ação' : 'ações'} neste turno.`, `${budget.base} ${budget.base === 1 ? 'action' : 'actions'} this turn.`)}
                        </Typography>
                    )}
                    {budget.quick && (
                        <Typography variant="caption" color="text.secondary">
                            {tr('Acelerado: +1 ação, só para Golpe ou Andar.', 'Quickened: +1 action, only for Strike or Stride.')}</Typography>
                    )}
                </Stack>
            </CardContent>

            <Snackbar
                open={notice}
                autoHideDuration={5000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setNotice(false) }}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="warning" variant="filled" onClose={() => setNotice(false)}>
                    {tr('Sem ações neste turno.', 'No actions this turn.')}</Alert>
            </Snackbar>
        </Card>
    )
}
