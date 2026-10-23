import { useState } from 'react'
import { Alert, Button, DialogActions, DialogContent, DialogTitle, Snackbar, Typography } from '@mui/material'
import { gold } from '../../../theme'
import type { BuildInfo } from '../../../pathbuilder/types'
import { actionsKeyFor, conditionsKeyFor, hpKeyFor, legacyCharKey, usesKeyFor } from '../charId'
import type { ConditionModifiers } from '../conditions'
import { characterMaxHp } from '../helpers'
import { EmbedDialog } from './EmbedDialog'
import { useActions } from './useActions'
import { useConditions } from './useConditions'
import { useHpTracker } from './useHpTracker'
import { useUses } from './useUses'

/** Orc Ferocity (Player Core pg. 72): reação, uma vez por dia, ao cair a 0 PV sem morrer na hora. */
export const ORC_FEROCITY = 'Orc Ferocity'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
    fullWidth?: boolean
}

/**
 * Orc Ferocity: "You avoid being knocked out and remain at 1 Hit Point, and your wounded condition increases
 * by 1." Paga a reação, marca o uso do dia, põe o PV em 1 e sobe o Ferido. O app não sabe quando o dano vai
 * zerar o PV, então o botão pede confirmação — e o jogador toca nele quando o mestre disser que caiu.
 */
export const OrcFerocityButton = ({ build, mods, fullWidth }: Props) => {
    const actions = useActions(actionsKeyFor(build), mods)
    const uses = useUses(usesKeyFor(build))
    const hp = useHpTracker(hpKeyFor(build), characterMaxHp(build, mods.hpMaxDelta), legacyCharKey(build))
    const conditions = useConditions(conditionsKeyFor(build), build.level ?? 1, legacyCharKey(build))
    const [open, setOpen] = useState(false)
    const [note, setNote] = useState<string | null>(null)
    const usedToday = uses.usedOf(ORC_FEROCITY) > 0
    const wounded = mods.active.find((c) => c.id === 'wounded')?.value ?? 0

    const confirm = () => {
        actions.spendReaction()
        uses.mark(ORC_FEROCITY)
        hp.restoreHp({ current: 1, temp: hp.temp })
        conditions.setCondition('wounded', wounded + 1)
        setOpen(false)
        setNote(`Orc Ferocity: você fica com 1 PV e Ferido ${wounded + 1}.`)
    }

    return (
        <>
            <Button
                size="small"
                variant={usedToday ? 'outlined' : 'contained'}
                onClick={(e) => { e.stopPropagation(); if (usedToday) uses.unmark(ORC_FEROCITY); else setOpen(true) }}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={usedToday ? 'Orc Ferocity já usada hoje — devolver' : 'Usar Orc Ferocity'}
                fullWidth={fullWidth}
                sx={{
                    flexShrink: 0,
                    fontWeight: 700,
                    ...(fullWidth ? { mb: 2, minHeight: 40 } : { minHeight: 30, px: 1.25, fontSize: '0.75rem' }),
                    ...(usedToday ? { color: gold.deep, borderColor: gold.main } : {}),
                }}
            >
                {usedToday ? 'Usada hoje ↺' : 'Usar · reação'}
            </Button>
            <EmbedDialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" onClick={(e) => e.stopPropagation()}>
                <DialogTitle sx={{ pb: 1 }}>Orc Ferocity</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        Gatilho: você cairia a 0 PV, mas não morreria na hora. Em vez disso, fica com <b>1 PV</b> e o Ferido sobe 1
                        (de {wounded} para {wounded + 1}). Gasta a reação e o uso do dia.
                    </Typography>
                    {actions.stored.reacted && <Alert severity="warning" sx={{ py: 0 }}>A reação desta rodada já foi usada. Dá para usar mesmo assim.</Alert>}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)} sx={{ mr: 'auto' }}>Cancelar</Button>
                    <Button variant="contained" onClick={confirm}>Ficar com 1 PV</Button>
                </DialogActions>
            </EmbedDialog>
            <Snackbar open={!!note} autoHideDuration={7000} onClose={() => setNote(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                {note ? <Alert severity="success" onClose={() => setNote(null)}>{note}</Alert> : undefined}
            </Snackbar>
        </>
    )
}
