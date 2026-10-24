import { memo, useMemo, useState } from 'react'
import { Box, FormControl, MenuItem, Select, Typography } from '@mui/material'
import { useInView } from '../../../motion/useInView'
import { gold, green, ink, parchment, rule, status } from '../../../theme'
import { fairness, VERDICT_TEXT } from '../fairness'
import type { PersonStats } from '../stats'

interface Props {
    people: PersonStats[]
    /** A distribuição de todo mundo junto (a opção padrão). */
    tableHist: number[]
}

const W = 400
const H = 150
const PAD_X = 4
const BASE = H - 18
const SLOT = (W - PAD_X * 2) / 20
const LABELED = new Set([1, 5, 10, 15, 20])

const barColor = (face: number) => (face === 20 ? gold.main : face === 1 ? status.error : green.light)

/**
 * As 20 faces do d20 contra o esperado (a linha tracejada, 5% cada) e o
 * veredito do qui-quadrado (`fairness.ts`). SVG à mão: 20 retângulos que
 * crescem com `transform`, sem biblioteca de gráfico.
 */
export const D20Histogram = memo(({ people, tableHist }: Props) => {
    const [who, setWho] = useState('')
    const [ref, shown] = useInView<HTMLDivElement>()
    const rolled = useMemo(() => people.filter((p) => p.checks > 0), [people])
    const hist = rolled.find((p) => p.key === who)?.hist ?? tableHist
    const f = useMemo(() => fairness(hist), [hist])
    const max = Math.max(1, ...hist, f.checks / 20)
    const expectedY = BASE - (f.checks / 20 / max) * (BASE - 8)

    return (
        <Box ref={ref}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                <FormControl size="small" sx={{ minWidth: 0, flex: '0 1 260px' }}>
                    <Select value={who} onChange={(e) => setWho(String(e.target.value))} displayEmpty inputProps={{ 'aria-label': 'De quem' }}>
                        <MenuItem value="">Toda a mesa</MenuItem>
                        {rolled.map((p) => <MenuItem key={p.key} value={p.key}>{p.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary">
                    {f.checks.toLocaleString('pt-BR')} {f.checks === 1 ? 'teste' : 'testes'}
                    {f.hot !== null && f.checks >= 20 && <> · mais saiu: <b>{f.hot}</b> · menos saiu: <b>{f.cold}</b></>}
                </Typography>
            </Box>

            <Box sx={{ backgroundColor: parchment.paper, border: `1px solid ${rule}`, borderRadius: 2, p: { xs: 1, sm: 1.5 } }}>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Quantas vezes cada face do d20 saiu" style={{ display: 'block' }}>
                    {hist.map((n, i) => {
                        const face = i + 1
                        const x = PAD_X + i * SLOT + SLOT * 0.14
                        return (
                            <g key={face}>
                                <rect
                                    x={x} y={8} width={SLOT * 0.72} height={BASE - 8}
                                    fill={barColor(face)}
                                    style={{
                                        transformBox: 'fill-box', transformOrigin: 'center bottom',
                                        // Altura cheia encolhida pela escala: trocar de pessoa anima a barra até a altura nova.
                                        transform: `scaleY(${shown ? n / max : 0})`,
                                        transition: `transform 650ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 28}ms`,
                                    }}
                                >
                                    <title>{`${face}: ${n}×`}</title>
                                </rect>
                                {LABELED.has(face) && (
                                    <text x={x + SLOT * 0.36} y={H - 4} textAnchor="middle" fontSize={11} fill={ink.secondary}>{face}</text>
                                )}
                            </g>
                        )
                    })}
                    <line x1={0} x2={W} y1={BASE} y2={BASE} stroke={rule} />
                    {f.checks > 0 && (
                        <line x1={0} x2={W} y1={expectedY} y2={expectedY} stroke={ink.secondary} strokeDasharray="4 4" strokeWidth={1}
                            style={{ opacity: shown ? 0.8 : 0, transition: 'opacity 400ms ease 700ms' }} />
                    )}
                </svg>
            </Box>
            <Typography sx={{ mt: 1, fontWeight: 600, color: f.verdict === 'fair' ? green.mid : f.verdict === 'few' ? ink.secondary : status.error }}>
                {VERDICT_TEXT[f.verdict]}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                A linha tracejada é o esperado de um dado honesto (5% para cada face).
                {f.chi2 !== null && ` Qui-quadrado ${f.chi2.toLocaleString('pt-BR')} (acima de 30,1 é suspeito).`}
            </Typography>
        </Box>
    )
})
