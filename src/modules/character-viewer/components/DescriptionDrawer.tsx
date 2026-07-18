import { useEffect, useMemo, useState } from 'react'
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Skeleton,
    Chip,
    Link,
    Stack,
    Divider,
    useTheme,
    useMediaQuery,
} from '@mui/material'
import { Close as CloseIcon, OpenInNew as ExternalIcon, MenuBook as BookIcon } from '@mui/icons-material'
import {
    fetchFeatDescription,
    fetchSpecialDescription,
    fetchSpellDescription,
    fetchItemDescription,
} from '../../../services/descriptions'
import type { SpellDescription } from '../../character-sheet/types'
import { actionSymbol, getAonSearchUrl, signed, traditionColor } from '../helpers'
import { parseDescription, type DescriptionPart, type HeightenedEntry } from '../format-description'
import { applyHeightening, computeHeightenedDamage, type AppliedHeightened } from '../heightening'

export interface SpellCasterInfo {
    name: string
    dc: number
    attack: number
    tradition: string
}

export type DescriptionRequest =
    | { type: 'feat'; name: string; level?: number }
    | { type: 'special'; name: string }
    | {
        type: 'spell'
        name: string
        level?: number            // rank efetivo de conjuração (slot; truque/foco já resolvido)
        autoHeightened?: boolean  // truque/foco: elevada automaticamente
        caster?: SpellCasterInfo
        cached?: SpellDescription
    }
    | { type: 'item'; name: string }

interface Props {
    request: DescriptionRequest | null
    onClose: () => void
}

interface State {
    loading: boolean
    text?: string
    spell?: SpellDescription
}

const TYPE_LABEL: Record<DescriptionRequest['type'], string> = {
    feat: 'Talento',
    special: 'Habilidade',
    spell: 'Magia',
    item: 'Item',
}

const TYPE_ACCENT: Record<DescriptionRequest['type'], string> = {
    feat: '#14b8a6',     // teal — sintonizado com o tema
    special: '#a259e0',  // roxo
    spell: '#5b8def',    // azul (sobrescrito por tradição quando há)
    item: '#f5c542',     // dourado
}

