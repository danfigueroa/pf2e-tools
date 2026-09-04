// Painel de ajuste fino: uma linha por estatística, com a coluna do benchmark
// trocável.
//
// O destaque de "mudou" fica AQUI e não no stat block: o bloco é o que vira PNG
// e precisa sair limpo, como uma ficha impressa de verdade.

import { Box, Button, MenuItem, Select, Typography } from '@mui/material'
import { gold, ink, parchment, rule } from '../../../theme'
import type { BenchColumn, ScaledRow } from '../types'

// Nem toda linha usa os cinco degraus: dano em área tem colunas próprias
// (ilimitado/limitado) e a linha de ranks de conjuração escolhe um comportamento.
const COLUMN_LABELS: Record<BenchColumn, string> = {
    extreme: 'Extremo',
    high: 'Alto',
    moderate: 'Moderado',
    low: 'Baixo',
    terrible: 'Terrível',
    unlimited: 'Ilimitado',
    limited: 'Limitado',
    follow: 'Acompanham',
    original: 'Originais',
}

interface Props {
    rows: ScaledRow[]
    overrides: Record<string, BenchColumn>
    onOverride: (key: string, column: BenchColumn) => void
    onReset: () => void
}

const show = (row: ScaledRow, value: number) =>
    row.kind === 'modifier' ? (value >= 0 ? `+${value}` : `${value}`) : `${value}`

export function ScaleAdjustPanel({ rows, overrides, onOverride, onReset }: Props) {
    const dirty = Object.keys(overrides).length > 0

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="overline" sx={{ color: gold.deep, letterSpacing: '0.06em' }}>
                    Ajuste fino
                </Typography>
                <Button size="small" disabled={!dirty} onClick={onReset}>
                    Restaurar padrão
                </Button>
            </Box>

            <Typography variant="caption" sx={{ display: 'block', mb: 1, color: ink.secondary }}>
                Cada linha mantém o degrau que a AON atribuiu à ficha original, e a diferença dela
                para a tabela é preservada. Trocar o degrau recalcula só aquela linha.
            </Typography>

            <Box sx={{ border: `1px solid ${rule}`, borderRadius: 1, overflow: 'hidden' }}>
                {rows.map((row, index) => {
                    const changed = row.from !== row.to
                        || (row.formulaFrom ?? null) !== (row.formulaTo ?? null)
                    return (
                        <Box
                            key={row.key}
                            sx={{
                                display: 'grid',
                                // Nada de minWidth fixo em flex-wrap: a 320px estoura.
                                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(120px, 0.9fr)' },
                                gap: { xs: 0.25, sm: 1 },
                                alignItems: 'center',
                                px: 1,
                                py: 0.75,
                                backgroundColor: index % 2 === 0 ? parchment.paper : parchment.sunken,
                                borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${rule}88`,
                            }}
                        >
                            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, overflowWrap: 'break-word' }}>
                                {row.label}
                                {row.inferred && (
                                    <Box component="span" sx={{ color: ink.disabled, fontWeight: 400 }} title="A AON não classifica esta linha — perícias e as CDs escritas na prosa das habilidades: o degrau foi deduzido do valor.">
                                        {' '}·  deduzido
                                    </Box>
                                )}
                            </Typography>

                            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                <Box component="span" sx={{ color: ink.disabled }}>
                                    {row.formulaFrom ?? show(row, row.from)}
                                </Box>
                                <Box component="span" sx={{ color: ink.disabled }}> → </Box>
                                <Box component="span" sx={{ fontWeight: changed ? 700 : 400, color: changed ? gold.deep : ink.primary }}>
                                    {row.formulaTo ?? show(row, row.to)}
                                </Box>
                            </Typography>

                            <Select
                                size="small"
                                value={row.column ?? ''}
                                displayEmpty
                                onChange={(e) => onOverride(row.key, e.target.value as BenchColumn)}
                                sx={{ fontSize: '0.8rem' }}
                                inputProps={{ 'aria-label': `Degrau de ${row.label}` }}
                            >
                                {row.column === null && <MenuItem value="">—</MenuItem>}
                                {row.columns.map((c) => (
                                    <MenuItem key={c} value={c}>{COLUMN_LABELS[c]}</MenuItem>
                                ))}
                            </Select>
                        </Box>
                    )
                })}
            </Box>
        </Box>
    )
}
