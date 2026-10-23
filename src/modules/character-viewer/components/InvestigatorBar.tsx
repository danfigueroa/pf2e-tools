import { useEffect, useState } from 'react'
import { Button, Card, CardContent, Chip, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import { Search as InvestigatorIcon } from '@mui/icons-material'
import { INVESTIGATOR_COLOR } from '../../../theme'
import type { BuildInfo } from '../../../pathbuilder/types'
import { actionsKeyFor } from '../charId'
import type { ConditionModifiers } from '../conditions'
import {
    MAX_LEADS, clock, cooldownLeft, hasClueIn, hasDetectivesReadiness, hasExpeditiousInspection, hasPursueALead, isDropped,
} from '../investigator'
import { FeatureRow } from './FeatureRow'
import type { InvestigatorApi } from './useInvestigator'
import { useActions } from './useActions'

interface Props {
    build: BuildInfo
    investigator: InvestigatorApi
    mods: ConditionModifiers
}

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }
const solid = { bgcolor: INVESTIGATOR_COLOR, '&:hover': { bgcolor: INVESTIGATOR_COLOR, filter: 'brightness(0.9)' } }

/** Hora de agora, relida a cada segundo enquanto algum relógio de 10 minutos está correndo. */
function useNow(running: boolean): number {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        if (!running) return
        setNow(Date.now())
        const t = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(t)
    }, [running])
    return now
}

/**
 * As investigações do Investigador. Fora das abas, porque o +1 vale em qualquer teste e o Clue In
 * passa o bônus a um aliado. O app **não conta o tempo** da regra: o relógio de 10 minutos só
 * mostra quanto falta, e o jogador devolve o recurso quando o mestre disser que passou.
 */
