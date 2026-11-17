import { useState } from 'react'
import {
    Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material'
import { foldName } from '../../../components/markdown/blocks'
import type { WikiAon, WikiKind } from '../../../services/wiki'
import { AonCreatureSearch } from '../../initiative-tracker/components/AonCreatureSearch'
import { parchment, rule, ink } from '../../../theme'
import { AON_KINDS, INFOBOX, joinMulti, multiValues, type FieldDef } from '../kinds'
import { tr } from '../../../i18n'

// A "Ficha rápida" de um tipo (os campos do `INFOBOX` e a criatura da AON), a mesma no editor da Wiki e
// na ficha do catálogo do Diário: as duas guardam o mesmo modelo, e a ficha vai inteira para a Wiki.

interface QuickFactsProps {
    kind: WikiKind
    fields: Record<string, string>
    aon: WikiAon | null
    /** Os títulos que os campos de link oferecem (viram `[[Título]]`). */
    titles: string[]
    onField: (key: string, value: string) => void
    onAon: (aon: WikiAon | null) => void
}

export function QuickFacts({ kind, fields, aon, titles, onField, onAon }: QuickFactsProps) {
    const defs = INFOBOX[kind]
    const hasAon = AON_KINDS.includes(kind)
    if (defs.length === 0 && !hasAon) return null
    return (
        <Box sx={{ mb: 2, p: 1.5, border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.page }}>
            <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {tr('Ficha rápida', 'Quick facts')}</Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', mt: 1 }}>
                {defs.map((f) => (
                    <FieldInput key={f.key} def={f} value={fields[f.key] ?? ''} titles={titles} onChange={(v) => onField(f.key, v)} />
                ))}
            </Box>
            {hasAon && <AonPicker aon={aon} onChange={onAon} />}
        </Box>
    )
}

function FieldInput({ def, value, titles, onChange }: { def: FieldDef; value: string; titles: string[]; onChange: (v: string) => void }) {
    if (def.options && def.multi) {
        const options = def.options
        const on = multiValues(value)
        const toggle = (o: string) => onChange(joinMulti(on.includes(o) ? on.filter((x) => x !== o) : [...on, o], options))
        return (
            <Box role="group" aria-label={def.label} sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="caption" component="div" sx={{ color: ink.secondary, mb: 0.5 }}>{def.label}</Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {options.map((o) => (
                        <Chip
                            key={o}
                            size="small"
                            label={o}
                            color={on.includes(o) ? 'primary' : 'default'}
                            variant={on.includes(o) ? 'filled' : 'outlined'}
                            aria-pressed={on.includes(o)}
                            onClick={() => toggle(o)}
                        />
                    ))}
                    {on.filter((v) => !options.includes(v)).map((v) => (
                        <Chip key={v} size="small" label={v} onDelete={() => toggle(v)} />
                    ))}
                </Stack>
            </Box>
        )
    }
    if (def.options) {
        return (
            <TextField
                select
                size="small"
                label={def.label}
                value={def.options.includes(value) || !value ? value : ''}
                onChange={(e) => onChange(e.target.value)}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
                <option value="">—</option>
                {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </TextField>
        )
    }
    if (def.link) {
        const linkOptions = titles.map((t) => `[[${t}]]`)
        return (
            <Autocomplete
                freeSolo
                size="small"
                options={linkOptions}
                value={value}
                onChange={(_, v) => onChange((v ?? '').slice(0, 300))}
                onInputChange={(_, v, reason) => { if (reason === 'input') onChange(v.slice(0, 300)) }}
                filterOptions={(opts, { inputValue }) => {
                    const q = foldName(inputValue.replace(/[[\]]/g, ''))
                    return q ? opts.filter((o) => foldName(o).includes(q)).slice(0, 20) : opts.slice(0, 20)
                }}
                renderInput={(params) => <TextField {...params} label={def.label} placeholder={tr('[[Página]] ou texto', '[[Page]] or text')} />}
            />
        )
    }
    return (
        <TextField
            size="small"
            label={def.label}
            value={value}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value.replace(/[\n\r\t]/g, ' ').slice(0, 300))}
        />
    )
}

/** A ficha da AON ligada (criatura ou NPC com stat block): buscar, trocar, tirar. */
function AonPicker({ aon, onChange }: { aon: WikiAon | null; onChange: (aon: WikiAon | null) => void }) {
    const [open, setOpen] = useState(false)
    return (
        <Box sx={{ mt: 1.5 }}>
            {aon
                ? (
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip label={`${aon.name}${aon.level !== null ? tr(` · nível ${aon.level}`, ` · level ${aon.level}`) : ''}`} onDelete={() => onChange(null)} />
                        <Button size="small" onClick={() => setOpen(true)}>{tr('Trocar criatura da AON', 'Change AON creature')}</Button>
                    </Stack>
                )
                : <Button size="small" onClick={() => setOpen(true)}>{tr('Ligar à ficha da AON', 'Link to the AON sheet')}</Button>}
            {open && (
                <Dialog open onClose={() => setOpen(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{tr('Criatura da AON', 'AON creature')}</DialogTitle>
                    <DialogContent>
                        <AonCreatureSearch onPick={(c) => {
                            onChange({ name: c.name, level: c.level, url: c.url || null, traits: c.traits.slice(0, 16) })
                            setOpen(false)
                        }} />
                    </DialogContent>
                    <DialogActions><Button onClick={() => setOpen(false)}>{tr('Fechar', 'Close')}</Button></DialogActions>
                </Dialog>
            )}
        </Box>
    )
}
