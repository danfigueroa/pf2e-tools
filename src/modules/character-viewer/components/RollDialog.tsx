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
    FormControlLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import { Casino as DiceIcon } from '@mui/icons-material'
import type { BuildInfo, SpellDescription, Weapon } from '../../character-sheet/types'
import { CONDITION_COLOR, MYTHIC_COLOR, PSYCHE_COLOR } from '../../../theme'
import { characterMaxHp, signed, spellcasterStats } from '../helpers'
import { psycheApplies, psycheDamageBonus } from '../psyche'
import { ampComponents, canAmpPsiCantrips, psiAmpFor } from '../psiAmps'
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
import { checkRoll, mapLabel, raysRoll, rollerIdentity, treatWoundsRoll, spellRoll, spellstrikeRoll, strikeRoll, withSimplePoison, type SpellAttackInfo } from '../rolls'
import type { TableRoll } from '../../../dice/tableRoll'
import { dialogEmbedProps, useEmbedContainer } from '../embedContext'
import { CASCADE_TYPES, hasLaughingShadow, hasSpellstrike, isStudiousSpell, laughingShadowDamage, withLaughingShadow } from '../magus'
import { FIRST_STRIKE_KEY, HUNTERS_AIM_KEY, gravityBonus } from '../ranger'
import { DEBILITATIONS, hasDebilitatingStrike, hasPoisonWeapon, isSimplePoison, poisonNote, simplePoisonDice, type Debilitation } from '../rogue'
import { initiativeBonus } from '../initiative'
import { availableOptions, hasBattleMedicine, hasContinualRecovery, hasRiskySurgery, healActionCost, wardMedicTargets, type HealMode } from '../treatWounds'
import { useConditions } from './useConditions'
import { mythicOptionFor, type MythicContext, type MythicOption } from '../mythicUse'
import { skillActionsFor } from '../skillActions'
import { payTime } from './useSpellCast'
import { castTimeOf, hasPrepaidStrike, NO_RESOURCE, pairCast, takePrepaidStrike, type CastResource } from '../spellCast'
import { useSpellCast } from './useSpellCast'
import { useHpTracker } from './useHpTracker'
import { actionCost, applySpend, shortfall, type ActionKind } from '../actions'
import { actionRange, variantFor } from '../actionVariants'
import { usePoisonOptions } from './usePoisonOptions'
import { useActions } from './useActions'
import { fearsomeBruteBonus, hasExactingStrike, hasFearsomeBrute } from '../fighter'
import { useRogue } from './useRogue'
import { usePoisonDef } from './usePoison'
import { actionsKeyFor, conditionsKeyFor, hpKeyFor, magusKeyFor, rogueKeyFor } from '../charId'
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
        /** De onde sai o que a conjuração gasta: o roll paga ações e recurso (ver `spellCast.ts`). */
        cast?: CastResource
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
const RollActions = ({ mythicOption, total, mythicDelta, mythicPoints, alreadyMythic, onRoll, onClose, disabled, label }: {
    /** O ✦ que a ficha permite NESTA rolagem (`mythicUse.ts`); `null` = o botão nem aparece. */
    mythicOption: MythicOption | null
    total: number | null
    mythicDelta: number | null
    mythicPoints: MythicPointsApi
    alreadyMythic?: boolean
    onRoll: (mythic: boolean) => void
    onClose: () => void
    disabled?: boolean
    /** Texto do botão principal quando não há número a rolar ('Conjurar'). */
    label?: string
}) => {
    const mythic = !!mythicOption && mythicDelta != null && total != null && !alreadyMythic
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
                    title={`${mythicOption?.feat}: troca a proficiência pela mítica (nível + 10) e gasta 1 Ponto Mítico`}
                >
                    {none ? `${mythicOption?.label} · sem Pontos Míticos` : `${mythicOption?.label} ${signed(total! + mythicDelta!)} · ${mythicPoints.available} pt`}
                </Button>
            )}
            <Button variant="contained" startIcon={<DiceIcon />} disabled={disabled} onClick={() => onRoll(false)}>
                {label ?? (total != null ? `Rolar ${signed(total)}` : 'Rolar')}
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
    // Cura com Medicina: Tratar Ferimentos (10 min, sem ações) ou Battle Medicine (1 ação).
    const [healMode, setHealMode] = useState<HealMode | null>(null)
    const [treatDc, setTreatDc] = useState<number | null>(null)
    const [onSelf, setOnSelf] = useState(true)
    const [hour, setHour] = useState(false)
    const [risky, setRisky] = useState(false)
    // Perícia que é uma AÇÃO (Demoralize, Trip, Seek…): gasta as ações dela. Desligado por padrão.
    const [skillActionId, setSkillActionId] = useState<string | null>(null)
    const { check } = request
    const hp = useHpTracker(hpKeyFor(build), characterMaxHp(build, mods.hpMaxDelta), legacyCharKey(build))
    const conditions = useConditions(conditionsKeyFor(build), build.level ?? 1, legacyCharKey(build))
    const actions = useActions(actionsKeyFor(build), mods)
    // Tratar Ferimentos: Medicina Treinada ou melhor. A CD que a proficiência
    // permite é escolha do jogador; a mais alta vem marcada.
    const treatOptions = check.en === 'Medicine' ? availableOptions(check.rank) : []
    const canTreat = treatOptions.length > 0
    const treatOption = treatOptions.find((o) => o.dc === treatDc) ?? treatOptions[treatOptions.length - 1]
    const skillActionList = skillActionsFor(check.en)
    const skillAction = skillActionList.find((a) => a.id === skillActionId) ?? null
    const skillLacking = skillAction && !healMode ? actions.missing(skillAction.actions, 'any') : 0
    const canBattle = canTreat && hasBattleMedicine(build)
    const canRisky = canTreat && hasRiskySurgery(build)
    const riskyOn = healMode === 'treat' && canRisky && risky
    const wounded = mods.active.find((c) => c.id === 'wounded')?.value ?? 0
    const healCost = healMode ? healActionCost(healMode) : 0
    const healLacking = healCost > 0 ? actions.missing(healCost, 'any') : 0
    const canInitiative = INITIATIVE_CHECKS.includes(check.en)
    // Iniciativa: Incredible Initiative e afins (circunstância, não empilham) entram na conta
    // só quando o teste está marcado como iniciativa — o memorial mostra de onde veio.
    const iniBonus = initiative && canInitiative ? initiativeBonus(build, check.en) : null
    const parts = [
        ...check.parts,
        ...(iniBonus && iniBonus.value ? [{ label: `Iniciativa: ${iniBonus.from.join(' / ')} (circunstância)`, value: iniBonus.value, kind: 'other' as const }] : []),
        ...(riskyOn ? [{ label: 'Risky Surgery (circunstância)', value: 2, kind: 'other' as const }] : []),
        ...(adjust ? [{ label: 'Ajuste', value: adjust, kind: 'other' as const }] : []),
    ]
    const total = sumParts(parts)
    const who = useMemo(() => rollerIdentity(build), [build])
    const send = useSend(mythicPoints, onClose)
    // Qual talento libera o ✦ desta rolagem: Ears na Percepção de iniciativa e no Sense Motive,
    // Feet/Arms no salto e na natação, Rewrite Fate nos demais testes.
    const mythicContext: MythicContext = healMode ? 'check'
        : skillAction?.mythic ?? (initiative && canInitiative && check.en === 'Perception' ? 'initiative' : 'check')
    const mythicOption = mythicOptionFor(build, mythicContext)
    return (
        <>
            <DialogTitle sx={{ pb: 1 }}>Rolar {check.label}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    <Memorial parts={parts} total={total} />
                    {request.note && <Typography variant="caption" color="text.secondary">{request.note}</Typography>}
                    <SituationalNotes mods={mods} />
                    <AdjustField label="Outros bônus/penalidades" value={adjust} onChange={setAdjust} />
                    {canTreat && (
                        <Box>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip
                                    label="Tratar Ferimentos · 10 min"
                                    color={healMode === 'treat' ? 'primary' : 'default'}
                                    variant={healMode === 'treat' ? 'filled' : 'outlined'}
                                    onClick={() => setHealMode(healMode === 'treat' ? null : 'treat')}
                                    aria-pressed={healMode === 'treat'}
                                    sx={{ minHeight: 32 }}
                                />
                                {canBattle && (
                                    <Chip
                                        label="Battle Medicine · 1 ação"
                                        color={healMode === 'battle' ? 'primary' : 'default'}
                                        variant={healMode === 'battle' ? 'filled' : 'outlined'}
                                        onClick={() => setHealMode(healMode === 'battle' ? null : 'battle')}
                                        aria-pressed={healMode === 'battle'}
                                        sx={{ minHeight: 32 }}
                                    />
                                )}
                            </Box>
                            {healMode ? (
                                <Stack spacing={1} sx={{ mt: 1 }}>
                                    <ToggleButtonGroup
                                        size="small"
                                        exclusive
                                        fullWidth
                                        value={treatOption.dc}
                                        onChange={(_, v: number | null) => { if (v) setTreatDc(v) }}
                                    >
                                        {treatOptions.map((o) => (
                                            <ToggleButton key={o.dc} value={o.dc} sx={{ flexDirection: 'column', textTransform: 'none', lineHeight: 1.2, py: 0.75 }}>
                                                <b>CD {o.dc}</b>
                                                <span style={{ fontSize: '0.7rem' }}>2d8{o.bonus ? `+${o.bonus}` : ''}</span>
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                    {healMode === 'treat' && (
                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                            <Chip
                                                size="small"
                                                label="Tratar por 1 hora · cura em dobro"
                                                color={hour ? 'primary' : 'default'}
                                                variant={hour ? 'filled' : 'outlined'}
                                                onClick={() => setHour(!hour)}
                                                aria-pressed={hour}
                                            />
                                            {canRisky && (
                                                <Chip
                                                    size="small"
                                                    label="Risky Surgery"
                                                    color={risky ? 'primary' : 'default'}
                                                    variant={risky ? 'filled' : 'outlined'}
                                                    onClick={() => setRisky(!risky)}
                                                    aria-pressed={risky}
                                                />
                                            )}
                                        </Box>
                                    )}
                                    <FormControlLabel
                                        control={<Switch size="small" checked={onSelf} onChange={(e) => setOnSelf(e.target.checked)} />}
                                        label="Em mim mesmo (soma ao meu PV)"
                                    />
                                    {healLacking > 0 && (
                                        <Alert severity="warning" sx={{ py: 0 }}>
                                            Você não tem ações suficientes neste turno (faltam {healLacking}). Dá para rolar mesmo assim.
                                        </Alert>
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                        Sucesso: 2d8{treatOption.bonus ? ` + ${treatOption.bonus}` : ''} PV · crítico: 4d8{treatOption.bonus ? ` + ${treatOption.bonus}` : ''} · falha crítica: 1d8 de dano.
                                        {healMode === 'battle'
                                            ? ' Gasta 1 ação (manipular, exige o kit de curandeiro). Não tira Ferido. O alvo fica imune ao seu Battle Medicine por 1 dia — não ao Tratar Ferimentos.'
                                            : ` Sem custo em ações (são 10 minutos, fora do combate). Sucesso tira Ferido${wounded ? ` (você tem Ferido ${wounded})` : ''}. O alvo fica imune a Tratar Ferimentos por ${hasContinualRecovery(build) ? '10 minutos (Continual Recovery)' : '1 hora'}.`}
                                        {healMode === 'treat' && wardMedicTargets(build, check.rank) > 1 ? ` Ward Medic: até ${wardMedicTargets(build, check.rank)} alvos com a mesma rolagem.` : ''}
                                        {riskyOn ? ' Risky Surgery: +2 no teste, sucesso vira crítico e o paciente toma 1d8 cortante antes da cura.' : ''}
                                    </Typography>
                                </Stack>
                            ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Escolhe a CD, rola a cura e soma ao PV.
                                </Typography>
                            )}
                        </Box>
                    )}
                    {skillActionList.length > 0 && !healMode && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">Esta rolagem é uma ação de perícia?</Typography>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                                {skillActionList.map((a) => (
                                    <Chip
                                        key={a.id}
                                        size="small"
                                        label={`${a.label} · ${a.time ?? `${a.actions} ${a.actions === 1 ? 'ação' : 'ações'}`}`}
                                        color={skillActionId === a.id ? 'primary' : 'default'}
                                        variant={skillActionId === a.id ? 'filled' : 'outlined'}
                                        onClick={() => setSkillActionId(skillActionId === a.id ? null : a.id)}
                                        aria-pressed={skillActionId === a.id}
                                        sx={{ minHeight: 28 }}
                                    />
                                ))}
                            </Box>
                            {skillLacking > 0 && (
                                <Alert severity="warning" sx={{ py: 0, mt: 0.75 }}>
                                    Você não tem ações suficientes neste turno (faltam {skillLacking}). Dá para rolar mesmo assim.
                                </Alert>
                            )}
                        </Box>
                    )}
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
                                {initiativeBonus(build, check.en)?.value ? ' Seus bônus de iniciativa entram na conta ao ligar.' : ''}
                                {initiativeBonus(build, check.en)?.winsTies ? ' Elven Instincts: num empate com oponente, você age primeiro.' : ''}
                            </Typography>
                        </Box>
                    )}
                </Stack>
            </DialogContent>
            <RollActions
                mythicOption={mythicOption}
                total={total}
                mythicDelta={check.mythicDelta}
                mythicPoints={mythicPoints}
                onClose={onClose}
                onRoll={(mythic) => {
                    if (healMode && canTreat) {
                        const out = treatWoundsRoll(who, parts, treatOption, mythic ? check.mythicDelta : null, { mode: healMode, hour, risky: riskyOn })
                        if (healCost > 0) actions.spend(healCost, 'any')
                        if (onSelf) {
                            // Risky Surgery corta ANTES da cura, e o PV temporário absorve o corte. Duas
                            // escritas seguidas no hook se atropelariam (cada uma parte do PV de antes do
                            // clique), então a conta inteira vai numa só.
                            let { current, temp } = hp
                            const cut = out.selfDamage + Math.max(0, -out.delta)
                            const absorbed = Math.min(temp, cut)
                            temp -= absorbed
                            current = Math.max(0, current - (cut - absorbed))
                            if (out.delta > 0) current = Math.min(characterMaxHp(build, mods.hpMaxDelta), current + out.delta)
                            if (current !== hp.current || temp !== hp.temp) hp.restoreHp({ current, temp })
                            if (out.removesWounded && wounded > 0) conditions.setCondition('wounded', 0)
                        }
                        send(out.roll, mythic)
                        return
                    }
                    if (skillAction && skillAction.actions > 0) payTime(actions, { kind: 'actions', n: skillAction.actions }, undefined, [], [])
                    const sub = [skillAction?.label, initiative && canInitiative ? 'iniciativa' : null].filter(Boolean).join(' · ') || undefined
                    send(
                    checkRoll(who, check.label, parts, mythic ? check.mythicDelta : null, sub, initiative && canInitiative),
                    mythic,
                    )
                }}
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

    // Laughing Shadow: alvo desprevenido e a outra mão livre sobem o dano da postura (2 → 5). É da SITUAÇÃO,
    // como o Hunter's Aim: não fica lembrado de um Golpe para o outro.
    const [laughing, setLaughing] = useState(false)
    const laughingApplies = hasLaughingShadow(build) && !!mods.cascade && !strike.traits.ranged && opts.mode !== 'thrown'
    const plan = planStrike(build, strike, withLaughingShadow(mods, build, laughing && laughingApplies), opts)
    const { traits } = strike

    // Spellstrike: só em Golpe corpo a corpo. A magia escolhida entra no mesmo
    // clique que rola o Golpe, gasta o slot e marca o Spellstrike como gasto.
    const magus = useMagus(magusKeyFor(build), build)
    const canSpellstrike = hasSpellstrike(build) && !traits.ranged && opts.mode !== 'thrown'
    const ss = useSpellstrike(build, canSpellstrike, mythicPoints)
    const spellstriking = canSpellstrike && ss.ready

    // Veneno na arma (Poison Weapon) e Debilitating Strike do Ladino: viram anotação da
    // rolagem — o app não sabe se o Golpe acertou, e o efeito é do GM.
    const rogue = useRogue(rogueKeyFor(build))
    // Arma ainda limpa e o personagem tem Poison Weapon: dá para aplicar o veneno AQUI, no
    // mesmo clique do Golpe (e a ação da aplicação entra na conta sozinha).
    const canApplyPoison = hasPoisonWeapon(build) && !!weapon && !rogue.stored.poison
    const po = usePoisonOptions(build, rogue, canApplyPoison)
    const [applyNow, setApplyNow] = useState(false)
    const applying = canApplyPoison && applyNow && !!po.selected
    // O veneno desta rolagem: o que já está na lâmina, ou o que vai ser aplicado agora.
    const poisonName = weapon ? (rogue.stored.poison ?? (applying ? po.selected!.name : null)) : null
    const simplePoison = isSimplePoison(poisonName)
    const simpleDice = simplePoisonDice(build)
    const poisonDef = usePoisonDef(simplePoison ? null : poisonName)
    const [poisonOn, setPoisonOn] = useState(true)
    // Aplicando agora, o veneno entra por definição; o chip liga/desliga só o que já estava na lâmina.
    const poisonUsed = !!poisonName && (rogue.stored.poison ? poisonOn : true)
    const canDebilitate = hasDebilitatingStrike(build)
    const [debil, setDebil] = useState<Debilitation | null>(null)
    // Guerreiro: Exacting Strike (anotação) e Fearsome Brute (entra na conta do dano, ver planStrike).
    const [exacting, setExacting] = useState(false)

    // Ações do turno: um Golpe custa 1 (2 com Hunter's Aim ou Spellstrike). Reação (Reactive
    // Strike) não gasta ação — gasta a reação da rodada.
    const actions = useActions(actionsKeyFor(build), mods)
    const [asReaction, setAsReaction] = useState(false)
    const aiming = huntersAimApplies(build, strike, opts) && opts.extrasOn[HUNTERS_AIM_KEY] === true
    const actionCostNow = asReaction ? 0 : spellstriking || aiming ? 2 : 1
    const actionKind: ActionKind = spellstriking || aiming ? 'any' : 'move-attack'
    // Aplicar o veneno custa 1 ação à parte (paga primeiro, de qualquer tipo); o Golpe vem depois.
    // Uma atividade que inclui o Golpe (Sudden Charge, Vicious Swing…) já o pagou: este Golpe não cobra.
    const strikePaid = !asReaction && hasPrepaidStrike()
    const lacking = strikePaid
        ? (applying ? actions.missing(1, 'any') : 0)
        : applying
            ? actions.missing(1, 'any')
                + shortfall(applySpend(actions.stored, actions.budget, 1, 'any'), actions.budget, actionCostNow, actionKind)
            : actions.missing(actionCostNow, actionKind)
    const reactionUsed = asReaction && actions.stored.reacted
    const rollNote = [
        poisonName && poisonUsed ? (simplePoison ? `veneno simples: ${simpleDice.count}d${simpleDice.faces} de veneno, sem salvaguarda` : poisonNote(poisonName, poisonDef)) : null,
        debil ? DEBILITATIONS.find((d) => d.id === debil)?.note : null,
        exacting ? 'Exacting Strike: se errar, não conta para a penalidade de ataques múltiplos' : null,
    ].filter(Boolean).join(' · ')
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

                    <Box>
                        <Chip
                            label="É uma reação (Reactive Strike)"
                            color={asReaction ? 'primary' : 'default'}
                            variant={asReaction ? 'filled' : 'outlined'}
                            onClick={() => setAsReaction(!asReaction)}
                            aria-pressed={asReaction}
                            size="small"
                            sx={{ minHeight: 28 }}
                        />
                    </Box>
                    {lacking > 0 && (
                        <Alert severity="warning" sx={{ py: 0 }}>
                            Você não tem ações suficientes neste turno (faltam {lacking}). Dá para rolar mesmo assim.
                        </Alert>
                    )}
                    {reactionUsed && (
                        <Alert severity="warning" sx={{ py: 0 }}>A reação desta rodada já foi usada.</Alert>
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

                    {hasFearsomeBrute(build) && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Fearsome Brute — alvo amedrontado
                            </Typography>
                            <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={opts.frightened ?? 0}
                                onChange={(_, v) => { if (v !== null) setOpts({ ...opts, frightened: v }) }}
                                fullWidth
                            >
                                {[0, 1, 2, 3, 4].map((n) => (
                                    <ToggleButton key={n} value={n}>
                                        {n === 0 ? 'Não' : `${n} (+${fearsomeBruteBonus(build, n)})`}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Box>
                    )}
                    {laughingApplies && (
                        <Box>
                            <Chip
                                label={`Laughing Shadow · alvo desprevenido, outra mão livre (${laughingShadowDamage(build)} de dano da postura)`}
                                color={laughing ? 'primary' : 'default'}
                                variant={laughing ? 'filled' : 'outlined'}
                                onClick={() => setLaughing(!laughing)}
                                aria-pressed={laughing}
                                sx={{ minHeight: 32, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Só com a outra mão completamente vazia (nada de arma de mão livre ou item nela) e contra alvo desprevenido — Finta, flanco, invisibilidade.
                            </Typography>
                        </Box>
                    )}
                    {hasExactingStrike(build) && (
                        <Box>
                            <Chip
                                label="Exacting Strike · 1 ação (Pressionar)"
                                color={exacting ? 'primary' : 'default'}
                                variant={exacting ? 'filled' : 'outlined'}
                                onClick={() => setExacting(!exacting)}
                                aria-pressed={exacting}
                                sx={{ minHeight: 32 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Se este Golpe errar, ele não conta para a penalidade de ataques múltiplos — marque o próximo ataque de acordo.
                            </Typography>
                        </Box>
                    )}
                    {canApplyPoison && (
                        <Box>
                            <Chip
                                label="Aplicar veneno antes do Golpe · +1 ação"
                                color={applyNow ? 'primary' : 'default'}
                                variant={applyNow ? 'filled' : 'outlined'}
                                onClick={() => setApplyNow(!applyNow)}
                                aria-pressed={applyNow}
                                sx={{ minHeight: 32 }}
                            />
                            {applyNow && (
                                <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                                    <Select
                                        size="small"
                                        value={po.selected?.name ?? ''}
                                        onChange={(e) => po.setChoice(e.target.value)}
                                        inputProps={{ 'aria-label': 'Veneno a aplicar' }}
                                        displayEmpty
                                        fullWidth
                                    >
                                        {po.options.map((o) => (
                                            <MenuItem key={o.name} value={o.name} disabled={o.left === 0}>
                                                {o.label} · {isSimplePoison(o.name) ? `${o.left}/${o.of} por dia` : `×${o.left}`}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    <Typography variant="caption" color="text.secondary">
                                        {po.selected
                                            ? 'Ao rolar: aplica (Interagir, 1 ação), gasta a dose e o Golpe já leva o veneno.'
                                            : 'Sem veneno para aplicar.'}
                                    </Typography>
                                    {rogue.stored.simpleUsed > 0 && (
                                        <Typography variant="caption" color="text.secondary">
                                            Veneno simples: {po.simpleLeft} de {po.dose} doses hoje.{' '}
                                            <Button size="small" onClick={rogue.newDay} sx={{ minWidth: 0, p: 0, verticalAlign: 'baseline' }}>
                                                Nova preparação
                                            </Button>
                                        </Typography>
                                    )}
                                </Stack>
                            )}
                        </Box>
                    )}
                    {weapon && rogue.stored.poison && (
                        <Box>
                            <Stack direction="row" alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                <Chip
                                    label={simplePoison ? `Arma envenenada · veneno simples ${simpleDice.count}d${simpleDice.faces}` : `Arma envenenada · ${poisonNote(rogue.stored.poison, poisonDef).replace('veneno: ', '')}`}
                                    color={poisonOn ? 'primary' : 'default'}
                                    variant={poisonOn ? 'filled' : 'outlined'}
                                    onClick={() => setPoisonOn(!poisonOn)}
                                    aria-pressed={poisonOn}
                                    sx={{ minHeight: 32 }}
                                />
                                <Button size="small" color="inherit" onClick={rogue.clearPoison}>
                                    Veneno usado
                                </Button>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {simplePoison
                                    ? `Rola ${simpleDice.count}d${simpleDice.faces} de veneno junto, sem salvaguarda e sem dobrar no crítico — vale se o Golpe acertar. Quando acertar, toque "Veneno usado".`
                                    : 'O veneno entra se o Golpe acertar; a rolagem diz qual é. Quando acertar, toque "Veneno usado".'}
                            </Typography>
                        </Box>
                    )}
                    {canDebilitate && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Debilitating Strike — se acertar um alvo desprevenido (ação livre)
                            </Typography>
                            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                {DEBILITATIONS.map((d) => (
                                    <Chip
                                        key={d.id}
                                        label={d.label}
                                        color={debil === d.id ? 'primary' : 'default'}
                                        variant={debil === d.id ? 'filled' : 'outlined'}
                                        onClick={() => setDebil(debil === d.id ? null : d.id)}
                                        aria-pressed={debil === d.id}
                                        sx={{ minHeight: 32 }}
                                    />
                                ))}
                            </Stack>
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
                mythicOption={mythicOptionFor(build, 'strike')}
                total={plan.attackTotal}
                mythicDelta={plan.mythicDelta}
                mythicPoints={mythicPoints}
                onClose={onClose}
                // Magia escolhida e ainda não pronta (buscando, sem slot, regra): o jogador
                // precisa trocar por "Só o Golpe" — rolar sem ela em silêncio enganaria.
                disabled={loading || (canSpellstrike && !!ss.option && !ss.ready)}
                onRoll={(mythic) => {
                    if (applying) { actions.spend(1); po.applyChosen() }
                    if (asReaction) { if (!actions.stored.reacted) actions.toggleReaction() }
                    else if (!takePrepaidStrike()) actions.spend(actionCostNow, actionKind)
                    const mythicDelta = mythic ? plan.mythicDelta : null
                    const noted = (r: TableRoll): TableRoll => {
                        const poisoned = simplePoison && poisonUsed ? withSimplePoison(r, simpleDice) : r
                        return rollNote ? { ...poisoned, note: rollNote } : poisoned
                    }
                    if (!spellstriking || !ss.option || !ss.spell) {
                        send(noted(strikeRoll(who, strike, plan, mythicDelta, sub)), mythic)
                        return
                    }
                    ss.spend()
                    // A magia do Spellstrike já saiu do slot: marcar o slot na lista depois não conta de novo.
                    pairCast(ss.option.name, 'roll')
                    magus.spendSpellstrike()
                    if (ss.enterCascade && magus.canCascade && !magus.stored.cascade) {
                        // O tipo da postura é o da última magia: a primeira parcela de dano ligada.
                        const type = ss.chosen.flatMap((c) => c.types).find((t) => (CASCADE_TYPES as readonly string[]).includes(t))
                        magus.setCascadeType(type ?? 'force')
                        magus.setCascade(true)
                        actions.spend(1)
                    }
                    // Magia de salvaguarda: a CD é a do BLOCO de onde ela vem (a do Mythic Magic é a mítica), ou a do
                    // grupo de foco no truque de foco; a de ataque usa o Golpe.
                    const caster = build.spellCasters?.[ss.option.casterIndex]
                    const baseDc = ss.option.focus ? ss.option.focus.dc : caster ? spellcasterStats(build, caster).dc : null
                    const dc = baseDc != null ? baseDc + mods.total.spellDc : null
                    const defense = !ss.usesAttack && ss.spell.defense ? `salvaguarda: ${ss.spell.defense}${dc ? ` (CD ${dc})` : ''}` : null
                    const amped = ss.ampOn ? 'amplificada' : null
                    send(noted(spellstrikeRoll(who, strike, plan, mythicDelta, [sub, `rank ${ss.option.rank}`, amped, defense].filter(Boolean).join(' · '), {
                        name: ss.option.name,
                        components: ss.chosen,
                        usesAttack: ss.usesAttack,
                    })), mythic)
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
    // Ações do turno: a magia custa o que a AON diz (reação, ação livre e "1 a 3" não gastam sozinhas).
    const actions = useActions(actionsKeyFor(build), mods)
    // Magia de ação variável: o jogador escolhe quantas ações gasta, e o custo, o dano e o efeito seguem a escolha.
    const range = spell ? actionRange(spell.actions) : null
    const [chosenActions, setChosenActions] = useState<number | null>(null)
    const nActions = range ? Math.min(range.max, Math.max(range.min, chosenActions ?? range.min)) : null
    const variant = nActions != null && castRank != null ? variantFor(request.name, castRank, nActions) : null
    const spellActions = range ? (nActions ?? range.min) : spell ? (actionCost(spell.actions) ?? 0) : 0
    const lackingSpell = actions.missing(spellActions)
    // Rolar também CONJURA: paga as ações e o recurso (slot, foco, Ponto Mítico). Marcar o slot
    // à mão depois da rolagem não paga de novo — `pairCast` casa as duas (ver `spellCast.ts`).
    const spellCast = useSpellCast(build, mods, mythicPoints, slots)
    // Magia estudiosa: a Arcane Cascade pode vir logo depois, como ação livre (em vez da ação de sempre).
    const magus = useMagus(magusKeyFor(build), build)
    const studious = !!spell && magus.canCascade && !magus.stored.cascade && isStudiousSpell(build, request.name)
    const [studiousCascade, setStudiousCascade] = useState(true)
    const resource: CastResource = spell ? (request.cast ?? NO_RESOURCE) : NO_RESOURCE
    const castTime = spell ? castTimeOf(spell.actions) : null
    const resourceLacking =
        resource.kind === 'slot' || resource.kind === 'spontaneous' ? slots.usedOf(resource.key) >= resource.total
            : resource.kind === 'focus' ? slots.focusUsed >= slots.focusMax
                : resource.kind === 'mythic' ? mythicPoints.available <= 0
                    : false
    const resourceText =
        resource.kind === 'slot' || resource.kind === 'spontaneous' ? `1 slot de rank ${castRank ?? '?'}`
            : resource.kind === 'focus' ? '1 ponto de foco'
                : resource.kind === 'mythic' ? '1 Ponto Mítico (Mythic Magic)'
                    : null
    const costText = [
        castTime?.kind === 'reaction' ? 'a reação' : spellActions > 0 ? `${spellActions} ${spellActions === 1 ? 'ação' : 'ações'}` : null,
        resourceText,
    ].filter(Boolean).join(' e ')
    const ampDef = request.psychic && canAmpPsiCantrips(build) ? psiAmpFor(request.name) : null
    const focusLeft = Math.max(0, (build.focusPoints ?? 0) - slots.focusUsed)
    const [ampOn, setAmpOn] = useState(false)
    const [melee, setMelee] = useState(false)
    const conserve = !!request.psychic && hasConservation(build) && isEnergySpell(request.name)
    const [picked, setPicked] = useState<EnergyMode | null>(null)
    const mode: EnergyMode | null = conserve ? (picked && energy.allowed.includes(picked) ? picked : energy.allowed[0]) : null

    const buildComponents = (amped: boolean): ScaledComponent[] => {
        const amp = amped && ampDef?.damage && castRank != null ? ampDef.damage(castRank, melee) : null
        const swapped: ScaledComponent[] = amp
            ? [...ampComponents(amp), ...baseComponents.filter((c) => c.kind !== 'damage')]
            : baseComponents
        return mode ? swapped.map((c) => (c.kind === 'damage' ? { ...c, types: convertTypes(c.types, mode) } : c)) : swapped
    }
    const components = variant?.components ?? buildComponents(ampOn)
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
    // Sem ataque nem dano (Guidance, Bless…): não há o que rolar, mas ainda se conjura.
    const nothing = !attackParts && chosen.length === 0
    const castOnly = nothing && !!spell

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

                    {range && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">Quantas ações você gasta nesta magia</Typography>
                            <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={nActions}
                                onChange={(_, v: number | null) => {
                                    if (v == null) return
                                    setChosenActions(v)
                                    const next = castRank != null ? variantFor(request.name, castRank, v)?.components : null
                                    if (next) setSelected(defaultSelection(next))
                                }}
                                fullWidth
                            >
                                {Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i).map((n) => (
                                    <ToggleButton key={n} value={n}>{n} {n === 1 ? 'ação' : 'ações'}</ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                            {variant ? (
                                variant.notes.map((note) => (
                                    <Typography key={note} variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{note}</Typography>
                                ))
                            ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    O efeito desta magia muda com as ações (alvos, área, dano). Os números aqui são os da descrição — confira o que o seu número de ações faz.
                                </Typography>
                            )}
                        </Box>
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
                        <Alert severity="info" sx={{ py: 0 }}>Esta magia não tem ataque nem dano para rolar: "Conjurar" só registra o gasto.</Alert>
                    )}
                    {spell && costText && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {castOnly ? 'Conjurar' : 'Rolar'} gasta {costText}.{resourceText ? ' Se você já marcou o slot na lista, não conta de novo.' : ''}
                        </Typography>
                    )}
                    {spell && resourceLacking && (
                        <Alert severity="warning" sx={{ py: 0 }}>
                            {resource.kind === 'mythic' ? 'Você não tem Pontos Míticos.' : resource.kind === 'focus' ? 'Você não tem pontos de foco.' : 'Não há slot disponível deste rank.'} Dá para conjurar mesmo assim, mas nada é descontado.
                        </Alert>
                    )}

                    {lackingSpell > 0 && (
                        <Alert severity="warning" sx={{ py: 0 }}>
                            Você não tem ações suficientes neste turno (faltam {lackingSpell}). Dá para rolar mesmo assim.
                        </Alert>
                    )}
                    {studious && (
                        <Chip
                            label="Magia estudiosa: entrar na Arcane Cascade como ação livre"
                            color={studiousCascade ? 'primary' : 'default'}
                            variant={studiousCascade ? 'filled' : 'outlined'}
                            aria-pressed={studiousCascade}
                            onClick={() => setStudiousCascade(!studiousCascade)}
                            sx={{ minHeight: 32, height: 'auto', alignSelf: 'flex-start', '& .MuiChip-label': { whiteSpace: 'normal' } }}
                        />
                    )}
                    {attackParts && <SituationalNotes mods={mods} />}
                    {attackParts && <AdjustField label="Ajuste no ataque" value={adjust} onChange={setAdjust} />}
                </Stack>
            </DialogContent>
            <RollActions
                mythicOption={mythicOptionFor(build, 'spell-attack')}
                total={total}
                mythicDelta={attack?.mythicDelta ?? null}
                alreadyMythic={attack?.alreadyMythic}
                mythicPoints={mythicPoints}
                onClose={onClose}
                disabled={nothing && !castOnly}
                label={castOnly ? 'Conjurar' : undefined}
                onRoll={(mythic) => {
                    if (spell) {
                        spellCast.cast({ name: request.name, actionsText: spell.actions, resource, via: 'roll', chosenActions: range ? nActions : undefined, traits: spell.traits })
                    } else {
                        actions.spend(spellActions)
                    }
                    // Antes do "Conjurar" fechar: o Shield amplificado não tem o que rolar, mas gasta o ponto.
                    if (ampOn && ampDef) slots.spendFocus()
                    if (studious && studiousCascade) {
                        // A postura pega o tipo de dano da magia; magia estudiosa sem dano (Blur) deixa a de força.
                        const type = chosen.flatMap((c) => c.types).find((t) => (CASCADE_TYPES as readonly string[]).includes(t))
                        magus.setCascadeType(type ?? 'force')
                        magus.setCascade(true)
                    }
                    if (castOnly) { onClose(); return }
                    if (mode) energy.record(mode)
                    // Um raio por ação (Blazing Bolt): cada um com o próprio ataque e dano, mas numa
                    // rolagem só — um cartão com os raios e o total, não um popup por raio.
                    const rays = attackParts ? (variant?.rays ?? 1) : 1
                    if (attackParts && rays > 1) {
                        send(raysRoll(who, {
                            name: request.name,
                            sub: sub || undefined,
                            rays: Array.from({ length: rays }, () => ({ attackParts, mythicDelta: mythic ? attack!.mythicDelta : null })),
                            components: rolled,
                        }), mythic)
                        return
                    }
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
