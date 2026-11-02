import { useState } from 'react'
import { Alert, Button, Chip, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar, Typography } from '@mui/material'
import type { BuildInfo } from '../../../pathbuilder/types'
import { CONDITIONS_BY_ID } from '../conditions'
import { costLabel } from '../activities'
import { mythicFeatsOf, type MythicFeatDef } from '../mythicFeats'
import { EmbedDialog } from './EmbedDialog'
import { FeatureRow } from './FeatureRow'
import type { ConditionsApi } from './useConditions'
import type { MagusApi } from './useMagus'
import type { MythicPointsApi } from './useMythicPoints'
import { useActivity } from './useActivity'
import { tr } from '../../../i18n'

interface Props {
    build: BuildInfo
    magus: MagusApi
    mythicPoints: MythicPointsApi
    conditions: ConditionsApi
}

/**
 * As linhas dos talentos míticos que gastam Ponto Mítico no turno (`mythicFeats.ts`). Cada uma
 * paga o tempo (ação, reação ou livre) e o ponto pelo mesmo `useActivity` dos botões "Usar" das
 * abas — só que aqui há um efeito na ficha (Acelerado do Godspeed) ou uma escolha (Become Destiny).
 */
export const MythicFeatsRows = ({ build, magus, mythicPoints, conditions }: Props) => {
    const feats = mythicFeatsOf(build)
    const { activate } = useActivity(build, conditions.mods, mythicPoints)
    const [note, setNote] = useState<{ text: string; warn: boolean } | null>(null)
    const [destiny, setDestiny] = useState(false)
    if (feats.length === 0) return null

    const canSpend = mythicPoints.available > 0

    /** Paga e avisa o que foi gasto; devolve se pagou (para os efeitos só valerem com o custo pago). */
    const pay = (feat: MythicFeatDef, extra?: string) => {
        const r = activate(feat.name, feat.info)
        const spent = r.spent.length ? tr(`gastou ${r.spent.join(' e ')}`, `spent ${r.spent.join(' and ')}`) : tr('nada a gastar', 'nothing to spend')
        setNote({
            text: `${feat.name}: ${spent}${r.warnings.length ? tr(` — atenção: ${r.warnings.join('; ')}`, ` — warning: ${r.warnings.join('; ')}`) : ''}.${extra ? ` ${extra}` : ''}`,
            warn: r.warnings.length > 0,
        })
    }

    // Só o que o jogador marcou pode ser tirado: condição imposta por aflição ou pelo Enlarge some quando a origem some.
    const removable = Object.keys(conditions.state).filter((id) => CONDITIONS_BY_ID[id])

    return (
        <>
            {feats.map((feat) => (
                <FeatureRow key={feat.id} title={feat.name}>
                    {feat.id === 'godspeed' && magus.stored.godspeed ? (
                        <>
                            <Chip label={tr("Ativo · +3 m · Acelerado", 'Active · +10 ft · Quickened')} size="small" color="primary" sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                {tr('Dura 1 minuto; encerre quando acabar.', 'Lasts 1 minute; end it when it\'s over.')}</Typography>
                            <Button size="small" variant="outlined" onClick={() => magus.setGodspeed(false)}>{tr('Encerrar', 'End')}</Button>
                        </>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                {feat.summary}
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={!canSpend}
                                title={feat.info.trigger ? `Gatilho: ${feat.info.trigger}` : undefined}
                                onClick={() => {
                                    if (feat.id === 'become-destiny') { setDestiny(true); return }
                                    pay(feat, feat.id === 'godspeed' ? tr('Acelerado ligado e +3 m nos Deslocamentos.', 'Quickened on and +10 feet to Speeds.') : undefined)
                                    if (feat.id === 'godspeed') magus.setGodspeed(true)
                                }}
                            >
                                {canSpend ? tr(`Usar · ${costLabel(feat.info)}`, `Use · ${costLabel(feat.info)}`) : tr('Sem pontos', 'No points')}
                            </Button>
                        </>
                    )}
                </FeatureRow>
            ))}

            <EmbedDialog open={destiny} onClose={() => setDestiny(false)}>
                <DialogTitle>Become Destiny</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 1.5 }}>
                        {tr('Gasta 1 Ponto Mítico (ação livre). Escolha a condição que ', 'Spends 1 Mythic Point (free action). Choose the condition that ')}{build.name} {tr('remove — ou use o botão sem escolher se o efeito é de magia, armadilha ou perigo, que o app não acompanha.', 'removes — or use the button without choosing if the effect is from a spell, trap or hazard, which the app doesn\'t track.')}</DialogContentText>
                    {removable.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {removable.map((id) => (
                                <Chip
                                    key={id}
                                    label={`${CONDITIONS_BY_ID[id].name}${conditions.state[id] > 1 ? ` ${conditions.state[id]}` : ''}`}
                                    onClick={() => {
                                        const feat = feats.find((f) => f.id === 'become-destiny')!
                                        pay(feat, tr(`${CONDITIONS_BY_ID[id].name} removida.`, `${CONDITIONS_BY_ID[id].name} removed.`))
                                        conditions.setCondition(id, 0)
                                        setDestiny(false)
                                    }}
                                    sx={{ minHeight: 32 }}
                                />
                            ))}
                        </div>
                    ) : (
                        <Typography variant="body2" color="text.secondary">{tr('Nenhuma condição marcada na ficha.', 'No condition marked on the sheet.')}</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => setDestiny(false)}>{tr('Cancelar', 'Cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            pay(feats.find((f) => f.id === 'become-destiny')!, tr('Efeito de magia, armadilha ou perigo: aplique à mão.', 'Effect from a spell, trap or hazard: apply it by hand.'))
                            setDestiny(false)
                        }}
                    >
                        {tr('Gastar sem remover condição', 'Spend without removing a condition')}</Button>
                </DialogActions>
            </EmbedDialog>

            <Snackbar
                open={!!note}
                autoHideDuration={8000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setNote(null) }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {note ? <Alert severity={note.warn ? 'warning' : 'success'} onClose={() => setNote(null)}>{note.text}</Alert> : undefined}
            </Snackbar>
        </>
    )
}
