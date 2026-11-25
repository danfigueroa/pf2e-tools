import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { tr } from '../../../i18n'
import { remasterCatalog } from '../rules'
import { allowedAtTable } from '../mesaRules'
import { chosenRuleIds, convertRuleIds, legacyLinks, type RemasterLink } from '../remaster'
import type { RuleEntry } from '../rules/types'
import type { SectionProps } from '../sections/types'

type Props = Pick<SectionProps, 'state' | 'core' | 'mesaRules' | 'update'> & {
    entries: RuleEntry[]
    exceptions: ReadonlySet<string>
    onClose: () => void
}

export function RemasterDialog({ state, core, entries, mesaRules, exceptions, update, onClose }: Props) {
    const [catalog, setCatalog] = useState<RemasterLink[] | null>(null)
    const [failed, setFailed] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const [selected, setSelected] = useState<Record<string, string>>({})
    useEffect(() => {
        let alive = true
        remasterCatalog(core.version).then((rows) => { if (alive) setCatalog(rows) })
            .catch(() => { if (alive) setFailed(true) })
        return () => { alive = false }
    }, [core.version, attempt])

    const links = useMemo(() => {
        const ids = chosenRuleIds(state)
        const earlier = legacyLinks([...core.classes, ...core.ancestries, ...core.heritages, ...core.backgrounds,
            ...core.classFeatures, ...core.languages, ...core.archetypes, ...entries])
        const all = new Map([...earlier, ...(catalog ?? [])].map((row) => [row.id, row]))
        return [...all.values()].filter((row) => ids.has(row.id))
    }, [state, core, entries, catalog])
    const replacements = new Map<string, string>()
    const keep = tr('Manter a versão atual', 'Keep current version')
    const value = (row: RemasterLink) => selected[row.id] ?? (row.targets.length === 1 ? row.targets[0].id : '')
    for (const row of links) {
        const id = value(row)
        if (row.targets.some((target) => target.id === id)) replacements.set(row.id, id)
    }
    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{tr('Converter para o Remaster', 'Convert to Remaster')}</DialogTitle>
            <DialogContent dividers>
                {failed && <Alert severity="warning" action={
                    <Button onClick={() => { setFailed(false); setAttempt(attempt + 1) }}>{tr('Tentar de novo', 'Try again')}</Button>
                }>{tr('Falha ao carregar o catálogo.', 'Could not load the catalog.')}</Alert>}
                {!failed && !catalog && <Typography>{tr('Carregando o catálogo…', 'Loading the catalog…')}</Typography>}
                {catalog && links.length === 0 && <Typography>
                    {tr('Nenhuma escolha deste rascunho tem uma substituição conhecida no catálogo.', 'No choice in this draft has a known replacement in the catalog.')}
                </Typography>}
                {catalog && links.length > 0 && <Stack spacing={2}>
                    <Typography>{tr('Revise as substituições no rascunho. Para atualizar a ficha publicada, use Aplicar na mesa.', 'Review the replacements in the draft. To update the published sheet, use Apply to the table.')}</Typography>
                    {links.map((row) => (
                        <TextField key={row.id} select size="small" label={row.name} value={value(row)}
                            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
                            onChange={(e) => setSelected({ ...selected, [row.id]: e.target.value })}>
                            <MenuItem value="">{keep}</MenuItem>
                            {row.targets.map((target) => {
                                const homonym = row.targets.some((other) => other.name === target.name && other.id !== target.id)
                                const blocked = !exceptions.has(target.id) && allowedAtTable({ ...target, remaster: true }, mesaRules) === false
                                return <MenuItem key={target.id} value={target.id}>
                                    {target.name}{homonym ? ` (${target.id})` : ''}{blocked ? tr(' (fora das regras)', ' (outside table rules)') : ''}
                                </MenuItem>
                            })}
                        </TextField>
                    ))}
                </Stack>}
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap' }}>
                <Button onClick={onClose}>{tr('Fechar', 'Close')}</Button>
                <Button variant="contained" disabled={!catalog || !replacements.size} onClick={() => {
                    update((current) => convertRuleIds(current, replacements))
                    onClose()
                }}>{tr('Converter no rascunho', 'Convert in draft')}</Button>
            </DialogActions>
        </Dialog>
    )
}
