import { useState } from 'react'
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    TextField,
    Typography,
} from '@mui/material'
import type { NpcShield } from '../types'
import { tr } from '../../../i18n'

const DEFAULT: NpcShield = {
    name: tr('Escudo de aço', 'Steel shield'),
    bonus: 2,
    hardness: 5,
    maxHp: 20,
    bt: 10,
    canBlock: true,
    hp: 20,
    raised: false,
}

const num = (text: string, fallback: number) => {
    const n = parseInt(text, 10)
    return Number.isFinite(n) && n >= 0 ? n : fallback
}

/**
 * O escudo de um monstro, à mão. A AON só traz os números na prosa de ~metade
 * dos monstros com Shield Block; para o resto, o GM informa — o padrão é o
 * escudo de aço do Player Core (+2, Dureza 5, PV 20, BT 10).
 */
export const NpcShieldDialog = ({ open, shield, onClose, onSave }: {
    open: boolean
    shield: NpcShield | undefined
    onClose: () => void
    /** `undefined` remove o escudo. */
    onSave: (shield: NpcShield | undefined) => void
}) => (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        {/* Remonta ao abrir: o formulário parte do escudo atual. */}
        {open && <ShieldForm shield={shield} onClose={onClose} onSave={onSave} />}
    </Dialog>
)

const ShieldForm = ({ shield, onClose, onSave }: {
    shield: NpcShield | undefined
    onClose: () => void
    onSave: (shield: NpcShield | undefined) => void
}) => {
    const start = shield ?? DEFAULT
    const [form, setForm] = useState({
        name: start.name,
        bonus: String(start.bonus),
        hardness: String(start.hardness),
        maxHp: String(start.maxHp),
        bt: String(start.bt),
        hp: String(start.hp),
        canBlock: start.canBlock,
    })
    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, '') }))

    const maxHp = Math.max(1, num(form.maxHp, start.maxHp))
    const save = () => onSave({
        name: form.name.trim() || tr('Escudo', 'Shield'),
        bonus: num(form.bonus, 2),
        hardness: num(form.hardness, 0),
        maxHp,
        bt: Math.min(maxHp, num(form.bt, Math.floor(maxHp / 2))),
        canBlock: form.canBlock,
        hp: Math.min(maxHp, num(form.hp, maxHp)),
        raised: shield?.raised ?? false,
    })

    return (
        <>
            <DialogTitle sx={{ fontWeight: 700 }}>{shield ? tr('Editar escudo', 'Edit shield') : tr('Definir escudo', 'Set shield')}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {tr('Os números estão no stat block: “steel shield (Hardness 5, HP 20, BT 10)”.', 'The numbers are in the stat block: “steel shield (Hardness 5, HP 20, BT 10)”.')}</Typography>
                <TextField
                    fullWidth
                    size="small"
                    label={tr("Nome", 'Name')}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    sx={{ mb: 1.5 }}
                />
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 1.5 }}>
                    <TextField size="small" label={tr("Bônus CA", 'AC bonus')} value={form.bonus} onChange={set('bonus')} inputProps={{ inputMode: 'numeric' }} />
                    <TextField size="small" label={tr("Dureza", 'Hardness')} value={form.hardness} onChange={set('hardness')} inputProps={{ inputMode: 'numeric' }} />
                    <TextField size="small" label={tr("PV máx.", 'Max HP')} value={form.maxHp} onChange={set('maxHp')} inputProps={{ inputMode: 'numeric' }} />
                    <TextField size="small" label="BT" value={form.bt} onChange={set('bt')} inputProps={{ inputMode: 'numeric' }} />
                    <TextField size="small" label={tr('PV atual', 'Current HP')} value={form.hp} onChange={set('hp')} inputProps={{ inputMode: 'numeric' }} />
                </Box>
                <FormControlLabel
                    sx={{ mt: 1 }}
                    control={<Checkbox checked={form.canBlock} onChange={(e) => setForm((f) => ({ ...f, canBlock: e.target.checked }))} />}
                    label={tr("Tem a reação Bloqueio com Escudo", 'Has the Shield Block reaction')}
                />
            </DialogContent>
            <DialogActions>
                {shield && (
                    <Button color="error" onClick={() => onSave(undefined)} sx={{ mr: 'auto' }}>
                        {tr('Remover', 'Remove')}</Button>
                )}
                <Button onClick={onClose}>{tr('Cancelar', 'Cancel')}</Button>
                <Button variant="contained" onClick={save}>{tr('Salvar', 'Save')}</Button>
            </DialogActions>
        </>
    )
}
