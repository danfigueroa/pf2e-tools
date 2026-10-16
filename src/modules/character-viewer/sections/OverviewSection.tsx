import { memo, useMemo, useState } from 'react'
import { Alert, Box, ButtonBase, Button, Card, CardContent, CircularProgress, Collapse, Typography, Stack, Chip, useTheme } from '@mui/material'
import { AutoAwesome as RegenerateIcon, ExpandMore as ExpandIcon, MenuBook as GuideIcon } from '@mui/icons-material'
import type { BuildInfo } from '../../character-sheet/types'
import { abilityMod, signed, ABILITY_LABELS, characterMaxHp, isMythicCharacter, MYTHIC_COLOR, type AbilityKey } from '../helpers'
import { perceptionCheck, saveCheck, SAVES } from '../checks'
import { getCombatGuide } from '../combatGuides'
import { GuideMarkdown } from '../components/GuideMarkdown'
import { HpTracker } from '../components/HpTracker'
import { ShieldCard } from '../components/ShieldCard'
import { useCharacterShield } from '../components/useShield'
import { RAGE_COLOR, gold } from '../../../theme/palette'
import { RESIST_LABEL } from '../rage'
import { pop, useArmed } from '../../../motion/motion'
import { ConditionDelta } from '../components/ConditionDelta'
import { MythicNote } from '../components/MythicNote'
import type { ConditionModifiers } from '../conditions'
import type { GuideSlot } from '../components/usePublication'
import type { RollRequest } from '../components/RollDialog'
import { RollTrigger } from '../components/RollTrigger'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
    guide: GuideSlot
    onRoll: (req: RollRequest) => void
    /** Celular ou painel estreito: o guia vira uma aba que abre e fecha. */
    compact?: boolean
}

