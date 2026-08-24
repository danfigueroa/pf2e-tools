import { useEffect, useState } from 'react'
import {
    Alert,
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
import { parseCharacterJson, type BuildInfo } from '../character-sheet/types'
import { UploadCard } from './components/UploadCard'
import { CharacterHeader } from './components/CharacterHeader'
import { DescriptionDrawer, type DescriptionRequest } from './components/DescriptionDrawer'
import { ConditionsBar } from './components/ConditionsBar'
import { MythicPointsBar } from './components/MythicPointsBar'
import { conditionsKeyFor, legacyCharKey, mythicKeyFor } from './charId'
import { useConditions } from './components/useConditions'
import { useMythicPoints } from './components/useMythicPoints'
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

/** O que toda seção recebe: a ficha, o abridor do drawer e as condições ativas. */
export interface SectionContext {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    mods: ConditionModifiers
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
        render: ({ build, mods }) => <OverviewSection build={build} mods={mods} />,
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
        render: ({ build, onSelect, mods }) => <SpellsSection build={build} onSelect={onSelect} mods={mods} />,
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
        render: ({ build, onSelect }) => <InventorySection build={build} onSelect={onSelect} />,
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
    const conditions = useConditions(
        build ? conditionsKeyFor(build) : 'none/conditions',
        build?.level ?? 1,
        build ? legacyCharKey(build) : undefined,
    )

    // Pontos Míticos: mesma história das condições — gastos de qualquer aba,
    // então o hook mora aqui e a chave também cai num placeholder sem ficha.
    const mythicPoints = useMythicPoints(
        build ? mythicKeyFor(build) : 'none/mythic',
        MYTHIC_POINTS_MAX,
    )

    // Restaurar ficha da sessão ao recarregar
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY)
            if (raw) setBuild(JSON.parse(raw) as BuildInfo)
        } catch { /* noop */ }
    }, [])

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

    const handleJson = (json: unknown) => {
        try {
            const b = parseCharacterJson(json)
            setBuild(b)
            setError(null)
            setActiveTab(0)
            setExpanded('overview')
            try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(b)) } catch { /* noop */ }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'JSON inválido.')
        }
    }

    const handleReset = () => {
        setBuild(null)
        setError(null)
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
    }

    if (!build) {
        return <UploadCard onJson={handleJson} error={error} />
    }

    const visibleSections = SECTIONS.filter(s => !s.visible || s.visible(build))
    const ctx: SectionContext = { build, onSelect: setDrawerReq, mods: conditions.mods }

    return (
        <Container maxWidth="lg" disableGutters sx={{ pb: 6 }}>
            <CharacterHeader build={build} onReset={handleReset} />

            <ConditionsBar conditions={conditions} />

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

            <DescriptionDrawer request={drawerReq} onClose={() => setDrawerReq(null)} />
        </Container>
    )
}
