import { useEffect, useState } from 'react'
import {
    Alert,
    Snackbar,
    Box,
    Container,
    Tabs,
    Tab,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    useTheme,
    useMediaQuery,
} from '@mui/material'
import { ExpandMore as ExpandIcon } from '@mui/icons-material'
import { checkApiAvailable, fetchCompanionStats } from '../../services/descriptions'
import {
    Shield as OverviewIcon,
    LocalFireDepartment as CombatIcon,
    Star as SkillsIcon,
    EmojiEvents as FeatsIcon,
    AutoAwesome as SpecialsIcon,
    AutoFixHigh as SpellsIcon,
    Pets as PetsIcon,
    Inventory2 as InventoryIcon,
} from '@mui/icons-material'

import { green, gold, parchment, displayFont } from '../../theme'
import { normalizeSpellCasters, parseCharacterJson, type BuildInfo } from '../character-sheet/types'
import { UploadCard, type JsonOrigin } from './components/UploadCard'
import { PublishDialog, type PublishBase } from './components/PublishDialog'
import { PublishedBar } from './components/PublishedBar'
import { usePublication, type GuideSlot } from './components/usePublication'
import { fetchPublished, type PublishedSheet } from '../../services/sheets'
import { CAMPAIGN_PRESETS } from './campaignPresets'
import { getCombatGuide } from './combatGuides'
import { CharacterHeader } from './components/CharacterHeader'
import { DescriptionDrawer, type DescriptionRequest } from './components/DescriptionDrawer'
import { ConditionsBar } from './components/ConditionsBar'
import { AfflictionsBar } from './components/AfflictionsBar'
import { PersistentDamageBar } from './components/PersistentDamageBar'
import { MythicPointsBar } from './components/MythicPointsBar'
import { afflictionsKeyFor, charSlugFromName, conditionsKeyFor, legacyCharKey, mythicKeyFor, persistentKeyFor } from './charId'
import { useConditions } from './components/useConditions'
import { useAfflictions } from './components/useAfflictions'
import { usePersistentDamage } from './components/usePersistentDamage'
import { useMythicPoints, type MythicPointsApi } from './components/useMythicPoints'
import { isMythicCharacter, MYTHIC_POINTS_MAX } from './helpers'
import type { ConditionModifiers } from './conditions'

import { OverviewSection } from './sections/OverviewSection'
import { CombatSection } from './sections/CombatSection'
import { SkillsSection } from './sections/SkillsSection'
import { FeatsSection } from './sections/FeatsSection'
import { SpecialsSection } from './sections/SpecialsSection'
import { SpellsSection } from './sections/SpellsSection'
import { PetsSection } from './sections/PetsSection'
import { InventorySection } from './sections/InventorySection'

const SESSION_KEY = 'pf2e:viewer:lastBuild'
/** Slug da ficha publicada aberta — ao recarregar, relê a versão da mesa. */
const SESSION_PUBLISHED_KEY = 'pf2e:viewer:lastPublished'

/** O guia que o app mostrava — base para a IA atualizar em vez de começar do zero. */
const curatedBase = (b: BuildInfo): string | null => {
    const g = getCombatGuide(b)
    return g.curated ? g.markdown : null
}

/** O que toda seção recebe: a ficha, o abridor do drawer, as condições ativas e os Pontos Míticos. */
export interface SectionContext {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
    guide: GuideSlot
}

interface SectionDef {
    id: string
    label: string
    icon: React.ReactElement
    render: (ctx: SectionContext) => React.ReactNode
    visible?: (build: BuildInfo) => boolean
}

