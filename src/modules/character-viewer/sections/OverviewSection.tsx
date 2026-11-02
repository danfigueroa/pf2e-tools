import { memo, useMemo, useState } from 'react'
import { Alert, Box, ButtonBase, Button, Card, CardContent, CircularProgress, Collapse, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, Stack, Chip, useTheme } from '@mui/material'
import { AutoAwesome as RegenerateIcon, EditNote as NotesIcon, Edit as EditIcon, ExpandMore as ExpandIcon, MenuBook as GuideIcon } from '@mui/icons-material'
import type { BuildInfo } from '../../../pathbuilder/types'
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
import { locale, tr } from '../../../i18n'
import { GuideEditDialog } from '../components/GuideEditDialog'
import { EmbedDialog } from '../components/EmbedDialog'
import { useGuideNotes } from '../components/useGuideNotes'
import { MAX_GUIDE_NOTES } from '../guideNotes'
import { guideKeyFor } from '../charId'
import { useSheetReadOnly } from '../sheetAccess'

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
    // Editar o guia (o texto inteiro, na ficha publicada) e os trechos do jogador (no estado da mesa, nunca regerados).
    const readOnly = useSheetReadOnly()
    const notes = useGuideNotes(guideKeyFor(build))
    const [editing, setEditing] = useState<'guide' | 'notes' | null>(null)
    const [confirmRegen, setConfirmRegen] = useState(false)
    const edited = !!slot.guide?.editedAt
    const regenerate = () => { if (edited) setConfirmRegen(true); else slot.onGenerate() }

    return (
        <Stack spacing={2}>
            {/* Pontos de vida (interativo) */}
            <HpTracker build={build} maxHp={hp} maxHpDelta={mods.hpMaxDelta} />

            {/* Escudo vestido: PV de item, Dureza, erguer/bloquear/consertar. */}
            <ShieldCard build={build} shield={shield} mods={mods} />

            {/* Stat tiles */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: { xs: 1, sm: 1.5 },
            }}>
                <StatTile
                    label={tr("CA", 'AC')}
                    value={baseAc + mods.total.ac + shieldAc}
                    accent={shieldAc ? gold.deep : theme.palette.primary.main}
                    delta={mods.total.ac}
                    base={baseAc}
                    // O número estoura ao erguer/abaixar — é a mudança que a mesa confere.
                    valueKey={shieldAc}
                    animate={armed}
                    extra={shieldAc > 0 ? (
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: gold.deep }}>
                            +{shieldAc} {tr('escudo erguido', 'shield raised')}</Typography>
                    ) : null}
                />
                <StatTile
                    label={tr("Percepção", 'Perception')}
                    value={signed(perception.total)}
                    delta={perception.conditionDelta}
                    base={perception.base}
                    onRoll={() => onRoll({ kind: 'check', check: perception, note: tr('Percepção também é a iniciativa padrão.', 'Perception is also the default initiative.') })}
                />
                <StatTile
                    label={tr("Deslocamento", 'Speed')}
                    value={tr(`${speed} pés`, `${speed} feet`)}
                    delta={mods.total.speed}
                />
            </Box>

            {/* Saves */}
            <Card>
                <CardContent>
                    <SectionTitle>{tr('Salvaguardas', 'Saving Throws')}</SectionTitle>
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
                    <SectionTitle>{tr('Atributos', 'Attributes')}</SectionTitle>
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
                                <SectionTitle>{tr('Idiomas', 'Languages')}</SectionTitle>
                                <Typography>{build.languages.join(', ')}</Typography>
                            </Box>
                        )}
                        {((build.resistances && build.resistances.length > 0) || rageResist) && (
                            <Box>
                                <SectionTitle>{tr('Resistências', 'Resistances')}</SectionTitle>
                                {build.resistances && build.resistances.length > 0 && (
                                    <Typography>{build.resistances.join(', ')}</Typography>
                                )}
                                {rageResist && (
                                    <Typography sx={{ color: RAGE_COLOR, fontWeight: 600 }}>
                                        {tr('Em fúria: ', 'Raging: ')}{rageResist}
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
                            {tr('Guia de Uso — Como Jogar', 'Play Guide — How to Play')}</Typography>
                        {guide.ai && (
                            <Chip label={edited ? tr('gerado por IA · editado', 'AI-generated · edited') : tr('gerado por IA', 'AI-generated')} size="small" variant="outlined" sx={{ ml: 'auto' }} />
                        )}
                        {!guide.curated && (
                            <Chip label={tr("automático", 'automatic')} size="small" variant="outlined" sx={{ ml: 'auto' }} />
                        )}
                        {compact && !guideOpen && slot.status === 'generating' && (
                            <Chip label={tr("gerando…", 'generating…')} size="small" color="info" variant="outlined" />
                        )}
                        {compact && !guideOpen && slot.status === 'failed' && (
                            <Chip label={tr("não gerou", 'not generated')} size="small" color="warning" variant="outlined" />
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
                            {tr('Gerando o guia para a ficha publicada… leva até meio minuto.', 'Generating the guide for the published sheet… takes up to half a minute.')}{!guide.ai && tr(' Enquanto isso, segue o guia anterior.', ' Meanwhile, the previous guide stays.')}
                        </Alert>
                    )}
                    {slot.status === 'failed' && (
                        <Alert
                            severity="warning"
                            sx={{ mb: 2 }}
                            action={<Button color="inherit" size="small" onClick={slot.onGenerate}>{tr('Tentar de novo', 'Try again')}</Button>}
                        >
                            {tr('Não deu para gerar o guia: ', 'Couldn\'t generate the guide: ')}{slot.error}
                        </Alert>
                    )}
                    {slot.published && !slot.guide && slot.status === 'idle' && (
                        <Alert
                            severity="info"
                            sx={{ mb: 2 }}
                            action={<Button color="inherit" size="small" onClick={slot.onGenerate}>{tr('Gerar guia', 'Generate guide')}</Button>}
                        >
                            {tr('Esta ficha foi publicada sem guia novo — o de baixo pode descrever a versão anterior.', 'This sheet was published without a new guide — the one below may describe the previous version.')}</Alert>
                    )}

                    <GuideMarkdown markdown={guide.markdown} />

                    {notes.text && (
                        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="overline" sx={{ display: 'block', fontWeight: 700, color: 'primary.light', lineHeight: 1.6 }}>
                                {tr('Do jogador', 'From the player')}</Typography>
                            <GuideMarkdown markdown={notes.text} />
                        </Box>
                    )}

                    {guide.ai && slot.guide && (
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 auto' }}>
                                {slot.guide.editedAt
                                    ? tr(`Gerado por IA e editado à mão em ${new Date(slot.guide.editedAt).toLocaleDateString(locale)}. A próxima geração parte deste texto.`, `AI-generated and edited by hand on ${new Date(slot.guide.editedAt).toLocaleDateString(locale)}. The next generation starts from this text.`)
                                    : <>{tr('Gerado por IA a partir da ficha em ', 'Generated by AI from the sheet on ')}{new Date(slot.guide.generatedAt).toLocaleDateString(locale)}{tr('. Confira na ficha antes de confiar num número.', '. Check the sheet before trusting a number.')}</>}
                            </Typography>
                            <Button
                                size="small"
                                startIcon={<RegenerateIcon />}
                                onClick={regenerate}
                                disabled={slot.status === 'generating'}
                            >
                                {tr('Gerar de novo', 'Generate again')}</Button>
                        </Box>
                    )}
                    {!readOnly && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: guide.ai && slot.guide ? 1 : 2 }}>
                            {slot.onEdit && (
                                <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing('guide')} disabled={slot.status === 'generating'}>
                                    {tr('Editar guia', 'Edit guide')}</Button>
                            )}
                            <Button size="small" variant="outlined" startIcon={<NotesIcon />} onClick={() => setEditing('notes')}>
                                {notes.text ? tr('Editar meus trechos', 'Edit my notes') : tr('Acrescentar meus trechos', 'Add my own notes')}</Button>
                        </Box>
                    )}
                    </Collapse>
                    {slot.onEdit && (
                        <GuideEditDialog
                            open={editing === 'guide'}
                            onClose={() => setEditing(null)}
                            title={tr('Editar o guia', 'Edit the guide')}
                            initial={guide.markdown}
                            hint={tr('Vale para quem abrir esta ficha. A IA não apaga a sua edição sozinha: ela só reescreve se você pedir "Gerar de novo" ou publicar uma versão nova — e parte deste texto.', 'It applies to anyone who opens this sheet. The AI doesn\'t erase your edit by itself: it only rewrites when you ask "Generate again" or publish a new version — and it starts from this text.')}
                            maxLength={7500}
                            onSave={async (text) => { await slot.onEdit!(text) }}
                        />
                    )}
                    <GuideEditDialog
                        open={editing === 'notes'}
                        onClose={() => setEditing(null)}
                        title={tr('Meus trechos do guia', 'My guide notes')}
                        initial={notes.text}
                        hint={tr('Seu texto aparece no fim do guia, em "Do jogador". A IA nunca o reescreve, e ele continua aqui a cada publicação. Vazio = apagar.', 'Your text shows at the end of the guide, under "From the player". The AI never rewrites it, and it stays here through every publication. Empty = delete.')}
                        maxLength={MAX_GUIDE_NOTES}
                        allowEmpty
                        onSave={(text) => notes.setText(text)}
                    />
                    <EmbedDialog open={confirmRegen} onClose={() => setConfirmRegen(false)}>
                        <DialogTitle>{tr('Gerar o guia de novo?', 'Generate the guide again?')}</DialogTitle>
                        <DialogContent>
                            <DialogContentText>
                                {tr('Este guia foi editado à mão. A IA vai reescrevê-lo partindo do seu texto, e a edição deixa de valer como está. Os seus trechos ("Do jogador") não mudam.', 'This guide was edited by hand. The AI will rewrite it starting from your text, and the edit no longer stands as is. Your notes ("From the player") don\'t change.')}</DialogContentText>
                        </DialogContent>
                        <DialogActions>
                            <Button color="inherit" onClick={() => setConfirmRegen(false)}>{tr('Cancelar', 'Cancel')}</Button>
                            <Button variant="contained" onClick={() => { setConfirmRegen(false); slot.onGenerate() }}>{tr('Gerar de novo', 'Generate again')}</Button>
                        </DialogActions>
                    </EmbedDialog>
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
