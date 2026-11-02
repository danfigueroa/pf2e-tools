import { useMemo, useState } from 'react'
import {
    Alert, Button, Chip, DialogActions, DialogContent, DialogTitle, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import type { BuildInfo } from '../../../pathbuilder/types'
import { postRoll } from '../../../services/rolls'
import { actionsKeyFor } from '../charId'
import type { CheckPart } from '../checks'
import type { ConditionModifiers } from '../conditions'
import { signed } from '../helpers'
import { casterAttack, rollerIdentity, scrapShotRoll } from '../rolls'
import { relicWeaponName, scrapShotDice, relicLevel, type RelicEntry, type RelicGift } from '../relics'
import { mapPenalty } from '../strikes'
import { EmbedDialog } from './EmbedDialog'
import { useActions } from './useActions'
import { tr } from '../../../i18n'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
    relic: RelicEntry
    gift: RelicGift
}

/**
 * Scrap Shot da relíquia (Miranda's Arm): ataque de magia com a relíquia a até 9 m e 1d6 perfurante
 * por 2 níveis (mínimo 1d6), +1 de circunstância e Desajeitado 1 em alvo de metal. O ataque é o de
 * magia mais alto da ficha (a relíquia não declara outro) e é um ataque: a penalidade de ataques
 * múltiplos vale. O metal da relíquia vai para a nota — metal precioso ignora resistências.
 */
export const ScrapShotButton = ({ build, mods, relic, gift }: Props) => {
    const actions = useActions(actionsKeyFor(build), mods)
    const who = useMemo(() => rollerIdentity(build), [build])
    const [open, setOpen] = useState(false)
    const [map, setMap] = useState<0 | 1 | 2>(0)
    const [metal, setMetal] = useState(false)

    const attack = useMemo(() => {
        const options = (build.spellCasters ?? []).map((c) => casterAttack(build, c, mods))
        return options.length ? options.reduce((best, o) => (o.total > best.total ? o : best)) : null
    }, [build, mods])

    const cost = typeof gift.activation?.cost === 'number' ? gift.activation.cost : 1
    const dice = scrapShotDice(relicLevel(build))
    const lacking = actions.missing(cost, 'any')
    const material = build.weapons?.find((w) => w.name === relicWeaponName(build))?.mat ?? null

    const parts: CheckPart[] = attack
        ? [
            ...attack.parts,
            ...(metal ? [{ label: tr('Alvo de metal (circunstância)', 'Metal target (circumstance)'), value: 1, kind: 'other' as const }] : []),
            ...(map ? [{ label: tr(`${map + 1}º ataque`, `${['1st', '2nd', '3rd'][map] ?? `${map + 1}th`} attack`), value: mapPenalty(false, map), kind: 'map' as const }] : []),
        ]
        : []
    const total = parts.reduce((n, p) => n + p.value, 0)

    const roll = () => {
        if (!attack) return
        actions.spend(cost, 'any')
        const note = [
            metal ? tr('Alvo de metal: desajeitado 1 até o início do seu próximo turno.', 'Metal target: clumsy 1 until the start of your next turn.') : null,
            material && /iron|silver|adamantine|mithral|orichalcum|cold|sovereign|noqual|dawnsilver|djezet|duskwood/i.test(material)
                ? tr(`Disparo de ${material}: ignora resistências conforme o metal.`, `${material} shot: bypasses resistances according to the metal.`) : null,
        ].filter(Boolean).join(' ')
        void postRoll(scrapShotRoll(who, `${relic.name} — ${gift.name}`, parts, dice, map ? tr(`${map + 1}º ataque`, `${['1st', '2nd', '3rd'][map] ?? `${map + 1}th`} attack`) : undefined, note || undefined))
        setOpen(false)
    }

    return (
        <>
            <Button
                size="small"
                variant="contained"
                onClick={(e) => { e.stopPropagation(); setOpen(true) }}
                aria-label={tr(`Atacar com ${gift.name}`, `Attack with ${gift.name}`)}
                sx={{ flexShrink: 0, fontWeight: 700, minHeight: 30, px: 1.25, fontSize: '0.75rem' }}
            >
                {tr('Atacar · ', 'Attack · ')}{cost} {cost === 1 ? tr('ação', 'action') : tr('ações', 'actions')}
            </Button>
            <EmbedDialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ pb: 1 }}>{relic.name}: {gift.name}</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                        {!attack ? (
                            <Alert severity="warning" sx={{ py: 0 }}>{tr('A ficha não tem ataque de magia para a relíquia usar.', 'The sheet has no spell attack for the relic to use.')}</Alert>
                        ) : (
                            <>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {tr('Ataque de magia ', 'Spell attack ')}{signed(total)} · {dice}{tr('d6 perfurante · até 9 m', 'd6 piercing · up to 30 feet')}</Typography>
                                <ToggleButtonGroup exclusive size="small" fullWidth value={map} onChange={(_, v) => { if (v !== null) setMap(v) }}>
                                    <ToggleButton value={0}>1º</ToggleButton>
                                    <ToggleButton value={1}>2º (−5)</ToggleButton>
                                    <ToggleButton value={2}>3º (−10)</ToggleButton>
                                </ToggleButtonGroup>
                                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                    <Chip
                                        label={tr("Alvo de metal · +1 e Desajeitado 1", 'Metal target · +1 and Clumsy 1')}
                                        color={metal ? 'primary' : 'default'}
                                        variant={metal ? 'filled' : 'outlined'}
                                        onClick={() => setMetal(!metal)}
                                        aria-pressed={metal}
                                        sx={{ minHeight: 32 }}
                                    />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                    {material ? tr(`A relíquia é de ${material}: o disparo ignora resistências conforme o metal. `, `The relic is made of ${material}: the shot bypasses resistances according to the metal. `) : ''}
                                    {tr('O ataque é o seu de magia mais alto; confira com o mestre se a relíquia usa outro.', 'The attack is your highest spell attack; check with the GM whether the relic uses another one.')}</Typography>
                                {lacking > 0 && (
                                    <Alert severity="warning" sx={{ py: 0 }}>
                                        {tr('Você não tem ações suficientes neste turno (faltam ', 'You don\'t have enough actions this turn (missing ')}{lacking}{tr('). Dá para rolar mesmo assim.', '). You can roll anyway.')}</Alert>
                                )}
                            </>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpen(false)} sx={{ mr: 'auto' }}>{tr('Cancelar', 'Cancel')}</Button>
                    <Button variant="contained" disabled={!attack} onClick={roll}>{attack ? tr(`Rolar ${signed(total)}`, `Roll ${signed(total)}`) : tr('Rolar', 'Roll')}</Button>
                </DialogActions>
            </EmbedDialog>
        </>
    )
}
