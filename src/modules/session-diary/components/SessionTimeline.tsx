import { memo } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { useInView } from '../../../motion/useInView'
import { gold, ink, parchment, rule, status, greenInk } from '../../../theme'
import { d20Average, type SessionPoint } from '../stats'
import { shortDay } from '../awards'
import { grow } from './style'
import { locale, tr } from '../../../i18n'

/** Quantas sessões cabem na linha do tempo; as mais antigas ficam de fora (o seletor ainda as tem). */
const MAX_SESSIONS = 24

interface Props {
    series: SessionPoint[]
    onOpenDay: (day: string) => void
}

/** A cor da média da noite: azarada em vermelho, na média em verde, quente em ouro. */
const avgColor = (avg: number | null) =>
    avg === null ? rule : avg < 9 ? status.error : avg < 10 ? status.warning : avg < 12 ? greenInk.light : gold.main

/**
 * Uma coluna por sessão: a altura é quanto a mesa rolou, a cor é a média do d20
 * da noite. Tocar abre a sessão.
 */
export const SessionTimeline = memo(({ series, onOpenDay }: Props) => {
    const [ref, shown] = useInView<HTMLDivElement>()
    const list = series.slice(-MAX_SESSIONS)
    const max = Math.max(1, ...list.map((s) => s.rolls))
    const labelEvery = list.length <= 8 ? 1 : Math.ceil(list.length / 6)
    return (
        <Box ref={ref}>
            <Box
                sx={{
                    display: 'flex', alignItems: 'flex-end', gap: { xs: 0.5, sm: 0.75 }, height: 150,
                    p: 1, pb: 0, backgroundColor: parchment.paper, border: `1px solid ${rule}`, borderRadius: 2,
                }}
            >
                {list.map((s, i) => {
                    const avg = d20Average(s)
                    const label = tr(`${shortDay(s.day)}: ${s.rolls} rolagens, ${s.people} ${s.people === 1 ? 'pessoa' : 'pessoas'}`, `${shortDay(s.day)}: ${s.rolls} rolls, ${s.people} ${s.people === 1 ? 'person' : 'people'}`) +
                        (avg !== null ? tr(`, média do d20 ${avg.toLocaleString(locale)}`, `, d20 average ${avg.toLocaleString(locale)}`) : '') + `, ${s.nat20}× 20 e ${s.nat1}× 1`
                    return (
                        <ButtonBase
                            key={s.day}
                            onClick={() => onOpenDay(s.day)}
                            title={label}
                            aria-label={tr(`Abrir a sessão de ${label}`, `Open the ${label} session`)}
                            sx={{
                                flex: '1 1 0', minWidth: 0, maxWidth: 56, height: '100%',
                                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch',
                                borderRadius: '4px 4px 0 0',
                                '&:hover .bar, &:focus-visible .bar': { filter: 'brightness(1.12)' },
                            }}
                        >
                            {avg !== null && list.length <= 12 && (
                                <Typography variant="caption" sx={{ fontWeight: 700, color: ink.secondary, lineHeight: 1.2, opacity: shown ? 1 : 0, transition: 'opacity 300ms ease 600ms' }}>
                                    {avg.toLocaleString(locale)}
                                </Typography>
                            )}
                            <Box
                                className="bar"
                                sx={{
                                    ...grow(shown, s.rolls / max, 'y', i),
                                    height: 'calc(100% - 18px)', borderRadius: '4px 4px 0 0',
                                    background: `linear-gradient(180deg, ${avgColor(avg)} 0%, ${avgColor(avg)}B3 100%)`,
                                }}
                            />
                        </ButtonBase>
                    )
                })}
            </Box>
            <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 0.75 }, px: 1, mt: 0.5 }}>
                {list.map((s, i) => (
                    <Typography key={s.day} variant="caption" color="text.secondary" sx={{ flex: '1 1 0', minWidth: 0, maxWidth: 56, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
                        {i % labelEvery === 0 ? s.day.slice(8, 10) + '/' + s.day.slice(5, 7) : ''}
                    </Typography>
                ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {tr('Cada coluna é uma noite de jogo: quanto mais alta, mais a mesa rolou. O número em cima é a média no d20 da noite, e a cor diz como foi: vermelho é noite de azar, dourado é noite de sorte. Toque numa coluna para ver a noite.', 'Each column is a game night: the taller, the more the table rolled. The number on top is the night\'s d20 average, and the color tells how it went: red is a night of bad luck, gold is a night of good luck. Tap a column to see the night.')}{series.length > MAX_SESSIONS && tr(` Mostrando as últimas ${MAX_SESSIONS}.`, ` Showing the last ${MAX_SESSIONS}.`)}
            </Typography>
        </Box>
    )
})