export const DescriptionDrawer = ({ request, onClose }: Props) => {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const [state, setState] = useState<State>({ loading: false })

    useEffect(() => {
        if (!request) return
        let cancelled = false
        setState({ loading: true })

        const load = async () => {
            if (request.type === 'feat') {
                const text = await fetchFeatDescription(request.name)
                if (!cancelled) setState({ loading: false, text: text ?? undefined })
            } else if (request.type === 'special') {
                const text = await fetchSpecialDescription(request.name)
                if (!cancelled) setState({ loading: false, text: text ?? undefined })
            } else if (request.type === 'item') {
                const text = await fetchItemDescription(request.name)
                if (!cancelled) setState({ loading: false, text: text ?? undefined })
            } else if (request.type === 'spell') {
                if (request.cached) {
                    setState({ loading: false, spell: request.cached })
                    return
                }
                const spell = await fetchSpellDescription(request.name)
                if (!cancelled) setState({ loading: false, spell: spell ?? undefined })
            }
        }
        load()
        return () => { cancelled = true }
    }, [request])

    const accent = useMemo(() => {
        if (!request) return TYPE_ACCENT.feat
        if (request.type === 'spell' && state.spell?.traits?.length) {
            const tradition = state.spell.traits.find(t => ['arcane','divine','occult','primal'].includes(t.toLowerCase()))
            if (tradition) return traditionColor(tradition)
        }
        return TYPE_ACCENT[request.type]
    }, [request, state.spell])

    const parsed = useMemo(() => {
        if (!request) return null
        const raw = state.spell?.description ?? state.text
        return parseDescription(raw, request.name)
    }, [request, state.text, state.spell])

    // Só marcamos entradas de heightening como aplicáveis quando sabemos o rank
    // conjurado (request.level) e o rank base da magia (spell.level, do AON).
    const levelAware =
        request?.type === 'spell' && request.level != null && state.spell?.level != null

    const heightenedEntries = useMemo<AppliedHeightened[]>(() => {
        const merged = mergeHeightened(state.spell?.heightened, parsed?.heightened)
        if (request?.type === 'spell' && request.level != null) {
            return applyHeightening(merged, state.spell?.level, request.level)
        }
        return merged.map((e) => ({ ...e, applies: false, times: 0 }))
    }, [request, state.spell, parsed])

    const heightenedDamage = useMemo(() => {
        if (!levelAware || !state.spell) return null
        return computeHeightenedDamage(state.spell, heightenedEntries)
    }, [levelAware, state.spell, heightenedEntries])

    return (
        <Drawer
            anchor={isMobile ? 'bottom' : 'right'}
            open={!!request}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: { xs: '100%', md: 520 },
                    maxHeight: { xs: '88vh', md: '100%' },
                    borderTopLeftRadius: { xs: 16, md: 0 },
                    borderTopRightRadius: { xs: 16, md: 0 },
                    backgroundImage: 'none',
                },
            }}
        >
            {request && (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Faixa de accent no topo (visual de tipo) */}
                    <Box sx={{ height: 4, backgroundColor: accent, flexShrink: 0 }} />

                    <Box sx={{ p: { xs: 2.5, md: 3 }, overflowY: 'auto', flex: 1 }}>
                        {/* Header */}
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Chip
                                    label={TYPE_LABEL[request.type]}
                                    size="small"
                                    sx={{
                                        backgroundColor: accent + '22',
                                        color: accent,
                                        border: `1px solid ${accent}55`,
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        fontSize: '0.65rem',
                                        height: 20,
                                        mb: 1,
                                    }}
                                />
                                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word' }}>
                                    {request.name}
                                    {state.spell?.actions && (
                                        <Box component="span" sx={{ ml: 1, color: accent, fontSize: '0.85em' }}>
                                            {actionSymbol(state.spell.actions)}
                                        </Box>
                                    )}
                                </Typography>
                            </Box>
                            <IconButton onClick={onClose} size="small">
                                <CloseIcon />
                            </IconButton>
                        </Stack>

                        {/* Bloco de fonte */}
                        {parsed?.source && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1.5,
                                    py: 1,
                                    mb: 2,
                                    borderRadius: 1,
                                    backgroundColor: 'action.hover',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <BookIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Box>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            display: 'block',
                                            color: 'text.secondary',
                                            fontWeight: 700,
                                            letterSpacing: '0.06em',
                                            lineHeight: 1,
                                            fontSize: '0.62rem',
                                        }}
                                    >
                                        FONTE
                                    </Typography>
                                    <Typography variant="body2" sx={{ lineHeight: 1.3, mt: 0.25 }}>
                                        {parsed.source}
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        {/* Bloco de nível de conjuração */}
                        {request.type === 'spell' && request.level != null && !state.loading && state.spell && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 1,
                                    px: 1.5,
                                    py: 1,
                                    mb: 2,
                                    borderRadius: 1,
                                    backgroundColor: accent + '12',
                                    border: '1px solid',
                                    borderColor: accent + '50',
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {state.spell.level != null && `Nível base ${state.spell.level} · `}
                                    Conjurada no nível {request.level}
                                </Typography>
                                {state.spell.level != null && request.level > state.spell.level && (
                                    <Chip
                                        size="small"
                                        label={`Elevada +${request.level - state.spell.level}`}
                                        sx={{
                                            backgroundColor: accent + '25',
                                            color: accent,
                                            border: `1px solid ${accent}60`,
                                            fontWeight: 700,
                                            height: 20,
                                        }}
                                    />
                                )}
                                {request.autoHeightened && (
                                    <Typography variant="caption" color="text.secondary">
                                        elevada automaticamente
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {/* Metadata da magia */}
                        {request.type === 'spell' && state.spell && (
                            <SpellMetadata
                                spell={state.spell}
                                accent={accent}
                                caster={request.caster}
                                heightenedDamage={heightenedDamage}
                                castLevel={request.level}
                            />
                        )}

                        {/* Corpo */}
                        {state.loading ? (
                            <Stack spacing={1.5}>
                                <Skeleton variant="text" width="92%" />
                                <Skeleton variant="text" width="88%" />
                                <Skeleton variant="text" width="95%" />
                                <Skeleton variant="text" width="60%" />
                            </Stack>
                        ) : (
                            <DescriptionBody
                                parts={parsed?.parts ?? []}
                                heightened={heightenedEntries}
                                levelAware={levelAware}
                                accent={accent}
                            />
                        )}

                        <Divider sx={{ my: 3 }} />

                        <Link
                            href={getAonSearchUrl(request.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                fontSize: '0.85rem',
                                color: accent,
                            }}
                        >
                            Ver no Archives of Nethys <ExternalIcon sx={{ fontSize: 14 }} />
                        </Link>
                    </Box>
                </Box>
            )}
        </Drawer>
    )
}

