import { useState } from 'react'
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material'
import { Campaign as ShareIcon } from '@mui/icons-material'
import { Markdown } from '../../../components/markdown/Markdown'
import { forPlayers } from '../../../components/markdown/blocks'
import { useImageUrl } from '../../../services/images'
import { rule } from '../../../theme'

// Confirmação antes de mostrar à mesa: é exatamente isto que vai aparecer na tela
// de todos. Um toque perdido no botão de um trecho não pode revelar um segredo
// sem o GM ver o que é.

export interface RevealDraft {
    title: string
    markdown: string
    image: string | null
}

interface Props {
    draft: RevealDraft
    onClose: () => void
    onConfirm: (draft: RevealDraft) => Promise<string | null>
}

export function RevealDialog({ draft, onClose, onConfirm }: Props) {
    const [title, setTitle] = useState(draft.title)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const image = useImageUrl(draft.image)
    const text = forPlayers(draft.markdown)
    const trimmed = title.trim()

    const confirm = async () => {
        setBusy(true)
        setError(null)
        const err = await onConfirm({ title: trimmed, markdown: text, image: draft.image })
        setBusy(false)
        if (err) setError(err)
        else onClose()
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Mostrar à mesa</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Aparece na tela de todos os jogadores, em qualquer página, até eles fecharem.
                </Typography>
                <TextField
                    label="Título"
                    size="small"
                    fullWidth
                    value={title}
                    onChange={(e) => setTitle(e.target.value.replace(/[\n\r\t]/g, ' ').slice(0, 120))}
                    sx={{ mb: 2 }}
                />
                <Box sx={{ border: `1px solid ${rule}`, borderRadius: 1, p: 2, maxHeight: '50vh', overflowY: 'auto' }}>
                    {image && <Box component="img" src={image} alt={trimmed} sx={{ display: 'block', maxWidth: '100%', maxHeight: 280, mx: 'auto', mb: text ? 2 : 0, borderRadius: 1 }} />}
                    {text && <Markdown source={text} dense />}
                </Box>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" startIcon={<ShareIcon />} disabled={busy || !trimmed} onClick={() => void confirm()}>
                    Mostrar
                </Button>
            </DialogActions>
        </Dialog>
    )
}
