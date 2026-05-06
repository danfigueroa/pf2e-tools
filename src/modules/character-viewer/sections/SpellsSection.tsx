import { Box, Card, CardContent, Typography, Stack, Chip, Divider } from '@mui/material'
import { ChevronRight as ChevronIcon } from '@mui/icons-material'
import type { BuildInfo, SpellCaster, FocusTradition, FocusAbility } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'
import { abilityMod, signed, traditionColor, traditionLabel } from '../helpers'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
}

export const SpellsSection = ({ build, onSelect }: Props) => {
    const hasCasters = build.spellCasters?.some(c => c.spells.some(l => l.list.length > 0))
    const focusSpells = collectFocusSpells(build)

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
                                Magias de Foco
                            </Typography>
                            {build.focusPoints != null && (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    ({build.focusPoints} ponto{build.focusPoints === 1 ? '' : 's'})
                                </Typography>
                            )}
                        </Box>
                        {focusSpells.map((s, idx) => (
                            <SpellRow key={`${s}-${idx}`} name={s} onSelect={onSelect} />
                        ))}
                    </CardContent>
                </Card>
            )}
        </Stack>
    )
}

const CasterCard = ({ caster, build, onSelect }: { caster: SpellCaster; build: BuildInfo; onSelect: Props['onSelect'] }) => {
    const ability = caster.ability as 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
    const abilityScore = (build.abilities as unknown as Record<string, number>)[ability] || 10
    const aMod = abilityMod(abilityScore)
    const dc = 10 + build.level + caster.proficiency + aMod
    const atk = build.level + caster.proficiency + aMod
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
                                CD {dc} · Atq {signed(atk)}
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

                {caster.spells.filter(l => l.list.length > 0).map((level) => (
                    <Box key={level.spellLevel}>
                        <Box sx={{
                            px: 2, py: 0.75,
                            backgroundColor: 'action.hover',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                                {level.spellLevel === 0 ? 'TRUQUES' : `NÍVEL ${level.spellLevel}`}
                            </Typography>
                        </Box>
                        {dedupe(level.list).map(({ name, count }) => (
                            <SpellRow key={name} name={name} count={count} onSelect={onSelect} />
                        ))}
                    </Box>
                ))}
            </CardContent>
        </Card>
    )
}

const SpellRow = ({
    name,
    count,
    onSelect,
}: {
    name: string
    count?: number
    onSelect: Props['onSelect']
}) => (
    <Box
        role="button"
        tabIndex={0}
        onClick={() => onSelect({ type: 'spell', name })}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect({ type: 'spell', name }) }}
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
        <Typography sx={{ fontWeight: 500 }}>
            {name}
            {count && count > 1 && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    ×{count}
                </Typography>
            )}
        </Typography>
        <ChevronIcon fontSize="small" sx={{ color: 'text.secondary' }} />
    </Box>
)

function dedupe(list: string[]): Array<{ name: string; count: number }> {
    const counts = new Map<string, number>()
    for (const s of list) counts.set(s, (counts.get(s) || 0) + 1)
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
}

function collectFocusSpells(build: BuildInfo): string[] {
    const out: string[] = []
    if (!build.focus) return out
    Object.values(build.focus).forEach((tradition: FocusTradition) => {
        Object.values(tradition).forEach((group: FocusAbility) => {
            if (group.focusCantrips) out.push(...group.focusCantrips)
            if (group.focusSpells) out.push(...group.focusSpells)
        })
    })
    return Array.from(new Set(out))
}
