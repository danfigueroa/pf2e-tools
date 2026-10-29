import { memo, useState } from 'react'
import { Box, Button, Chip, IconButton, Paper, Stack, TextField, Typography } from '@mui/material'
import { Add as AddIcon, Check as CheckIcon, Visibility as RevealIcon, Link as LinkIcon } from '@mui/icons-material'
import { displayFont, green, parchment, rule } from '../../../theme'
import type { JournalSummary, ThreadStatus } from '../doc'
import { THREAD_COLOR, THREAD_STATUS_LABEL } from '../threadStyle'

// Ganchos e pendências da campanha ao lado da sessão: os desta sessão e os que
// seguem em aberto, para o GM não esquecer a pista que plantou três sessões atrás.


interface Props {
    docs: JournalSummary[]
    sessionId: string
    linked: string[]
    onOpen: (id: string) => void
    onLink: (id: string) => void
    onStatus: (id: string, status: ThreadStatus) => void
    onCreate: (title: string) => Promise<void>
}

function Row({ t, here, onOpen, onLink, onStatus }: {
    t: JournalSummary; here: boolean
    onOpen: (id: string) => void; onLink: (id: string) => void; onStatus: (id: string, s: ThreadStatus) => void
}) {
    const status = (t.status as ThreadStatus | null) ?? 'open'
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5, borderBottom: `1px solid ${rule}` }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: THREAD_COLOR[status], flexShrink: 0 }} />
            <Button
                onClick={() => onOpen(t.id)}
                sx={{
                    flex: 1, minWidth: 0, justifyContent: 'flex-start', textTransform: 'none', px: 0.5, py: 0.25,
                    color: status === 'resolved' ? 'text.secondary' : 'text.primary',
                    textDecoration: status === 'resolved' ? 'line-through' : 'none',
                }}
            >
                <Typography variant="body2" noWrap>{t.title}</Typography>
            </Button>
            {!here && (
                <IconButton size="small" aria-label={`Ligar "${t.title}" a esta sessão`} title="Ligar a esta sessão" onClick={() => onLink(t.id)}>
                    <LinkIcon fontSize="small" />
                </IconButton>
            )}
            {status === 'open' && (
                <IconButton size="small" aria-label={`Marcar "${t.title}" como revelado`} title="Revelado" onClick={() => onStatus(t.id, 'revealed')}>
                    <RevealIcon fontSize="small" />
                </IconButton>
            )}
            {status !== 'resolved' && (
                <IconButton size="small" aria-label={`Marcar "${t.title}" como resolvido`} title="Resolvido" onClick={() => onStatus(t.id, 'resolved')}>
                    <CheckIcon fontSize="small" />
                </IconButton>
            )}
        </Box>
    )
}

export const ThreadsPanel = memo(function ThreadsPanel({ docs, linked, onOpen, onLink, onStatus, onCreate }: Props) {
    const [title, setTitle] = useState('')
    const threads = docs.filter((d) => d.kind === 'thread').sort((a, b) => a.title.localeCompare(b.title))
    const here = threads.filter((t) => linked.includes(t.id))
    const open = threads.filter((t) => !linked.includes(t.id) && t.status !== 'resolved')

    const add = () => {
        const t = title.trim()
        if (!t) return
        setTitle('')
        void onCreate(t)
    }

    return (
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: parchment.paper, position: { xl: 'sticky' }, top: { xl: 16 } }}>
            <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: green.main, mb: 1 }}>Ganchos</Typography>
            <Typography variant="caption" color="text.secondary">Nesta sessão</Typography>
            {here.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 0.5 }}>Nenhum.</Typography>}
            {here.map((t) => <Row key={t.id} t={t} here onOpen={onOpen} onLink={onLink} onStatus={onStatus} />)}
            {open.length > 0 && (
                <>
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>Em aberto na campanha</Typography>
                    {open.map((t) => <Row key={t.id} t={t} here={false} onOpen={onOpen} onLink={onLink} onStatus={onStatus} />)}
                </>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Novo gancho, pista, segredo…"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                    onKeyDown={(e) => { if (e.key === 'Enter') add() }}
                    slotProps={{ htmlInput: { 'aria-label': 'Novo gancho' } }}
                />
                <IconButton aria-label="Criar gancho" onClick={add} disabled={!title.trim()}><AddIcon /></IconButton>
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                {(Object.keys(THREAD_STATUS_LABEL) as ThreadStatus[]).map((s) => (
                    <Chip key={s} size="small" variant="outlined" label={THREAD_STATUS_LABEL[s]}
                        icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: THREAD_COLOR[s], ml: '8px !important' }} />} />
                ))}
            </Stack>
        </Paper>
    )
})
