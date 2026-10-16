import { useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import { Casino as DiceIcon } from '@mui/icons-material'
import type { BuildInfo, SpellDescription, Weapon } from '../../character-sheet/types'
import { CONDITION_COLOR, MYTHIC_COLOR, PSYCHE_COLOR } from '../../../theme'
import { isMythicCharacter, signed } from '../helpers'
import { psycheApplies, psycheDamageBonus } from '../psyche'
import { psiAmpFor } from '../psiAmps'
import { convertTypes, hasConservation, isEnergySpell, type EnergyMode } from '../energy'
import { energyKeyFor, legacyCharKey, slotsKeyFor } from '../charId'
import { useEnergy } from './useEnergy'
import { useSpellSlots } from './useSpellSlots'
import type { Check, CheckPart } from '../checks'
import type { ConditionModifiers } from '../conditions'
import type { MythicPointsApi } from './useMythicPoints'
import type { UnarmedAttack } from '../unarmed'
import { magicWeaponRules } from '../magicWeapons'
import { useGear } from '../../../services/gear'
import { postRoll } from '../../../services/rolls'
import {
    DEFAULT_STRIKE_OPTIONS,
    extraEnabled,
    SPEC_KEY,
    specActive,
    extraLabel,
    planStrike,
    gravityApplies,
    huntersAimApplies,
    unarmedStrike,
    weaponStrike,
    type AttackMode,
    type StrikeOptions,
} from '../strikes'
import { damageComponents, formatValue, componentLabel, scaleSpell, type ScaledComponent } from '../heightening'
import { checkRoll, mapLabel, rollerIdentity, spellRoll, spellstrikeRoll, strikeRoll, type SpellAttackInfo } from '../rolls'
import type { TableRoll } from '../../../dice/tableRoll'
import { dialogEmbedProps, useEmbedContainer } from '../embedContext'
import { CASCADE_TYPES, hasSpellstrike } from '../magus'
import { FIRST_STRIKE_KEY, HUNTERS_AIM_KEY, gravityBonus } from '../ranger'
import { magusKeyFor } from '../charId'
import { useMagus } from './useMagus'
import { useSpellstrike } from './useSpellstrike'
import { SpellstrikePanel } from './SpellstrikePanel'

/** O que tocar na ficha pede para rolar. */
export type RollRequest =
    | { kind: 'check'; check: Check; note?: string }
    | { kind: 'weapon'; weapon: Weapon }
    | { kind: 'unarmed'; attack: UnarmedAttack }
    | {
        kind: 'spell'
        name: string
        /** `null` = o bloco não tem os números do ataque. */
        attack: SpellAttackInfo | null
        /** A descrição da AON (traços, salvaguarda, dano por rank); ausente = só o ataque. */
        spell?: SpellDescription | null
        castRank?: number
        /** Conjuração de Psíquico: a psique liberada soma ao dano. */
        psychic?: boolean
    }

interface Props {
    request: RollRequest | null
    build: BuildInfo
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
    onClose: () => void
}

/**
 * Diálogo de rolagem da Ficha Virtual: mostra a conta antes de rolar, deixa
 * escolher MAP, dano extra e o mítico, e manda a rolagem para a mesa.
 *
 * O estado muda na hora e a animação só apresenta: o Ponto Mítico é gasto no
 * clique, junto com a rolagem, e o cartão aparece para todos pelo feed.
 */
export const RollDialog = ({ request, build, mods, mythicPoints, onClose }: Props) => {
    const embed = useEmbedContainer()
    if (!request) return null
    const key = request.kind === 'check' ? request.check.label
        : request.kind === 'weapon' ? request.weapon.name
            : request.kind === 'unarmed' ? request.attack.id
                : request.name
    return (
        <Dialog {...dialogEmbedProps(embed)} open onClose={onClose} fullWidth maxWidth="xs">
            {/* A `key` zera o estado interno quando o pedido troca com o diálogo aberto. */}
            {request.kind === 'check' && <CheckBody key={key} request={request} build={build} mods={mods} mythicPoints={mythicPoints} onClose={onClose} />}
            {(request.kind === 'weapon' || request.kind === 'unarmed') && (
                <StrikeBody key={key} request={request} build={build} mods={mods} mythicPoints={mythicPoints} onClose={onClose} />
            )}
            {request.kind === 'spell' && <SpellBody key={key} request={request} build={build} mods={mods} mythicPoints={mythicPoints} onClose={onClose} />}
        </Dialog>
    )
}

interface BodyProps<R> {
    request: R
    build: BuildInfo
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
    onClose: () => void
}

const sumParts = (parts: CheckPart[]) => parts.reduce((s, p) => s + p.value, 0)

/** O memorial: uma linha por parcela, o total embaixo. */
const Memorial = ({ parts, total, title }: { parts: CheckPart[]; total: number; title?: string }) => (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.25, py: 0.75 }}>
        {title && (
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6, fontWeight: 700 }}>
                {title}
            </Typography>
        )}
        {parts.map((p, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography
                    variant="body2"
                    sx={{ color: p.kind === 'condition' || (p.kind === 'armor') ? CONDITION_COLOR : p.kind === 'mythic' ? MYTHIC_COLOR : 'text.primary' }}
                >
                    {p.label}
                </Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{signed(p.value)}</Typography>
            </Box>
        ))}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', mt: 0.5, pt: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Total</Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>{signed(total)}</Typography>
        </Box>
    </Box>
)

