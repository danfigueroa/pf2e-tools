import { useCallback, useEffect, useState } from 'react'
import { listSheetsAndDrafts, type PublishedSummary, type SheetDraft } from '../../services/sheets'
import { onSheetNotice } from '../../services/sheetNotices'
import { onPreparationFinished } from '../../services/sheetPreparation'
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
    // Publicações em preparo (rascunhos): a ficha ainda não está na mesa.
    const [drafts, setDrafts] = useState<SheetDraft[]>([])

    useEffect(() => {
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | null = null
        const load = () => {
            listSheetsAndDrafts().then((list) => {
                if (cancelled) return
                setPublished(list.sheets)
                setDrafts(list.drafts)
            })
        }
        load()
        // Publicação ou restauração em outro aparelho: o nível dos cards acompanha. O andamento de um
        // preparo chega a cada passo; junta a rajada numa leitura só.
        const stop = onSheetNotice((notice) => {
            if (notice.kind === 'published' || notice.kind === 'prepared') load()
            else if (notice.kind === 'preparing' && !timer) timer = setTimeout(() => { timer = null; load() }, 1500)
        })
        // Sem Realtime (modo local, canal fechado), o preparo que esta aba terminou também relê.
        const stopFinished = onPreparationFinished(load)
        return () => { cancelled = true; stop(); stopFinished(); if (timer) clearTimeout(timer) }
    }, [])

    const find = useCallback(
        (preset: CharacterPreset) => published.find((p) => p.slug === charSlugFromName(preset.sheetName)) ?? null,
        [published],
    )

    /** Nível publicado, ou o do arquivo fixo. */
    const levelOf = useCallback((preset: CharacterPreset) => find(preset)?.level ?? preset.level, [find])

    /** Publicadas que não são presets da campanha (personagem novo na mesa). */
    const extras = published.filter((p) => !CAMPAIGN_SLUGS.has(p.slug))

    /** Dono da ficha publicada (`null` = sem dono ou não publicada): quem, além do GM, pode mexer nela. */
    const ownerOf = useCallback(
        (slug: string) => published.find((p) => p.slug === slug)?.ownerId ?? null,
        [published],
    )

    /** O rascunho em preparo deste personagem, ou `null`. */
    const draftOf = useCallback((slug: string) => drafts.find((d) => d.slug === slug) ?? null, [drafts])

    return { published, find, levelOf, extras, ownerOf, drafts, draftOf }
}
