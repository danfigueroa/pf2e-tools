import { useCallback, useEffect, useMemo, useState } from 'react'
import { announceSheet } from '../../services/presence'
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
import { checkApiAvailable, fetchCompanionStats, loadDescriptionBundle, loadSheetDescriptions } from '../../services/descriptions'
import { characterDescriptionNames } from './descriptionNames'
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
import type { BuildInfo, FeatDescription } from '../character-sheet/types'
import { PublishedBar } from './components/PublishedBar'
import { NewVersionBar } from './components/NewVersionBar'
import { withRelicRunes } from './relics'
import { GiftArrivalNotice } from './components/GiftArrivalNotice'
import type { PublishedSheet } from '../../services/sheets'
import type { GuideSlot, PublicationApi } from './components/usePublication'
import { curatedBase } from './combatGuides'
import { CharacterHeader } from './components/CharacterHeader'
import { DescriptionDrawer, type DescriptionRequest } from './components/DescriptionDrawer'
import { ActivityButton } from './components/ActivityButton'
import { postShare } from '../../services/rolls'
import { rollerIdentity, shareRule } from './rolls'
import { RollDialog, type RollRequest } from './components/RollDialog'
import { ConditionsBar } from './components/ConditionsBar'
import { AfflictionsBar } from './components/AfflictionsBar'
import { PersistentDamageBar } from './components/PersistentDamageBar'
import { MythicPointsBar } from './components/MythicPointsBar'
import { useUses } from './components/useUses'
import { GODSPEED_SOURCE, godspeedConditions, withGodspeed } from './mythicFeats'
import { usesKeyFor, actionsKeyFor, afflictionsKeyFor, charSlug, conditionsKeyFor, energyKeyFor, legacyCharKey, magusKeyFor, mythicKeyFor, persistentKeyFor, psycheKeyFor, rageKeyFor, rangerKeyFor, sizeKeyFor } from './charId'
import { useConditions } from './components/useConditions'
import { useAfflictions } from './components/useAfflictions'
import { usePersistentDamage } from './components/usePersistentDamage'
import { useMythicPoints, type MythicPointsApi } from './components/useMythicPoints'
import { useSizeEffect, type SizeEffectApi } from './components/useSizeEffect'
import { sizeEffectConditions, withSizeEffect } from './sizeEffects'
import { useRage } from './components/useRage'
import { usePsyche } from './components/usePsyche'
import { PsycheBar } from './components/PsycheBar'
import { EnergyBar } from './components/EnergyBar'
import { useEnergy } from './components/useEnergy'
import { hasConservation } from './energy'
import { STRAIN_SOURCE, withPsyche } from './psyche'
import { RageBar } from './components/RageBar'
import { MagusBar } from './components/MagusBar'
import { useMagus } from './components/useMagus'
import { hasMagusFeatures, withCascade } from './magus'
import { ActionsBar } from './components/ActionsBar'
import { DiceBar } from './components/DiceBar'
import { useActions } from './components/useActions'
import { RangerBar } from './components/RangerBar'
import { useRanger } from './components/useRanger'
import { hasRangerFeatures, withRanger } from './ranger'
import { hasQuickShieldBlock, reflexShieldBonus, withReflexShield } from './fighter'
import { useCharacterShield } from './components/useShield'
import { TITAN_SOURCE, withRage } from './rage'
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

