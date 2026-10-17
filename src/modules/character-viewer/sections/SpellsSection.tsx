import { useMemo, useState, memo } from 'react'
import { Box, Button, Card, CardContent, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Tooltip, Typography, Stack, Chip, Divider, LinearProgress } from '@mui/material'
import {
    ChevronRight as ChevronIcon,
    CloudDownload as DownloadIcon,
    Restore as RestoreIcon,
    Bolt as SpendIcon,
    Casino as DiceIcon,
} from '@mui/icons-material'
import type { BuildInfo, SpellCaster, FocusTradition, FocusAbility } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'
import { actionSymbol, isMythicMagicCaster, MYTHIC_COLOR, signed, spellcasterStats, traditionColor, traditionLabel } from '../helpers'
import { castRankForSlot, damageAtRank } from '../heightening'
import { getCachedSpell, prefetchSpellDescriptions, useDescriptionCacheVersion } from '../../../services/descriptions'
import { legacyCharKey, slotsKeyFor } from '../charId'
import { slotKey, useSpellSlots, type SpellSlotsApi } from '../components/useSpellSlots'
import { SlotPips, SlotCount } from '../components/SlotPips'
import { gold, PSYCHE_COLOR } from '../../../theme'
import { psycheDamageBonus } from '../psyche'
import { signatureSpellsFor } from '../signatureSpells'
import { ConditionDelta } from '../components/ConditionDelta'
import type { ConditionModifiers } from '../conditions'
import type { MythicPointsApi } from '../components/useMythicPoints'
import type { RollRequest } from '../components/RollDialog'
import { casterAttack, focusAttack } from '../rolls'
import { EmbedDialog } from '../components/EmbedDialog'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    onRoll: (req: RollRequest) => void
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
}

