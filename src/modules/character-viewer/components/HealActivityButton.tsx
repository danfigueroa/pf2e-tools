import { useMemo, useState } from 'react'
import {
    Alert, Button, DialogActions, DialogContent, DialogTitle, FormControlLabel, Snackbar, Stack, Switch, Typography,
} from '@mui/material'
import { gold } from '../../../theme'
import type { BuildInfo } from '../../../pathbuilder/types'
import { postRoll } from '../../../services/rolls'
import { rollDie, rollGroups } from '../../../dice/roll'
import { actionsKeyFor, conditionsKeyFor, hpKeyFor, legacyCharKey, usesKeyFor } from '../charId'
import type { ConditionModifiers } from '../conditions'
import { characterMaxHp } from '../helpers'
import {
    UNSTABLE_BROKEN, unstableBurn, unstableDc, unstableOutcome, type HealActivity,
} from '../healActivities'
import { healRoll, rollerIdentity } from '../rolls'
import { EmbedDialog } from './EmbedDialog'
import { useActions } from './useActions'
import { useHpTracker } from './useHpTracker'
import { useUses } from './useUses'
import { useConditions } from './useConditions'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
    activity: HealActivity
    fullWidth?: boolean
}

const OUTCOME_TEXT = {
    success: 'passou',
    failure: 'falhou: a inovação pifou',
    critFailure: 'falha crítica: a inovação pifou e você se queimou',
} as const

/**
 * Cura que é uma ação do personagem (`healActivities.ts`): paga a ação, rola os dados, soma ao PV de
 * quem usa ("Em mim mesmo") ou só manda a rolagem para a mesa, e marca o "1× por dia". O teste
 * simples do traço Unstable sai no mesmo clique, e a falha deixa a inovação "pifada" até alguém
 * devolver — o app não conta os 10 minutos de reajuste.
 */
