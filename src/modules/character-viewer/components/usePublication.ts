import { useCallback, useRef, useState } from 'react'
import {
    requestGuide,
    restoreSheet,
    saveEditedGuide,
    type GuideBases,
    type GuideText,
    type PublishedSheet,
} from '../../../services/sheets'
import type { Lang } from '../../../i18n'
import { tr } from '../../../i18n'

export type GuideStatus = 'idle' | 'generating' | 'failed'

/** O guia gerado da ficha publicada, e o que a Visão Geral precisa para pedi-lo. */
export interface GuideSlot {
    /** `null` = a ficha aberta não é a da mesa: vale o guia curado/heurístico. */
    published: PublishedSheet | null
    /** O guia gerado no idioma desta página. */
    guide: GuideText | null
    status: GuideStatus
    error: string | null
    onGenerate: () => void
    /** Grava o guia editado à mão (no idioma da página). Ausente = quem olha não pode editar a ficha. */
    onEdit?: (markdown: string) => Promise<void>
}

/**
 * A ficha publicada que está aberta, e o guia gerado para ela.
 *
 * `published` só existe quando a ficha na tela É a da mesa (carregada do
 * servidor ou recém-publicada). Quem abriu um JSON "só neste aparelho" não tem
 * publicação associada — e não vê o guia gerado para outra versão.
 */
export function usePublication() {
    const [published, setPublished] = useState<PublishedSheet | null>(null)
    const [guideStatus, setGuideStatus] = useState<GuideStatus>('idle')
    const [guideError, setGuideError] = useState<string | null>(null)

    // A geração leva até 30 s; se a pessoa trocar de personagem nesse meio
    // tempo, a resposta não pode cair na ficha errada.
    const currentSlug = useRef<string | null>(null)

    const attach = useCallback((sheet: PublishedSheet | null) => {
        currentSlug.current = sheet?.slug ?? null
        setPublished(sheet)
        setGuideStatus('idle')
        setGuideError(null)
    }, [])

    const generateGuide = useCallback(async (sheet: PublishedSheet, base: GuideBases, only?: Lang) => {
        setGuideStatus('generating')
        setGuideError(null)
        try {
            const next = await requestGuide(sheet.slug, base, only)
            if (currentSlug.current !== next.slug) return
            setPublished(next)
            setGuideStatus('idle')
        } catch (e) {
            if (currentSlug.current !== sheet.slug) return
            setGuideStatus('failed')
            setGuideError(e instanceof Error ? e.message : tr('Falha ao gerar o guia', 'Failed to generate the guide'))
        }
    }, [])

    /** O texto escrito à mão substitui o guia desta língua (a IA, na próxima vez, parte dele). Lança no erro. */
    const editGuide = useCallback(async (sheet: PublishedSheet, markdown: string) => {
        const next = await saveEditedGuide(sheet.slug, sheet.publishedAt, markdown)
        if (currentSlug.current !== next.slug) return
        setPublished(next)
    }, [])

    const restore = useCallback(async (slug: string) => {
        const sheet = await restoreSheet(slug)
        attach(sheet)
        return sheet
    }, [attach])

    return { published, guideStatus, guideError, attach, restore, generateGuide, editGuide }
}

export type PublicationApi = ReturnType<typeof usePublication>
