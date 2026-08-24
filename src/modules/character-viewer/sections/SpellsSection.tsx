import { useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Tooltip, Typography, Stack, Chip, Divider, LinearProgress } from '@mui/material'
import {
    ChevronRight as ChevronIcon,
    CloudDownload as DownloadIcon,
    Restore as RestoreIcon,
    Bolt as SpendIcon,
} from '@mui/icons-material'
import type { BuildInfo, SpellCaster, FocusTradition, FocusAbility } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'
import { actionSymbol, signed, spellcasterStats, traditionColor, traditionLabel } from '../helpers'
import { castRankForSlot, damageAtRank } from '../heightening'
import { getCachedSpell, prefetchSpellDescriptions } from '../../../services/descriptions'
import { legacyCharKey, slotsKeyFor } from '../charId'
import { slotKey, useSpellSlots, type SpellSlotsApi } from '../components/useSpellSlots'
import { SlotPips, SlotCount } from '../components/SlotPips'
import { gold } from '../../../theme'
import { ConditionDelta } from '../components/ConditionDelta'
import type { ConditionModifiers } from '../conditions'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    mods: ConditionModifiers
}

export const SpellsSection = ({ build, onSelect, mods }: Props) => {
    const hasCasters = build.spellCasters?.some(c => c.spells.some(l => l.list.length > 0))
    const focusSpells = useMemo(() => collectFocusSpells(build), [build])
    const focusRank = castRankForSlot(0, build.level)
    const focusMax = build.focusPoints ?? 0
    const slots = useSpellSlots(slotsKeyFor(build), focusMax, legacyCharKey(build))

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
    const hasTrackable =
        !!build.spellCasters?.some(c => c.spells.some(l => l.spellLevel > 0 && l.list.length > 0)) ||
        (focusSpells.length > 0 && focusMax > 0)

    return (
        <Stack spacing={2}>
            <Dialog open={confirmNewDay} onClose={() => setConfirmNewDay(false)}>
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
            </Dialog>

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
                        onSelect={onSelect}
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
    onSelect: Props['onSelect']
    mods: ConditionModifiers
}

const CasterCard = ({ caster, casterIdx, build, slots, onSelect, mods }: CasterProps) => {
    const base = spellcasterStats(build, caster)
    // Estupefato pesa em CD e ataque de magia (testes de INT/SAB/CAR).
    const dc = base.dc + mods.total.spellDc
    const attack = base.attack + mods.total.attackSpell
    const accent = traditionColor(caster.magicTradition)
    // Espontâneo: os slots do nível são intercambiáveis (repertório à parte).
    // Preparado/inato: cada cópia preparada é o próprio slot.
    const isSpontaneous = caster.spellcastingType === 'spontaneous'

    const levels = useMemo(
        () => caster.spells
            .filter(l => l.list.length > 0)
            .map(l => ({ spellLevel: l.spellLevel, entries: dedupe(l.list) })),
        [caster],
    )

    const levelKey = (spellLevel: number, name?: string) => slotKey(casterIdx, caster.name, spellLevel, name)

    /** Total/gastos do nível — truques (nível 0) são à vontade, não têm slot. */
    const levelSummary = (spellLevel: number, entries: Array<{ name: string; count: number }>) => {
        if (spellLevel === 0) return null
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
                                    label={caster.spellcastingType === 'prepared' ? 'Preparado' : 'Espontâneo'}
                                    size="small"
                                    variant="outlined"
                                />
                            </Stack>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                CD {dc} · Atq {signed(attack)}
                            </Typography>
                            <ConditionDelta delta={mods.total.spellDc} base={base.dc} align="right" />
                        </Box>
                    </Stack>
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
                            {entries.map(({ name, count }) => {
                                const rowKey = levelKey(spellLevel, name)
                                const used = Math.min(count, slots.usedOf(rowKey))
                                const tracked = spellLevel > 0 && !isSpontaneous
                                const spontaneousSpend = isSpontaneous && summary
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
                                            caster: { name: caster.name, dc, attack, tradition: caster.magicTradition },
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
    /** Botão de gastar um slot compartilhado (espontâneo) ou ponto de foco. */
    spend?: { onSpend: () => void; disabled: boolean; tooltip: string }
    dimmed?: boolean
}

const SpellRow = ({ name, count, accent, request, onSelect, pips, spend, dimmed }: SpellRowProps) => {
    const cached = getCachedSpell(name)
    // Dano já no nível do slot (request.level = rank efetivo de conjuração).
    const castRank = request.type === 'spell' ? request.level : undefined
    const dmg = cached && castRank != null ? damageAtRank(cached, castRank) : cached?.damage || null
    const summary = cached
        ? [
            dmg ? `${dmg}${cached.damageType ? ` ${cached.damageType}` : ''}` : null,
            cached.range || cached.area || null,
            cached.defense || cached.duration || null,
        ]
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .join(' · ')
        : ''
    const actions = cached?.actions ? actionSymbol(cached.actions) : ''

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
                    <Tooltip title={spend.disabled ? 'Sem slots disponíveis' : spend.tooltip}>
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
    return { name: 'Magias de Foco', dc: 10 + base + mods.total.spellDc, attack, tradition: entry.tradition }
}