const SpellMetadata = ({
    spell,
    accent,
    caster,
    heightenedDamage,
    castLevel,
}: {
    spell: SpellDescription
    accent: string
    caster?: SpellCasterInfo
    heightenedDamage?: string | null
    castLevel?: number
}) => (
    <Box sx={{ mb: 2.5 }}>
        {spell.traits && spell.traits.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                {spell.traits.map((t) => (
                    <Chip
                        key={t}
                        label={t}
                        size="small"
                        sx={{
                            backgroundColor: traditionColor(t) + '1f',
                            color: traditionColor(t),
                            border: `1px solid ${traditionColor(t)}55`,
                            textTransform: 'capitalize',
                            fontSize: '0.7rem',
                            height: 22,
                        }}
                    />
                ))}
            </Stack>
        )}
        {(caster || spell.traditions?.length || spell.castComponents || spell.range || spell.area || spell.targets || spell.duration || spell.defense || spell.damage || heightenedDamage) && (
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 0.75,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: accent + '40',
                    backgroundColor: accent + '0a',
                }}
            >
                {caster && (
                    <MetaRow label="CD / Ataque" value={`CD ${caster.dc} · ${signed(caster.attack)}`} accent={accent} />
                )}
                {spell.traditions && spell.traditions.length > 0 && (
                    <MetaRow label="Tradições" value={spell.traditions.join(', ')} />
                )}
                {spell.castComponents && (
                    <MetaRow
                        label="Conjuração"
                        value={`${actionSymbol(spell.actions ?? '')} ${spell.castComponents}`.trim()}
                    />
                )}
                {spell.range && <MetaRow label="Alcance" value={spell.range} />}
                {spell.area && <MetaRow label="Área" value={spell.area} />}
                {spell.targets && <MetaRow label="Alvos" value={spell.targets} />}
                {spell.duration && <MetaRow label="Duração" value={spell.duration} />}
                {spell.defense && <MetaRow label="Defesa" value={spell.defense} />}
                {spell.damage && (
                    <MetaRow
                        label="Dano"
                        value={`${spell.damage}${spell.damageType ? ` ${spell.damageType}` : ''}`}
                    />
                )}
                {heightenedDamage && (
                    <MetaRow
                        label={castLevel != null ? `Dano (nível ${castLevel})` : 'Dano elevado'}
                        value={`${heightenedDamage}${spell.damageType ? ` ${spell.damageType}` : ''}`}
                        accent={accent}
                    />
                )}
            </Box>
        )}
    </Box>
)

const MetaRow = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', minWidth: 0 }}>
        <Typography
            component="span"
            sx={{
                fontWeight: 700,
                color: 'text.secondary',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
            }}
        >
            {label}
        </Typography>
        <Typography
            component="span"
            sx={{
                fontSize: '0.85rem',
                wordBreak: 'break-word',
                ...(accent ? { color: accent, fontWeight: 700 } : {}),
            }}
        >
            {value}
        </Typography>
    </Box>
)

