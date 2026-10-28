import { useEffect, useState } from 'react'
import { Alert, Button, CircularProgress } from '@mui/material'
import { fetchPublished, type PublishedSheet } from '../../../services/sheets'
import { onSheetNotice, useLatestPublished } from '../../../services/sheetNotices'
import { currentUserId } from '../../../services/supabase'
import { VIEW_OK } from '../sheetAccess'

interface Props {
    slug: string
    /** A versão da mesa que está aberta; `null` = arquivo fixo ou JSON "só neste aparelho". */
    published: PublishedSheet | null
    /** Troca a ficha aberta pela versão nova (quem hospeda sabe trocar). */
    onOpen: (sheet: PublishedSheet) => void
    /** O guia da MESMA versão ficou pronto em outro aparelho: entra sem aviso. */
    onGuide: (sheet: PublishedSheet) => void
}

/**
 * "Nova versão publicada": quem está com a ficha aberta numa versão mais velha fica
 * sabendo na hora (canal `sheets`, `services/sheetNotices`), em vez de jogar o
 * nível 10 com a mesa no 11. Nada troca sozinho — no meio de um turno, a ficha
 * mudando embaixo do dedo seria pior; o botão abre a nova.
 */
export const NewVersionBar = ({ slug, published, onOpen, onGuide }: Props) => {
    const latest = useLatestPublished(slug)
    const [busy, setBusy] = useState(false)
    const [failed, setFailed] = useState(false)

    // O guia gerado chega 5–30 s depois da publicação: quem abriu a versão nova antes dele o recebe aqui.
    const openedAt = published?.publishedAt ?? null
    useEffect(() => onSheetNotice((notice) => {
        if (notice.kind !== 'guide' || notice.slug !== slug || notice.publishedAt !== openedAt) return
        void fetchPublished(slug).then((sheet) => { if (sheet && sheet.publishedAt === openedAt) onGuide(sheet) })
    }), [slug, openedAt, onGuide])

    const newer = latest
        && latest.publishedAt > (published?.publishedAt ?? 0)
        // A publicação deste aparelho: a ficha já é a nova (ou vai ser, quando a resposta chegar).
        && !(latest.by && latest.by === currentUserId())
    if (!newer) return null

    const open = async () => {
        setBusy(true)
        setFailed(false)
        const sheet = await fetchPublished(slug).catch(() => null)
        setBusy(false)
        if (sheet) onOpen(sheet)
        else setFailed(true)
    }

    return (
        <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={(
                <Button color="inherit" size="small" onClick={open} disabled={busy} {...VIEW_OK}
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}>
                    Abrir a nova versão
                </Button>
            )}
        >
            {published
                ? `Nova versão da ficha publicada pela mesa${latest.level ? ` (nível ${latest.level})` : ''}.`
                : `A mesa publicou uma versão desta ficha${latest.level ? ` (nível ${latest.level})` : ''}.`}
            {failed && ' Não deu para abrir — tente de novo.'}
        </Alert>
    )
}
