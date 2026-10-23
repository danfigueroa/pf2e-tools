import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TYPE_ACCENT as PALETTE_TYPE_ACCENT } from '../../../theme/palette'
import {
    Box,
    Button,
    Typography,
    IconButton,
    Skeleton,
    Chip,
    Link,
    Stack,
    Divider,
    Tooltip,
    Alert,
} from '@mui/material'
import {
    Close as CloseIcon,
    OpenInNew as ExternalIcon,
    MenuBook as BookIcon,
    Casino as DiceIcon,
    Share as ShareIcon,
    Check as CheckIcon,
} from '@mui/icons-material'
import { applyFix, useFixesVersion } from '../../../services/translationFixes'
import { TranslationFix } from './TranslationFix'
import {
    fetchFeatDescription,
    fetchSpecialDescription,
    fetchSpellDescription,
    fetchItemDescription,
} from '../../../services/descriptions'
import type { FeatDescription, SpellDescription } from '../../../pathbuilder/types'
import { actionSymbol, getAonSearchUrl, signed, traditionColor } from '../helpers'
import { parseDescription, type DescriptionPart, type HeightenedEntry } from '../format-description'
import { StaffSpellList } from './StaffSpellList'
import { isStrikeFocusSpell } from '../monk'
import type { RollRequest } from './RollDialog'
import type { SpellAttackInfo } from '../rolls'
import type { CastResource } from '../spellCast'
import {
    applyHeightening,
    componentLabel,
    computeHeightenedDamage,
    damageComponents,
    formatValue,
    isPureDamageEntry,
    namedLabel,
    scaleSpell,
    spellHeightenedEntries,
    type AppliedHeightened,
    type ScaledSpell,
} from '../heightening'

export interface SpellCasterInfo {
    name: string
    dc: number
    attack: number
    tradition: string
    /** A conta do ataque de magia e o ✦ — o que o diálogo de rolagem usa. */
    attackInfo?: SpellAttackInfo | null
    /** Conjuração de Psíquico: recebe o bônus da psique liberada (`psyche.ts`). */
    psychic?: boolean
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
        /** De onde sai o que a conjuração gasta (slot, foco, Ponto Mítico) — a rolagem paga junto. */
        cast?: CastResource
    }
    | { type: 'item'; name: string }

export interface DescriptionContentProps {
    request: DescriptionRequest
    onClose: () => void
    /** Abre a rolagem da magia (ataque e dano no rank conjurado). */
    onRoll?: (req: RollRequest) => void
    /**
     * Troca o conteúdo do drawer sem fechá-lo — as magias de um bastão abrem a
     * própria descrição por aqui. O efeito de carga já reage a `request`, então
     * a página só precisa reapontar o estado.
     */
    onNavigate?: (req: DescriptionRequest) => void
    /** Compartilha a regra com a mesa; `false` quando não deu. */
    onShare?: (req: DescriptionRequest) => Promise<boolean>
    /**
     * Ações de quem tem a ficha aberta para o talento/habilidade/item já carregado
     * (o "Usar" das abas). Fora da ficha — o cartão compartilhado — não há.
     */
    renderActions?: (req: DescriptionRequest, entry: FeatDescription) => ReactNode
}

interface State {
    loading: boolean
    entry?: FeatDescription   // talento / habilidade / item
    spell?: SpellDescription
}

const TYPE_LABEL: Record<DescriptionRequest['type'], string> = {
    feat: 'Talento',
    special: 'Habilidade',
    spell: 'Magia',
    item: 'Item',
}

// Acentos por tipo (o de magia é sobrescrito pela tradição quando há).
const TYPE_ACCENT: Record<DescriptionRequest['type'], string> = PALETTE_TYPE_ACCENT

/**
 * O conteúdo da descrição (carga, heightening e o texto), sem a gaveta: o
 * drawer da ficha e o cartão da regra compartilhada com a mesa desenham o mesmo.
 */
