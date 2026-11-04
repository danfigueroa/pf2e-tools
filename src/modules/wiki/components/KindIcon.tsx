import type { ComponentType } from 'react'
import { Box } from '@mui/material'
import {
    Article as OtherIcon, AutoAwesome as DeityIcon, Diamond as ItemIcon, Event as EventIcon, MenuBook as LoreIcon,
    Pets as CreatureIcon, Person as NpcIcon, Place as LocationIcon, Shield as FactionIcon,
} from '@mui/icons-material'
import { chrome, gold, greenInk, isDark, status, WIKI_KIND_COLORS } from '../../../theme'
import type { WikiKind, WikiSummary } from '../../../services/wiki'
import { useImageUrl } from '../../../services/images'

// O ícone e a cor de cada tipo de página (ladrilho, miniatura sem imagem, capa do cartão) e as pílulas
// de situação/atitude que a lista e os cartões mostram.

const ICONS: Record<WikiKind, ComponentType<{ sx?: object; fontSize?: 'inherit' | 'small' | 'medium' | 'large' }>> = {
    npc: NpcIcon, location: LocationIcon, item: ItemIcon, creature: CreatureIcon, faction: FactionIcon,
    deity: DeityIcon, event: EventIcon, lore: LoreIcon, other: OtherIcon,
}

export function KindGlyph({ kind }: { kind: WikiKind }) {
    const Icon = ICONS[kind]
    return <Icon sx={{ fontSize: 15, color: gold.bright }} />
}

export function KindTile({ kind, size = 44 }: { kind: WikiKind; size?: number }) {
    const Icon = ICONS[kind]
    return (
        <Box aria-hidden="true" sx={{
            width: size, height: size, borderRadius: `${Math.round(size / 3.6)}px`, flex: 'none', bgcolor: WIKI_KIND_COLORS[kind],
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: chrome.onAccent,
        }}>
            <Icon sx={{ fontSize: size * 0.5, color: chrome.onAccent }} />
        </Box>
    )
}

/**
 * A imagem da página, ou, sem imagem, o fundo pontilhado na cor do tipo com o ícone no meio. `round` é o
 * avatar redondo da árvore; `cover` é a capa do cartão do Início.
 */
export function PageThumb({ page, size, height, round = false, cover = false, ring = false }: {
    page: Pick<WikiSummary, 'kind' | 'image'>
    size: number
    height?: number
    round?: boolean
    cover?: boolean
    ring?: boolean
}) {
    const url = useImageUrl(page.image)
    const color = WIKI_KIND_COLORS[page.kind]
    const Icon = ICONS[page.kind]
    const h = height ?? size
    const radius = round ? 999 : cover ? 0 : 12
    if (url) {
        return (
            <Box component="img" src={url} alt="" loading="lazy" sx={{
                display: 'block', width: cover ? 1 : size, height: h, flex: 'none', objectFit: 'cover', objectPosition: 'center 18%',
                borderRadius: `${radius}px`, boxShadow: ring ? `0 0 0 2px ${gold.bright}` : 'none',
            }} />
        )
    }
    const disc = cover ? 76 : 0
    return (
        <Box aria-hidden="true" sx={{
            width: cover ? 1 : size, height: h, flex: 'none', borderRadius: `${radius}px`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            // No escuro, o tom claro da cor do tipo some no fundo: a miniatura vira o ladrilho cheio.
            bgcolor: isDark && !cover ? color : `${color}24`,
            ...(round || (isDark && !cover) ? {} : { backgroundImage: `radial-gradient(circle at 1px 1px, ${color}40 1px, transparent 0)`, backgroundSize: cover ? '18px 18px' : '12px 12px' }),
        }}>
            {cover
                ? (
                    <Box sx={{ width: disc, height: disc, borderRadius: 999, bgcolor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 8px ${color}26` }}>
                        <Icon sx={{ fontSize: 34, color: chrome.onAccent }} />
                    </Box>
                )
                : <Icon sx={{ fontSize: Math.round(size * (round ? 0.55 : 0.42)), color: isDark ? chrome.onAccent : color }} />}
        </Box>
    )
}

/** O quadradinho colorido do tipo, no cabeçalho de cada grupo da lista. */
export function KindSwatch({ kind, size = 22 }: { kind: WikiKind; size?: number }) {
    const Icon = ICONS[kind]
    return (
        <Box aria-hidden="true" sx={{ width: size, height: size, borderRadius: `${Math.round(size / 3.6)}px`, flex: 'none', bgcolor: WIKI_KIND_COLORS[kind], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon sx={{ fontSize: Math.round(size * 0.6), color: chrome.onAccent }} />
        </Box>
    )
}

/** Situação (com o ponto) e atitude, pequenas, sobre o pergaminho. */
export function PageBadges({ badges, size = 'small' }: { badges: WikiSummary['badges']; size?: 'small' | 'medium' }) {
    if (!badges?.status && !badges?.attitude) return null
    const h = size === 'small' ? 22 : 24
    const pill = { display: 'inline-flex', alignItems: 'center', gap: 0.6, height: h, px: 1, borderRadius: 999, fontSize: '0.75rem', whiteSpace: 'nowrap' } as const
    const alive = /^(viv|aliv)/i.test(badges.status ?? '')
    return (
        <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {badges.status && (
                <Box component="span" sx={{ ...pill, fontWeight: 600, bgcolor: `${alive ? status.success : greenInk.light}1F`, color: greenInk.main }}>
                    <Box component="span" aria-hidden="true" sx={{ width: 6, height: 6, borderRadius: 999, bgcolor: alive ? status.success : greenInk.light }} />
                    {badges.status}</Box>
            )}
            {badges.attitude && (
                <Box component="span" sx={{ ...pill, fontWeight: 700, bgcolor: `${gold.bright}38`, color: gold.deep }}>{badges.attitude}</Box>
            )}
        </Box>
    )
}
