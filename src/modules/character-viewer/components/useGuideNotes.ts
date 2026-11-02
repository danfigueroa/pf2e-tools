import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { MAX_GUIDE_NOTES, NO_GUIDE_NOTES, isGuideNotesEmpty, sanitizeGuideNotes, type GuideNotesStored } from '../guideNotes'

/** Os trechos do jogador no guia, compartilhados com a mesa (campo `guide`). */
export function useGuideNotes(syncKey: string) {
    const [stored, setStored] = useSharedState<GuideNotesStored>(syncKey, {
        empty: () => NO_GUIDE_NOTES,
        sanitize: sanitizeGuideNotes,
        isEmpty: isGuideNotesEmpty,
    })
    /** Texto vazio tira os trechos. */
    const setText = useCallback((text: string) => {
        const clean = text.replace(/\r\n?/g, '\n').trim().slice(0, MAX_GUIDE_NOTES)
        setStored((s) => (s.text === clean ? s : clean ? { text: clean } : NO_GUIDE_NOTES))
    }, [setStored])
    return useMemo(() => ({ text: stored.text, setText }), [stored.text, setText])
}
