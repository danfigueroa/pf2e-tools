import { Typography } from '@mui/material'
import { CONDITION_COLOR } from '../../../theme'
import { signed } from '../helpers'

interface Props {
    /** Modificador vindo das condições; 0 não renderiza nada. */
    delta: number
    /** Valor antes das condições, mostrado entre parênteses. */
    base?: number
    align?: 'left' | 'center' | 'right'
}

/**
 * Selo abaixo de um número já ajustado, deixando claro que a diferença veio das
 * condições (e qual era o valor da ficha).
 */
export const ConditionDelta = ({ delta, base, align = 'center' }: Props) => {
    if (!delta) return null
    return (
        <Typography
            component="span"
            sx={{
                display: 'block',
                fontSize: '0.68rem',
                fontWeight: 700,
                lineHeight: 1.2,
                color: CONDITION_COLOR,
                textAlign: align,
                whiteSpace: 'nowrap',
            }}
        >
            {signed(delta)} cond.{base != null ? ` · base ${signed(base)}` : ''}
        </Typography>
    )
}
