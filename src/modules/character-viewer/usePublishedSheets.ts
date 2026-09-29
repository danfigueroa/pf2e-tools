import { useCallback, useEffect, useState } from 'react'
import { listPublished, type PublishedSummary } from '../../services/sheets'
import { charSlugFromName } from './charId'
import { CAMPAIGN_PRESETS, type CharacterPreset } from './campaignPresets'

const CAMPAIGN_SLUGS = new Set(CAMPAIGN_PRESETS.map((p) => charSlugFromName(p.sheetName)))

/**
 * As fichas publicadas pela mesa, para os cards de personagem mostrarem o
 * nível ATUAL — o `level` de `CAMPAIGN_PRESETS` é o do arquivo fixo, e
 * depois de um level-up publicado ele mentiria.
 */
export function usePublishedSheets() {
    const [published, setPublished] = useState<PublishedSummary[]>([])

    useEffect(() => {
        let cancelled = false
        listPublished().then((list) => { if (!cancelled) setPublished(list) })
        return () => { cancelled = true }
    }, [])

    const find = useCallback(
        (preset: CharacterPreset) => published.find((p) => p.slug === charSlugFromName(preset.sheetName)) ?? null,
        [published],
    )

    /** Nível publicado, ou o do arquivo fixo. */
    const levelOf = useCallback((preset: CharacterPreset) => find(preset)?.level ?? preset.level, [find])

    /** Publicadas que não são presets da campanha (personagem novo na mesa). */
    const extras = published.filter((p) => !CAMPAIGN_SLUGS.has(p.slug))

    return { published, find, levelOf, extras }
}
