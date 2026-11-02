import { useRef, useState } from 'react'
import { Alert, Box, Button, DialogActions, DialogContent, DialogTitle, Tab, Tabs, TextField, Typography } from '@mui/material'
import { EmbedDialog } from './EmbedDialog'
import { GuideMarkdown } from './GuideMarkdown'
import { tr } from '../../../i18n'

interface Props {
    open: boolean
    onClose: () => void
    title: string
    /** O texto com que o editor abre. */
    initial: string
    /** O que aparece acima do campo: o que acontece com o texto. */
    hint: string
    maxLength: number
    /** Texto vazio é permitido (os trechos: vazio = apagar); o guia não pode ficar vazio. */
    allowEmpty?: boolean
    /** Grava; lança no erro (o diálogo mostra e continua aberto). */
    onSave: (text: string) => Promise<void> | void
}

/**
 * O editor do guia "Como Jogar" e dos trechos do jogador. O campo NÃO é controlado (`defaultValue` + ref, lido ao
 * salvar e ao abrir a prévia): com o valor no estado, digitar rápido num textarea do MUI repintava e remedia em laço
 * — a lição do "Corrigir tradução". A prévia usa o mesmo `GuideMarkdown` do cartão, então mostra o que vai aparecer.
 */
export function GuideEditDialog({ open, onClose, title, initial, hint, maxLength, allowEmpty = false, onSave }: Props) {
    return (
        <EmbedDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            {/* Montado só aberto: cada abertura parte do texto de agora. */}
            {open && <Body title={title} initial={initial} hint={hint} maxLength={maxLength} allowEmpty={allowEmpty} onSave={onSave} onClose={onClose} />}
        </EmbedDialog>
    )
}

const Body = ({ title, initial, hint, maxLength, allowEmpty, onSave, onClose }: Omit<Props, 'open'>) => {
    const ref = useRef<HTMLTextAreaElement | null>(null)
    const [tab, setTab] = useState<'edit' | 'preview'>('edit')
    const [preview, setPreview] = useState(initial)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const current = () => (ref.current?.value ?? initial).replace(/\r\n?/g, '\n')
    const save = async () => {
        const text = current().trim()
        if (!text && !allowEmpty) { setError(tr('O guia não pode ficar vazio.', 'The guide can\'t be empty.')); return }
        setSaving(true)
        setError(null)
        try {
            await onSave(text)
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : tr('Não deu para salvar.', 'Couldn\'t save.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <DialogTitle sx={{ pb: 0.5 }}>{title}</DialogTitle>
            <DialogContent>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{hint}</Typography>
                <Tabs
                    value={tab}
                    onChange={(_, v: 'edit' | 'preview') => { if (v === 'preview') setPreview(current()); setTab(v) }}
                    sx={{ minHeight: 36, mb: 1, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
                >
                    <Tab value="edit" label={tr('Editar', 'Edit')} />
                    <Tab value="preview" label={tr('Prévia', 'Preview')} />
                </Tabs>
                {/* O campo continua montado na prévia: desmontado, o texto voltaria ao inicial. */}
                <Box sx={{ display: tab === 'edit' ? 'block' : 'none' }}>
                    <TextField
                        inputRef={ref}
                        defaultValue={initial}
                        multiline
                        minRows={10}
                        maxRows={22}
                        fullWidth
                        slotProps={{ htmlInput: { maxLength, spellCheck: true } }}
                        sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem' } }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                        {tr('Formato: "## Título" para seção, "- " para item de lista e **negrito**. Até ', 'Format: "## Title" for a section, "- " for a list item and **bold**. Up to ')}{maxLength.toLocaleString()}{tr(' caracteres.', ' characters.')}</Typography>
                </Box>
                {tab === 'preview' && (
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, maxHeight: '55vh', overflowY: 'auto' }}>
                        {preview.trim()
                            ? <GuideMarkdown markdown={preview} />
                            : <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('(vazio)', '(empty)')}</Typography>}
                    </Box>
                )}
                {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} sx={{ mr: 'auto' }}>{tr('Cancelar', 'Cancel')}</Button>
                <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? tr('Salvando…', 'Saving…') : tr('Salvar', 'Save')}</Button>
            </DialogActions>
        </>
    )
}