const SECTIONS: SectionDef[] = [
    {
        id: 'overview',
        label: 'Visão Geral',
        icon: <OverviewIcon />,
        render: ({ build, mods, guide }) => <OverviewSection build={build} mods={mods} guide={guide} />,
    },
    {
        id: 'combat',
        label: 'Combate',
        icon: <CombatIcon />,
        render: ({ build, mods }) => <CombatSection build={build} mods={mods} />,
    },
    {
        id: 'skills',
        label: 'Perícias',
        icon: <SkillsIcon />,
        render: ({ build, mods }) => <SkillsSection build={build} mods={mods} />,
    },
    {
        id: 'feats',
        label: 'Talentos',
        icon: <FeatsIcon />,
        render: ({ build, onSelect }) => <FeatsSection build={build} onSelect={onSelect} />,
    },
    {
        id: 'specials',
        label: 'Habilidades',
        icon: <SpecialsIcon />,
        render: ({ build, onSelect }) => <SpecialsSection build={build} onSelect={onSelect} />,
        visible: (b) => (b.specials?.length ?? 0) > 0,
    },
    {
        id: 'spells',
        label: 'Magias',
        icon: <SpellsIcon />,
        render: ({ build, onSelect, mods, mythicPoints }) => (
            <SpellsSection build={build} onSelect={onSelect} mods={mods} mythicPoints={mythicPoints} />
        ),
        visible: (b) => {
            const hasCasters = b.spellCasters?.some(c => c.spells.some(l => l.list.length > 0))
            const hasFocus = !!b.focus && Object.keys(b.focus).length > 0
            return !!(hasCasters || hasFocus)
        },
    },
    {
        id: 'pets',
        label: 'Companheiros',
        icon: <PetsIcon />,
        render: ({ build }) => <PetsSection build={build} />,
        visible: (b) => (b.pets?.length ?? 0) > 0 || (b.familiars?.length ?? 0) > 0,
    },
    {
        id: 'inventory',
        label: 'Inventário',
        icon: <InventoryIcon />,
        render: ({ build, onSelect, mods }) => <InventorySection build={build} onSelect={onSelect} mods={mods} />,
    },
]

