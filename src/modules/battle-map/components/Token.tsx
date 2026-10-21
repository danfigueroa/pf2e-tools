import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useTheme } from '@mui/material'
import { CELL_PX, initials } from '../geometry'
import { hpBarColor } from '../../character-viewer/components/useHpTracker'
import { useImageUrl } from '../../../services/images'
import { MAP_BACKDROP, TOKEN_NPC, TOKEN_PC, gold, mapChrome, parchment, status } from '../../../theme'
import type { TokenDescriptor } from '../../../services/maps'
import type { TokenHp } from '../hp'
import { fitStyle } from '../tokenFit'

interface Props {
    id: string
    token: TokenDescriptor
    x: number
    y: number
    hp: TokenHp | null
    /** Mostra "42/64" — no monstro, só no Modo GM. */
    showNumbers: boolean
    image: string | null
    /** Enquadramento da imagem (centro e ampliação), em números soltos para o `memo` comparar. */
    fitX: number
    fitY: number
    fitZ: number
    active: boolean
    /** Alguém (em outro aparelho) está com a ficha deste personagem aberta (`services/presence`). */
    online: boolean
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

/** Duração da troca de tamanho (Enlarge/Shrink). */
const RESIZE_MS = 900
/** Antes disso o token só está se acomodando (cache, depois o servidor) — não anima. */
const RESIZE_ARM_MS = 1000
/** Fases: até `CHARGE` o token brilha no tamanho antigo; até `SETTLE` muda; depois assenta. */
const CHARGE = 0.25
const SETTLE = 0.7
const EASE_CHANGE = 'cubic-bezier(0.3, 0, 0.2, 1)'

interface Box { px: number; inset: number; border: number }

/**
 * Anima a troca de tamanho do token — o Enlarge/Shrink ligado na Ficha
 * Virtual chega pelo poll e o token saltava de 1 para 4 quadrados num quadro.
 *
 * O tamanho novo já está no DOM quando a animação começa (o estado muda na
 * hora; a animação só apresenta): cada peça parte do desenho ANTIGO e volta ao
 * próprio estilo. O círculo brilha, muda passando um pouco do ponto e assenta,
 * com uma onda dourada que se abre (cresce) ou se fecha (encolhe). Barra e
 * nome acompanham, senão saltariam antes do círculo.
 *
 * O círculo vai por `transform` (escalar a imagem/iniciais junto), com a
 * borda compensada para não engrossar 4× no Grande → Médio. A barra vai por
 * `left/right`: escalada, o "80/120" esticava. `transform` só nas peças,
 * nunca no contêiner — ver o comentário do `Token`; as peças já têm `zIndex`,
 * então já são um contexto de empilhamento próprio e nada muda nas camadas.
 * Web Animations em vez de keyframes do Emotion porque o ponto de partida
 * depende dos dois tamanhos.
 */
function useResizeAnimation(
    box: Box,
    circle: RefObject<HTMLDivElement | null>,
    bar: RefObject<HTMLDivElement | null>,
    name: RefObject<HTMLDivElement | null>,
) {
    const prev = useRef<Box | null>(null)
    const mountedAt = useRef(0)
    const running = useRef<Animation[]>([])
    const { px, inset, border } = box

    useEffect(() => {
        mountedAt.current = performance.now()
        const list = running
        return () => list.current.forEach((a) => a.cancel())
    }, [])

    useLayoutEffect(() => {
        const old = prev.current
        prev.current = { px, inset, border }
        if (!old || (old.px === px && old.inset === inset)) return
        if (performance.now() - mountedAt.current < RESIZE_ARM_MS) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        running.current.forEach((a) => a.cancel())
        running.current = []
        const timing: KeyframeAnimationOptions = { duration: RESIZE_MS }

        const oldD = old.px - 2 * old.inset
        const newD = px - 2 * inset
        const grows = newD > oldD
        const from = oldD / newD
        const over = grows ? 1.08 : 0.93
        // Os dois círculos são concêntricos ao próprio quadrado, e o token
        // cresce para a direita e para baixo: o centro anda meia diferença.
        const shift = (old.px - px) / 2
        const startTransform = `translate(${shift}px, ${shift}px) scale(${from})`
        // Anel que se abre (cresce) ou se fecha sobre o token (encolhe), em px
        // do mundo. Tudo que tem tamanho no quadro é dividido pela escala dele,
        // senão o brilho de um Grande → Miúdo começaria 8× maior.
        const wave = Math.max(old.px, px) * 0.4
        const frame = (scale: number, halo: [number, number, string], ring: [number, string]) => ({
            borderWidth: `${border / scale}px`,
            boxShadow: `0 0 ${halo[0] / scale}px ${halo[1] / scale}px ${gold.bright}${halo[2]}`,
            outlineStyle: 'solid',
            outlineWidth: `${3 / scale}px`,
            outlineOffset: `${ring[0] / scale}px`,
            outlineColor: `${gold.bright}${ring[1]}`,
        })

        if (circle.current) {
            running.current.push(circle.current.animate([
                { transform: startTransform, ...frame(from, [0, 0, '00'], grows ? [0, '00'] : [wave, '00']) },
                {
                    offset: CHARGE,
                    easing: EASE_CHANGE,
                    transform: startTransform,
                    ...frame(from, [20, 5, 'DD'], grows ? [0, 'DD'] : [wave, '55']),
                },
                {
                    offset: SETTLE,
                    easing: 'ease-in-out',
                    transform: `scale(${over})`,
                    ...frame(over, [26, 7, 'BB'], grows ? [wave * 0.6, '77'] : [0, 'DD']),
                },
                { transform: 'none', ...frame(1, [0, 0, '00'], grows ? [wave, '00'] : [0, '00']) },
            ], timing))
        }
        if (bar.current) {
            // A barra é `left/right: 8%` do contêiner, que já tem o tamanho novo:
            // em px, o `right` antigo pode ser negativo (passa da borda), e vale.
            const oldEdges = { left: `${0.08 * old.px}px`, right: `${px - 0.92 * old.px}px` }
            running.current.push(bar.current.animate([
                oldEdges,
                { offset: CHARGE, easing: EASE_CHANGE, ...oldEdges },
                { offset: SETTLE, left: '8%', right: '8%' },
                { left: '8%', right: '8%' },
            ], timing))
        }
        if (name.current) {
            const oldPlace = `translate(calc(-50% + ${(old.px - px) / 2}px), ${old.px - px}px)`
            running.current.push(name.current.animate([
                { transform: oldPlace },
                { offset: CHARGE, easing: EASE_CHANGE, transform: oldPlace },
                { offset: SETTLE, transform: 'translateX(-50%)' },
                { transform: 'translateX(-50%)' },
            ], timing))
        }
    }, [px, inset, border, circle, bar, name])
}

export const Token = memo(function Token({ id, token, x, y, hp, showNumbers, image, fitX, fitY, fitZ, active, online }: Props) {
    const theme = useTheme()
    const src = useImageUrl(image)
    // Sem saber a proporção da imagem (ainda carregando) vale o `cover` de sempre.
    const [aspect, setAspect] = useState<{ src: string; value: number } | null>(null)
    const known = src && aspect?.src === src ? aspect.value : null
    const px = token.size * CELL_PX
    const ring = active ? gold.bright : token.kind === 'pc' ? TOKEN_PC : TOKEN_NPC
    const ratio = hp && hp.max > 0 ? Math.min(1, hp.current / hp.max) : 0
    const barColor = hp ? hpBarColor(hp.current, hp.max, theme.palette) : ''
    // Rótulos em px do mundo: crescem com o token grande, mas não com o zoom
    // de propósito — é o que faz o mapa afastado não virar uma sopa de texto.
    const font = Math.max(12, Math.min(18, px * 0.2))
    const dim = token.defeated ? 0.45 : 1
    // Miúdo ocupa o quadrado inteiro (alvo de toque), mas o círculo é metade.
    const inset = token.tiny ? px * 0.25 : 3
    const circleRef = useRef<HTMLDivElement>(null)
    const barRef = useRef<HTMLDivElement>(null)
    const nameRef = useRef<HTMLDivElement>(null)
    const border = active ? 4 : 3
    useResizeAnimation({ px, inset, border }, circleRef, barRef, nameRef)

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
            {online && (
                // O ponto verde da sidebar: o jogador deste personagem está com a ficha aberta.
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        zIndex: Z_NAME,
                        right: inset,
                        top: inset,
                        width: Math.max(10, px * 0.16),
                        height: Math.max(10, px * 0.16),
                        borderRadius: '50%',
                        background: status.success,
                        border: `2px solid ${mapChrome.outline}`,
                    }}
                />
            )}
            {hp && (
                <div
                    ref={barRef}
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
                ref={circleRef}
                style={{
                    position: 'absolute',
                    zIndex: Z_TOKEN,
                    inset,
                    opacity: dim,
                    borderRadius: '50%',
                    border: `${border}px solid ${ring}`,
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
                        onLoad={(e) => {
                            const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                            if (w > 0 && h > 0) setAspect({ src, value: w / h })
                        }}
                        style={known === null
                            ? { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }
                            : { position: 'absolute', ...fitStyle({ x: fitX, y: fitY, z: fitZ }, known), maxWidth: 'none', pointerEvents: 'none' }}
                    />
                ) : (
                    <span
                        style={{
                            color: parchment.page,
                            fontWeight: 700,
                            fontSize: (px - 2 * inset) * 0.32,
                            letterSpacing: '0.02em',
                            userSelect: 'none',
                        }}
                    >
                        {initials(token.name)}
                    </span>
                )}
            </div>

            <div
                ref={nameRef}
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