const SpellsSectionView = ({ build, onSelect, onRoll, mods, mythicPoints }: Props) => {
    const hasCasters = build.spellCasters?.some(c => c.spells.some(l => l.list.length > 0))
    const focusSpells = useMemo(() => collectFocusSpells(build), [build])
    const focusRank = castRankForSlot(0, build.level)
    const focusMax = build.focusPoints ?? 0
    const slots = useSpellSlots(slotsKeyFor(build), focusMax, legacyCharKey(build))
    // As linhas leem o cache no render; magia aberta no drawer ou baixada pelo
    // "Carregar todas" precisa repintar a lista com o resumo novo.
    useDescriptionCacheVersion()

    const allNames = useMemo(() => {
        const names = new Set<string>()
        build.spellCasters?.forEach(c => c.spells.forEach(l => l.list.forEach(n => names.add(n))))
        focusSpells.forEach(f => names.add(f.name))
        return Array.from(names)
    }, [build, focusSpells])

    // Progresso do "Carregar todas"; cada atualização re-renderiza e as linhas
    // releem o cache — é assim que os resumos aparecem progressivamente.
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
    // "Novo dia" agora devolve os slots para a mesa inteira, não só para quem
    // clicou — deixou de ser um clique sem consequência.
    const [confirmNewDay, setConfirmNewDay] = useState(false)
    const allCached = allNames.every(n => getCachedSpell(n) != null)

    const loadAll = async () => {
        setProgress({ done: 0, total: allNames.length })
        await prefetchSpellDescriptions(allNames, (done, total) => setProgress({ done, total }))
        setProgress(null)
    }

    if (!hasCasters && focusSpells.length === 0) {
        return (
            <Card>
                <CardContent>
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Este personagem não conjura magias.
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    // Truques são à vontade: só há o que controlar a partir do nível 1 (ou no foco).
    // Mythic Magic não tem slot — o que ela gasta é Ponto Mítico, que o "Novo dia" não devolve.
    const hasTrackable =
        !!build.spellCasters?.some(c => !isMythicMagicCaster(c) && c.spells.some(l => l.spellLevel > 0 && l.list.length > 0)) ||
        (focusSpells.length > 0 && focusMax > 0)

    return (
        <Stack spacing={2}>
            <EmbedDialog open={confirmNewDay} onClose={() => setConfirmNewDay(false)}>
                <DialogTitle>Começar um novo dia?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Todos os slots de magia e pontos de foco voltam a ficar disponíveis.
                        Como a ficha é compartilhada, isso vale para todos os jogadores.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => setConfirmNewDay(false)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={() => { slots.resetAll(); setConfirmNewDay(false) }}
                    >
                        Novo dia
                    </Button>
                </DialogActions>
            </EmbedDialog>

            {hasTrackable && (
                <Card>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                {slots.spentCount > 0
                                    ? `Gastos hoje: ${slots.spentCount}. Toque num slot gasto para recuperá-lo.`
                                    : 'Toque num slot para gastá-lo; toque de novo para recuperá-lo.'}
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<RestoreIcon />}
                                disabled={slots.spentCount === 0}
                                onClick={() => setConfirmNewDay(true)}
                                sx={{ flexShrink: 0 }}
                            >
                                Novo dia
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {!allCached && (
                <Card>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        {progress ? (
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Carregando magias… {progress.done}/{progress.total}
                                </Typography>
                                <LinearProgress
                                    variant={progress.total > 0 ? 'determinate' : 'indeterminate'}
                                    value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
                                    sx={{ mt: 0.75, borderRadius: 1 }}
                                />
                            </Box>
                        ) : (
                            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                    Baixe todas as descrições de uma vez para consultar na mesa sem espera.
                                </Typography>
                                <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={loadAll}>
                                    Carregar todas
                                </Button>
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            )}

            {build.spellCasters
                ?.map((caster, idx) => ({ caster, idx }))
                .filter(({ caster }) => caster.spells.some(l => l.list.length > 0))
                .map(({ caster, idx }) => (
                    <CasterCard
                        key={`${caster.name}-${idx}`}
                        caster={caster}
                        casterIdx={idx}
                        build={build}
                        slots={slots}
                        mythicPoints={mythicPoints}
                        onSelect={onSelect}
                        onRoll={onRoll}
                        mods={mods}
                    />
                ))}

            {focusSpells.length > 0 && (
                <Card>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                                <Typography variant="overline" sx={{ fontWeight: 700, color: 'primary.light' }}>
                                    Magias de Foco (nível {focusRank})
                                </Typography>
                                {focusMax > 0 && (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography variant="caption" color="text.secondary">
                                            <SlotCount total={focusMax} used={slots.focusUsed} /> pontos
                                        </Typography>
                                        <SlotPips
                                            total={focusMax}
                                            used={slots.focusUsed}
                                            color={gold.main}
                                            onChange={slots.setFocusUsed}
                                            label="Ponto de foco"
                                            size={16}
                                        />
                                    </Stack>
                                )}
                            </Stack>
                        </Box>
                        {focusSpells.map((s, idx) => (
                            <SpellRow
                                key={`${s.name}-${idx}`}
                                name={s.name}
                                accent={traditionColor(s.tradition)}
                                request={{
                                    type: 'spell',
                                    name: s.name,
                                    level: focusRank,
                                    autoHeightened: true,
                                    caster: focusCasterInfo(build, s, mods),
                                }}
                                onSelect={onSelect}
                                spend={focusMax > 0 ? {
                                    onSpend: slots.spendFocus,
                                    disabled: slots.focusUsed >= focusMax,
                                    tooltip: 'Gastar 1 Ponto de Foco',
                                } : undefined}
                                dimmed={focusMax > 0 && slots.focusUsed >= focusMax}
                                psycheOn={!!mods.psyche}
                            />
                        ))}
                        {focusMax > 0 && (
                            <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Refocus (10 min) devolve 1 ponto — toque num ponto gasto para recuperá-lo.
                                </Typography>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}
        </Stack>
    )
}

interface CasterProps {
    caster: SpellCaster
    casterIdx: number
    build: BuildInfo
    slots: SpellSlotsApi
    mythicPoints: MythicPointsApi
    onSelect: Props['onSelect']
    onRoll: Props['onRoll']
    mods: ConditionModifiers
}

const CasterCard = ({ caster, casterIdx, build, slots, mythicPoints, onSelect, onRoll, mods }: CasterProps) => {
    const base = spellcasterStats(build, caster)
    // A conta do ataque de magia, para a rolagem (mesmo total do "Atq" abaixo).
    const attackInfo = casterAttack(build, caster, mods)
    // Estupefato pesa em CD e ataque de magia (testes de INT/SAB/CAR).
    const dc = base.dc + mods.total.spellDc
    const attack = base.attack + mods.total.attackSpell
    const accent = traditionColor(caster.magicTradition)
    // Espontâneo: os slots do nível são intercambiáveis (repertório à parte).
    // Preparado/inato: cada cópia preparada é o próprio slot.
    const isSpontaneous = caster.spellcastingType === 'spontaneous'
    // Mythic Magic: os "slots" que o Pathbuilder exporta não existem; cada
    // conjuração sai do pool de Pontos Míticos da barra do topo.
    const isMythicMagic = isMythicMagicCaster(caster)

    // Assinatura: a magia aparece no rank que o repertório a guarda e, elevada,
    // em todo rank acima que tenha slot (`signatureSpells.ts`).
    const signature = useMemo(() => signatureSpellsFor(build, caster), [build, caster])
    const levels = useMemo(() => {
        const known = new Map<number, string[]>()
        for (const l of caster.spells) if (l.list.length > 0) known.set(l.spellLevel, l.list)
        const baseRank = new Map<string, number>()
        for (const name of signature) {
            const rank = [...known.entries()].find(([lvl, list]) => lvl > 0 && list.includes(name))?.[0]
            if (rank != null) baseRank.set(name, rank)
        }
        const ranks = new Set<number>(known.keys())
        for (const [lvl, total] of (caster.perDay ?? []).entries()) {
            if (lvl > 0 && total > 0 && [...baseRank.values()].some((r) => r < lvl)) ranks.add(lvl)
        }
        return [...ranks].sort((a, b) => a - b).map((spellLevel) => {
            const entries: Array<{ name: string; count: number; signature?: 'base' | 'raised' }> =
                dedupe(known.get(spellLevel) ?? []).map((e) => ({
                    ...e,
                    signature: baseRank.get(e.name) === spellLevel ? 'base' : undefined,
                }))
            for (const [name, rank] of baseRank) {
                if (rank < spellLevel) entries.push({ name, count: 1, signature: 'raised' })
            }
            return { spellLevel, entries }
        })
    }, [caster, signature])

    const levelKey = (spellLevel: number, name?: string) => slotKey(casterIdx, caster.name, spellLevel, name)

    /** Total/gastos do nível — truques (nível 0) são à vontade, não têm slot. */
    const levelSummary = (spellLevel: number, entries: Array<{ name: string; count: number }>) => {
        if (spellLevel === 0 || isMythicMagic) return null
        if (isSpontaneous) {
            const total = caster.perDay?.[spellLevel] ?? 0
            return total > 0 ? { total, used: Math.min(total, slots.usedOf(levelKey(spellLevel))) } : null
        }
        let total = 0
        let used = 0
        for (const e of entries) {
            total += e.count
            used += Math.min(e.count, slots.usedOf(levelKey(spellLevel, e.name)))
        }
        return { total, used }
    }

    return (
        <Card sx={{ borderLeft: `3px solid ${accent}` }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Box sx={{ px: 2, py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                {caster.name}
                            </Typography>
                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                                <Chip
                                    label={traditionLabel(caster.magicTradition)}
                                    size="small"
                                    sx={{
                                        backgroundColor: accent + '22',
                                        color: accent,
                                        border: `1px solid ${accent}55`,
                                        fontWeight: 600,
                                    }}
                                />
                                <Chip
                                    label={isMythicMagic
                                        ? 'Ponto Mítico'
                                        : caster.spellcastingType === 'prepared' ? 'Preparado' : 'Espontâneo'}
                                    size="small"
                                    variant="outlined"
                                    sx={isMythicMagic ? { color: MYTHIC_COLOR, borderColor: MYTHIC_COLOR } : undefined}
                                />
                            </Stack>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                CD {dc}
                            </Typography>
                            <ConditionDelta delta={mods.total.spellDc} base={base.dc} align="right" />
                            <Button
                                size="small"
                                startIcon={<DiceIcon />}
                                onClick={() => onRoll({ kind: 'spell', name: `Ataque de magia — ${caster.name}`, attack: attackInfo })}
                                aria-label={`Rolar ataque de magia de ${caster.name}`}
                                sx={{ mt: 0.25, minHeight: 32, px: 1 }}
                            >
                                Atq {signed(attack)}
                            </Button>
                        </Box>
                    </Stack>
                    {isMythicMagic && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Sem slots: cada conjuração gasta <strong>1 Ponto Mítico</strong>, com proficiência
                            mítica no ataque e na CD. Disponíveis agora: {mythicPoints.available} de {mythicPoints.max}.
                        </Typography>
                    )}
                </Box>

                {/* Resumo dos slots do dia (disponíveis/total por nível). */}
                {levels.some(l => levelSummary(l.spellLevel, l.entries) != null) && (
                    <Box sx={{ px: 2, pb: 1.5 }}>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {levels.map((l) => {
                                const s = levelSummary(l.spellLevel, l.entries)
                                if (!s) return null
                                const empty = s.used >= s.total
                                return (
                                    <Chip
                                        key={l.spellLevel}
                                        size="small"
                                        label={<>Nv {l.spellLevel}: <SlotCount total={s.total} used={s.used} /></>}
                                        sx={{
                                            height: 22,
                                            fontSize: '0.7rem',
                                            opacity: empty ? 0.5 : 1,
                                            textDecoration: empty ? 'line-through' : 'none',
                                        }}
                                    />
                                )
                            })}
                        </Stack>
                    </Box>
                )}

                <Divider />

                {levels.map(({ spellLevel, entries }) => {
                    const castRank = castRankForSlot(spellLevel, build.level)
                    const summary = levelSummary(spellLevel, entries)
                    const key = levelKey(spellLevel)
                    return (
                        <Box key={spellLevel}>
                            <Box sx={{
                                px: 2, py: 0.75,
                                backgroundColor: 'action.hover',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                            }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                                    {spellLevel === 0 ? `TRUQUES (NÍVEL ${castRank})` : `NÍVEL ${spellLevel}`}
                                </Typography>
                                {/* Espontâneo: os slots ficam no cabeçalho, não na magia. */}
                                {isSpontaneous && summary && (
                                    <SlotPips
                                        total={summary.total}
                                        used={summary.used}
                                        color={accent}
                                        onChange={(next) => slots.setUsed(key, next, summary.total)}
                                        label={`Slot de nível ${spellLevel}`}
                                    />
                                )}
                            </Box>
                            {entries.map(({ name, count, signature: sig }) => {
                                const rowKey = levelKey(spellLevel, name)
                                const used = Math.min(count, slots.usedOf(rowKey))
                                const tracked = spellLevel > 0 && !isSpontaneous && !isMythicMagic
                                const spontaneousSpend = isMythicMagic
                                    ? {
                                        onSpend: mythicPoints.spend,
                                        disabled: mythicPoints.available === 0,
                                        tooltip: 'Gastar 1 Ponto Mítico',
                                        emptyTooltip: 'Sem Pontos Míticos disponíveis',
                                    }
                                    : isSpontaneous && summary
                                    ? {
                                        onSpend: () => slots.spendOne(key, summary.total),
                                        disabled: summary.used >= summary.total,
                                        tooltip: `Gastar 1 slot de nível ${spellLevel}`,
                                    }
                                    : undefined
                                return (
                                    <SpellRow
                                        key={name}
                                        name={name}
                                        count={count}
                                        accent={accent}
                                        request={{
                                            type: 'spell',
                                            name,
                                            level: castRank,
                                            autoHeightened: spellLevel === 0,
                                            caster: { name: caster.name, dc, attack, tradition: caster.magicTradition, attackInfo, psychic: isPsychicCaster(build, caster) },
                                        }}
                                        onSelect={onSelect}
                                        pips={tracked ? {
                                            total: count,
                                            used,
                                            onChange: (next: number) => slots.setUsed(rowKey, next, count),
                                            label: `Slot de ${name}`,
                                        } : undefined}
                                        spend={spontaneousSpend}
                                        dimmed={tracked ? used >= count : false}
                                        psycheOn={!!mods.psyche}
                                        signature={sig}
                                    />
                                )
                            })}
                        </Box>
                    )
                })}
            </CardContent>
        </Card>
    )
}

interface SpellRowProps {
    name: string
    count?: number
    accent: string
    request: DescriptionRequest
    onSelect: Props['onSelect']
    /** Slots da própria magia (conjurador preparado). */
    pips?: { total: number; used: number; onChange: (next: number) => void; label: string }
    /** Botão de gastar um slot compartilhado (espontâneo), ponto de foco ou Ponto Mítico. */
    spend?: { onSpend: () => void; disabled: boolean; tooltip: string; emptyTooltip?: string }
    dimmed?: boolean
    /** Psique liberada: a linha mostra o bônus de dano da conjuração de Psíquico. */
    psycheOn?: boolean
    /** Magia de assinatura: `base` no rank do repertório, `raised` repetida num rank acima. */
    signature?: 'base' | 'raised'
}

const SpellRow = ({ name, count, accent, request, onSelect, pips, spend, dimmed, psycheOn, signature }: SpellRowProps) => {
    const cached = getCachedSpell(name)
    // Dano já no nível do slot (request.level = rank efetivo de conjuração).
    const castRank = request.type === 'spell' ? request.level : undefined
    // Já traz o tipo ("10d6 fogo", "3d8 contundente + 3d8 frio").
    const dmg = cached && castRank != null
        ? damageAtRank(cached, castRank)
        : cached?.damage ? `${cached.damage}${cached.damageType ? ` ${cached.damageType}` : ''}` : null
    // Elevada: o rank do slot (ou o automático do truque/foco) passa do rank base.
    const raisedTo = cached?.level != null && castRank != null && castRank > cached.level ? castRank : null
    const summary = cached
        ? [
            dmg,
            cached.range || cached.area || null,
            cached.defense || cached.duration || null,
        ]
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .join(' · ')
        : ''
    const actions = cached?.actions ? actionSymbol(cached.actions) : ''
    const psycheBonus = psycheOn && request.type === 'spell' && request.caster?.psychic && castRank != null
        && cached && dmg && !(cached.duration ?? '').trim()
        ? psycheDamageBonus(castRank) : 0

    return (
        <Box
            role="button"
            tabIndex={0}
            onClick={() => onSelect(request)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(request) }}
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 2,
                py: 1.25,
                cursor: 'pointer',
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 'none' },
                '&:hover': { backgroundColor: 'action.hover' },
                '&:focus-visible': { backgroundColor: 'action.focus', outline: 'none' },
            }}
        >
            <Box sx={{ minWidth: 0, opacity: dimmed ? 0.5 : 1 }}>
                <Typography sx={{ fontWeight: 500, textDecoration: dimmed ? 'line-through' : 'none' }}>
                    {name}
                    {actions && (
                        <Typography component="span" sx={{ ml: 0.75, color: accent, fontSize: '0.85em' }}>
                            {actions}
                        </Typography>
                    )}
                    {raisedTo != null && (
                        <Tooltip title={`Elevada: rank base ${cached?.level}, conjurada no ${raisedTo}º — os números já estão no rank conjurado`}>
                            <Typography
                                component="span"
                                variant="caption"
                                sx={{
                                    ml: 0.75,
                                    px: 0.5,
                                    borderRadius: 0.75,
                                    border: `1px solid ${accent}66`,
                                    color: accent,
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                ↑ {raisedTo}º
                            </Typography>
                        </Tooltip>
                    )}
                    {signature && (
                        <Tooltip title="Magia de assinatura: pode ser conjurada em qualquer slot de rank igual ou maior, sem aprender de novo.">
                            <Typography
                                component="span"
                                variant="caption"
                                sx={{ ml: 0.75, px: 0.5, borderRadius: 0.75, border: `1px solid ${accent}66`, color: accent, fontWeight: 700, whiteSpace: 'nowrap' }}
                            >
                                assinatura
                            </Typography>
                        </Tooltip>
                    )}
                    {psycheBonus > 0 && (
                        <Tooltip title="Unleash Psyche: bônus de status no dano inicial (o dobro do rank). Já entra na rolagem.">
                            <Typography
                                component="span"
                                variant="caption"
                                sx={{ ml: 0.75, px: 0.5, borderRadius: 0.75, border: `1px solid ${PSYCHE_COLOR}66`, color: PSYCHE_COLOR, fontWeight: 700, whiteSpace: 'nowrap' }}
                            >
                                +{psycheBonus} psique
                            </Typography>
                        </Tooltip>
                    )}
                    {count && count > 1 && !pips && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            ×{count}
                        </Typography>
                    )}
                </Typography>
                {summary && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {summary}
                    </Typography>
                )}
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                {pips && (
                    <SlotPips
                        total={pips.total}
                        used={pips.used}
                        color={accent}
                        onChange={pips.onChange}
                        label={pips.label}
                    />
                )}
                {spend && (
                    <Tooltip title={spend.disabled ? (spend.emptyTooltip ?? 'Sem slots disponíveis') : spend.tooltip}>
                        <span>
                            <IconButton
                                size="small"
                                aria-label={spend.tooltip}
                                disabled={spend.disabled}
                                onClick={(e) => { e.stopPropagation(); spend.onSpend() }}
                                sx={{ color: accent }}
                            >
                                <SpendIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
                <ChevronIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </Stack>
        </Box>
    )
}

function dedupe(list: string[]): Array<{ name: string; count: number }> {
    const counts = new Map<string, number>()
    for (const s of list) counts.set(s, (counts.get(s) || 0) + 1)
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
}

/** O bloco é a conjuração de Psíquico (e não a de uma herança ou de um arquétipo). */
const isPsychicCaster = (build: BuildInfo, caster: SpellCaster) => build.class === 'Psychic' && caster.name === 'Psychic'

interface FocusSpellEntry {
    name: string
    tradition: string
    group: FocusAbility
}

function collectFocusSpells(build: BuildInfo): FocusSpellEntry[] {
    const out: FocusSpellEntry[] = []
    const seen = new Set<string>()
    if (!build.focus) return out
    Object.entries(build.focus).forEach(([tradition, abilities]: [string, FocusTradition]) => {
        Object.values(abilities).forEach((group: FocusAbility) => {
            for (const name of [...(group.focusCantrips ?? []), ...(group.focusSpells ?? [])]) {
                if (seen.has(name)) continue
                seen.add(name)
                out.push({ name, tradition, group })
            }
        })
    })
    return out
}

// CD/ataque de focus spells a partir de build.focus; omitido quando o JSON
// não traz proficiência/atributo para o grupo.
function focusCasterInfo(build: BuildInfo, entry: FocusSpellEntry, mods: ConditionModifiers) {
    const { proficiency, abilityBonus, itemBonus } = entry.group
    if (proficiency == null || abilityBonus == null) return undefined
    const base = build.level + proficiency + abilityBonus + (itemBonus ?? 0)
    const attack = base + mods.total.attackSpell
    return {
        name: 'Magias de Foco',
        dc: 10 + base + mods.total.spellDc,
        attack,
        tradition: entry.tradition,
        attackInfo: focusAttack(build, entry.group, mods),
        // Os psi cantrips do Psíquico são conjuração de Psíquico.
        psychic: build.class === 'Psychic',
    }
}

export const SpellsSection = memo(SpellsSectionView)