export const InvestigatorBar = ({ build, investigator, mods }: Props) => {
    const actions = useActions(actionsKeyFor(build), mods)
    const { stored } = investigator
    const [adding, setAdding] = useState(false)
    const [name, setName] = useState('')
    const [replaceId, setReplaceId] = useState('')
    const full = stored.leads.length >= MAX_LEADS
    const running = [stored.pursuedAt, stored.clueAt, stored.inspectedAt].some((t) => t != null)
    const now = useNow(running)

    const typed = name.trim()
    const droppedHit = typed !== '' && isDropped(stored, typed)
    const canOpen = typed !== '' && !droppedHit && (!full || replaceId !== '')
    const open = () => {
        if (!canOpen) return
        investigator.open(typed, full ? replaceId : null)
        setName('')
        setReplaceId('')
        setAdding(false)
    }

    const cooldown = (at: number | null) => {
        const left = cooldownLeft(at, now)
        return left > 0 ? left : 0
    }
    const timer = (key: 'pursuedAt' | 'clueAt' | 'inspectedAt', at: number | null, use: () => void, label: string) => {
        const left = cooldown(at)
        if (at != null && left > 0) {
            return (
                <>
                    <Chip label={`de novo em ${clock(left)}`} size="small" variant="outlined" sx={chipSx} />
                    <Button size="small" variant="outlined" onClick={() => investigator.stamp(key, null)}>Já passou</Button>
                </>
            )
        }
        return (
            <>
                {at != null && <Chip label="pronto" size="small" sx={{ ...chipSx, bgcolor: INVESTIGATOR_COLOR, color: '#FFFFFF' }} />}
                <Button size="small" variant="contained" onClick={use} sx={solid}>{label}</Button>
            </>
        )
    }

    return (
        <Card sx={{ mb: 3, borderColor: stored.leads.length ? INVESTIGATOR_COLOR + '99' : undefined, borderWidth: stored.leads.length ? 2 : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1.25}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <InvestigatorIcon sx={{ color: INVESTIGATOR_COLOR }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Investigações</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {stored.leads.length}/{MAX_LEADS} · +1 de circunstância nos testes que levam à resposta
                        </Typography>
                    </Stack>

                    {hasPursueALead(build) && (
                        <>
                            {stored.leads.length === 0 && !adding && (
                                <Typography variant="body2" color="text.secondary">
                                    Nenhuma investigação aberta. O Pursue a Lead leva 1 minuto; se o mestre confirmar um mistério maior, abra uma aqui.
                                </Typography>
                            )}
                            {stored.leads.map((l) => (
                                <FeatureRow key={l.id} title={l.name}>
                                    <Chip label="ativa · +1" size="small" sx={{ ...chipSx, bgcolor: INVESTIGATOR_COLOR, color: '#FFFFFF' }} />
                                    <Button size="small" variant="outlined" onClick={() => investigator.close(l.id)} sx={{ ml: 'auto' }}>Resolvida</Button>
                                    <Button size="small" color="inherit" onClick={() => investigator.abandon(l.id)} title="Sai da lista e não volta até a próxima preparação diária">
                                        Abandonar
                                    </Button>
                                </FeatureRow>
                            ))}
                            {adding ? (
                                <Stack spacing={1}>
                                    <TextField
                                        size="small"
                                        label="Questão ou nome da investigação"
                                        placeholder="Quem matou o sacerdote?"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') open() }}
                                        error={droppedHit}
                                        helperText={droppedHit ? 'Abandonada hoje: só volta depois da próxima preparação diária.' : undefined}
                                        slotProps={{ htmlInput: { maxLength: 80 } }}
                                        autoFocus
                                        fullWidth
                                    />
                                    {full && (
                                        <Select
                                            size="small"
                                            value={replaceId}
                                            displayEmpty
                                            onChange={(e) => setReplaceId(e.target.value)}
                                            inputProps={{ 'aria-label': 'Investigação a abandonar' }}
                                            fullWidth
                                        >
                                            <MenuItem value="" disabled>Já há duas — qual abandonar?</MenuItem>
                                            {stored.leads.map((l) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                                        </Select>
                                    )}
                                    <Stack direction="row" spacing={1}>
                                        <Button size="small" variant="contained" disabled={!canOpen} onClick={open} sx={solid}>Abrir investigação</Button>
                                        <Button size="small" onClick={() => { setAdding(false); setName(''); setReplaceId('') }}>Cancelar</Button>
                                    </Stack>
                                </Stack>
                            ) : (
                                <FeatureRow title="Pursue a Lead">
                                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                        1 minuto. Achou um mistério maior: 10 minutos até o próximo.
                                    </Typography>
                                    {timer('pursuedAt', stored.pursuedAt, () => { investigator.stamp('pursuedAt', Date.now()); setAdding(true) }, 'Usar · abrir investigação')}
                                    <Button size="small" variant="outlined" onClick={() => setAdding(true)}>Abrir sem o relógio</Button>
                                </FeatureRow>
                            )}
                        </>
                    )}

                    {hasClueIn(build) && (
                        <FeatureRow title="Clue In">
                            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                Reação: o aliado que testa ganha o seu bônus de investigação.
                            </Typography>
                            {timer('clueAt', stored.clueAt, () => { actions.spendReaction(); investigator.stamp('clueAt', Date.now()) }, 'Usar · reação')}
                        </FeatureRow>
                    )}

                    {hasExpeditiousInspection(build) && (
                        <FeatureRow title="Expeditious Inspection">
                            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                Ação livre: Recall Knowledge, Seek ou Sense Motive.
                            </Typography>
                            {timer('inspectedAt', stored.inspectedAt, () => investigator.stamp('inspectedAt', Date.now()), 'Usar · ação livre')}
                        </FeatureRow>
                    )}

                    {hasDetectivesReadiness(build) && stored.leads.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            Detective's Readiness: o +1 vale também nas salvaguardas contra a criatura ou o efeito ligado a uma investigação aberta, e o Clue In ajuda a salvaguarda de um aliado.
                        </Typography>
                    )}
                    {stored.dropped.length > 0 && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary">Abandonadas hoje: {stored.dropped.join(', ')}.</Typography>
                            <Button size="small" onClick={investigator.newDay}>Nova preparação</Button>
                        </Stack>
                    )}
                </Stack>
            </CardContent>
        </Card>
    )
}
