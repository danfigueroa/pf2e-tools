import { useState } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    MenuItem,
    Select,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material'
import { AutoFixHigh as MagusIcon } from '@mui/icons-material'
import { MAGUS_COLOR } from '../../../theme'
import type { BuildInfo } from '../../character-sheet/types'
import { characterMaxHp } from '../helpers'
import { actionsKeyFor, hpKeyFor, legacyCharKey } from '../charId'
import { useActions } from './useActions'
import { CASCADE_TYPES, cascadeDamage, divertDestinyHp, hasDivertDestiny, hasFieryRebirthFeat, hasSpellstrike, hasSummonMythicPower } from '../magus'
import { classDc, fieryRebirthDamage, fieryRebirthHeal } from '../fighter'
import { fieryRebirthRoll, rollerIdentity } from '../rolls'
import { postRoll } from '../../../services/rolls'
import { translateDamageType } from '../../transformation-statblock/i18n'
import { useHpTracker } from './useHpTracker'
import { EmbedDialog } from './EmbedDialog'
import { FeatureRow } from './FeatureRow'
import { MythicFeatsRows } from './MythicFeatsRows'
import type { ConditionsApi } from './useConditions'
import type { MagusApi } from './useMagus'
import type { MythicPointsApi } from './useMythicPoints'

interface Props {
    build: BuildInfo
    magus: MagusApi
    mythicPoints: MythicPointsApi
    conditions: ConditionsApi
}

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }

/**
 * O que o Magus liga, gasta e recarrega: Arcane Cascade, Spellstrike, Summon
 * Mythic Power e Divert Destiny. Fica fora das abas, ao lado da Fúria e da
 * psique, porque a postura muda o dano de qualquer Golpe e o Divert Destiny
 * se usa no meio de qualquer aba. Só mostra o que a ficha tem.
 *
 * O PV e as condições são de quem usa o Divert Destiny, então a faixa ocupa o
 * mesmo lugar do `RageBar`: lê `useHpTracker` com o corte de Drenado.
 */
