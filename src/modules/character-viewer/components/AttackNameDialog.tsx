import { useRef } from 'react'
import { Button, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { EmbedDialog } from './EmbedDialog'
import { MAX_NAME_LENGTH } from '../attackNames'

/**
 * Dar nome próprio a uma arma ou ataque. O campo NÃO é controlado (`defaultValue` + ref, lido ao
 * salvar): a mesma lição do `TranslationFix` — com o texto no estado, digitar rápido repintava o campo.
 */
export function AttackNameDialog({ open, original, current, onSave, onClose }: {
    open: boolean
    /** O nome que a ficha tem (Pathbuilder): as regras continuam sendo as dele. */
    original: string
    current: string
    onSave: (name: string) => void
    onClose: () => void
}) {
    const input = useRef<HTMLInputElement>(null)
    const save = () => { onSave(input.current?.value ?? ''); onClose() }
    return (
        <EmbedDialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>Nome próprio</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    As regras, os traços e as runas continuam sendo os de <b>{original}</b>; só o nome muda na ficha e nas rolagens da mesa.
                </Typography>
                <TextField
                    inputRef={input}
                    defaultValue={current}
                    autoFocus
                    fullWidth
                    size="small"
                    label="Nome"
                    placeholder={original}
                    slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
                />
            </DialogContent>
            <DialogActions>
                {current && (
                    <Button color="inherit" onClick={() => { onSave(''); onClose() }} sx={{ mr: 'auto' }}>
                        Voltar ao original
                    </Button>
                )}
                <Button color="inherit" onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={save}>Salvar</Button>
            </DialogActions>
        </EmbedDialog>
    )
}