/** O que toda seção recebe: a ficha, o abridor do drawer, as condições ativas e os Pontos Míticos. */
export interface SectionContext {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    /** Abre o diálogo de rolagem — a rolagem vai para a mesa inteira. */
    onRoll: (req: RollRequest) => void
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
    guide: GuideSlot
    /** Enlarge/Shrink ligado — a runa do Brukuthur liga e desliga pela aba de Combate. */
    sizeEffect: SizeEffectApi
    /** Celular ou painel estreito (acordeão). */
    compact: boolean
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
        render: ({ build, mods, guide, onRoll, compact }) => <OverviewSection build={build} mods={mods} guide={guide} onRoll={onRoll} compact={compact} />,
    },
    {
        id: 'combat',
        label: 'Combate',
        icon: <CombatIcon />,
        render: ({ build, mods, onRoll, onSelect, sizeEffect }) => (
            <CombatSection build={build} mods={mods} onRoll={onRoll} onSelect={onSelect} sizeEffect={sizeEffect} />
        ),
    },
    {
        id: 'skills',
        label: 'Perícias',
        icon: <SkillsIcon />,
        render: ({ build, mods, onRoll }) => <SkillsSection build={build} mods={mods} onRoll={onRoll} />,
    },
    {
        id: 'feats',
        label: 'Talentos',
        icon: <FeatsIcon />,
        render: ({ build, onSelect, mods, mythicPoints }) => <FeatsSection build={build} onSelect={onSelect} mods={mods} mythicPoints={mythicPoints} />,
    },
    {
        id: 'specials',
        label: 'Habilidades',
        icon: <SpecialsIcon />,
        render: ({ build, onSelect, mods, mythicPoints }) => <SpecialsSection build={build} onSelect={onSelect} mods={mods} mythicPoints={mythicPoints} />,
        visible: (b) => (b.specials?.length ?? 0) > 0,
    },
    {
        id: 'spells',
        label: 'Magias',
        icon: <SpellsIcon />,
        render: ({ build, onSelect, onRoll, mods, mythicPoints }) => (
            <SpellsSection build={build} onSelect={onSelect} onRoll={onRoll} mods={mods} mythicPoints={mythicPoints} />
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
        render: ({ build, onSelect, mods, mythicPoints }) => <InventorySection build={build} onSelect={onSelect} mods={mods} mythicPoints={mythicPoints} />,
    },
]

interface Props {
    build: BuildInfo
    /** `usePublication()` de quem hospeda: a ficha da mesa, o guia gerado e a geração. */
    publication: PublicationApi
    onReset: () => void
    /** "Versão anterior" da faixa da ficha publicada; sem ele a faixa some. */
    onRestore?: () => void
    /**
     * Painel estreito (mapa): força o acordeão do celular e tira a moldura da
     * página. Sem isto o layout segue a largura da JANELA, que num painel de
     * 420px dentro de um monitor largo escolheria as abas.
     */
    compact?: boolean
    /**
     * Abre a versão nova quando a mesa publica outra desta ficha (faixa "Nova versão publicada"). Sem ele a
     * faixa não aparece — quem hospeda é que sabe trocar a ficha aberta.
     */
    onOpenPublished?: (sheet: PublishedSheet) => void
}