export const HealActivityButton = ({ build, mods, activity, fullWidth }: Props) => {
    const actions = useActions(actionsKeyFor(build), mods)
    const uses = useUses(usesKeyFor(build))
    const maxHp = characterMaxHp(build, mods.hpMaxDelta)
    const hp = useHpTracker(hpKeyFor(build), maxHp, legacyCharKey(build))
    const conditions = useConditions(conditionsKeyFor(build), build.level ?? 1, legacyCharKey(build))
    const who = useMemo(() => rollerIdentity(build), [build])
    const [open, setOpen] = useState(false)
    const [onSelf, setOnSelf] = useState(true)
    const [note, setNote] = useState<{ text: string; warn: boolean } | null>(null)

    const usedToday = activity.daily && uses.usedOf(activity.key) > 0
    const broken = activity.unstable && uses.usedOf(UNSTABLE_BROKEN) > 0
    const lacking = actions.missing(activity.actions, 'any')
    const dc = unstableDc(build)
    const costLabel = activity.time ?? `${activity.actions} ${activity.actions === 1 ? 'ação' : 'ações'}`

    const roll = () => {
        if (activity.actions > 0) actions.spend(activity.actions, 'any')
        if (activity.daily) uses.mark(activity.key)
        const rolled = rollGroups([{ count: activity.count, faces: activity.faces }], activity.flat)
        const lines = [activity.note]
        let burn = 0
        let warn = false
        if (activity.unstable && !broken) {
            const d20 = rollDie(20)
            const outcome = unstableOutcome(d20, dc)
            lines.push(`Unstable: teste simples CD ${dc} — ${d20} ${OUTCOME_TEXT[outcome]}.`)
            if (outcome !== 'success') {
                uses.mark(UNSTABLE_BROKEN)
                warn = true
                lines.push('Sem ações Unstable até reajustar a inovação (10 minutos).')
            }
            if (outcome === 'critFailure') {
                burn = unstableBurn(build.level ?? 1)
                lines.push(`Dano de fogo em você: ${burn} (metade do nível).`)
            }
        } else if (activity.unstable) {
            lines.push('A inovação estava pifada: a cura vale, mas sem o efeito Unstable do talento.')
        }
        // Word of Faith: quem recebe a cura reduz o Amedrontado em 1 (aqui, só quando é você).
        const frightened = mods.active.find((c) => c.id === 'frightened')?.value ?? 0
        if (activity.reducesFrightened) {
            if (onSelf && frightened > 0) {
                conditions.setCondition('frightened', frightened - 1)
                lines.push(`Amedrontado ${frightened} → ${frightened - 1}.`)
            } else if (!onSelf) {
                lines.push('O aliado reduz o Amedrontado dele em 1.')
            }
        }
        void postRoll(healRoll(who, activity.name, `Cura ${activity.formula}`, rolled, onSelf ? 'em si mesma' : 'em um aliado adjacente', lines.join(' ').slice(0, 480)))
        // Cura e queimadura numa escrita só de PV: duas seguidas partiriam do PV de antes do clique.
        if (onSelf || burn) {
            let { current, temp } = hp
            if (onSelf) current = Math.min(maxHp, current + rolled.total)
            if (burn) {
                const absorbed = Math.min(temp, burn)
                temp -= absorbed
                current = Math.max(0, current - (burn - absorbed))
            }
            if (current !== hp.current || temp !== hp.temp) hp.restoreHp({ current, temp })
        }
        setOpen(false)
        const spent = `${activity.formula} = ${rolled.total}`
        setNote({
            text: `${activity.name}: ${spent}${onSelf ? ` em você (PV ${Math.min(maxHp, hp.current + rolled.total)})` : ''}${lines.length > 1 ? ` — ${lines.slice(1).join(' ')}` : ''}`,
            warn: warn || lacking > 0,
        })
    }

    const click = (e: React.MouseEvent) => {
        // A linha inteira abre a descrição: o botão não pode abri-la junto.
        e.stopPropagation()
        if (usedToday) { uses.unmark(activity.key); return }
        setOpen(true)
    }

    return (
        <>
            <Button
                size="small"
                variant={usedToday ? 'outlined' : 'contained'}
                onClick={click}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={usedToday ? `${activity.name} já usada hoje — devolver` : `Curar com ${activity.name}`}
                fullWidth={fullWidth}
                sx={{
                    flexShrink: 0,
                    fontWeight: 700,
                    ...(fullWidth ? { mb: 2, minHeight: 40 } : { minHeight: 30, px: 1.25, fontSize: '0.75rem' }),
                    ...(usedToday ? { color: gold.deep, borderColor: gold.main } : {}),
                }}
            >
                {usedToday ? 'Usada ↺' : `Curar · ${costLabel}`}
            </Button>
            <EmbedDialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" onClick={(e) => e.stopPropagation()}>
                <DialogTitle sx={{ pb: 1 }}>{activity.name}</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Cura {activity.formula} PV · {costLabel}{activity.frequency ? ` · ${activity.frequency}` : activity.daily ? ' · 1× por dia' : ''}
                        </Typography>
                        <FormControlLabel
                            control={<Switch size="small" checked={onSelf} onChange={(e) => setOnSelf(e.target.checked)} />}
                            label="Em mim mesmo (soma ao meu PV)"
                        />
                        <Typography variant="caption" color="text.secondary">{activity.note}</Typography>
                        {activity.unstable && (
                            <Typography variant="caption" color={broken ? 'warning.main' : 'text.secondary'}>
                                {broken
                                    ? 'A inovação está pifada: o efeito Unstable não funciona até o reajuste de 10 minutos.'
                                    : `Unstable: depois da cura, teste simples CD ${dc}. Na falha a inovação pifa; na falha crítica você também toma ${unstableBurn(build.level ?? 1)} de fogo.`}
                            </Typography>
                        )}
                        {broken && (
                            <Button size="small" variant="outlined" onClick={() => uses.unmark(UNSTABLE_BROKEN)} sx={{ alignSelf: 'flex-start' }}>
                                Reajustei a inovação (10 min)
                            </Button>
                        )}
                        {lacking > 0 && (
                            <Alert severity="warning" sx={{ py: 0 }}>
                                Você não tem ações suficientes neste turno (faltam {lacking}). Dá para rolar mesmo assim.
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)} sx={{ mr: 'auto' }}>Cancelar</Button>
                    <Button variant="contained" onClick={roll}>Rolar {activity.formula}</Button>
                </DialogActions>
            </EmbedDialog>
            <Snackbar
                open={!!note}
                autoHideDuration={9000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setNote(null) }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {note ? <Alert severity={note.warn ? 'warning' : 'success'} onClose={() => setNote(null)}>{note.text}</Alert> : undefined}
            </Snackbar>
        </>
    )
}
