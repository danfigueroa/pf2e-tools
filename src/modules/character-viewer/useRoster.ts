import { useMemo } from 'react'
import { charSlugFromName } from './charId'
import { CAMPAIGN_PRESETS } from './campaignPresets'
import { usePublishedSheets } from './usePublishedSheets'

export interface RosterEntry {
    slug: string
    label: string
    /** "Classe · nível N" — vazio quando a ficha publicada não diz. */
    meta: string
}

/**
 * Os personagens da mesa: os presets da campanha (com classe e nível atuais) e,
 * depois, quem foi publicado e não é preset. É a lista de quem pode receber um
 * item, e a que o painel do mapa usa para escolher a ficha.
 */
export function useRoster(): RosterEntry[] {
    const { levelOf, extras } = usePublishedSheets()
    return useMemo(() => [
        ...CAMPAIGN_PRESETS.map((p) => ({
            slug: charSlugFromName(p.sheetName),
            label: p.name,
            meta: `${p.class} · nível ${levelOf(p)}`,
        })),
        ...extras.map((s) => ({ slug: s.slug, label: s.name, meta: s.level ? `Nível ${s.level}` : '' })),
    ], [levelOf, extras])
}
