import { memo } from 'react'
import { useTheme } from '@mui/material'
import { CELL_PX, initials } from '../geometry'
import { hpBarColor } from '../../character-viewer/components/useHpTracker'
import { useImageUrl } from '../../../services/images'
import { MAP_BACKDROP, TOKEN_NPC, TOKEN_PC, gold, mapChrome, parchment } from '../../../theme'
import type { TokenDescriptor } from '../../../services/maps'
import type { TokenHp } from '../hp'

interface Props {
    id: string
    token: TokenDescriptor
    x: number
    y: number
    hp: TokenHp | null
    /** Mostra "42/64" — no monstro, só no Modo GM. */
    showNumbers: boolean
    image: string | null
    active: boolean
}

/**
 * Um token. Memoizado: arrastar um token, ou o poll trazer o PV de outro,
 * não repinta os demais. Durante o arrasto é o `MapCanvas` que escreve a
 * posição direto no DOM — o React só fica sabendo no soltar.
 *
 * A posição é `left/top` e NÃO `transform` de propósito, e a opacidade do
 * derrotado vai nas peças, não no contêiner: os dois criariam um contexto de
 * empilhamento por token, e aí o token de baixo cobriria a barra de PV do de
 * cima. Sem contexto próprio, as camadas valem para o mapa inteiro — toda barra
 * (`Z_BAR`) acima de todo nome (`Z_NAME`), acima de todo token.
 */
const Z_TOKEN = 1
const Z_NAME = 2
const Z_BAR = 3

export const Token = memo(function Token({ id, token, x, y, hp, showNumbers, image, active }: Props) {
    const theme = useTheme()
    const src = useImageUrl(image)
    const px = token.size * CELL_PX
    const ring = active ? gold.bright : token.kind === 'pc' ? TOKEN_PC : TOKEN_NPC
    const ratio = hp && hp.max > 0 ? Math.min(1, hp.current / hp.max) : 0
    const barColor = hp ? hpBarColor(hp.current, hp.max, theme.palette) : ''
    // Rótulos em px do mundo: crescem com o token grande, mas não com o zoom
    // de propósito — é o que faz o mapa afastado não virar uma sopa de texto.
    const font = Math.max(12, Math.min(18, px * 0.2))
    const dim = token.defeated ? 0.45 : 1

    return (
        <div
            data-token-id={id}
            style={{
                position: 'absolute',
                width: px,
                height: px,
                left: x * CELL_PX,
                top: y * CELL_PX,
                cursor: 'grab',
                touchAction: 'none',
            }}
        >
            {hp && (
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        zIndex: Z_BAR,
                        left: '8%',
                        right: '8%',
                        top: -14,
                        height: showNumbers ? 14 : 7,
                        borderRadius: 7,
                        background: mapChrome.track,
                        border: `1px solid ${mapChrome.outline}`,
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ width: `${ratio * 100}%`, height: '100%', background: barColor }} />
                    {showNumbers && (
                        <span
                            style={{
                                position: 'absolute',
                                inset: 0,
                                fontSize: 11,
                                lineHeight: '12px',
                                fontWeight: 700,
                                color: mapChrome.text,
                                textAlign: 'center',
                                textShadow: `0 0 2px ${mapChrome.outline}, 0 0 2px ${mapChrome.outline}`,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {hp.current}/{hp.max}{hp.temp > 0 ? ` +${hp.temp}` : ''}
                        </span>
                    )}
                </div>
            )}

            <div
                style={{
                    position: 'absolute',
                    zIndex: Z_TOKEN,
                    inset: 3,
                    opacity: dim,
                    borderRadius: '50%',
                    border: `${active ? 4 : 3}px solid ${ring}`,
                    boxShadow: active
                        ? `0 0 0 2px ${mapChrome.outline}, 0 0 14px 4px ${gold.bright}`
                        : '0 2px 6px rgba(0, 0, 0, 0.6)',
                    background: MAP_BACKDROP,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {src ? (
                    <img
                        src={src}
                        alt=""
                        draggable={false}
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    />
                ) : (
                    <span
                        style={{
                            color: parchment.page,
                            fontWeight: 700,
                            fontSize: px * 0.3,
                            letterSpacing: '0.02em',
                            userSelect: 'none',
                        }}
                    >
                        {initials(token.name)}
                    </span>
                )}
            </div>

            <div
                style={{
                    position: 'absolute',
                    zIndex: Z_NAME,
                    opacity: dim,
                    top: px - 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    maxWidth: Math.max(px * 1.8, 120),
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: `${mapChrome.label}CC`,
                    color: mapChrome.text,
                    fontSize: font,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                {token.name}
            </div>
        </div>
    )
})