export const CharacterViewerPage = () => {
    const theme = useTheme()
    // Acordeão só no celular. Do tablet para cima as abas roláveis cabem e
    // poupam a rolagem vertical enorme que 8 seções empilhadas produzem.
    const isPhone = useMediaQuery(theme.breakpoints.down('sm'))

    const [build, setBuild] = useState<BuildInfo | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState(0)
    const [expanded, setExpanded] = useState<string | false>('overview')
    const [drawerReq, setDrawerReq] = useState<DescriptionRequest | null>(null)
    const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)

    // Condições ficam fora das abas: afetam a ficha inteira e precisam de um
    // hook incondicional, então a chave cai num placeholder enquanto não há ficha.
    // Aflições vêm ANTES das condições: o estágio ativo impõe condições que
    // precisam entrar no cálculo dos modificadores da ficha.
    const afflictions = useAfflictions(
        build ? afflictionsKeyFor(build) : 'none/afflictions',
    )

    const persistentDamage = usePersistentDamage(
        build ? persistentKeyFor(build) : 'none/persistent',
    )

    const conditions = useConditions(
        build ? conditionsKeyFor(build) : 'none/conditions',
        build?.level ?? 1,
        build ? legacyCharKey(build) : undefined,
        afflictions.conditions,
    )

    // Pontos Míticos: mesma história das condições — gastos de qualquer aba,
    // então o hook mora aqui e a chave também cai num placeholder sem ficha.
    const mythicPoints = useMythicPoints(
        build ? mythicKeyFor(build) : 'none/mythic',
        MYTHIC_POINTS_MAX,
    )

    const publication = usePublication()
    const { attach } = publication
    // Arquivo enviado aguardando a escolha entre publicar e só ver.
    const [pending, setPending] = useState<{ json: unknown; build: BuildInfo; base: PublishBase | null } | null>(null)
    const [publishBusy, setPublishBusy] = useState(false)
    const [publishError, setPublishError] = useState<string | null>(null)
    const [publishedNotice, setPublishedNotice] = useState<string | null>(null)

    // Restaurar ficha da sessão ao recarregar. Se era a ficha da mesa, relê a
    // versão publicada — alguém pode ter publicado outra enquanto isso.
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY)
            // Normaliza de novo: a ficha salva antes da correção do `prepared` ainda vem sem ele.
            if (raw) setBuild(normalizeSpellCasters(JSON.parse(raw) as BuildInfo))
            const slug = sessionStorage.getItem(SESSION_PUBLISHED_KEY)
            if (slug) {
                fetchPublished(slug).then((sheet) => {
                    if (!sheet) return
                    try { setBuild(parseCharacterJson(sheet.json)) } catch { return }
                    attach(sheet)
                })
            }
        } catch { /* noop */ }
    }, [attach])

    // Verifica se o backend está disponível ao montar
    useEffect(() => {
        let cancelled = false
        checkApiAvailable().then((ok) => { if (!cancelled) setApiAvailable(ok) })
        return () => { cancelled = true }
    }, [])

    // Pré-busca stats de companheiros animais (só 1-2 fetches, vale eager)
    useEffect(() => {
        if (!build || apiAvailable !== true) return
        const animals = (build.pets || [])
            .filter(p => p.type === 'Animal Companion' && p.animal && !build.petDescriptions?.[p.animal])
            .map(p => p.animal!)
        if (animals.length === 0) return

        let cancelled = false
        Promise.all(animals.map(fetchCompanionStats)).then((stats) => {
            if (cancelled) return
            const fresh: Record<string, NonNullable<BuildInfo['petDescriptions']>[string]> = {}
            animals.forEach((name, idx) => { if (stats[idx]) fresh[name] = stats[idx]! })
            if (Object.keys(fresh).length === 0) return
            setBuild((prev) => prev ? { ...prev, petDescriptions: { ...prev.petDescriptions, ...fresh } } : prev)
        })
        return () => { cancelled = true }
    }, [build, apiAvailable])

    /** Abre a ficha. `published` = é a versão da mesa (tem guia gerado). */
    const show = (b: BuildInfo, published: PublishedSheet | null) => {
        setBuild(b)
        attach(published)
        setError(null)
        setActiveTab(0)
        setExpanded('overview')
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(b))
            if (published) sessionStorage.setItem(SESSION_PUBLISHED_KEY, published.slug)
            else sessionStorage.removeItem(SESSION_PUBLISHED_KEY)
        } catch { /* noop */ }
    }

    const handleJson = async (json: unknown, origin: JsonOrigin) => {
        let b: BuildInfo
        try {
            b = parseCharacterJson(json)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'JSON inválido.')
            return
        }
        if (origin.kind === 'preset') {
            show(b, origin.published)
            return
        }
        // Arquivo enviado: compara com a versão que a mesa usa hoje (a
        // publicada, senão o arquivo fixo da campanha) antes de oferecer publicar.
        setPublishError(null)
        const current = await fetchPublished(charSlugFromName(b.name))
        let base: PublishBase | null = null
        try {
            if (current) {
                base = { build: parseCharacterJson(current.json), from: 'published', publishedAt: current.publishedAt }
            } else {
                const preset = CAMPAIGN_PRESETS.find((p) => p.sheetName === b.name)
                const res = preset ? await fetch(`/characters/${preset.filename}`) : null
                if (res?.ok) base = { build: parseCharacterJson(await res.json()), from: 'static' }
            }
        } catch { /* sem base: o diálogo trata como personagem novo */ }
        setPending({ json, build: b, base })
    }

    const handlePublish = async () => {
        if (!pending) return
        setPublishBusy(true)
        setPublishError(null)
        // O guia que o app mostrava para ESTE personagem vira a base do novo.
        const base = curatedBase(pending.build)
        try {
            const sheet = await publication.publish(pending.json)
            show(parseCharacterJson(sheet.json), sheet)
            setPending(null)
            setPublishedNotice(`${sheet.name} publicada para a mesa.`)
            void publication.generateGuide(sheet, base)
        } catch (e) {
            setPublishError(e instanceof Error ? e.message : 'Falha ao publicar')
        } finally {
            setPublishBusy(false)
        }
    }

    const handleRestore = async () => {
        const slug = publication.published?.slug
        if (!slug) return
        try {
            const sheet = await publication.restore(slug)
            show(parseCharacterJson(sheet.json), sheet)
            setPublishedNotice('Versão anterior restaurada.')
        } catch (e) {
            setPublishedNotice(e instanceof Error ? e.message : 'Falha ao restaurar')
        }
    }

    const handleReset = () => {
        setBuild(null)
        setError(null)
        attach(null)
        try {
            sessionStorage.removeItem(SESSION_KEY)
            sessionStorage.removeItem(SESSION_PUBLISHED_KEY)
        } catch { /* noop */ }
    }

    const publishDialog = pending && (
        <PublishDialog
            open
            incoming={pending.build}
            base={pending.base}
            busy={publishBusy}
            error={publishError}
            onViewOnly={() => { show(pending.build, null); setPending(null) }}
            onPublish={handlePublish}
            onCancel={() => setPending(null)}
        />
    )

    const publishSnackbar = (
        <Snackbar
            open={!!publishedNotice}
            autoHideDuration={6000}
            onClose={(_, reason) => { if (reason !== 'clickaway') setPublishedNotice(null) }}
            message={publishedNotice}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
    )

    if (!build) {
        return (
            <>
                <UploadCard onJson={handleJson} error={error} />
                {publishDialog}
                {publishSnackbar}
            </>
        )
    }

    const visibleSections = SECTIONS.filter(s => !s.visible || s.visible(build))
    const published = publication.published
    const guide: GuideSlot = {
        published,
        guide: published?.guide ?? null,
        status: publication.guideStatus,
        error: publication.guideError,
        onGenerate: () => { if (published) void publication.generateGuide(published, curatedBase(build)) },
    }
    const ctx: SectionContext = { build, onSelect: setDrawerReq, mods: conditions.mods, mythicPoints, guide }

    return (
        <Container maxWidth="lg" disableGutters sx={{ pb: 6 }}>
            <CharacterHeader build={build} onReset={handleReset} />
            {published && <PublishedBar sheet={published} onRestore={handleRestore} />}

            <ConditionsBar conditions={conditions} />
            <AfflictionsBar afflictions={afflictions.afflictions} onRemove={afflictions.remove} />
            <PersistentDamageBar
                persistent={persistentDamage.persistent}
                onRemove={persistentDamage.remove}
            />

            {isMythicCharacter(build) && <MythicPointsBar points={mythicPoints} />}

            {apiAvailable === false && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Servidor de descrições offline. Os textos do AON não serão carregados.
                    Para ativar a busca + tradução, rode <code>yarn dev:full</code> (em vez de <code>yarn dev</code>).
                </Alert>
            )}

            {isPhone ? (
                <Box>
                    {visibleSections.map((s) => (
                        <Accordion
                            key={s.id}
                            expanded={expanded === s.id}
                            onChange={(_, isOpen) => setExpanded(isOpen ? s.id : false)}
                            sx={{
                                '&:before': { display: 'none' },
                                mb: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1.5,
                                overflow: 'hidden',
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandIcon sx={{ color: gold.bright }} />}
                                sx={{
                                    backgroundColor: green.main,
                                    color: parchment.page,
                                    borderBottom: `2px solid ${gold.main}`,
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                    <Box sx={{ color: gold.bright, display: 'flex' }}>{s.icon}</Box>
                                    <Typography
                                        sx={{ fontFamily: displayFont, fontWeight: 700, letterSpacing: '0.06em' }}
                                    >
                                        {s.label}
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 2 }}>
                                {s.render(ctx)}
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            ) : (
                <Box>
                    <Tabs
                        value={Math.min(activeTab, visibleSections.length - 1)}
                        onChange={(_, v) => setActiveTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{
                            backgroundColor: green.main,
                            borderRadius: 1,
                            borderBottom: `3px solid ${gold.bright}`,
                            mb: 3,
                            minHeight: 48,
                            '& .MuiTab-root': {
                                minHeight: 48,
                                color: 'rgba(237, 227, 204, 0.75)',
                                '&.Mui-selected': { color: gold.bright },
                            },
                            '& .MuiTabs-scrollButtons': {
                                color: parchment.page,
                                // No tablet a faixa rola, mas sem seta ninguém
                                // descobre que há aba depois de "Magias".
                                '&.Mui-disabled': { opacity: 0.3 },
                            },
                        }}
                    >
                        {visibleSections.map((s) => (
                            <Tab
                                key={s.id}
                                label={s.label}
                                icon={s.icon}
                                iconPosition="start"
                                sx={{
                                    minHeight: 48,
                                    // Tablet: só o rótulo, senão sobram duas
                                    // abas visíveis e o resto vira rolagem.
                                    '& > .MuiTab-iconWrapper': {
                                        display: { xs: 'none', md: 'inline-flex' },
                                    },
                                }}
                            />
                        ))}
                    </Tabs>

                    {visibleSections[Math.min(activeTab, visibleSections.length - 1)].render(ctx)}
                </Box>
            )}

            <DescriptionDrawer
                request={drawerReq}
                onClose={() => setDrawerReq(null)}
                onNavigate={setDrawerReq}
            />
            {publishDialog}
            {publishSnackbar}
        </Container>
    )
}
