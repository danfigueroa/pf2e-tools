// Peças pequenas do histórico: o número que conta e o avatar da pessoa.

import { Box } from '@mui/material'
import { TokenBadge } from '../../battle-map/components/TokenBadge'
import { useAnimatedNumber } from '../../../motion/useAnimatedNumber'

interface CountProps {
    value: number
    /** Casas decimais animadas (a média do d20 conta de décimo em décimo). */
    decimals?: number
    shown: boolean
    format?: (n: number) => string
    duration?: number
}

/** O número corre do zero até o valor quando aparece; depois, de um valor ao outro (a sessão ao vivo). */
export const CountUp = ({ value, decimals = 0, shown, format, duration = 1100 }: CountProps) => {
    const scale = 10 ** decimals
    const n = useAnimatedNumber(shown ? Math.round(value * scale) : 0, { duration }) / scale
    const text = format ? format(n) : n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    return <>{text}</>
}

interface AvatarProps {
    slug: string | null
    name: string
    color: string
    size?: number
}

/** O token da ficha; sem ficha (rolador do mapa), um disco na cor dos dados. */
export const PersonAvatar = ({ slug, name, color, size = 32 }: AvatarProps) =>
    slug
        ? <TokenBadge slug={slug} name={name} size={size} />
        : <Box aria-hidden sx={{ width: size, height: size, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