const OverviewSectionView = ({ build, mods, guide: slot, onRoll, compact = false }: Props) => {
    const theme = useTheme()
    // No celular o guia é longo e empurra as outras abas para longe: começa fechado.
    const [guideOpen, setGuideOpen] = useState(false)
    const showGuide = !compact || guideOpen
    // Drenado corta PV máximos (valor × nível); nunca abaixo de 1.
    const hp = characterMaxHp(build, mods.hpMaxDelta)

    // Raging Resistance: só enquanto a Fúria está ligada (`rage.ts`).
    const rageResist = useMemo(() => {
        const entries = Object.entries(mods.rage?.resist ?? {})
        return entries.length > 0 ? entries.map(([t, v]) => `${RESIST_LABEL[t] ?? t} ${v}`).join(', ') : null
    }, [mods.rage])

    const baseAc = build.acTotal?.acTotal ?? 10
    // O escudo erguido soma na CA; o Pathbuilder exporta a CA sem ele.
    const shield = useCharacterShield(build)
    const shieldAc = shield.view?.acBonus ?? 0
    const armed = useArmed()
    const perception = perceptionCheck(build, mods)
    const baseSpeed = build.attributes.speed + (build.attributes.speedBonus || 0)
    const speed = Math.max(0, baseSpeed + mods.total.speed)

    const saves = SAVES.map((s) => saveCheck(build, s.key, mods))

    // Ficha publicada com guia gerado: vale o gerado, que descreve ESTA versão.
    // Sem ele, o curado à mão (ou a heurística) continua aparecendo — com aviso
    // se a ficha é da mesa, porque aí ele pode estar descrevendo a anterior.
    const fallback = useMemo(() => getCombatGuide(build), [build])
    const guide = slot.guide
        ? { markdown: slot.guide.markdown, curated: true, ai: true }
        : { ...fallback, ai: false }
    const mythic = isMythicCharacter(build)

    return (
        <Stack spacing={2}>
            {/* Pontos de vida (interativo) */}
            <HpTracker build={build} maxHp={hp} maxHpDelta={mods.hpMaxDelta} />

            {/* Escudo vestido: PV de item, Dureza, erguer/bloquear/consertar. */}
            <ShieldCard build={build} shield={shield} hpMaxDelta={mods.hpMaxDelta} />

            {/* Stat tiles */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: { xs: 1, sm: 1.5 },
            }}>
                <StatTile
                    label="CA"
                    value={baseAc + mods.total.ac + shieldAc}
                    accent={shieldAc ? gold.deep : theme.palette.primary.main}
                    delta={mods.total.ac}
                    base={baseAc}
                    // O número estoura ao erguer/abaixar — é a mudança que a mesa confere.
                    valueKey={shieldAc}
                    animate={armed}
                    extra={shieldAc > 0 ? (
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: gold.deep }}>
                            +{shieldAc} escudo erguido
                        </Typography>
                    ) : null}
                />
                <StatTile
                    label="Percepção"
                    value={signed(perception.total)}
                    delta={perception.conditionDelta}
                    base={perception.base}
                    onRoll={() => onRoll({ kind: 'check', check: perception, note: 'Percepção também é a iniciativa padrão.' })}
                />
                <StatTile
                    label="Deslocamento"
                    value={`${speed} pés`}
                    delta={mods.total.speed}
                />
            </Box>

            {/* Saves */}
            <Card>
                <CardContent>
                    <SectionTitle>Salvaguardas</SectionTitle>
                    {/* Grade em vez de Stack: no celular o Stack virava coluna
                        e o divisor vertical ficava atravessado. Três colunas
                        cabem mesmo em 320px — são três números curtos. */}
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            '& > * + *': { borderLeft: '1px solid', borderColor: 'divider' },
                        }}
                    >
                        {saves.map((s) => {
                            return (
                                <RollTrigger
                                    key={s.label}
                                    label={s.label}
                                    onClick={() => onRoll({ kind: 'check', check: s })}
                                    sx={{ textAlign: 'center', px: 0.5, py: 0.5, borderRadius: 0 }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {s.label}
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.light', lineHeight: 1.2 }}>
                                        {signed(s.total)}
                                    </Typography>
                                    <ConditionDelta delta={s.conditionDelta} base={s.base} />
                                    {mythic && (
                                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: MYTHIC_COLOR }}>
                                            ✦ {signed(s.total + s.mythicDelta)}
                                        </Typography>
                                    )}
                                </RollTrigger>
                            )
                        })}
                    </Box>
                    {mythic && <MythicNote sx={{ mt: 1, textAlign: 'center' }} />}
                </CardContent>
            </Card>

            {/* Atributos */}
            <Card>
                <CardContent>
                    <SectionTitle>Atributos</SectionTitle>
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' },
                        gap: 1,
                    }}>
                        {(Object.keys(ABILITY_LABELS) as AbilityKey[]).map((k) => {
                            const score = build.abilities[k]
                            const mod = abilityMod(score)
                            const isKey = build.keyability === k
                            return (
                                <Box
                                    key={k}
                                    sx={{
                                        textAlign: 'center',
                                        py: 1.5,
                                        borderRadius: 1.5,
                                        border: '1px solid',
                                        borderColor: isKey ? 'primary.main' : 'divider',
                                        backgroundColor: isKey ? theme.palette.primary.main + '14' : 'transparent',
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                                        {ABILITY_LABELS[k]}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1, mt: 0.25 }}>
                                        {signed(mod)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {score}
                                    </Typography>
                                </Box>
                            )
                        })}
                    </Box>
                </CardContent>
            </Card>

            {/* Idiomas + Resistências */}
            {(build.languages?.length || build.resistances?.length || rageResist) && (
                <Card>
                    <CardContent>
                        {build.languages?.length > 0 && (
                            <Box sx={{ mb: build.resistances?.length || rageResist ? 2 : 0 }}>
                                <SectionTitle>Idiomas</SectionTitle>
                                <Typography>{build.languages.join(', ')}</Typography>
                            </Box>
                        )}
                        {((build.resistances && build.resistances.length > 0) || rageResist) && (
                            <Box>
                                <SectionTitle>Resistências</SectionTitle>
                                {build.resistances && build.resistances.length > 0 && (
                                    <Typography>{build.resistances.join(', ')}</Typography>
                                )}
                                {rageResist && (
                                    <Typography sx={{ color: RAGE_COLOR, fontWeight: 600 }}>
                                        Em fúria: {rageResist}
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Guia de uso — como jogar em combate (último elemento) */}
            <Card sx={{ borderColor: theme.palette.primary.main + '55' }}>
                <CardContent>
                    <Box
                        component={compact ? ButtonBase : 'div'}
                        {...(compact ? {
                            onClick: () => setGuideOpen((o) => !o),
                            'aria-expanded': guideOpen,
                            'aria-controls': 'guide-body',
                        } : {})}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: showGuide ? 1.5 : 0,
                            flexWrap: 'wrap',
                            ...(compact ? { width: '100%', textAlign: 'left', justifyContent: 'flex-start', borderRadius: 1 } : {}),
                        }}
                    >
                        <GuideIcon sx={{ color: 'primary.light' }} />
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Guia de Uso — Como Jogar
                        </Typography>
                        {guide.ai && (
                            <Chip label="gerado por IA" size="small" variant="outlined" sx={{ ml: 'auto' }} />
                        )}
                        {!guide.curated && (
                            <Chip label="automático" size="small" variant="outlined" sx={{ ml: 'auto' }} />
                        )}
                        {compact && !guideOpen && slot.status === 'generating' && (
                            <Chip label="gerando…" size="small" color="info" variant="outlined" />
                        )}
                        {compact && !guideOpen && slot.status === 'failed' && (
                            <Chip label="não gerou" size="small" color="warning" variant="outlined" />
                        )}
                        {compact && (
                            <ExpandIcon
                                sx={{
                                    ml: guide.ai || !guide.curated ? 0 : 'auto',
                                    transition: 'transform 150ms',
                                    transform: guideOpen ? 'rotate(180deg)' : 'none',
                                }}
                            />
                        )}
                    </Box>

                    <Collapse in={showGuide} timeout={compact ? 200 : 0} unmountOnExit id="guide-body">
                    {slot.status === 'generating' && (
                        <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ mb: 2 }}>
                            Gerando o guia para a ficha publicada… leva até meio minuto.
                            {!guide.ai && ' Enquanto isso, segue o guia anterior.'}
                        </Alert>
                    )}
                    {slot.status === 'failed' && (
                        <Alert
                            severity="warning"
                            sx={{ mb: 2 }}
                            action={<Button color="inherit" size="small" onClick={slot.onGenerate}>Tentar de novo</Button>}
                        >
                            Não deu para gerar o guia: {slot.error}
                        </Alert>
                    )}
                    {slot.published && !slot.guide && slot.status === 'idle' && (
                        <Alert
                            severity="info"
                            sx={{ mb: 2 }}
                            action={<Button color="inherit" size="small" onClick={slot.onGenerate}>Gerar guia</Button>}
                        >
                            Esta ficha foi publicada sem guia novo — o de baixo pode descrever a versão anterior.
                        </Alert>
                    )}

                    <GuideMarkdown markdown={guide.markdown} />

                    {guide.ai && slot.guide && (
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 auto' }}>
                                Gerado por IA a partir da ficha em {new Date(slot.guide.generatedAt).toLocaleDateString('pt-BR')}.
                                Confira na ficha antes de confiar num número.
                            </Typography>
                            <Button
                                size="small"
                                startIcon={<RegenerateIcon />}
                                onClick={slot.onGenerate}
                                disabled={slot.status === 'generating'}
                            >
                                Gerar de novo
                            </Button>
                        </Box>
                    )}
                    </Collapse>
                </CardContent>
            </Card>
        </Stack>
    )
}

