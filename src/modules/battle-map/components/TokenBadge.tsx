import { Box } from '@mui/material'
import { useSharedState } from '../../character-viewer/components/useSharedState'
import { useImageUrl } from '../../../services/images'
import { initials } from '../geometry'
import { MAP_BACKDROP, TOKEN_PC, parchment } from '../../../theme'

interface TokenStored { url: string }

const sanitize = (raw: unknown): TokenStored | null =>
    raw && typeof raw === 'object' && typeof (raw as TokenStored).url === 'string'
        ? { url: (raw as TokenStored).url }
        : null

interface Props {
    slug: string
    name: string
    size?: number
}

/**
 * O token do personagem, só para olhar (quem envia é o `TokenAvatar` da ficha).
 * Lê a MESMA fatia da mesa (`<slug>/token`), então mostra a imagem que o jogador
 * mandou — e as iniciais, na cor do fundo do mapa, enquanto não há uma.
 */
export const TokenBadge = ({ slug, name, size = 36 }: Props) => {
    const [token] = useSharedState<TokenStored | null>(`${slug}/token`, {
        empty: () => null,
        sanitize,
        isEmpty: (v) => v === null,
    })
    const src = useImageUrl(token?.url)
    return (
        <Box
            sx={{
                width: size,
                height: size,
                flexShrink: 0,
                borderRadius: '50%',
                border: `2px solid ${TOKEN_PC}`,
                backgroundColor: MAP_BACKDROP,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: parchment.page,
                fontWeight: 700,
                fontSize: size * 0.38,
            }}
        >
            {src
                ? <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials(name)}
        </Box>
    )
}
