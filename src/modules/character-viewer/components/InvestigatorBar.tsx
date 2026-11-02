import { useEffect, useState } from 'react'
import { Button, Card, CardContent, Chip, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import { Search as InvestigatorIcon } from '@mui/icons-material'
import { INVESTIGATOR_COLOR, onSolid } from '../../../theme'
import type { BuildInfo } from '../../../pathbuilder/types'
import { actionsKeyFor, charSlug } from '../charId'
import { clearStratagem, useStratagemPending } from '../stratagemPending'
import type { ConditionModifiers } from '../conditions'
import {
    MAX_LEADS, clock, cooldownLeft, hasClueIn, hasDetectivesReadiness, hasExpeditiousInspection, hasPursueALead, isDropped,
} from '../investigator'
import { FeatureRow } from './FeatureRow'
import type { InvestigatorApi } from './useInvestigator'
import { useActions } from './useActions'
import { tr } from '../../../i18n'

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
    const slug = charSlug(build)
    // O d20 do Devise a Stratagem rolado no diálogo do Golpe e ainda não usado.
    const stratagem = useStratagemPending(slug, actions.stored.turn)
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
                    <Chip label={tr(`de novo em ${clock(left)}`, `again in ${clock(left)}`)} size="small" variant="outlined" sx={chipSx} />
                    <Button size="small" variant="outlined" onClick={() => investigator.stamp(key, null)}>{tr('Já passou', 'Time\'s up')}</Button>
                </>
            )
        }
        return (
            <>
                {at != null && <Chip label={tr("pronto", 'ready')} size="small" sx={{ ...chipSx, bgcolor: INVESTIGATOR_COLOR, color: onSolid }} />}
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
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>{tr('Investigações', 'Investigations')}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {stored.leads.length}/{MAX_LEADS} {tr('· +1 de circunstância nos testes que levam à resposta', '· +1 circumstance bonus to checks that lead to the answer')}</Typography>
                    </Stack>

                    {stratagem && (
                        <FeatureRow title={tr(`Estratagema: d20 ${stratagem.d20}`, `Stratagem: d20 ${stratagem.d20}`)}>
                            <Typography variant="caption" color="text.secondary">
                                {tr('Vale no primeiro Golpe na criatura, até o seu próximo turno (abra o Golpe).', 'Applies to the first Strike against the creature, until your next turn (open the Strike).')}</Typography>
                            <Button size="small" color="inherit" onClick={() => clearStratagem(slug)} sx={{ ml: 'auto' }}>{tr('Descartar', 'Discard')}</Button>
                        </FeatureRow>
                    )}

                    {hasPursueALead(build) && (
                        <>
                            {stored.leads.length === 0 && !adding && (
                                <Typography variant="body2" color="text.secondary">
                                    {tr('Nenhuma investigação aberta. O Pursue a Lead leva 1 minuto; se o mestre confirmar um mistério maior, abra uma aqui.', 'No open investigation. Pursue a Lead takes 1 minute; if the GM confirms a bigger mystery, open one here.')}</Typography>
                            )}
                            {stored.leads.map((l) => (
                                <FeatureRow key={l.id} title={l.name}>
                                    <Chip label={tr("ativa · +1", 'active · +1')} size="small" sx={{ ...chipSx, bgcolor: INVESTIGATOR_COLOR, color: onSolid }} />
                                    <Button size="small" variant="outlined" onClick={() => investigator.close(l.id)} sx={{ ml: 'auto' }}>{tr('Resolvida', 'Resolved')}</Button>
                                    <Button size="small" color="inherit" onClick={() => investigator.abandon(l.id)} title={tr("Sai da lista e não volta até a próxima preparação diária", 'It leaves the list and doesn\'t come back until the next daily preparations')}>
                                        {tr('Abandonar', 'Abandon')}</Button>
                                </FeatureRow>
                            ))}
                            {adding ? (
                                <Stack spacing={1}>
                                    <TextField
                                        size="small"
                                        label={tr("Questão ou nome da investigação", 'Question or name of the investigation')}
                                        placeholder={tr("Quem matou o sacerdote?", 'Who killed the priest?')}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') open() }}
                                        error={droppedHit}
                                        helperText={droppedHit ? tr('Abandonada hoje: só volta depois da próxima preparação diária.', 'Abandoned today: only comes back after the next daily preparations.') : undefined}
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
                                            inputProps={{ 'aria-label': tr('Investigação a abandonar', 'Investigation to abandon') }}
                                            fullWidth
                                        >
                                            <MenuItem value="" disabled>{tr('Já há duas — qual abandonar?', 'There are already two — which one to abandon?')}</MenuItem>
                                            {stored.leads.map((l) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                                        </Select>
                                    )}
                                    <Stack direction="row" spacing={1}>
                                        <Button size="small" variant="contained" disabled={!canOpen} onClick={open} sx={solid}>{tr('Abrir investigação', 'Open investigation')}</Button>
                                        <Button size="small" onClick={() => { setAdding(false); setName(''); setReplaceId('') }}>{tr('Cancelar', 'Cancel')}</Button>
                                    </Stack>
                                </Stack>
                            ) : (
                                <FeatureRow title="Pursue a Lead">
                                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                        {tr('1 minuto. Achou um mistério maior: 10 minutos até o próximo.', '1 minute. Found a bigger mystery: 10 minutes until the next one.')}</Typography>
                                    {timer('pursuedAt', stored.pursuedAt, () => { investigator.stamp('pursuedAt', Date.now()); setAdding(true) }, tr('Usar · abrir investigação', 'Use · open investigation'))}
                                    <Button size="small" variant="outlined" onClick={() => setAdding(true)}>{tr('Abrir sem o relógio', 'Open without the timer')}</Button>
                                </FeatureRow>
                            )}
                        </>
                    )}

                    {hasClueIn(build) && (
                        <FeatureRow title="Clue In">
                            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                {tr('Reação: o aliado que testa ganha o seu bônus de investigação.', 'Reaction: the ally attempting the check gains your investigation bonus.')}</Typography>
                            {timer('clueAt', stored.clueAt, () => { actions.spendReaction(); investigator.stamp('clueAt', Date.now()) }, tr('Usar · reação', 'Use · reaction'))}
                        </FeatureRow>
                    )}

                    {hasExpeditiousInspection(build) && (
                        <FeatureRow title="Expeditious Inspection">
                            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                {tr('Ação livre: Recall Knowledge, Seek ou Sense Motive.', 'Free action: Recall Knowledge, Seek or Sense Motive.')}</Typography>
                            {timer('inspectedAt', stored.inspectedAt, () => investigator.stamp('inspectedAt', Date.now()), tr('Usar · ação livre', 'Use · free action'))}
                        </FeatureRow>
                    )}

                    {hasDetectivesReadiness(build) && stored.leads.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            {tr('Detective\'s Readiness: o +1 vale também nas salvaguardas contra a criatura ou o efeito ligado a uma investigação aberta, e o Clue In ajuda a salvaguarda de um aliado.', 'Detective\'s Readiness: the +1 also applies to saving throws against the creature or effect tied to an open investigation, and Clue In helps an ally\'s saving throw.')}</Typography>
                    )}
                    {stored.dropped.length > 0 && (
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary">{tr('Abandonadas hoje: ', 'Abandoned today: ')}{stored.dropped.join(', ')}.</Typography>
                            <Button size="small" onClick={investigator.newDay}>{tr('Nova preparação', 'New preparation')}</Button>
                        </Stack>
                    )}
                </Stack>
            </CardContent>
        </Card>
    )
}