export const MagusBar = ({ build, magus, mythicPoints, conditions }: Props) => {
    const { stored, effect } = magus
    const hp = useHpTracker(hpKeyFor(build), characterMaxHp(build, conditions.mods.hpMaxDelta), legacyCharKey(build))
    const actions = useActions(actionsKeyFor(build), conditions.mods)
    const [confirmDivert, setConfirmDivert] = useState(false)
    const [confirmRebirth, setConfirmRebirth] = useState(false)

    const maxHp = characterMaxHp(build, conditions.mods.hpMaxDelta)
    const divertHp = divertDestinyHp(build.level, maxHp)
    const canSpend = mythicPoints.available > 0

    const divert = () => {
        mythicPoints.spend()
        hp.restoreHp({ current: divertHp, temp: hp.temp })
        // Perde ferido e morrendo por inteiro; o condenado não aumenta (não mexemos nele).
        conditions.setCondition('dying', 0)
        conditions.setCondition('wounded', 0)
        setConfirmDivert(false)
    }

    const rebirth = () => {
        mythicPoints.spend()
        // Volta à consciência, de pé, com PV iguais ao nível por cima do que já tinha.
        hp.restoreHp({ current: Math.min(maxHp, hp.current + fieryRebirthHeal(build.level)), temp: hp.temp })
        conditions.setCondition('unconscious', 0)
        conditions.setCondition('dying', 0)
        void postRoll(fieryRebirthRoll(rollerIdentity(build), fieryRebirthDamage(build.level), classDc(build)))
        setConfirmRebirth(false)
    }

    const summon = () => {
        actions.spend(1)
        mythicPoints.setUsed(mythicPoints.used - 1)
        magus.markSummoned()
    }

    return (
        <Card sx={{ mb: 3, borderColor: effect ? MAGUS_COLOR + '99' : undefined, borderWidth: effect ? 2 : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1.25}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <MagusIcon sx={{ color: MAGUS_COLOR }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                            {magus.canCascade || hasSpellstrike(build) ? 'Magus' : 'Poder mítico'}
                        </Typography>
                    </Stack>

                    {magus.canCascade && (
                        <Box>
                            <FeatureRow title="Arcane Cascade">
                                {effect ? (
                                    <>
                                        <Chip
                                            label={`Na postura · +${effect.damage} ${translateDamageType(effect.type)}`}
                                            size="small"
                                            sx={{ ...chipSx, bgcolor: MAGUS_COLOR, color: '#FFFFFF' }}
                                        />
                                        <Select
                                            size="small"
                                            value={stored.cascadeType}
                                            onChange={(e) => magus.setCascadeType(e.target.value)}
                                            inputProps={{ 'aria-label': 'Tipo do dano da postura' }}
                                            sx={{ height: 32, fontSize: '0.85rem' }}
                                        >
                                            {CASCADE_TYPES.map((t) => (
                                                <MenuItem key={t} value={t}>{translateDamageType(t)}</MenuItem>
                                            ))}
                                        </Select>
                                        <Button size="small" variant="outlined" onClick={() => magus.setCascade(false)} sx={{ ml: 'auto' }}>
                                            Sair da postura
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                            +{cascadeDamage(build)} de dano nos Golpes corpo a corpo.
                                        </Typography>
                                        <Tooltip title="Para entrar, sua última ação no turno precisa ter sido conjurar uma magia ou fazer um Spellstrike.">
                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={() => { actions.spend(1); magus.setCascade(true) }}
                                                sx={{ bgcolor: MAGUS_COLOR, '&:hover': { bgcolor: MAGUS_COLOR, filter: 'brightness(0.9)' } }}
                                            >
                                                Entrar na postura
                                            </Button>
                                        </Tooltip>
                                    </>
                                )}
                            </FeatureRow>
                            {effect && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Escolha o tipo da última magia que conjurou (força se ela não causava dano). Os Golpes ganham o traço arcane.
                                </Typography>
                            )}
                        </Box>
                    )}

                    {hasSpellstrike(build) && (
                        <FeatureRow title="Spellstrike">
                            <Chip
                                label={stored.spent ? 'Gasto' : 'Carregado'}
                                size="small"
                                variant={stored.spent ? 'outlined' : 'filled'}
                                sx={stored.spent ? chipSx : { ...chipSx, bgcolor: MAGUS_COLOR + '22', color: MAGUS_COLOR, border: `1px solid ${MAGUS_COLOR}55` }}
                            />
                            <Box sx={{ ml: 'auto' }}>
                                {stored.spent ? (
                                    <Tooltip title="Recarregar o Spellstrike custa 1 ação.">
                                        <Button size="small" variant="contained" onClick={() => { actions.spend(1); magus.rechargeSpellstrike() }}
                                            sx={{ bgcolor: MAGUS_COLOR, '&:hover': { bgcolor: MAGUS_COLOR, filter: 'brightness(0.9)' } }}>
                                            Recarregar · 1 ação
                                        </Button>
                                    </Tooltip>
                                ) : (
                                    <Tooltip title="Marca como gasto. Volta ao recarregar (1 ação, concentrar) ou ao conjurar uma magia de conflux que leve 1 ação ou mais; magia de foco de outro tipo não recarrega.">
                                        <Button size="small" variant="outlined" onClick={magus.spendSpellstrike}>
                                            Usei o Spellstrike
                                        </Button>
                                    </Tooltip>
                                )}
                            </Box>
                        </FeatureRow>
                    )}

                    {hasSummonMythicPower(build) && (
                        <FeatureRow title="Summon Mythic Power">
                            {stored.summoned ? (
                                <>
                                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                                        Já usada hoje.
                                    </Typography>
                                    <Button size="small" onClick={magus.newDay}>Novo dia</Button>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                        1 ação, 1× por dia: recupera 1 Ponto Mítico.
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={mythicPoints.used === 0}
                                        onClick={summon}
                                    >
                                        {mythicPoints.used === 0 ? 'Pontos cheios' : 'Recuperar 1 ponto'}
                                    </Button>
                                </>
                            )}
                        </FeatureRow>
                    )}

                    {hasDivertDestiny(build) && (
                        <FeatureRow title="Divert Destiny">
                            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                Reação: ao ir a 0 PV, gasta 1 Ponto Mítico e fica com {divertHp} PV.
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled={!canSpend}
                                onClick={() => setConfirmDivert(true)}
                            >
                                {canSpend ? 'Usar' : 'Sem pontos'}
                            </Button>
                        </FeatureRow>
                    )}
                    <MythicFeatsRows build={build} magus={magus} mythicPoints={mythicPoints} conditions={conditions} />
                    {hasFieryRebirthFeat(build) && (
                        <FeatureRow title="Fiery Rebirth">
                            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                Ao escapar da morte: gasta 1 Ponto Mítico, volta de pé com +{fieryRebirthHeal(build.level)} PV e explode em fogo ({fieryRebirthDamage(build.level)}).
                            </Typography>
                            <Button size="small" variant="outlined" color="error" disabled={!canSpend} onClick={() => setConfirmRebirth(true)}>
                                {canSpend ? 'Usar' : 'Sem pontos'}
                            </Button>
                        </FeatureRow>
                    )}
                </Stack>
            </CardContent>

            <EmbedDialog open={confirmRebirth} onClose={() => setConfirmRebirth(false)}>
                <DialogTitle>Fiery Rebirth</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Gasta 1 Ponto Mítico. {build.name} volta à consciência, de pé, e recupera {fieryRebirthHeal(build.level)} PV.
                        Em seguida explode em fogo: {fieryRebirthDamage(build.level)} de dano em quem está adjacente (Reflexos básico,
                        CD {classDc(build)}; falha crítica empurra 1,5 m). A rolagem vai para a mesa.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => setConfirmRebirth(false)}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={rebirth}>Usar Fiery Rebirth</Button>
                </DialogActions>
            </EmbedDialog>

            <EmbedDialog open={confirmDivert} onClose={() => setConfirmDivert(false)}>
                <DialogTitle>Divert Destiny</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Gasta 1 Ponto Mítico. {build.name} sobrevive com {divertHp} PV, perde os estados ferido e morrendo
                        e fica de pé e consciente. O condenado não aumenta.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => setConfirmDivert(false)}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={divert}>Usar Divert Destiny</Button>
                </DialogActions>
            </EmbedDialog>
        </Card>
    )
}
