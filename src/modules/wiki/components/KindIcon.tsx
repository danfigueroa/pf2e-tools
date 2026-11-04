import type { ComponentType } from 'react'
import { Box } from '@mui/material'
import {
    Article as OtherIcon, AutoAwesome as DeityIcon, Diamond as ItemIcon, Event as EventIcon, MenuBook as LoreIcon,
    Pets as CreatureIcon, Person as NpcIcon, Place as LocationIcon, Shield as FactionIcon,
} from '@mui/icons-material'
import { chrome, gold, WIKI_KIND_COLORS } from '../../../theme'
import type { WikiKind } from '../../../services/wiki'

// O ícone de cada tipo de página, no ladrilho verde da lista, dos cartões e das páginas ligadas.

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
