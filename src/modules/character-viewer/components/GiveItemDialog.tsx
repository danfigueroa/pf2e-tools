import { useEffect, useState } from 'react'
import {
    Button, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText,
    TextField, Typography,
} from '@mui/material'
import { EmbedDialog } from './EmbedDialog'
import type { RosterEntry } from '../useRoster'
import { tr } from '../../../i18n'

interface Props {
    /** O item a passar; `null` = fechado. */
    item: { name: string; max: number } | null
    /** Colegas que podem receber (sem o próprio personagem). */
    roster: RosterEntry[]
    /** Quem já passou este item a mim e quanto — vêm primeiro, para devolver. */
    holders: { slug: string; n: number }[]
    onClose: () => void
    onConfirm: (to: RosterEntry, n: number) => void
}

/** Passar um consumível a um colega: quem recebe e quantos. */
export const GiveItemDialog = ({ item, roster, holders, onClose, onConfirm }: Props) => {
    const [to, setTo] = useState('')
    const [qty, setQty] = useState('1')

    useEffect(() => {
        if (!item) return
        setTo(holders[0]?.slug ?? '')
        setQty('1')
    }, [item, holders])

    // Quem passou o item a mim sobe para o topo: devolver é o caso mais comum.
    const heldBy = new Map(holders.map((h) => [h.slug, h.n]))
    const sorted = [...roster].sort((a, b) => (heldBy.has(b.slug) ? 1 : 0) - (heldBy.has(a.slug) ? 1 : 0))

    const max = item?.max ?? 1
    const n = Math.floor(Number(qty))
    const valid = !!to && n >= 1 && n <= max
    const target = roster.find((r) => r.slug === to)

    return (
        <EmbedDialog open={!!item} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{tr('Passar ', 'Give ')}{item?.name}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {tr('O item sai do seu inventário e vai para o do colega; ele pode usar ou devolver.', 'The item leaves your inventory and goes to your teammate\'s; they can use it or give it back.')}</Typography>
                <List dense disablePadding sx={{ mb: 2 }}>
                    {sorted.map((r) => (
                        <ListItemButton key={r.slug} selected={r.slug === to} onClick={() => setTo(r.slug)}>
                            <ListItemText
                                primary={r.label}
                                secondary={[r.meta, heldBy.has(r.slug) ? tr(`passou ${heldBy.get(r.slug)} a você`, `gave you ${heldBy.get(r.slug)}`) : '']
                                    .filter(Boolean).join(' · ')}
                            />
                        </ListItemButton>
                    ))}
                    {sorted.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', px: 2 }}>
                            {tr('Nenhum outro personagem na mesa.', 'No other character at the table.')}</Typography>
                    )}
                </List>
                <TextField
                    label={tr("Quantidade", 'Amount')}
                    type="number"
                    size="small"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    slotProps={{ htmlInput: { min: 1, max, inputMode: 'numeric' } }}
                    helperText={tr(`Você tem ${max}.`, `You have ${max}.`)}
                    error={qty !== '' && !valid && !!to}
                    fullWidth
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{tr('Cancelar', 'Cancel')}</Button>
                <Button
                    variant="contained"
                    disabled={!valid}
                    onClick={() => { if (target) onConfirm(target, n) }}
                >
                    {tr('Passar', 'Give')}</Button>
            </DialogActions>
        </EmbedDialog>
    )
}
