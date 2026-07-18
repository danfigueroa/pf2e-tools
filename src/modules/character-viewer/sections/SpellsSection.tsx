import { useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, Typography, Stack, Chip, Divider, LinearProgress } from '@mui/material'
import { ChevronRight as ChevronIcon, CloudDownload as DownloadIcon } from '@mui/icons-material'
import type { BuildInfo, SpellCaster, FocusTradition, FocusAbility } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'
import { actionSymbol, signed, spellcasterStats, traditionColor, traditionLabel } from '../helpers'
import { castRankForSlot, damageAtRank } from '../heightening'
import { getCachedSpell, prefetchSpellDescriptions } from '../../../services/descriptions'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
}

export const SpellsSection = ({ build, onSelect }: Props) => {
    const hasCasters = build.spellCasters?.some(c => c.spells.some(l => l.list.length > 0))
    const focusSpells = useMemo(() => collectFocusSpells(build), [build])
    const focusRank = castRankForSlot(0, build.level)

    const allNames = useMemo(() => {
        const names = new Set<string>()
        build.spellCasters?.forEach(c => c.spells.forEach(l => l.list.forEach(n => names.add(n))))
        focusSpells.forEach(f => names.add(f.name))
        return Array.from(names)
    }, [build, focusSpells])

    // Progresso do "Carregar todas"; cada atualização re-renderiza e as linhas
    // releem o cache — é assim que os resumos aparecem progressivamente.
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
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

    return (
        <Stack spacing={2}>
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
                ?.filter(c => c.spells.some(l => l.list.length > 0))
                .map((caster, idx) => (
                    <CasterCard key={`${caster.name}-${idx}`} caster={caster} build={build} onSelect={onSelect} />
                ))}

            {focusSpells.length > 0 && (
                <Card>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="overline" sx={{ fontWeight: 700, color: 'primary.light' }}>
                                Magias de Foco (nível {focusRank})
                            </Typography>
                            {build.focusPoints != null && (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    ({build.focusPoints} ponto{build.focusPoints === 1 ? '' : 's'})
                                </Typography>
                            )}
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
                                    caster: focusCasterInfo(build, s),
                                }}
                                onSelect={onSelect}
                            />
                        ))}
                    </CardContent>
                </Card>
            )}
        </Stack>
    )
}

const CasterCard = ({ caster, build, onSelect }: { caster: SpellCaster; build: BuildInfo; onSelect: Props['onSelect'] }) => {
    const { dc, attack } = spellcasterStats(build, caster)
    const accent = traditionColor(caster.magicTradition)

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
                        </Box>
                    </Stack>
                </Box>

                {caster.perDay?.some(n => n > 0) && (
                    <Box sx={{ px: 2, pb: 1.5 }}>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {caster.perDay.map((n, lvl) =>
                                n > 0 ? (
                                    <Chip
                                        key={lvl}
                                        size="small"
                                        label={`Nv ${lvl}: ${n}`}
                                        sx={{ height: 22, fontSize: '0.7rem' }}
                                    />
                                ) : null,
                            )}
                        </Stack>
                    </Box>
                )}

                <Divider />

                {caster.spells.filter(l => l.list.length > 0).map((level) => {
                    const castRank = castRankForSlot(level.spellLevel, build.level)
                    return (
                        <Box key={level.spellLevel}>
                            <Box sx={{
                                px: 2, py: 0.75,
                                backgroundColor: 'action.hover',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                            }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                                    {level.spellLevel === 0 ? `TRUQUES (NÍVEL ${castRank})` : `NÍVEL ${level.spellLevel}`}
                                </Typography>
                            </Box>
                            {dedupe(level.list).map(({ name, count }) => (
                                <SpellRow
                                    key={name}
                                    name={name}
                                    count={count}
                                    accent={accent}
                                    request={{
                                        type: 'spell',
                                        name,
                                        level: castRank,
                                        autoHeightened: level.spellLevel === 0,
                                        caster: { name: caster.name, dc, attack, tradition: caster.magicTradition },
                                    }}
                                    onSelect={onSelect}
                                />
                            ))}
                        </Box>
                    )
                })}
            </CardContent>
        </Card>
    )
}

const SpellRow = ({
    name,
    count,
    accent,
    request,
    onSelect,
}: {
    name: string
    count?: number
    accent: string
    request: DescriptionRequest
    onSelect: Props['onSelect']
}) => {
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
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500 }}>
                    {name}
                    {actions && (
                        <Typography component="span" sx={{ ml: 0.75, color: accent, fontSize: '0.85em' }}>
                            {actions}
                        </Typography>
                    )}
                    {count && count > 1 && (
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
            <ChevronIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
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
function focusCasterInfo(build: BuildInfo, entry: FocusSpellEntry) {
    const { proficiency, abilityBonus, itemBonus } = entry.group
    if (proficiency == null || abilityBonus == null) return undefined
    const attack = build.level + proficiency + abilityBonus + (itemBonus ?? 0)
    return { name: 'Magias de Foco', dc: 10 + attack, attack, tradition: entry.tradition }
}
