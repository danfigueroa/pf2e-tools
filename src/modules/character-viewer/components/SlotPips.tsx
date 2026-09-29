import { useEffect, useRef, useState } from 'react'
import { Box, ButtonBase, Stack, Tooltip } from '@mui/material'
import { RECOVER, RIPPLE, SPEND, useArmed, useReducedMotion } from '../../../motion/motion'

interface Props {
    /** Quantidade de slots do grupo. */
    total: number
    /** Quantos já foram gastos (sempre os primeiros da esquerda). */
    used: number
    /** Cor do slot disponível — tradição do conjurador ou acento de foco. */
    color: string
    /** Recebe o novo total de gastos ao clicar num pip. */
    onChange: (next: number) => void
    /** Prefixo do aria-label, ex.: "slot de nível 3". */
    label: string
    size?: number
}

/**
 * Fileira de slots clicáveis. Clicar num disponível gasta até ele; clicar num
 * gasto recupera a partir dele — é assim que se devolve um slot específico.
 */
export const SlotPips = ({ total, used, color, onChange, label, size = 14 }: Props) => {
    // Os pips que acabaram de mudar: gastos encolhem soltando um anel na cor da
    // tradição, recuperados estouram de volta. Vale também para mudança vinda
    // da mesa (outro jogador, "Novo dia") — é justamente a que ninguém viu.
    const armed = useArmed()
    const reduced = useReducedMotion()
    const prev = useRef(used)
    const [change, setChange] = useState<{ from: number; to: number; id: number } | null>(null)
    useEffect(() => {
        const from = prev.current
        prev.current = used
        if (from === used || !armed || reduced) return
        setChange((c) => ({ from, to: used, id: (c?.id ?? 0) + 1 }))
    }, [used, armed, reduced])

    if (total <= 0) return null

    return (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: { xs: 0.75, sm: 0.5 } }}>
            {Array.from({ length: total }, (_, i) => {
                const spent = i < used
                const moved = change && i >= Math.min(change.from, change.to) && i < Math.max(change.from, change.to)
                const twin = (change?.id ?? 0) % 2
                return (
                    <Tooltip key={i} title={spent ? 'Recuperar' : 'Gastar'} enterDelay={400}>
                        <ButtonBase
                            aria-label={`${label} ${i + 1}: ${spent ? 'gasto' : 'disponível'}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange(spent ? i : i + 1)
                            }}
                            sx={{
                                // Pip de 14px é impossível de acertar com o
                                // dedo: no celular ele cresce, no desktop fica
                                // do tamanho pedido.
                                width: { xs: size + 6, sm: size },
                                height: { xs: size + 6, sm: size },
                                flexShrink: 0,
                                borderRadius: '50%',
                                border: '1px solid',
                                borderColor: spent ? 'divider' : color,
                                backgroundColor: spent ? 'action.hover' : color,
                                position: 'relative',
                                transition: 'background-color 120ms, border-color 120ms',
                                animation: moved ? `${(spent ? SPEND : RECOVER)[twin]} 300ms ease-out` : undefined,
                                '&:hover': { transform: 'scale(1.15)' },
                                '&::after': moved && spent ? {
                                    content: '""',
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '50%',
                                    border: '2px solid',
                                    borderColor: color,
                                    opacity: 0,
                                    animation: `${RIPPLE[twin]} 550ms ease-out`,
                                    pointerEvents: 'none',
                                } : undefined,
                                '&:focus-visible': { outline: '2px solid', outlineColor: color, outlineOffset: 2 },
                            }}
                        />
                    </Tooltip>
                )
            })}
        </Stack>
    )
}

/** Rótulo "2/5" para cabeçalhos; conta disponíveis, não gastos. */
export const SlotCount = ({ total, used }: { total: number; used: number }) => (
    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {Math.max(0, total - used)}/{total}
    </Box>
)