export const DescriptionContent = ({ request, onClose, onNavigate, onRoll, onShare, renderActions }: DescriptionContentProps) => {
    const [state, setState] = useState<State>({ loading: false })

    useEffect(() => {
        if (!request) return
        let cancelled = false
        setState({ loading: true })

        // Tradução pendente (falha transitória, ex. rate limit do Groq): o
        // resultado EN não foi cacheado — retentar em alguns segundos e trocar
        // pela versão traduzida sem o usuário fazer nada.
        const retryIfPending = async <T extends { translationPending?: boolean }>(
            first: T | null,
            refetch: () => Promise<T | null>,
            apply: (value: T) => void,
        ) => {
            if (!first?.translationPending) return
            await new Promise((r) => setTimeout(r, 6000))
            if (cancelled) return
            const retry = await refetch()
            if (!cancelled && retry && !retry.translationPending) apply(retry)
        }

        const load = async () => {
            if (request.type === 'feat' || request.type === 'special' || request.type === 'item') {
                const fetcher =
                    request.type === 'feat' ? fetchFeatDescription
                        : request.type === 'special' ? fetchSpecialDescription
                            : fetchItemDescription
                const entry = await fetcher(request.name)
                if (cancelled) return
                setState({ loading: false, entry: entry ?? undefined })
                await retryIfPending(entry, () => fetcher(request.name), (v) =>
                    setState({ loading: false, entry: v }))
            } else if (request.type === 'spell') {
                if (request.cached) {
                    setState({ loading: false, spell: request.cached })
                    return
                }
                const spell = await fetchSpellDescription(request.name)
                if (cancelled) return
                setState({ loading: false, spell: spell ?? undefined })
                await retryIfPending(spell, () => fetchSpellDescription(request.name), (v) =>
                    setState({ loading: false, spell: v }))
            }
        }
        load()
        return () => { cancelled = true }
    }, [request])

    // A correção de tradução da mesa por cima, reaplicada quando chega uma nova (ou é desfeita).
    const fixesVersion = useFixesVersion()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fixesVersion: a correção mora fora do React
    const entry = useMemo(() => (state.entry ? applyFix(request.type, request.name, state.entry) : undefined), [state.entry, request, fixesVersion])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idem
    const spell = useMemo(() => (state.spell ? applyFix('spell', request.name, state.spell) : undefined), [state.spell, request, fixesVersion])

    const accent = useMemo(() => {
        if (!request) return TYPE_ACCENT.feat
        if (request.type === 'spell' && spell?.traits?.length) {
            const tradition = spell.traits.find(t => ['arcane','divine','occult','primal'].includes(t.toLowerCase()))
            if (tradition) return traditionColor(tradition)
        }
        return TYPE_ACCENT[request.type]
    }, [request, spell])

    const parsed = useMemo(() => {
        if (!request) return null
        const raw = spell?.description ?? entry?.description ?? undefined
        // Tudo chega com prosa limpa do backend (v10+) — sem strip heurístico,
        // que comia a primeira oração de descrições começando por "Você …".
        return parseDescription(raw, request.name, { stripMetadata: false })
    }, [request, entry, spell])

    // Modo "nível-ciente": sabemos o rank conjurado (request.level) e o rank
    // base da magia (spell.level, do AON) — a magia é exibida já elevada.
    const levelAware =
        request?.type === 'spell' && request.level != null && spell?.level != null

    const heightenedEntries = useMemo<AppliedHeightened[]>(() => {
        const merged = spellHeightenedEntries(
            spell,
            mergeHeightened(spell?.heightened, parsed?.heightened),
        )
        if (request?.type === 'spell' && request.level != null) {
            return applyHeightening(merged, spell?.level, request.level)
        }
        return merged.map((e) => ({ ...e, applies: false, times: 0 }))
    }, [request, spell, parsed])

    // Os números no rank conjurado, pelo `scaling` que o backend leu do EN.
    // Sem ele (cache antigo), o caminho antigo de um dado só.
    const scaled = useMemo<ScaledSpell | null>(() => {
        if (!levelAware || !spell || request?.type !== 'spell' || request.level == null) return null
        return scaleSpell(spell, request.level)
    }, [levelAware, spell, request])

    const heightenedDamage = useMemo(() => {
        if (!levelAware || !spell || scaled) return null
        return computeHeightenedDamage(spell, heightenedEntries)
    }, [levelAware, spell, heightenedEntries, scaled])

    // Dados elevados trocados dentro da prosa (destacados). A k-ésima "2d4" do
    // inglês é a k-ésima "2d4" da tradução — os dados sobrevivem ao LLM.
    const diceSubs = useMemo<DiceSub[]>(() => {
        if (scaled) {
            return scaled.components
                .filter((c) => c.changed && c.count > 0)
                .map((c) => ({
                    from: c.formula,
                    to: formatValue(c.value),
                    nth: c.nth,
                    occurrences: c.occurrences,
                }))
        }
        if (!levelAware || !heightenedDamage || !spell?.damage) return []
        if (heightenedDamage === spell.damage) return []
        return [{ from: spell.damage, to: heightenedDamage, nth: 0 }]
    }, [scaled, levelAware, heightenedDamage, spell])

    // Bloco de heightening exibido:
    // - nível-ciente: só as entradas que se APLICAM neste rank, e ainda oculta
    //   as "puras de dano" quando o dano já foi recalculado (nada de info de
    //   níveis mais altos irrelevantes ao slot preparado);
    // - fluxos sem nível: lista completa como sempre.
    const heightenedBlock = useMemo(() => {
        if (heightenedEntries.length === 0) return null
        if (!levelAware) {
            return { title: 'CONJURADA COM NÍVEL MAIS ALTO', entries: heightenedEntries, levelAware: false }
        }
        // Com `scaling`, só sobra o que não virou número (Fly 7º, área maior…).
        const visible = scaled
            ? scaled.entries.filter((e) => !e.resolved)
            : heightenedEntries
                .filter((e) => e.applies)
                .filter((e) => !heightenedDamage || !isPureDamageEntry(e.text))
        if (visible.length === 0) return null
        return { title: `NESTE RANK (${request?.type === 'spell' ? request.level : ''})`, entries: visible, levelAware: true }
    }, [heightenedEntries, levelAware, heightenedDamage, request, scaled])

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
                            {(spell?.actions || entry?.actions) && (
                                <Box component="span" sx={{ ml: 1, color: accent, fontSize: '0.85em' }}>
                                    {actionSymbol(spell?.actions || entry?.actions)}
                                </Box>
                            )}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                        {/* Só o que a AON resolveu: um nome sem descrição chegaria vazio à mesa. */}
                        {onShare && !state.loading && (spell || entry) && (
                            <ShareButton key={request.name} onShare={() => onShare(request)} />
                        )}
                        <IconButton onClick={onClose} size="small" aria-label="Fechar">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </Stack>

                {/* Bloco de fonte */}
                {(spell?.sourceBook || entry?.sourceBook || parsed?.source) && (
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
                                {spell?.sourceBook || entry?.sourceBook || parsed?.source}
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* Tradução pendente (o effect retenta sozinho em segundos) */}
                {(spell?.translationPending || entry?.translationPending) && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', fontStyle: 'italic', mb: 1.5 }}
                    >
                        Texto original em inglês — traduzindo automaticamente…
                    </Typography>
                )}

                {/* Bloco de nível de conjuração */}
                {request.type === 'spell' && request.level != null && !state.loading && spell && (
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
                            {spell.level != null && `Nível base ${spell.level} · `}
                            Conjurada no nível {request.level}
                        </Typography>
                        {spell.level != null && request.level > spell.level && (
                            <Chip
                                size="small"
                                label={`Elevada +${request.level - spell.level}`}
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

                {/* Metadata de talento / habilidade / item */}
                {request.type !== 'spell' && entry && (
                    <EntryMetadata entry={entry} accent={accent} />
                )}

                {/* Metadata da magia */}
                {request.type === 'spell' && spell && (
                    <SpellMetadata
                        spell={spell}
                        accent={accent}
                        caster={request.caster}
                        heightenedDamage={heightenedDamage}
                        scaled={scaled}
                        castLevel={request.level}
                    />
                )}

                {/* Rolar: ataque (traço ataque) e dano no rank conjurado */}
                {request.type === 'spell' && spell && !state.loading && onRoll && (
                    <SpellRollButton
                        spell={spell}
                        caster={request.caster}
                        castRank={request.level ?? spell.level ?? undefined}
                        name={request.name}
                        cast={request.cast}
                        onRoll={onRoll}
                    />
                )}

                {/* Usar: o mesmo botão da linha do talento/habilidade, para quem foi consultar */}
                {request.type !== 'spell' && entry && !state.loading && renderActions?.(request, entry)}

                {/* Bastão: magias do degrau que a ficha possui (só elas) */}
                {request.type !== 'spell' && entry?.staff && !state.loading && (
                    <StaffSpellList
                        staff={entry.staff}
                        accent={accent}
                        onNavigate={onNavigate}
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
                        heightenedBlock={heightenedBlock}
                        diceSubs={diceSubs}
                        accent={accent}
                    />
                )}

                {/* Corrigir a tradução: só do que já veio traduzido (inglês pendente se resolve sozinho) */}
                {!state.loading && (spell || entry) && !(spell ?? entry)?.translationPending && (
                    <TranslationFix kind={request.type} name={request.name} payload={(spell ?? entry)!} />
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
    )
}

type ShareStatus = 'idle' | 'sending' | 'done' | 'failed'

const SHARE_LABEL: Record<ShareStatus, string> = {
    idle: 'Compartilhar com a mesa',
    sending: 'Compartilhando…',
    done: 'Compartilhado com a mesa',
    failed: 'Não deu para compartilhar — tente de novo',
}

// O ✓ fica uns segundos: confirma, e segura o toque duplo que mandaria duas vezes.
const ShareButton = ({ onShare }: { onShare: () => Promise<boolean> }) => {
    const [status, setStatus] = useState<ShareStatus>('idle')
    useEffect(() => {
        if (status !== 'done' && status !== 'failed') return
        const t = setTimeout(() => setStatus('idle'), 3000)
        return () => clearTimeout(t)
    }, [status])
    const label = SHARE_LABEL[status]
    return (
        <Tooltip title={label}>
            <span>
                <IconButton
                    size="small"
                    aria-label={label}
                    disabled={status === 'sending' || status === 'done'}
                    onClick={async () => {
                        setStatus('sending')
                        setStatus((await onShare()) ? 'done' : 'failed')
                    }}
                >
                    {status === 'done' ? <CheckIcon color="success" /> : <ShareIcon color={status === 'failed' ? 'error' : 'inherit'} />}
                </IconButton>
            </span>
        </Tooltip>
    )
}

// Metadata de talentos/habilidades/itens: traits, nível e os campos em prosa
// (pré-requisitos, gatilho, requisitos…) que o backend extrai e traduz separado
// da descrição — antes eles vinham colados no meio do texto ou eram perdidos
// pelo strip heurístico de metadados.
const EntryMetadata = ({ entry, accent }: { entry: FeatDescription; accent: string }) => {
    const rows: [string, string][] = []
    if (entry.className) rows.push(['Classe', entry.className])
    if (entry.archetype?.length) rows.push(['Arquétipo', entry.archetype.join(', ')])
    if (entry.prerequisites) rows.push(['Pré-requisitos', entry.prerequisites])
    if (entry.frequency) rows.push(['Frequência', entry.frequency])
    if (entry.trigger) rows.push(['Gatilho', entry.trigger])
    if (entry.requirements) rows.push(['Requisitos', entry.requirements])
    if (entry.cost) rows.push(['Custo', entry.cost])
    if (entry.access) rows.push(['Acesso', entry.access])

    if (rows.length === 0 && !entry.traits?.length && entry.level == null) return null

    return (
        <Box sx={{ mb: 2.5 }}>
            {(entry.level != null || (entry.traits && entry.traits.length > 0)) && (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: rows.length > 0 ? 1.5 : 0 }}>
                    {entry.level != null && (
                        <Chip
                            label={`Nível ${entry.level}`}
                            size="small"
                            sx={{
                                backgroundColor: accent + '25',
                                color: accent,
                                border: `1px solid ${accent}60`,
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                height: 22,
                            }}
                        />
                    )}
                    {entry.traits?.map((t) => (
                        <Chip
                            key={t}
                            label={t}
                            size="small"
                            sx={{
                                backgroundColor: 'action.hover',
                                border: '1px solid',
                                borderColor: 'divider',
                                textTransform: 'capitalize',
                                fontSize: '0.7rem',
                                height: 22,
                            }}
                        />
                    ))}
                </Stack>
            )}
            {rows.length > 0 && (
                <Box
                    sx={{
                        display: 'grid',
                        gap: 0.75,
                        px: 1.5,
                        py: 1.25,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: accent + '40',
                        backgroundColor: accent + '0a',
                    }}
                >
                    {rows.map(([label, value]) => (
                        <MetaRow key={label} label={label} value={value} />
                    ))}
                </Box>
            )}
        </Box>
    )
}

/** Botão de rolar a magia — só aparece quando há ataque ou dano legível. */
const SpellRollButton = ({ spell, caster, castRank, name, cast, onRoll }: {
    spell: SpellDescription
    caster?: SpellCasterInfo
    castRank?: number
    name: string
    cast?: CastResource
    onRoll: (req: RollRequest) => void
}) => {
    // Ki Strike, Inner Upheaval e Perfect Strike vivem no diálogo do Golpe: lá o gasto do ponto de foco, o +1 de
    // ataque, o dano extra e a reação saem juntos, e um "Conjurar" aqui cobraria tudo em dobro.
    if (isStrikeFocusSpell(name)) {
        return (
            <Alert severity="info" sx={{ mb: 2 }}>
                Esta magia se usa no diálogo do Golpe (aba Combate, "Rolar" no ataque desarmado): o chip dela gasta o Ponto de Foco e soma o que a magia dá.
            </Alert>
        )
    }
    const hasAttack = !!caster?.attackInfo && (spell.traits ?? []).some((t) => t.toLowerCase() === 'attack')
    const scaled = castRank != null ? scaleSpell(spell, castRank) : null
    const hasDamage = !!scaled && damageComponents(scaled).length > 0
    // Magia da ficha sem nada para rolar (Guidance, Bless…) ainda se CONJURA: o botão gasta as
    // ações e o slot. Magia fora da ficha (bastão, consulta) não tem conjurador e não ganha o botão.
    if (!hasAttack && !hasDamage && !caster) return null
    const label = hasAttack && hasDamage ? 'Rolar ataque e dano' : hasAttack ? 'Rolar ataque' : hasDamage ? 'Rolar dano' : 'Conjurar'
    return (
        <Button
            variant="contained"
            startIcon={<DiceIcon />}
            onClick={() => onRoll({ kind: 'spell', name, attack: caster?.attackInfo ?? null, spell, castRank, psychic: caster?.psychic, cast })}
            sx={{ mb: 2, minHeight: 40 }}
            fullWidth
        >
            {label}
        </Button>
    )
}

const SpellMetadata = ({
    spell,
    accent,
    caster,
    heightenedDamage,
    scaled,
    castLevel,
}: {
    spell: SpellDescription
    accent: string
    caster?: SpellCasterInfo
    heightenedDamage?: string | null
    scaled?: ScaledSpell | null
    castLevel?: number
}) => {
    const dmg = scaled ? damageComponents(scaled) : []
    const named = scaled ? scaled.components.filter((c) => !dmg.includes(c)) : []
    const hasNumbers = scaled ? dmg.length + named.length > 0 : Boolean(spell.damage || heightenedDamage)
    return (
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
        {(caster || spell.traditions?.length || spell.castComponents || spell.range || spell.area || spell.targets || spell.duration || spell.defense || hasNumbers) && (
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
                {scaled ? (
                    <>
                        {dmg.length > 0 && (
                            <MetaRow
                                label={scaled.heightened && castLevel != null ? `Dano (rank ${castLevel})` : 'Dano'}
                                value={dmg.map(componentLabel).join(', ')}
                                accent={scaled.heightened ? accent : undefined}
                            />
                        )}
                        {named.map((c) => (
                            <MetaRow
                                key={c.id}
                                label={namedLabel(c)}
                                value={c.uncertain ? `${c.formula} (?)` : c.changed ? `${formatValue(c.value)} (base ${c.formula})` : formatValue(c.value)}
                                accent={c.changed ? accent : undefined}
                            />
                        ))}
                    </>
                ) : (
                    <>
                        {spell.damage && (
                            <MetaRow
                                label="Dano"
                                value={`${spell.damage}${spell.damageType ? ` ${spell.damageType}` : ''}`}
                            />
                        )}
                        {heightenedDamage && (
                            <MetaRow
                                label={castLevel != null ? `Dano (rank ${castLevel})` : 'Dano elevado'}
                                value={`${heightenedDamage}${spell.damageType ? ` ${spell.damageType}` : ''}`}
                                accent={accent}
                            />
                        )}
                    </>
                )}
            </Box>
        )}
    </Box>
    )
}

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

/** Um dado da prosa trocado pelo valor no rank conjurado. */
interface DiceSub {
    from: string
    to: string
    /** Qual ocorrência de `from` (entre as iguais) é esta. */
    nth: number
    /** Quantas há no inglês; se a tradução tiver outra contagem, não troca nada. */
    occurrences?: number
}

interface Hit { start: number; end: number; sub: DiceSub }

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const diceRe = (formula: string) => new RegExp(`(?<![\\dd])${escapeRe(formula)}(?![\\d])`, 'g')

/**
 * Onde cada troca cai, parte a parte. A contagem de ocorrências é GLOBAL (a
 * prosa inteira), como no inglês de onde veio o `nth`.
 */
function locateSubs(texts: string[], subs: DiceSub[]): Hit[][] {
    const out: Hit[][] = texts.map(() => [])
    const byFormula = new Map<string, DiceSub[]>()
    for (const sub of subs) byFormula.set(sub.from, [...(byFormula.get(sub.from) ?? []), sub])
    for (const [formula, list] of byFormula) {
        const found: { part: number; start: number }[] = []
        texts.forEach((t, part) => {
            for (const m of t.matchAll(diceRe(formula))) found.push({ part, start: m.index ?? 0 })
        })
        for (const sub of list) {
            if (sub.occurrences != null && found.length !== sub.occurrences) continue
            const at = found[sub.nth]
            if (at) out[at.part].push({ start: at.start, end: at.start + formula.length, sub })
        }
    }
    out.forEach((hits) => hits.sort((x, y) => x.start - y.start))
    return out
}

// Renderiza o texto de um parágrafo com os dados elevados destacados.
const PartText = ({ text, hits, accent }: { text: string; hits: Hit[]; accent: string }) => {
    if (hits.length === 0) return <>{text}</>
    const nodes: React.ReactNode[] = []
    let cursor = 0
    hits.forEach((h, i) => {
        if (h.start < cursor) return
        nodes.push(text.slice(cursor, h.start))
        nodes.push(
            <Box
                key={i}
                component="span"
                title={`${h.sub.from} no rank base — elevado para o rank conjurado`}
                sx={{ color: accent, fontWeight: 700 }}
            >
                {h.sub.to}
            </Box>,
        )
        cursor = h.end
    })
    nodes.push(text.slice(cursor))
    return <>{nodes}</>
}

interface HeightenedBlockData {
    title: string
    entries: AppliedHeightened[]
    levelAware: boolean
}

const DescriptionBody = ({
    parts,
    heightenedBlock,
    diceSubs,
    accent,
}: {
    parts: DescriptionPart[]
    heightenedBlock: HeightenedBlockData | null
    diceSubs: DiceSub[]
    accent: string
}) => {
    if (parts.length === 0 && !heightenedBlock) {
        return (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Descrição não encontrada. Tente abrir no Archives of Nethys.
            </Typography>
        )
    }

    const hits = locateSubs(parts.map((p) => p.text), diceSubs)

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
            {parts.map((p, idx) => {
                const partHits = hits[idx]
                return p.kind === 'labeled' ? (
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
                            <PartText text={p.text} hits={partHits} accent={accent} />
                        </Typography>
                    </Box>
                ) : (
                    <Typography key={idx} sx={{ lineHeight: 1.7 }}>
                        <PartText text={p.text} hits={partHits} accent={accent} />
                    </Typography>
                )
            })}

            {heightenedBlock && (
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
                        {heightenedBlock.title}
                    </Typography>
                    <Stack spacing={1}>
                        {heightenedBlock.entries.map((h, idx) => (
                            <Box
                                key={`${h.level}-${idx}`}
                                sx={{
                                    display: 'flex',
                                    gap: 1.25,
                                    alignItems: 'baseline',
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
                                        backgroundColor: accent + '25',
                                        border: '1px solid',
                                        borderColor: accent + '60',
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
                                    {heightenedBlock.levelAware && h.times > 1 && (
                                        <Typography
                                            component="span"
                                            variant="caption"
                                            sx={{ ml: 0.75, color: accent, fontWeight: 700, whiteSpace: 'nowrap' }}
                                        >
                                            ✓ aplica ×{h.times}
                                        </Typography>
                                    )}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}
        </Box>
    )
}
