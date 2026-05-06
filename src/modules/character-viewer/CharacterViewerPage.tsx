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

import { parseCharacterJson, type BuildInfo } from '../character-sheet/types'
import { UploadCard } from './components/UploadCard'
import { CharacterHeader } from './components/CharacterHeader'
import { DescriptionDrawer, type DescriptionRequest } from './components/DescriptionDrawer'

import { OverviewSection } from './sections/OverviewSection'
import { CombatSection } from './sections/CombatSection'
import { SkillsSection } from './sections/SkillsSection'
import { FeatsSection } from './sections/FeatsSection'
import { SpecialsSection } from './sections/SpecialsSection'
import { SpellsSection } from './sections/SpellsSection'
import { PetsSection } from './sections/PetsSection'
import { InventorySection } from './sections/InventorySection'

const SESSION_KEY = 'pf2e:viewer:lastBuild'

interface SectionDef {
    id: string
    label: string
    icon: React.ReactElement
    render: (build: BuildInfo, onSelect: (req: DescriptionRequest) => void) => React.ReactNode
    visible?: (build: BuildInfo) => boolean
}

const SECTIONS: SectionDef[] = [
    {
        id: 'overview',
        label: 'Visão Geral',
        icon: <OverviewIcon />,
        render: (b) => <OverviewSection build={b} />,
    },
    {
        id: 'combat',
        label: 'Combate',
        icon: <CombatIcon />,
        render: (b) => <CombatSection build={b} />,
    },
    {
        id: 'skills',
        label: 'Perícias',
        icon: <SkillsIcon />,
        render: (b) => <SkillsSection build={b} />,
    },
    {
        id: 'feats',
        label: 'Talentos',
        icon: <FeatsIcon />,
        render: (b, sel) => <FeatsSection build={b} onSelect={sel} />,
    },
    {
        id: 'specials',
        label: 'Habilidades',
        icon: <SpecialsIcon />,
        render: (b, sel) => <SpecialsSection build={b} onSelect={sel} />,
        visible: (b) => (b.specials?.length ?? 0) > 0,
    },
    {
        id: 'spells',
        label: 'Magias',
        icon: <SpellsIcon />,
        render: (b, sel) => <SpellsSection build={b} onSelect={sel} />,
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
        render: (b) => <PetsSection build={b} />,
        visible: (b) => (b.pets?.length ?? 0) > 0 || (b.familiars?.length ?? 0) > 0,
    },
    {
        id: 'inventory',
        label: 'Inventário',
        icon: <InventoryIcon />,
        render: (b, sel) => <InventorySection build={b} onSelect={sel} />,
    },
]

export const CharacterViewerPage = () => {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))

    const [build, setBuild] = useState<BuildInfo | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState(0)
    const [expanded, setExpanded] = useState<string | false>('overview')
    const [drawerReq, setDrawerReq] = useState<DescriptionRequest | null>(null)
    const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)

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

    return (
        <Container maxWidth="lg" disableGutters sx={{ pb: 6 }}>
            <CharacterHeader build={build} onReset={handleReset} />

            {apiAvailable === false && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Servidor de descrições offline. Os textos do AON não serão carregados.
                    Para ativar a busca + tradução, rode <code>yarn dev:full</code> (em vez de <code>yarn dev</code>).
                </Alert>
            )}

            {isMobile ? (
                <Box>
                    {visibleSections.map((s) => (
                        <Accordion
                            key={s.id}
                            expanded={expanded === s.id}
                            onChange={(_, isOpen) => setExpanded(isOpen ? s.id : false)}
                            sx={{
                                '&:before': { display: 'none' },
                                mb: 1,
                                borderRadius: 1.5,
                                overflow: 'hidden',
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                    <Box sx={{ color: 'primary.light', display: 'flex' }}>{s.icon}</Box>
                                    <Typography sx={{ fontWeight: 600 }}>{s.label}</Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 0 }}>
                                {s.render(build, setDrawerReq)}
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
                        sx={{
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            mb: 3,
                            '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 600 },
                        }}
                    >
                        {visibleSections.map((s) => (
                            <Tab
                                key={s.id}
                                label={s.label}
                                icon={s.icon}
                                iconPosition="start"
                                sx={{ minHeight: 48 }}
                            />
                        ))}
                    </Tabs>

                    {visibleSections[Math.min(activeTab, visibleSections.length - 1)].render(build, setDrawerReq)}
                </Box>
            )}

            <DescriptionDrawer request={drawerReq} onClose={() => setDrawerReq(null)} />
        </Container>
    )
}