/** Campo de ajuste livre: entra cru, sem a regra de empilhamento. */
const AdjustField = ({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) => (
    <TextField
        label={label}
        type="number"
        size="small"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => {
            const n = Math.round(Number(e.target.value))
            onChange(Number.isFinite(n) ? Math.max(-99, Math.min(99, n)) : 0)
        }}
        slotProps={{ htmlInput: { inputMode: 'numeric', step: 1 } }}
        helperText="Entra como está — confira você se o tipo empilha (status, circunstância)."
        fullWidth
    />
)

/** Penalidades e notas que não viram número sozinhas (Surdo em teste de som…). */
const SituationalNotes = ({ mods }: { mods: ConditionModifiers }) =>
    mods.situational.length === 0 ? null : (
        <Box>
            {mods.situational.map((s, i) => (
                <Typography key={i} variant="caption" sx={{ display: 'block', color: CONDITION_COLOR }}>
                    Não aplicado sozinho — {s.from}: {s.text}
                </Typography>
            ))}
        </Box>
    )

/**
 * Os dois botões de rolar. O mítico só existe para personagem mítico, e fica
 * desabilitado sem ponto: gastar é parte do clique, não um passo à parte.
 */
const RollActions = ({ build, total, mythicDelta, mythicPoints, alreadyMythic, onRoll, onClose, disabled }: {
    build: BuildInfo
    total: number | null
    mythicDelta: number | null
    mythicPoints: MythicPointsApi
    alreadyMythic?: boolean
    onRoll: (mythic: boolean) => void
    onClose: () => void
    disabled?: boolean
}) => {
    const mythic = isMythicCharacter(build) && mythicDelta != null && total != null && !alreadyMythic
    const none = mythicPoints.available === 0
    return (
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
            <Button onClick={onClose} sx={{ mr: 'auto' }}>Cancelar</Button>
            {mythic && (
                <Button
                    variant="outlined"
                    disabled={none || disabled}
                    onClick={() => onRoll(true)}
                    sx={{ color: MYTHIC_COLOR, borderColor: MYTHIC_COLOR }}
                    title="Troca a proficiência pela mítica (nível + 10) e gasta 1 Ponto Mítico"
                >
                    {none ? '✦ Sem Pontos Míticos' : `✦ Mítico ${signed(total! + mythicDelta!)} · ${mythicPoints.available} pt`}
                </Button>
            )}
            <Button variant="contained" startIcon={<DiceIcon />} disabled={disabled} onClick={() => onRoll(false)}>
                {total != null ? `Rolar ${signed(total)}` : 'Rolar'}
            </Button>
        </DialogActions>
    )
}

/** Manda para a mesa e gasta o ponto no mesmo gesto. */
function useSend(mythicPoints: MythicPointsApi, onClose: () => void) {
    return (roll: TableRoll, mythic: boolean) => {
        if (mythic) mythicPoints.spend()
        void postRoll(roll)
        onClose()
    }
}

// ── Teste (salvaguarda, Percepção, perícia) ──────────────────────────────────

/** Os testes que o PF2e deixa servir de iniciativa (Percepção é o padrão; o GM aceita os outros). */
const INITIATIVE_CHECKS = ['Perception', 'Stealth', 'Athletics', 'Acrobatics']

