import { useEffect, useMemo, useState } from 'react'
import { Box, ListItemButton, Typography } from '@mui/material'
import { fetchWikiRecent, type WikiChange, type WikiSummary } from '../../../services/wiki'
import { displayFont, greenInk, ink, rule } from '../../../theme'
import { authorName, formatWhen } from '../useWiki'
import { tr } from '../../../i18n'

// As mudanças recentes da Wiki (o atalho "Recentes" do Início).

/** As últimas versões gravadas na mesa, de todas as páginas, com quem as gravou. */
export function RecentChanges({ pages, authors, onOpen, limit = 40 }: {
    pages: WikiSummary[]
    authors: Record<string, string>
    onOpen: (id: string) => void
    limit?: number
}) {
    const [changes, setChanges] = useState<WikiChange[] | null>(null)
    const [names, setNames] = useState<Record<string, string>>({})
    // Relê quando o índice muda (alguém gravou): o índice já assina o aviso do banco.
    const stamp = useMemo(() => Math.max(0, ...pages.map((p) => p.updatedAt)), [pages])
    useEffect(() => {
        let live = true
        void fetchWikiRecent().then((out) => {
            if (!live) return
            setChanges(out?.changes ?? [])
            setNames(out?.authors ?? {})
        })
        return () => { live = false }
    }, [stamp])

    if (!changes) return <Typography variant="body2" color="text.secondary">{tr('Carregando…', 'Loading…')}</Typography>
    if (!changes.length) {
        return <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Nada escrito ainda.', 'Nothing written yet.')}</Typography>
    }
    const all = { ...authors, ...names }
    return (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {changes.slice(0, limit).map((c) => (
                <Box component="li" key={`${c.page}:${c.rev}`} sx={{ borderBottom: `1px solid ${rule}`, '&:last-child': { borderBottom: 0 } }}>
                    <ListItemButton onClick={() => onOpen(c.page)} sx={{ px: 1, py: 0.75, borderRadius: 1, display: 'block' }}>
                        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: greenInk.main, fontSize: '0.95rem' }}>{c.title}</Typography>
                        <Typography variant="caption" sx={{ color: ink.secondary }}>
                            {c.rev === 1 ? tr('Criada por ', 'Created by ') : tr('Alterada por ', 'Edited by ')}
                            <Box component="span" sx={{ fontWeight: 700, color: ink.primary }}>{authorName(all, c.by)}</Box>
                            {` · ${formatWhen(c.at)}`}
                        </Typography>
                    </ListItemButton>
                </Box>
            ))}
        </Box>
    )
}