// Mescla as fontes de heightened: estruturada (do API spell.heightened) e
// extraída (do parser format-description). A estruturada tem prioridade quando
// existem entries (mais confiável); senão usa a do parser.
function mergeHeightened(
    structured: Record<string, string> | undefined,
    parsed: HeightenedEntry[] | undefined,
): HeightenedEntry[] {
    if (structured && Object.keys(structured).length > 0) {
        return Object.entries(structured).map(([level, text]) => ({ level, text }))
    }
    return parsed || []
}

const DescriptionBody = ({
    parts,
    heightened,
    levelAware,
    accent,
}: {
    parts: DescriptionPart[]
    heightened: AppliedHeightened[]
    levelAware: boolean
    accent: string
}) => {
    if (parts.length === 0 && heightened.length === 0) {
        return (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Descrição não encontrada. Tente abrir no Archives of Nethys.
            </Typography>
        )
    }

    return (
        <Box sx={{ '& > * + *': { mt: 1.5 } }}>
            {parts.length > 0 && (
                <Typography
                    variant="overline"
                    sx={{
                        display: 'block',
                        color: 'text.secondary',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        fontSize: '0.62rem',
                        mb: 0.5,
                    }}
                >
                    DESCRIÇÃO
                </Typography>
            )}
            {parts.map((p, idx) =>
                p.kind === 'labeled' ? (
                    <Box key={idx}>
                        <Typography
                            component="span"
                            sx={{
                                fontWeight: 700,
                                color: accent,
                                mr: 0.75,
                            }}
                        >
                            {p.label}.
                        </Typography>
                        <Typography component="span" sx={{ lineHeight: 1.7 }}>
                            {p.text}
                        </Typography>
                    </Box>
                ) : (
                    <Typography key={idx} sx={{ lineHeight: 1.7 }}>
                        {p.text}
                    </Typography>
                ),
            )}

            {heightened.length > 0 && (
                <Box
                    sx={{
                        mt: 2.5,
                        px: 2,
                        py: 1.75,
                        borderRadius: 1.5,
                        backgroundColor: accent + '12',
                        border: '1px solid',
                        borderColor: accent + '50',
                    }}
                >
                    <Typography
                        variant="overline"
                        sx={{
                            display: 'block',
                            color: accent,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            fontSize: '0.68rem',
                            mb: 1.25,
                        }}
                    >
                        CONJURADA COM NÍVEL MAIS ALTO
                    </Typography>
                    <Stack spacing={1}>
                        {heightened.map((h, idx) => {
                            const highlighted = levelAware && h.applies
                            const dimmed = levelAware && !h.applies
                            return (
                                <Box
                                    key={`${h.level}-${idx}`}
                                    sx={{
                                        display: 'flex',
                                        gap: 1.25,
                                        alignItems: 'baseline',
                                        opacity: dimmed ? 0.55 : 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            flexShrink: 0,
                                            minWidth: 44,
                                            px: 0.75,
                                            py: 0.25,
                                            borderRadius: 0.75,
                                            textAlign: 'center',
                                            backgroundColor: highlighted ? accent + '45' : accent + '25',
                                            border: highlighted ? '2px solid' : '1px solid',
                                            borderColor: highlighted ? accent : accent + '60',
                                            fontFamily: 'monospace',
                                            fontWeight: 700,
                                            fontSize: '0.78rem',
                                            color: accent,
                                            lineHeight: 1.3,
                                        }}
                                    >
                                        {h.level}
                                    </Box>
                                    <Typography sx={{ lineHeight: 1.55, flex: 1 }}>
                                        {h.text}
                                        {highlighted && (
                                            <Typography
                                                component="span"
                                                variant="caption"
                                                sx={{ ml: 0.75, color: accent, fontWeight: 700, whiteSpace: 'nowrap' }}
                                            >
                                                {h.times > 1 ? `✓ aplica ×${h.times}` : '✓ aplica'}
                                            </Typography>
                                        )}
                                    </Typography>
                                </Box>
                            )
                        })}
                    </Stack>
                </Box>
            )}
        </Box>
    )
}
