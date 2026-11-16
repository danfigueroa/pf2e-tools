import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { initialsOf } from '../layouts/navigation'
import { useAvatarUrl } from '../services/avatars'
import { useImageUrl } from '../services/images'

interface Props {
    userId?: string | null
    name: string
    size: number
    /** Fundo e cor das iniciais (quando não há imagem). */
    bg?: string
    color?: string
    fontSize?: number | string
    sx?: SxProps<Theme>
}

/**
 * A cara de uma conta: a imagem dela (própria ou o token da ficha) ou o círculo com as iniciais.
 * Decorativo: o nome sempre aparece ao lado, então a imagem é `aria-hidden`.
 */
export const UserAvatar = ({ userId, name, size, bg, color, fontSize, sx }: Props) => {
    const src = useImageUrl(useAvatarUrl(userId))
    return (
        <Box
            aria-hidden
            sx={{
                width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', bgcolor: bg, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: fontSize ?? size * 0.36, fontWeight: 700, lineHeight: 1, ...(sx as object),
            }}
        >
            {src
                ? <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : initialsOf(name)}
        </Box>
    )
}
