import { useRef, useState } from 'react'
import { Box, ButtonBase, CircularProgress, Tooltip } from '@mui/material'
import { PhotoCamera as CameraIcon } from '@mui/icons-material'
import { useSharedState } from './useSharedState'
import { TOKEN_MAX_SIDE, deleteImage, shrinkImage, uploadImage, useImageUrl } from '../../../services/images'
import { initials } from '../../battle-map/geometry'
import { MAP_BACKDROP, TOKEN_PC, gold, parchment } from '../../../theme'

interface TokenStored { url: string }

const sanitize = (raw: unknown): TokenStored | null =>
    raw && typeof raw === 'object' && typeof (raw as TokenStored).url === 'string'
        ? { url: (raw as TokenStored).url }
        : null

interface Props {
    slug: string
    name: string
}

/**
 * O token do personagem no Mapa de Combate. Mora aqui, e não no mapa, porque
 * não muda de um combate para outro: é enviado uma vez e vale em todos os
 * mapas — e apagar um mapa depois do jogo não o leva junto.
 *
 * É uma fatia da mesa (`<slug>/token`), como o PV: qualquer um que abrir a
 * ficha vê a mesma imagem.
 */
export const TokenAvatar = ({ slug, name }: Props) => {
    const [token, setToken] = useSharedState<TokenStored | null>(`${slug}/token`, {
        empty: () => null,
        sanitize,
        isEmpty: (v) => v === null,
    })
    const src = useImageUrl(token?.url)
    const input = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(false)

    const upload = async (file: File) => {
        setBusy(true)
        setError(false)
        try {
            const { blob } = await shrinkImage(file, TOKEN_MAX_SIDE, true)
            const url = await uploadImage(blob, 'tokens', slug)
            const old = token?.url
            setToken(() => ({ url }))
            if (old && old !== url) void deleteImage(old)
        } catch {
            setError(true)
        } finally {
            setBusy(false)
            if (input.current) input.current.value = ''
        }
    }

    const size = { xs: 64, sm: 76 }

    return (
        <Tooltip title={error ? 'Não foi possível enviar a imagem' : token ? 'Trocar o token do mapa' : 'Enviar o token do mapa'}>
            <ButtonBase
                onClick={() => input.current?.click()}
                disabled={busy}
                aria-label={token ? `Trocar o token de ${name}` : `Enviar o token de ${name}`}
                sx={{
                    position: 'relative',
                    flexShrink: 0,
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    border: `3px solid ${error ? 'transparent' : TOKEN_PC}`,
                    outline: error ? '2px solid' : 'none',
                    outlineColor: 'error.main',
                    backgroundColor: MAP_BACKDROP,
                    overflow: 'hidden',
                    ...(src ? { '&:hover .token-camera, &:focus-visible .token-camera': { opacity: 1 } } : {}),
                }}
            >
                {src ? (
                    <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <Box component="span" sx={{ color: parchment.page, fontWeight: 700, fontSize: '1.4rem' }}>
                        {initials(name)}
                    </Box>
                )}
                {/* Com imagem, a câmera cobre o token só no hover; sem imagem,
                    fica como selo no canto para não embaralhar as iniciais. */}
                <Box
                    className="token-camera"
                    sx={src || busy ? {
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        backgroundColor: `${MAP_BACKDROP}99`,
                        color: gold.bright,
                        opacity: busy ? 1 : 0,
                        transition: 'opacity 150ms',
                    } : {
                        position: 'absolute',
                        right: 4,
                        bottom: 4,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        backgroundColor: gold.bright,
                        color: MAP_BACKDROP,
                    }}
                >
                    {busy
                        ? <CircularProgress size={22} sx={{ color: gold.bright }} />
                        : <CameraIcon sx={{ fontSize: src ? 20 : 14 }} />}
                </Box>
                <input
                    ref={input}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }}
                />
            </ButtonBase>
        </Tooltip>
    )
}
