import { memo, useEffect, useRef, useState, type ReactElement } from 'react'
import { Box, ButtonBase, Paper, Typography } from '@mui/material'
import {
    AcUnit, AutoAwesome, Balance, Celebration, EmojiEvents, FlashOn,
    LocalFireDepartment, SentimentVeryDissatisfied, Speed, Stars, Thunderstorm, TrendingDown, Whatshot,
} from '@mui/icons-material'
import { useInView } from '../../../motion/useInView'
import { pulseAnimation, useReducedMotion, type Pulse } from '../../../motion/motion'
import { displayFont, ink, parchment, rule } from '../../../theme'
import type { Award } from '../awards'
import { CountUp, PersonAvatar } from './ui'
import { reveal, TONE } from './style'

const ICONS: Record<string, ReactElement> = {
    blessed: <AutoAwesome />, cursed: <SentimentVeryDissatisfied />, hot: <Whatshot />, cold: <AcUnit />,
    legend: <EmojiEvents />, stumble: <TrendingDown />, smash: <FlashOn />, engine: <LocalFireDepartment />,
    karma: <Balance />, gunner: <Speed />, mythic: <Stars />, glory: <Celebration />, doom: <Thunderstorm />,
}

/** Os dois primeiros ganham cartão maior: são o "quem tirou mais 20" e "o mais azarado". */
const FEATURED = 2

interface Props {
    awards: Award[]
    /** Troféu de uma noite: tocar abre aquela sessão. */
    onOpenDay?: (day: string) => void
}

/** O hall da fama: um cartão por troféu, entrando em sequência quando a grade aparece. */
export const AwardGrid = memo(({ awards, onOpenDay }: Props) => {
    const [ref, shown] = useInView<HTMLDivElement>()
    const featured = awards.slice(0, FEATURED)
    const rest = awards.slice(FEATURED)
    return (
        <Box ref={ref} sx={{ display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1.5 }}>
                {featured.map((a, i) => <AwardCard key={a.id} award={a} big shown={shown} index={i} onOpenDay={onOpenDay} />)}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
                {rest.map((a, i) => <AwardCard key={a.id} award={a} shown={shown} index={i + FEATURED} onOpenDay={onOpenDay} />)}
            </Box>
        </Box>
    )
})

interface CardProps {
    award: Award
    big?: boolean
    shown: boolean
    index: number
    onOpenDay?: (day: string) => void
}

const AwardCard = memo(({ award: a, big, shown, index, onOpenDay }: CardProps) => {
    const tone = TONE[a.tone]
    const w = a.winner
    const pulse = useWinnerPulse(w?.person.key ?? null)
    const decimals = w && !Number.isInteger(w.value) ? 1 : 0
    const openDay = w?.day && onOpenDay ? () => onOpenDay(w.day!) : undefined
    return (
        <Paper
            variant="outlined"
            sx={{
                ...reveal(shown, index),
                position: 'relative', overflow: 'hidden', minWidth: 0,
                p: big ? { xs: 1.75, sm: 2.25 } : 1.5,
                borderColor: rule,
                background: big ? `linear-gradient(160deg, ${parchment.paper} 40%, ${tone.accent}1F 100%)` : parchment.paper,
                animation: pulseAnimation(pulse),
                '&::before': { content: '""', position: 'absolute', inset: '0 0 auto 0', height: 3, backgroundColor: tone.accent },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box
                    aria-hidden
                    sx={{
                        width: big ? 40 : 32, height: big ? 40 : 32, borderRadius: '50%', flexShrink: 0,
                        display: 'grid', placeItems: 'center',
                        color: tone.text, backgroundColor: `${tone.accent}1F`, border: `1px solid ${tone.accent}55`,
                        '& svg': { fontSize: big ? 22 : 18 },
                    }}
                >
                    {ICONS[a.id]}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: big ? '1.05rem' : '0.92rem', lineHeight: 1.2 }}>
                        {a.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{a.blurb}</Typography>
                </Box>
            </Box>

            {w ? (
                <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        <PersonAvatar slug={w.person.slug} name={w.person.name} color={w.person.color} size={big ? 44 : 34} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{w.person.name}</Typography>
                            {w.detail && (openDay ? (
                                <ButtonBase onClick={openDay} sx={{ typography: 'caption', color: tone.text, textDecoration: 'underline', textAlign: 'left' }}>
                                    {w.detail}
                                </ButtonBase>
                            ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>{w.detail}</Typography>
                            ))}
                        </Box>
                        <Typography
                            component="div"
                            sx={{ fontWeight: 800, fontSize: big ? '2.2rem' : '1.6rem', lineHeight: 1, color: tone.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
                        >
                            <CountUp value={w.value} decimals={decimals} shown={shown} format={(n) => (n === w.value ? w.label : formatLike(w.label, n, decimals))} />
                        </Typography>
                    </Box>
                    {a.runnerUp && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: ink.secondary }} noWrap>
                            Vice: {a.runnerUp.person.name} · {a.runnerUp.label}
                        </Typography>
                    )}
                </>
            ) : a.tie ? (
                <Typography variant="body2" sx={{ color: ink.secondary }}>
                    <b>Empate</b> em {a.tie.label}: {joinNames(a.tie.names)}. Ninguém leva sozinho.
                </Typography>
            ) : (
                <Typography variant="body2" sx={{ color: ink.secondary, fontStyle: 'italic' }}>
                    Ninguém ainda.
                </Typography>
            )}
        </Paper>
    )
})

const joinNames = (names: string[]) =>
    names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`

/** Durante a contagem, o rótulo acompanha o número: "7×" passa por "3×", "+2" por "+1". */
function formatLike(label: string, n: number, decimals: number): string {
    const text = n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    if (label.endsWith('×')) return `${text}×`
    if (label.startsWith('+')) return n > 0 ? `+${text}` : text
    const unit = label.match(/^\S+\s+(.+)$/)
    return unit ? `${text} ${unit[1]}` : text
}

/**
 * Brilho dourado quando o troféu troca de dono com a página aberta (a sessão ao
 * vivo). O primeiro vencedor não brilha: é só a página carregando.
 */
function useWinnerPulse(key: string | null): Pulse | null {
    const reduced = useReducedMotion()
    const prev = useRef(key)
    const [pulse, setPulse] = useState<Pulse | null>(null)
    useEffect(() => {
        if (prev.current === key) return
        const had = prev.current !== null
        prev.current = key
        if (had && key !== null && !reduced) setPulse((p) => ({ kind: 'turn', id: (p?.id ?? 0) + 1 }))
    }, [key, reduced])
    return pulse
}