const CheckBody = ({ request, build, mods, mythicPoints, onClose }: BodyProps<Extract<RollRequest, { kind: 'check' }>>) => {
    const [adjust, setAdjust] = useState(0)
    const [initiative, setInitiative] = useState(false)
    const { check } = request
    const canInitiative = INITIATIVE_CHECKS.includes(check.en)
    const parts = adjust ? [...check.parts, { label: 'Ajuste', value: adjust, kind: 'other' as const }] : check.parts
    const total = sumParts(parts)
    const who = useMemo(() => rollerIdentity(build), [build])
    const send = useSend(mythicPoints, onClose)
    return (
        <>
            <DialogTitle sx={{ pb: 1 }}>Rolar {check.label}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    <Memorial parts={parts} total={total} />
                    {request.note && <Typography variant="caption" color="text.secondary">{request.note}</Typography>}
                    <SituationalNotes mods={mods} />
                    <AdjustField label="Outros bônus/penalidades" value={adjust} onChange={setAdjust} />
                    {canInitiative && (
                        <Box>
                            <Chip
                                label="Usar como iniciativa"
                                color={initiative ? 'primary' : 'default'}
                                variant={initiative ? 'filled' : 'outlined'}
                                onClick={() => setInitiative(!initiative)}
                                aria-pressed={initiative}
                                sx={{ minHeight: 32 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                O total vira a sua iniciativa no encontro do mestre.
                            </Typography>
                        </Box>
                    )}
                </Stack>
            </DialogContent>
            <RollActions
                build={build}
                total={total}
                mythicDelta={check.mythicDelta}
                mythicPoints={mythicPoints}
                onClose={onClose}
                onRoll={(mythic) => send(
                    checkRoll(who, check.label, parts, mythic ? check.mythicDelta : null, initiative && canInitiative ? 'iniciativa' : undefined, initiative && canInitiative),
                    mythic,
                )}
            />
        </>
    )
}

// ── Golpe (arma ou desarmado) ────────────────────────────────────────────────

const extrasKey = (slug: string, strikeKey: string) => `pf2e:roll:extras:v1:${slug}:${strikeKey}`

function loadExtras(key: string): Record<string, boolean> {
    try {
        const raw = JSON.parse(localStorage.getItem(key) ?? 'null')
        return raw && typeof raw === 'object' ? raw as Record<string, boolean> : {}
    } catch {
        return {}
    }
}

const StrikeBody = ({ request, build, mods, mythicPoints, onClose }: BodyProps<Extract<RollRequest, { kind: 'weapon' | 'unarmed' }>>) => {
    const who = useMemo(() => rollerIdentity(build), [build])
    const send = useSend(mythicPoints, onClose)
    const weapon = request.kind === 'weapon' ? request.weapon : null
    const gearNames = useMemo(() => (weapon ? [weapon.name] : []), [weapon])
    const gear = useGear(gearNames)
    const rules = weapon ? magicWeaponRules(weapon.name) : null
    const [profile, setProfile] = useState(0)

    const entry = weapon ? gear[weapon.name] : null
    const loading = !!weapon && entry === undefined
    const strike = weapon
        ? weaponStrike(build, weapon, entry && entry.kind === 'weapon' ? entry : null, rules, profile)
        : unarmedStrike(build, (request as Extract<RollRequest, { kind: 'unarmed' }>).attack)

    // Por arma, não por perfil: o 2d6 de precisão da Gloom Blade é o mesmo nos três perfis.
    const storeKey = extrasKey(who.slug, weapon ? `w:${weapon.name}` : strike.key)
    const [opts, setOpts] = useState<StrikeOptions>(() => ({ ...DEFAULT_STRIKE_OPTIONS, extrasOn: loadExtras(storeKey) }))
    const toggleExtra = (k: string, on: boolean) => {
        const extrasOn = { ...opts.extrasOn, [k]: on }
        setOpts({ ...opts, extrasOn })
        // Primeiro Golpe da rodada e Hunter's Aim são da SITUAÇÃO, não da arma: lembrar
        // um "desligado" derrubaria o dano do primeiro Golpe da rodada seguinte em silêncio.
        if (k === FIRST_STRIKE_KEY || k === HUNTERS_AIM_KEY) return
        try { localStorage.setItem(storeKey, JSON.stringify(extrasOn)) } catch { /* cota cheia */ }
    }

    const plan = planStrike(build, strike, mods, opts)
    const { traits } = strike

    // Spellstrike: só em Golpe corpo a corpo. A magia escolhida entra no mesmo
    // clique que rola o Golpe, gasta o slot e marca o Spellstrike como gasto.
    const magus = useMagus(magusKeyFor(build), build)
    const canSpellstrike = hasSpellstrike(build) && !traits.ranged && opts.mode !== 'thrown'
    const ss = useSpellstrike(build, canSpellstrike)
    const spellstriking = canSpellstrike && ss.ready
    const damageText = [
        `${formatValue({ count: plan.weapon.groups[0]?.count ?? 0, faces: plan.weapon.groups[0]?.faces ?? 0, flat: plan.weapon.flat })} ${strike.damageType}`,
        ...plan.extras.map(extraLabel),
    ].join(' + ')
    const critExtras = [
        plan.deadly ? `deadly ${plan.deadly.count}d${plan.deadly.faces}` : null,
        plan.fatal ? `fatal: dados da arma em d${plan.fatal} e +1d${plan.fatal}` : null,
        ...plan.critEffects.map((c) => c.label),
    ].filter(Boolean)
    const spec = strike.spec
    const specOn = specActive(strike, mods, opts.extrasOn)

    const sub = [
        mapLabel(opts.map, traits.agile),
        profile > 0 && rules ? rules.profiles[profile - 1].when : null,
        opts.mode === 'thrown' ? 'arremesso' : null,
    ].filter(Boolean).join(' · ')

    return (
        <>
            <DialogTitle sx={{ pb: 1 }}>Golpe — {weapon ? (weapon.display || weapon.name) : strike.name}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    {rules && rules.profiles.length > 0 && (
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            orientation="vertical"
                            value={profile}
                            onChange={(_, v) => { if (v !== null) setProfile(v) }}
                            fullWidth
                        >
                            <ToggleButton value={0} sx={{ textTransform: 'none' }}>{rules.baseLabel}</ToggleButton>
                            {rules.profiles.map((p, i) => (
                                <ToggleButton key={p.when} value={i + 1} sx={{ textTransform: 'none' }}>{p.when}</ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    )}

                    <Box>
                        <Typography variant="caption" color="text.secondary">Penalidade de ataques múltiplos{traits.agile ? ' (ágil)' : ''}</Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={opts.map}
                            onChange={(_, v) => { if (v !== null) setOpts({ ...opts, map: v }) }}
                            fullWidth
                        >
                            <ToggleButton value={0}>1º</ToggleButton>
                            <ToggleButton value={1}>2º ({traits.agile ? '−4' : '−5'})</ToggleButton>
                            <ToggleButton value={2}>3º ({traits.agile ? '−8' : '−10'})</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {/* Arremesso muda o atributo do ataque; sem traços, quem rola diz qual vale. */}
                    {(traits.thrown && !traits.ranged) && (
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={opts.mode === 'thrown' ? 'thrown' : 'auto'}
                            onChange={(_, v: AttackMode | null) => { if (v) setOpts({ ...opts, mode: v }) }}
                            fullWidth
                        >
                            <ToggleButton value="auto">Corpo a corpo</ToggleButton>
                            <ToggleButton value="thrown">Arremesso</ToggleButton>
                        </ToggleButtonGroup>
                    )}
                    {!traits.known && !loading && (
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={opts.mode === 'auto' ? strike.baseAbility : opts.mode}
                            onChange={(_, v: AttackMode | null) => { if (v) setOpts({ ...opts, mode: v }) }}
                            fullWidth
                        >
                            <ToggleButton value="str">Ataque de FOR</ToggleButton>
                            <ToggleButton value="dex">Ataque de DES</ToggleButton>
                        </ToggleButtonGroup>
                    )}

                    {canSpellstrike && ss.options.length > 0 && <SpellstrikePanel ss={ss} magus={magus} />}

                    <Memorial title="Ataque" parts={plan.attackParts} total={plan.attackTotal} />

                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.25, py: 0.75 }}>
                        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6, fontWeight: 700 }}>
                            Dano
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{damageText}</Typography>
                        {plan.damageParts.length > 1 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Fixo: {plan.damageParts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ')}
                            </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Crítico: dobra o rolado{critExtras.length ? `, mais ${critExtras.join(' e ')} por fora do dobro` : ''}.
                        </Typography>
                    </Box>

                    {strike.extras.length > 0 && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Dano extra — ligue só o que vale neste golpe
                            </Typography>
                            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                {strike.extras.map((e) => {
                                    const on = extraEnabled(e, opts.extrasOn, mods)
                                    return (
                                        <Chip
                                            key={e.key}
                                            label={extraLabel(e)}
                                            color={on ? 'primary' : 'default'}
                                            variant={on ? 'filled' : 'outlined'}
                                            onClick={() => toggleExtra(e.key, !on)}
                                            aria-pressed={on}
                                            sx={{ minHeight: 32 }}
                                        />
                                    )
                                })}
                            </Stack>
                            {strike.extras.some((e) => e.precision) && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Precisão é condicional (Ataque Furtivo, Hunter's Edge…) e não afeta criatura imune a precisão.
                                </Typography>
                            )}
                        </Box>
                    )}

                    {gravityApplies(strike, mods) && (
                        <Box>
                            <Chip
                                label={`Primeiro Golpe da rodada · Gravity Weapon +${gravityBonus(strike.weaponDice.count)}`}
                                color={opts.extrasOn[FIRST_STRIKE_KEY] !== false ? 'primary' : 'default'}
                                variant={opts.extrasOn[FIRST_STRIKE_KEY] !== false ? 'filled' : 'outlined'}
                                onClick={() => toggleExtra(FIRST_STRIKE_KEY, opts.extrasOn[FIRST_STRIKE_KEY] === false)}
                                aria-pressed={opts.extrasOn[FIRST_STRIKE_KEY] !== false}
                                sx={{ minHeight: 32 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Bônus de status igual a 2 × os dados da arma, só no primeiro Golpe com arma de cada rodada. Desligue nos seguintes.
                            </Typography>
                        </Box>
                    )}
                    {huntersAimApplies(build, strike, opts) && (
                        <Box>
                            <Chip
                                label="Hunter's Aim · +2 contra a presa (2 ações)"
                                color={opts.extrasOn[HUNTERS_AIM_KEY] === true ? 'primary' : 'default'}
                                variant={opts.extrasOn[HUNTERS_AIM_KEY] === true ? 'filled' : 'outlined'}
                                onClick={() => toggleExtra(HUNTERS_AIM_KEY, opts.extrasOn[HUNTERS_AIM_KEY] !== true)}
                                aria-pressed={opts.extrasOn[HUNTERS_AIM_KEY] === true}
                                sx={{ minHeight: 32 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                +2 de circunstância no ataque contra a presa caçada; ignora escondido e cobertura leve.
                            </Typography>
                        </Box>
                    )}

                    {spec && (spec.source.kind === 'prey' || spec.source.kind === 'situational') && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Se o golpe for crítico
                            </Typography>
                            <Chip
                                label={`${spec.effect.label}${spec.effect.damage ? '' : ' (aviso)'}`}
                                color={specOn ? 'primary' : 'default'}
                                variant={specOn ? 'filled' : 'outlined'}
                                onClick={() => toggleExtra(SPEC_KEY, !specOn)}
                                aria-pressed={specOn}
                                sx={{ minHeight: 32 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {spec.source.reason}.
                            </Typography>
                        </Box>
                    )}
                    {spec && (spec.source.kind === 'always' || spec.source.kind === 'raging') && (
                        <Typography variant="caption" color={specOn ? 'text.secondary' : 'warning.main'} sx={{ display: 'block' }}>
                            {spec.effect.label}: {specOn ? 'vale neste golpe' : 'só vale em Fúria'} — {spec.source.reason}.
                        </Typography>
                    )}

                    {plan.warnings.map((w) => <Alert key={w} severity="warning" sx={{ py: 0 }}>{w}</Alert>)}
                    {loading && <Typography variant="caption" color="text.secondary">Buscando os traços da arma no AON…</Typography>}
                    <SituationalNotes mods={mods} />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <AdjustField label="Ajuste no ataque" value={opts.attackAdjust} onChange={(n) => setOpts({ ...opts, attackAdjust: n })} />
                        <AdjustField label="Ajuste no dano" value={opts.damageAdjust} onChange={(n) => setOpts({ ...opts, damageAdjust: n })} />
                    </Stack>
                </Stack>
            </DialogContent>
            <RollActions
                build={build}
                total={plan.attackTotal}
                mythicDelta={plan.mythicDelta}
                mythicPoints={mythicPoints}
                onClose={onClose}
                // Magia escolhida e ainda não pronta (buscando, sem slot, regra): o jogador
                // precisa trocar por "Só o Golpe" — rolar sem ela em silêncio enganaria.
                disabled={loading || (canSpellstrike && !!ss.option && !ss.ready)}
                onRoll={(mythic) => {
                    const mythicDelta = mythic ? plan.mythicDelta : null
                    if (!spellstriking || !ss.option || !ss.spell) {
                        send(strikeRoll(who, strike, plan, mythicDelta, sub), mythic)
                        return
                    }
                    ss.spend()
                    magus.spendSpellstrike()
                    if (ss.enterCascade && magus.canCascade && !magus.stored.cascade) {
                        // O tipo da postura é o da última magia: a primeira parcela de dano ligada.
                        const type = ss.chosen.flatMap((c) => c.types).find((t) => (CASCADE_TYPES as readonly string[]).includes(t))
                        magus.setCascadeType(type ?? 'force')
                        magus.setCascade(true)
                    }
                    const defense = !ss.usesAttack && ss.spell.defense ? `salvaguarda: ${ss.spell.defense}` : null
                    send(spellstrikeRoll(who, strike, plan, mythicDelta, [sub, `rank ${ss.option.rank}`, defense].filter(Boolean).join(' · '), {
                        name: ss.option.name,
                        components: ss.chosen,
                        usesAttack: ss.usesAttack,
                    }), mythic)
                }}
            />
        </>
    )
}

// ── Magia ────────────────────────────────────────────────────────────────────

const SpellBody = ({ request, build, mods, mythicPoints, onClose }: BodyProps<Extract<RollRequest, { kind: 'spell' }>>) => {
    const who = useMemo(() => rollerIdentity(build), [build])
    const send = useSend(mythicPoints, onClose)
    const { spell, castRank, attack } = request
    const traits = (spell?.traits ?? []).map((t) => t.toLowerCase())
    // Sem descrição (o "Atq" do cartão do conjurador): é o ataque genérico.
    const hasAttack = !!attack && (!spell || traits.includes('attack'))
    // A salvaguarda chega TRADUZIDA ("Reflexos básico") — casa as duas línguas.
    const basic = /\bbasic\b|básic/i.test(spell?.defense ?? '')

    const scaled = spell && castRank != null ? scaleSpell(spell, castRank) : null
    const baseComponents = scaled ? damageComponents(scaled) : []

    // Amp do psi cantrip (1 Ponto de Foco) e Conservation of Energy: os dois
    // mexem no dano antes de qualquer outra coisa.
    const slots = useSpellSlots(slotsKeyFor(build), build.focusPoints ?? 0, legacyCharKey(build))
    const energy = useEnergy(energyKeyFor(build))
    const ampDef = request.psychic ? psiAmpFor(request.name) : null
    const focusLeft = Math.max(0, (build.focusPoints ?? 0) - slots.focusUsed)
    const [ampOn, setAmpOn] = useState(false)
    const [melee, setMelee] = useState(false)
    const conserve = !!request.psychic && hasConservation(build) && isEnergySpell(request.name)
    const [picked, setPicked] = useState<EnergyMode | null>(null)
    const mode: EnergyMode | null = conserve ? (picked && energy.allowed.includes(picked) ? picked : energy.allowed[0]) : null

    const buildComponents = (amped: boolean): ScaledComponent[] => {
        const amp = amped && ampDef?.damage && castRank != null ? ampDef.damage(castRank, melee) : null
        const swapped: ScaledComponent[] = amp
            ? [
                ...amp.map((a, i): ScaledComponent => ({
                    id: 9000 + i, kind: 'damage', formula: '', types: [a.type], persistent: a.persistent,
                    count: a.count, faces: a.faces, flat: a.flat, nth: 0, occurrences: 1,
                    value: { count: a.count, faces: a.faces, flat: a.flat }, changed: true, uncertain: false,
                })),
                ...baseComponents.filter((c) => c.kind !== 'damage'),
            ]
            : baseComponents
        return mode ? swapped.map((c) => (c.kind === 'damage' ? { ...c, types: convertTypes(c.types, mode) } : c)) : swapped
    }
    const components = buildComponents(ampOn)
    // Dois componentes com a mesma fórmula e tipos diferentes costumam ser
    // ALTERNATIVAS (Gouging Claw: cortante OU perfurante): só o primeiro liga.
    // Persistente começa desligado: em magia ele costuma ser de um grau só (o
    // 5d4 da Ignition é do sucesso crítico), e a prosa diz qual.
    const defaultSelection = (list: ScaledComponent[]) => {
        const on = new Set<number>()
        const formulas = new Set<string>()
        for (const c of list) {
            if (c.uncertain || c.persistent) continue
            const f = formatValue(c.value)
            if (formulas.has(f)) continue
            formulas.add(f)
            on.add(c.id)
        }
        return on
    }
    const [selected, setSelected] = useState<Set<number>>(() => defaultSelection(components))
    const [map, setMap] = useState<0 | 1 | 2>(0)
    const [adjust, setAdjust] = useState(0)

    const attackParts: CheckPart[] | null = hasAttack ? [
        ...attack!.parts,
        ...(map ? [{ label: `${map + 1}º ataque`, value: -5 * map, kind: 'map' as const }] : []),
        ...(adjust ? [{ label: 'Ajuste', value: adjust, kind: 'other' as const }] : []),
    ] : null
    const total = attackParts ? sumParts(attackParts) : null
    const chosen = components.filter((c) => selected.has(c.id) && !c.uncertain)
    const nothing = !attackParts && chosen.length === 0

    // Psique liberada: bônus de status igual ao dobro do rank, uma vez só, no dano
    // inicial (a primeira parcela imediata de dano) — nunca no persistente.
    const psycheBonus = psycheApplies(mods, spell, request.psychic) && castRank != null ? psycheDamageBonus(castRank) : 0
    const psycheTarget = psycheBonus ? chosen.find((c) => c.kind === 'damage' && !c.persistent) : undefined
    const rolled = psycheTarget
        ? chosen.map((c) => (c === psycheTarget ? { ...c, value: { ...c.value, flat: c.value.flat + psycheBonus } } : c))
        : chosen

    const sub = [
        castRank != null ? `rank ${castRank}` : null,
        attackParts && map ? mapLabel(map) : null,
        basic && spell?.defense ? `salvaguarda: ${spell.defense}` : null,
        ampOn && ampDef ? 'amplificada' : null,
        mode ? `energia: ${mode === 'add' ? 'adicionando (fogo)' : 'removendo (frio)'}` : null,
        psycheTarget ? `psique liberada +${psycheBonus}` : null,
    ].filter(Boolean).join(' · ')

    return (
        <>
            <DialogTitle sx={{ pb: 1 }}>{request.name}{castRank != null ? ` (rank ${castRank})` : ''}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    {attackParts && (
                        <>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Penalidade de ataques múltiplos</Typography>
                                <ToggleButtonGroup exclusive size="small" value={map} onChange={(_, v) => { if (v !== null) setMap(v) }} fullWidth>
                                    <ToggleButton value={0}>1º</ToggleButton>
                                    <ToggleButton value={1}>2º (−5)</ToggleButton>
                                    <ToggleButton value={2}>3º (−10)</ToggleButton>
                                </ToggleButtonGroup>
                            </Box>
                            <Memorial title="Ataque de magia" parts={attackParts} total={total!} />
                            {attack!.alreadyMythic && (
                                <Typography variant="caption" sx={{ color: MYTHIC_COLOR }}>
                                    Mythic Magic: o ataque já usa a proficiência mítica, e o Ponto Mítico sai ao conjurar.
                                </Typography>
                            )}
                        </>
                    )}

                    {ampDef && castRank != null && (
                        <Box>
                            <Chip
                                label={`Amplificar · 1 Ponto de Foco (${focusLeft} restante${focusLeft === 1 ? '' : 's'})`}
                                color={ampOn ? 'primary' : 'default'}
                                variant={ampOn ? 'filled' : 'outlined'}
                                disabled={!ampOn && focusLeft === 0}
                                aria-pressed={ampOn}
                                onClick={() => {
                                    const next = !ampOn
                                    setAmpOn(next)
                                    setSelected(defaultSelection(buildComponents(next)))
                                }}
                                sx={{ minHeight: 32 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {ampDef.summary} O ponto é gasto ao rolar.
                            </Typography>
                            {ampOn && ampDef.meleeOption && (
                                <Chip
                                    size="small"
                                    label="Ataque corpo a corpo (d12)"
                                    color={melee ? 'primary' : 'default'}
                                    variant={melee ? 'filled' : 'outlined'}
                                    aria-pressed={melee}
                                    onClick={() => setMelee(!melee)}
                                    sx={{ mt: 0.5 }}
                                />
                            )}
                            {ampOn && ampDef.notes(castRank, melee).map((n) => (
                                <Typography key={n} variant="caption" sx={{ display: 'block', color: PSYCHE_COLOR }}>{n}</Typography>
                            ))}
                        </Box>
                    )}

                    {conserve && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">Conservation of Energy</Typography>
                            <ToggleButtonGroup exclusive size="small" value={mode} fullWidth onChange={(_, v: EnergyMode | null) => { if (v) setPicked(v) }}>
                                <ToggleButton value="add" disabled={!energy.allowed.includes('add')} sx={{ textTransform: 'none' }}>Adicionar (fogo)</ToggleButton>
                                <ToggleButton value="remove" disabled={!energy.allowed.includes('remove')} sx={{ textTransform: 'none' }}>Remover (frio)</ToggleButton>
                            </ToggleButtonGroup>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {energy.stored.last ? 'A última foi a oposta: esta tem de ser a outra.' : 'Neutro: a primeira escolha é livre.'} Rolar registra a escolha.
                            </Typography>
                        </Box>
                    )}

                    {components.length > 0 && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                {components.length > 1 ? 'Dano — às vezes as parcelas somam, às vezes são alternativas: ligue as que valem' : 'Dano'}
                            </Typography>
                            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                {components.map((c) => {
                                    const on = selected.has(c.id) && !c.uncertain
                                    return (
                                        <Chip
                                            key={c.id}
                                            label={componentLabel(c)}
                                            color={on ? 'primary' : 'default'}
                                            variant={on ? 'filled' : 'outlined'}
                                            disabled={!!c.uncertain}
                                            aria-pressed={on}
                                            onClick={() => setSelected((prev) => {
                                                const next = new Set(prev)
                                                if (next.has(c.id)) next.delete(c.id)
                                                else next.add(c.id)
                                                return next
                                            })}
                                            sx={{ minHeight: 32 }}
                                        />
                                    )
                                })}
                            </Stack>
                            {components.some((c) => c.uncertain) && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    "(?)": o número deste rank não pôde ser lido com segurança — role à mão.
                                </Typography>
                            )}
                            {basic && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Salvaguarda básica: a mesa vê o dano de cada grau (sucesso ½, falha crítica ×2).
                                </Typography>
                            )}
                            {attackParts && chosen.length > 0 && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Crítico: dobra o rolado (o persistente entra à parte, como a magia mandar).
                                </Typography>
                            )}
                        </Box>
                    )}

                    {psycheTarget && (
                        <Typography variant="caption" sx={{ color: PSYCHE_COLOR, display: 'block' }}>
                            Psique liberada: +{psycheBonus} de dano (status, o dobro do rank {castRank}) na primeira parcela de dano.
                        </Typography>
                    )}

                    {spell && castRank != null && !scaled && (
                        <Alert severity="info" sx={{ py: 0 }}>
                            O dano desta magia ainda não está no formato que dá para rolar. Feche e abra a magia de novo.
                        </Alert>
                    )}
                    {spell && components.length === 0 && scaled && !attackParts && (
                        <Alert severity="info" sx={{ py: 0 }}>Esta magia não tem ataque nem dano para rolar.</Alert>
                    )}

                    {attackParts && <SituationalNotes mods={mods} />}
                    {attackParts && <AdjustField label="Ajuste no ataque" value={adjust} onChange={setAdjust} />}
                </Stack>
            </DialogContent>
            <RollActions
                build={build}
                total={total}
                mythicDelta={attack?.mythicDelta ?? null}
                alreadyMythic={attack?.alreadyMythic}
                mythicPoints={mythicPoints}
                onClose={onClose}
                disabled={nothing}
                onRoll={(mythic) => {
                    if (ampOn && ampDef) slots.spendFocus()
                    if (mode) energy.record(mode)
                    send(spellRoll(who, {
                    name: request.name,
                    sub: sub || undefined,
                    attackParts,
                    mythicDelta: mythic && attackParts ? attack!.mythicDelta : null,
                    components: rolled,
                    basic,
                }), mythic && !!attackParts)
                }}
            />
        </>
    )
}