const StatTile = ({ label, value, accent, delta = 0, base, extra, valueKey, animate = false, onRoll }: {
    /** Torna o cartão tocável para rolar o teste. */
    onRoll?: () => void
    label: string
    value: string | number
    accent?: string
    delta?: number
    base?: number
    extra?: React.ReactNode
    /** Troca → o número estoura de novo (ver `animate`). */
    valueKey?: string | number
    animate?: boolean
}) => (
    <Card sx={{ borderColor: accent ? accent + '60' : undefined, transition: 'border-color 300ms' }}>
        <MaybeRoll label={label} onRoll={onRoll}>
        {/* "DESLOCAMENTO" é o rótulo mais longo e define o aperto: no celular
            a margem interna e a fonte encolhem para ele caber numa linha. */}
        <CardContent sx={{ textAlign: 'center', px: { xs: 1, sm: 2 }, py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: { xs: 0, sm: '0.04em' },
                    fontSize: { xs: '0.62rem', sm: '0.75rem' },
                }}
            >
                {label}
            </Typography>
            <Typography
                key={valueKey}
                variant="h4"
                sx={{
                    fontWeight: 700,
                    color: accent || 'primary.light',
                    mt: 0.25,
                    fontSize: { xs: '1.35rem', sm: '1.5rem' },
                    animation: animate ? `${pop} 360ms ease-out` : 'none',
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
            >
                {value}
            </Typography>
            <ConditionDelta delta={delta} base={base} />
            {extra}
        </CardContent>
        </MaybeRoll>
    </Card>
)

const MaybeRoll = ({ label, onRoll, children }: { label: string; onRoll?: () => void; children: React.ReactNode }) =>
    onRoll ? <RollTrigger label={label} onClick={onRoll} sx={{ borderRadius: 0 }}>{children}</RollTrigger> : <>{children}</>

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <Typography
        variant="overline"
        sx={{
            display: 'block',
            color: 'text.secondary',
            fontWeight: 700,
            letterSpacing: '0.06em',
            mb: 1.25,
        }}
    >
        {children}
    </Typography>
)

export const OverviewSection = memo(OverviewSectionView)