export const CharacterSheetView = ({ build: source, publication, onReset, onRestore, compact = false, onOpenPublished }: Props) => {
    const theme = useTheme()
    // Acordeão só no celular. Do tablet para cima as abas roláveis cabem e
    // poupam a rolagem vertical enorme que 8 seções empilhadas produzem.
    const narrowWindow = useMediaQuery(theme.breakpoints.down('sm'))
    const isPhone = compact || narrowWindow

    // Stats dos companheiros animais chegam da AON depois: ficam por cima da
    // ficha recebida em vez de reescrever o estado de quem hospeda.
    const [petStats, setPetStats] = useState<NonNullable<BuildInfo['petDescriptions']>>({})
    // As runas das dádivas da relíquia entram na arma aqui (`relics.ts`), num ponto só:
    // o Combate, a rolagem e o inventário leem a mesma ficha já com elas.
    const build = useMemo<BuildInfo>(
        () => withRelicRunes(Object.keys(petStats).length === 0
            ? source
            : { ...source, petDescriptions: { ...source.petDescriptions, ...petStats } }),
        [source, petStats],
    )

    const [activeTab, setActiveTab] = useState(0)
    const [expanded, setExpanded] = useState<string | false>('overview')
    const [drawerReq, setDrawerReq] = useState<DescriptionRequest | null>(null)
    const [rollReq, setRollReq] = useState<RollRequest | null>(null)
    const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)

    // Aflições vêm ANTES das condições: o estágio ativo impõe condições que
    // precisam entrar no cálculo dos modificadores da ficha.
    const afflictions = useAfflictions(afflictionsKeyFor(build))
    const persistentDamage = usePersistentDamage(persistentKeyFor(build))

    // Mudança de tamanho (Enlarge/Shrink): impõe condição e bônus de dano, então
    // vem antes das condições, como as aflições.
    const sizeEffect = useSizeEffect(sizeKeyFor(build), build.sizeName)

    // Fúria do bárbaro: o dano viaja nos modificadores e o Desajeitado do Titan
    // Mauler é derivado, então também vem antes das condições.
    const rage = useRage(rageKeyFor(build), build)
    // Unleash Psyche do Psíquico: o Estupefato da ressaca é derivado, como o Titan Mauler.
    const psyche = usePsyche(psycheKeyFor(build), build)
    const energy = useEnergy(energyKeyFor(build))
    // Arcane Cascade do Magus: o dano extra viaja nos modificadores, como a Fúria.
    const magus = useMagus(magusKeyFor(build), build)
    // Hunt Prey e Gravity Weapon do Patrulheiro: também viajam nos modificadores.
    const ranger = useRanger(rangerKeyFor(build), build)
    // Reflexive Shield: o escudo erguido (estado da mesa) também vale nos Reflexos.
    const reflexShield = reflexShieldBonus(build, useCharacterShield(build).view?.acBonus ?? 0)

    // O que a ficha sofre sem ter marcado: estágio de aflição, o Desajeitado do
    // Enlarge e o do Titan Mauler. Em conflito vale o pior valor, como em
    // `useConditions`.
    const { derived, derivedSources } = useMemo(() => {
        const fromSize = sizeEffectConditions(sizeEffect.effect)
        const sizeSource = sizeEffect.effect ? `${sizeEffect.effect.spell} ${sizeEffect.effect.rank}º` : ''
        const origins = [
            { conditions: fromSize, source: sizeSource },
            { conditions: rage.clumsy, source: TITAN_SOURCE },
            { conditions: psyche.strain, source: STRAIN_SOURCE },
            { conditions: godspeedConditions(magus.stored.godspeed), source: GODSPEED_SOURCE },
        ].filter((o) => Object.keys(o.conditions).length > 0)
        if (origins.length === 0) return { derived: afflictions.conditions, derivedSources: undefined }
        const merged = { ...afflictions.conditions }
        const sources: Record<string, string> = {}
        for (const { conditions: imposed, source: from } of origins) {
            for (const [id, value] of Object.entries(imposed)) {
                if ((merged[id] ?? 0) < value) {
                    merged[id] = value
                    sources[id] = from
                }
            }
        }
        return { derived: merged, derivedSources: sources }
    }, [afflictions.conditions, sizeEffect.effect, rage.clumsy, psyche.strain, magus.stored.godspeed])

    const conditions = useConditions(
        conditionsKeyFor(build),
        build.level ?? 1,
        legacyCharKey(build),
        derived,
        derivedSources,
    )
    // O +4 de estado no corpo a corpo do Enlarge e a Fúria viajam junto dos modificadores.
    const mods = useMemo(
        () => withGodspeed(withReflexShield(withRanger(withCascade(withPsyche(withRage(withSizeEffect(conditions.mods, sizeEffect.effect), rage.effect), psyche.effect), magus.effect), ranger.effect), reflexShield), magus.stored.godspeed),
        [conditions.mods, sizeEffect.effect, rage.effect, psyche.effect, magus.effect, ranger.effect, reflexShield, magus.stored.godspeed],
    )

    // Ações do turno: a faixa liga o poll leve (a Iniciativa zera do aparelho do mestre).
    const actions = useActions(actionsKeyFor(build), mods, true)
    const uses = useUses(usesKeyFor(build))

    // Pontos Míticos: gastos de qualquer aba, então o hook mora aqui.
    const mythicPoints = useMythicPoints(mythicKeyFor(build), MYTHIC_POINTS_MAX)

    const { generateGuide, published, guideStatus, guideError, attach } = publication

    // Verifica se o backend está disponível ao montar
    useEffect(() => {
        let cancelled = false
        checkApiAvailable().then((ok) => { if (!cancelled) setApiAvailable(ok) })
        return () => { cancelled = true }
    }, [])

    // Tudo o que a ficha descreve, já traduzido: o arquivo estático do CDN
    // (`public/descriptions/`, dos presets) e, quando a ficha aberta É a da
    // mesa, o pacote guardado junto da publicação — é por ela que chega um
    // level-up. O que nenhum dos dois tem segue pela API, como antes.
    const slug = charSlug(build)
    const descriptionNames = useMemo(() => characterDescriptionNames(build), [build])
    const isPublished = !!published
    useEffect(() => { void loadDescriptionBundle(slug) }, [slug])
    // Quem está na mesa vê que esta ficha está aberta (sidebar).
    useEffect(() => announceSheet(slug, build.name), [slug, build.name])
    useEffect(() => {
        if (isPublished) void loadSheetDescriptions(slug, descriptionNames)
    }, [slug, descriptionNames, isPublished])

    // Pré-busca stats de companheiros animais (só 1-2 fetches, vale eager)
    useEffect(() => {
        if (apiAvailable !== true) return
        const animals = (source.pets || [])
            .filter(p => p.type === 'Animal Companion' && p.animal && !source.petDescriptions?.[p.animal])
            .map(p => p.animal!)
        if (animals.length === 0) return

        let cancelled = false
        Promise.all(animals.map(fetchCompanionStats)).then((stats) => {
            if (cancelled) return
            const fresh: NonNullable<BuildInfo['petDescriptions']> = {}
            animals.forEach((name, idx) => { if (stats[idx]) fresh[name] = stats[idx]! })
            if (Object.keys(fresh).length === 0) return
            setPetStats((prev) => ({ ...prev, ...fresh }))
        })
        return () => { cancelled = true }
    }, [source, apiAvailable])

    // As seções são `memo`: com objetos novos a cada render, abrir o drawer ou o
    // diálogo de rolagem (estado desta página) repintaria a seção inteira.
    const guide = useMemo<GuideSlot>(() => ({
        published,
        guide: published?.guide ?? null,
        status: guideStatus,
        error: guideError,
        onGenerate: () => { if (published) void generateGuide(published, curatedBase(build)) },
    }), [published, guideStatus, guideError, generateGuide, build])
    const closeDrawer = useCallback(() => setDrawerReq(null), [])
    // O "Usar" das abas Talentos e Habilidades também dentro do drawer: quem foi ler a
    // regra usa dali. Os dois botões leem a mesma fatia da mesa (ações, usos do dia).
    const drawerActions = useCallback(
        (req: DescriptionRequest, entry: FeatDescription) =>
            req.type === 'feat' || req.type === 'special'
                ? <ActivityButton build={build} mods={mods} mythicPoints={mythicPoints} name={req.name} desc={entry} fullWidth />
                : null,
        [build, mods, mythicPoints],
    )
    const shareDrawer = useCallback(
        (req: DescriptionRequest) => postShare(shareRule(rollerIdentity(build), req)),
        [build],
    )
    const closeRoll = useCallback(() => setRollReq(null), [])

    const visibleSections = SECTIONS.filter(s => !s.visible || s.visible(build))
    const ctx: SectionContext = { build, onSelect: setDrawerReq, onRoll: setRollReq, mods, mythicPoints, guide, sizeEffect, compact: isPhone }

    return (
        <Container maxWidth={compact ? false : 'lg'} disableGutters sx={{ pb: compact ? 2 : 6 }}>
            <CharacterHeader build={build} onReset={onReset} sizeEffect={sizeEffect.effect} compact={compact} />
            <GiftArrivalNotice build={build} />
            {onOpenPublished && (
                <NewVersionBar slug={slug} published={published} onOpen={onOpenPublished} onGuide={attach} />
            )}
            {published && onRestore && <PublishedBar sheet={published} onRestore={onRestore} />}

            <ConditionsBar conditions={conditions} />
            <ActionsBar actions={actions} shieldReaction={hasQuickShieldBlock(build)} />
            <DiceBar build={build} />
            {rage.spec && <RageBar build={build} rage={rage} conditions={conditions} />}
            {psyche.has && <PsycheBar psyche={psyche} />}
            {hasRangerFeatures(build) && <RangerBar build={build} ranger={ranger} mods={mods} />}
            {hasMagusFeatures(build) && (
                <MagusBar build={build} magus={magus} mythicPoints={mythicPoints} conditions={conditions} />
            )}
            {hasConservation(build) && <EnergyBar energy={energy} />}
            <AfflictionsBar afflictions={afflictions.afflictions} onRemove={afflictions.remove} />
            <PersistentDamageBar
                persistent={persistentDamage.persistent}
                onRemove={persistentDamage.remove}
            />

            {isMythicCharacter(build) && <MythicPointsBar points={mythicPoints} onNewDay={uses.resetAll} />}

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
                            // O MUI monta o conteúdo recolhido por padrão: as oito
                            // seções (hooks, buscas na AON) subiam juntas e cada
                            // render da página repintava todas. Só o aberto existe.
                            slotProps={{ transition: { unmountOnExit: true } }}
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
                onClose={closeDrawer}
                onNavigate={setDrawerReq}
                onRoll={setRollReq}
                onShare={shareDrawer}
                renderActions={drawerActions}
            />
            <RollDialog
                request={rollReq}
                build={build}
                mods={mods}
                mythicPoints={mythicPoints}
                onClose={closeRoll}
            />
        </Container>
    )
}
