import { useState, useEffect, useRef } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Typography,
    Stack,
    Alert,
    LinearProgress,
    Fade,
    Chip,
} from '@mui/material'
import {
    CloudDownload as FetchIcon,
    Translate as TranslateIcon,
    CheckCircle as DoneIcon,
    Description as PdfIcon,
} from '@mui/icons-material'
import { parseCharacterJson, parseFeatEntry } from './types'
import type { BuildInfo, CompanionStats, FocusAbility, FocusTradition } from './types'
import { downloadCharacterPdf } from './pdf'

interface LoadingState {
    active: boolean
    phase: 'idle' | 'fetching' | 'translating' | 'done'
    current: string
    progress: number
    total: number
}

// Cache localStorage para evitar re-buscar descrições já traduzidas
// v2: descarta as descrições em inglês que a v1 gravou permanentemente quando
// a tradução falhava (ver translationPending abaixo).
const DESC_CACHE_VERSION = 'v2'
function descCacheKey(type: 'feat' | 'spell' | 'special', name: string) {
    return `pf2e:${DESC_CACHE_VERSION}:${type}:${name}`
}
function getCachedDesc(type: 'feat' | 'spell' | 'special', name: string): string | null {
    try { return localStorage.getItem(descCacheKey(type, name)) } catch { return null }
}
function getCachedSpell(name: string): object | null {
    try {
        const raw = localStorage.getItem(descCacheKey('spell', name))
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}
function saveDescCache(type: 'feat' | 'special', name: string, value: string) {
    try { localStorage.setItem(descCacheKey(type, name), value) } catch {}
}
function saveSpellCache(name: string, value: object) {
    try { localStorage.setItem(descCacheKey('spell', name), JSON.stringify(value)) } catch {}
}
function getCachedCompanion(name: string): object | null {
    try {
        const raw = localStorage.getItem(`pf2e:${DESC_CACHE_VERSION}:companion:${name}`)
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}
function saveCompanionCache(name: string, value: object) {
    try { localStorage.setItem(`pf2e:${DESC_CACHE_VERSION}:companion:${name}`, JSON.stringify(value)) } catch {}
}

// Verifica se uma descrição vinda da API é válida (evita salvar string literal "null" ou vazias)
function isValidDescription(value: unknown): value is string {
    if (typeof value !== 'string') return false
    const t = value.trim()
    return t.length > 0 && t !== 'null' && t !== 'undefined'
}

const SESSION_KEY = 'pf2e:lastBuild'
function saveSessionBuild(b: BuildInfo) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(b)) } catch {}
}
function loadSessionBuild(): BuildInfo | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY)
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

export const CharacterSheetPage = () => {
    const [build, setBuild] = useState<BuildInfo | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [apiWarning, setApiWarning] = useState<string | null>(null)
    const [loading, setLoading] = useState<LoadingState>({
        active: false,
        phase: 'idle',
        current: '',
        progress: 0,
        total: 0,
    })
    const abortRef = useRef<AbortController | null>(null)

    // D: Restaura o último personagem carregado se o usuário recarregar a página
    useEffect(() => {
        const saved = loadSessionBuild()
        if (saved) setBuild(saved)
    }, [])

    const checkApiAvailable = async (): Promise<boolean> => {
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 2000)
            const r = await fetch('/api/health', { signal: controller.signal })
            clearTimeout(timeoutId)
            return r.ok
        } catch {
            return false
        }
    }

    const enrichFeatDescriptions = async (b: BuildInfo, updateProgress: (current: string) => void) => {
        const names = (b.feats || []).map((f) => parseFeatEntry(f).name)
        const unique = Array.from(new Set(names))
        const missing = unique.filter((n) => !b.featDescriptions?.[n])
        if (!missing.length) return b

        const copy: BuildInfo = {
            ...b,
            featDescriptions: { ...(b.featDescriptions || {}) },
        }

        // Resolve do localStorage primeiro
        const fromCache = missing.filter(n => {
            const cached = getCachedDesc('feat', n)
            if (cached) { copy.featDescriptions![n] = cached; return false }
            return true
        })

        if (!fromCache.length) return copy

        updateProgress(`${fromCache.length} talentos`)
        try {
            const r = await fetch('/api/feats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: fromCache }),
                signal: abortRef.current?.signal,
            })
            if (r.ok) {
                const data: Record<string, { name: string; description: string | null; translationPending?: boolean }> = await r.json()
                Object.entries(data).forEach(([key, val]) => {
                    if (isValidDescription(val?.description)) {
                        copy.featDescriptions![key] = val.description!
                        // translationPending = veio em inglês por falha transitória
                        // do tradutor; usa neste PDF mas não fixa no cache.
                        if (!val.translationPending) saveDescCache('feat', key, val.description!)
                    }
                })
            }
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'AbortError') return copy
        }

        return copy
    }

    // Nomes muito genéricos que não valem a pena buscar (perícias, traits básicos, etc.)
    const SKIP_SPECIALS = new Set([
        'large', 'medium', 'small', 'tiny', 'huge', 'gargantuan',
        'nature', 'arcana', 'religion', 'occultism', 'society',
        'acrobatics', 'athletics', 'crafting', 'deception', 'diplomacy',
        'intimidation', 'medicine', 'performance', 'stealth', 'survival', 'thievery',
    ])

    const enrichSpecialDescriptions = async (b: BuildInfo, updateProgress: (current: string) => void) => {
        const names = (b.specials || []).map((s) => String(s))
        const unique = Array.from(new Set(names)).filter(
            (n) => !SKIP_SPECIALS.has(n.toLowerCase())
        )
        const missing = unique.filter(
            (n) => !b.specialDescriptions || !b.specialDescriptions[n]
        )
        if (!missing.length) return b
        
        const copy: BuildInfo = {
            ...b,
            specialDescriptions: { ...(b.specialDescriptions || {}) },
        }
        
        // Resolve do localStorage primeiro
        const fromCache = missing.filter(n => {
            const cached = getCachedDesc('special', n)
            if (cached) { copy.specialDescriptions![n] = cached; return false }
            return true
        })

        if (!fromCache.length) return copy

        updateProgress(`${fromCache.length} habilidades`)
        try {
            const r = await fetch('/api/searches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: fromCache }),
                signal: abortRef.current?.signal,
            })
            if (r.ok) {
                const data: Record<string, { name: string; description: string | null; translationPending?: boolean }> = await r.json()
                Object.entries(data).forEach(([key, val]) => {
                    if (isValidDescription(val?.description)) {
                        copy.specialDescriptions![key] = val.description!
                        // translationPending = veio em inglês por falha transitória
                        // do tradutor; usa neste PDF mas não fixa no cache.
                        if (!val.translationPending) saveDescCache('special', key, val.description!)
                    }
                })
            }
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'AbortError') return copy
        }

        return copy
    }

    const enrichSpellDescriptions = async (b: BuildInfo, updateProgress: (current: string) => void) => {
        const spellNames: string[] = []
        
        b.spellCasters?.forEach((caster) => {
            caster.spells.forEach((level) => {
                spellNames.push(...level.list)
            })
        })
        
        if (b.focus) {
            Object.values(b.focus).forEach((tradition: FocusTradition) => {
                Object.values(tradition).forEach((abilityGroup: FocusAbility) => {
                    if (abilityGroup.focusSpells) {
                        spellNames.push(...abilityGroup.focusSpells)
                    }
                    if (abilityGroup.focusCantrips) {
                        spellNames.push(...abilityGroup.focusCantrips)
                    }
                })
            })
        }
        
        const unique = Array.from(new Set(spellNames))
        const missing = unique.filter(
            (n) => !b.spellDescriptions || !b.spellDescriptions[n]
        )
        
        if (!missing.length) return b
        
        const copy: BuildInfo = {
            ...b,
            spellDescriptions: { ...(b.spellDescriptions || {}) },
        }
        
        // Resolve do localStorage primeiro
        const fromCache = missing.filter(n => {
            const cached = getCachedSpell(n)
            if (cached) { copy.spellDescriptions![n] = cached as any; return false }
            return true
        })

        if (fromCache.length) {
            updateProgress(`${fromCache.length} magias`)
            try {
                const r = await fetch('/api/spells', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ names: fromCache }),
                    signal: abortRef.current?.signal,
                })
                if (r.ok) {
                    const data: Record<string, object> = await r.json()
                    Object.entries(data).forEach(([key, val]) => {
                        const v = val as any
                        // Para paridade com feats: só armazenar quando há descrição válida.
                        // Sem isso, magias com erro de tradução apareciam só com metadados,
                        // diferente da renderização de feats.
                        if (v && isValidDescription(v.description)) {
                            copy.spellDescriptions![key] = v
                            saveSpellCache(key, v)
                        }
                    })
                }
            } catch (e: unknown) {
                if (e instanceof Error && e.name === 'AbortError') return copy
            }
        }
        
        return copy
    }

    const enrichPetDescriptions = async (b: BuildInfo): Promise<BuildInfo> => {
        const animalNames = (b.pets || [])
            .filter(p => p.type === 'Animal Companion' && p.animal)
            .map(p => p.animal!)

        const unique = Array.from(new Set(animalNames))
        const missing = unique.filter(n => !b.petDescriptions?.[n])
        if (!missing.length) return b

        const copy: BuildInfo = {
            ...b,
            petDescriptions: { ...(b.petDescriptions || {}) },
        }

        // Resolve do localStorage primeiro
        const fromCache = missing.filter(n => {
            const cached = getCachedCompanion(n)
            if (cached) { copy.petDescriptions![n] = cached as CompanionStats; return false }
            return true
        })

        if (!fromCache.length) return copy

        try {
            const r = await fetch('/api/companions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: fromCache }),
                signal: abortRef.current?.signal,
            })
            if (r.ok) {
                const data: Record<string, CompanionStats> = await r.json()
                Object.entries(data).forEach(([name, stats]) => {
                    copy.petDescriptions![name] = stats
                    saveCompanionCache(name, stats)
                })
            }
        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'AbortError') return copy
        }

        return copy
    }

    const enrichDescriptions = async (b: BuildInfo): Promise<BuildInfo> => {
        const apiAvailable = await checkApiAvailable()
        
        if (!apiAvailable) {
            const existingFeats = Object.keys(b.featDescriptions || {}).length
            const existingSpecials = Object.keys(b.specialDescriptions || {}).length
            
            const totalFeats = (b.feats || []).length
            const totalSpecials = (b.specials || []).length
            
            if (existingFeats < totalFeats || existingSpecials < totalSpecials) {
                setApiWarning(
                    `Servidor de API não está rodando. Algumas descrições podem estar faltando. ` +
                    `Para buscar automaticamente da AON com tradução, rode: npm run dev:full`
                )
            }
            return b
        }
        
        setApiWarning(null)
        
        // Calcular total de itens para buscar
        const featNames = Array.from(new Set((b.feats || []).map((f) => parseFeatEntry(f).name)))
        const specialNames = Array.from(new Set((b.specials || []).map((s) => String(s)))).filter(
            (n) => !SKIP_SPECIALS.has(n.toLowerCase())
        )
        const spellNames: string[] = []
        b.spellCasters?.forEach((caster) => {
            caster.spells.forEach((level) => spellNames.push(...level.list))
        })
        
        const missingFeats = featNames.filter(n => !b.featDescriptions?.[n])
        const missingSpecials = specialNames.filter(n => !b.specialDescriptions?.[n])
        const missingSpells = Array.from(new Set(spellNames)).filter(n => !b.spellDescriptions?.[n])
        const missingPets = (b.pets || [])
            .filter(p => p.type === 'Animal Companion' && p.animal && !b.petDescriptions?.[p.animal])
            .map(p => p.animal!)

        // Com batch endpoints, total = nº de chamadas (máx 4)
        const total = (missingFeats.length > 0 ? 1 : 0) + (missingSpecials.length > 0 ? 1 : 0)
            + (missingSpells.length > 0 ? 1 : 0) + (missingPets.length > 0 ? 1 : 0)

        if (total === 0) return b

        let progress = 0
        const updateProgress = (current: string) => {
            progress++
            setLoading(prev => ({ ...prev, current, progress }))
        }

        // Cria novo AbortController para esta busca
        abortRef.current = new AbortController()

        setLoading({
            active: true,
            phase: 'fetching',
            current: 'Buscando descrições em paralelo...',
            progress: 0,
            total,
        })

        try {
            // Quatro pipelines em paralelo
            const [enrichedFeats, enrichedSpecials, enrichedSpells, enrichedPets] = await Promise.all([
                missingFeats.length > 0
                    ? enrichFeatDescriptions(b, updateProgress)
                    : Promise.resolve(b),
                missingSpecials.length > 0
                    ? enrichSpecialDescriptions(b, updateProgress)
                    : Promise.resolve(b),
                missingSpells.length > 0
                    ? enrichSpellDescriptions(b, updateProgress)
                    : Promise.resolve(b),
                missingPets.length > 0
                    ? enrichPetDescriptions(b)
                    : Promise.resolve(b),
            ])

            // Merge: junta os resultados dos quatro pipelines
            const enriched: BuildInfo = {
                ...b,
                featDescriptions: { ...b.featDescriptions, ...enrichedFeats.featDescriptions },
                specialDescriptions: { ...b.specialDescriptions, ...enrichedSpecials.specialDescriptions },
                spellDescriptions: { ...b.spellDescriptions, ...enrichedSpells.spellDescriptions },
                petDescriptions: { ...b.petDescriptions, ...enrichedPets.petDescriptions },
            }

            setLoading(prev => ({ ...prev, phase: 'done', current: 'Concluído!' }))
            await new Promise(resolve => setTimeout(resolve, 800))

            return enriched
        } finally {
            setLoading({
                active: false,
                phase: 'idle',
                current: '',
                progress: 0,
                total: 0,
            })
        }
    }

    const applyBuild = (b: BuildInfo) => {
        setBuild(b)
        saveSessionBuild(b)
    }

    const handleFileUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
        setError(null)
        setApiWarning(null)
        const file = e.target.files?.[0]
        if (!file) return
        try {
            const text = await file.text()
            const json = JSON.parse(text)
            let parsed = parseCharacterJson(json)
            parsed = await enrichDescriptions(parsed)
            applyBuild(parsed)
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return
            console.error(err)
            const message = err instanceof Error ? err.message : 'Falha ao ler o arquivo JSON.'
            setError(message)
            setBuild(null)
        }
    }

    const handleUseExample = async () => {
        setError(null)
        setApiWarning(null)
        try {
            const res = await fetch('/character-example.json')
            if (!res.ok) throw new Error('Exemplo não encontrado no servidor.')
            const json = await res.json()
            let parsed = parseCharacterJson(json)
            parsed = await enrichDescriptions(parsed)
            applyBuild(parsed)
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return
            const message = err instanceof Error ? err.message : 'Não foi possível carregar o exemplo.'
            setError(message)
        }
    }

    const handleGenerate = async () => {
        if (!build) return
        await downloadCharacterPdf(build)
    }

    // B: Cancela a busca em andamento
    const handleCancelEnrich = () => {
        abortRef.current?.abort()
        setLoading({ active: false, phase: 'idle', current: '', progress: 0, total: 0 })
    }

    const handleDownloadEnrichedJson = () => {
        if (!build) return
        const json = JSON.stringify({ success: true, build }, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${build.name}_enriquecido.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const hasEnrichedDescriptions = build && (
        Object.keys(build.featDescriptions || {}).length > 0 ||
        Object.keys(build.specialDescriptions || {}).length > 0 ||
        Object.keys(build.spellDescriptions || {}).length > 0
    )

    const getPhaseIcon = () => {
        switch (loading.phase) {
            case 'fetching': return <FetchIcon sx={{ animation: 'pulse 1s infinite' }} />
            case 'translating': return <TranslateIcon sx={{ animation: 'pulse 1s infinite' }} />
            case 'done': return <DoneIcon color="success" />
            default: return null
        }
    }

    const progressPercent = loading.total > 0 ? (loading.progress / loading.total) * 100 : 0

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
                Ficha de Personagem
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Importe um JSON de personagem para gerar uma ficha completa em PDF.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {apiWarning && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {apiWarning}
                </Alert>
            )}

            {/* Loading Animation */}
            <Fade in={loading.active}>
                <Card 
                    sx={{ 
                        mb: 3, 
                        bgcolor: 'rgba(27, 59, 42, 0.06)',
                        border: '1px solid rgba(27, 59, 42, 0.25)',
                        display: loading.active ? 'block' : 'none',
                    }}
                >
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            {getPhaseIcon()}
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {loading.phase === 'fetching' && 'Buscando descrições da AON...'}
                                    {loading.phase === 'translating' && 'Traduzindo para português...'}
                                    {loading.phase === 'done' && 'Processamento concluído!'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {loading.current}
                                </Typography>
                            </Box>
                            <Chip 
                                label={`${loading.progress}/${loading.total}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        </Box>
                        
                        <LinearProgress 
                            variant="determinate" 
                            value={progressPercent}
                            sx={{
                                height: 6,
                                borderRadius: 3,
                                bgcolor: 'rgba(27, 59, 42, 0.10)',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 3,
                                    bgcolor: 'primary.main',
                                },
                            }}
                        />
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                Cada item leva alguns segundos devido ao rate limit da API de tradução
                            </Typography>
                            <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={handleCancelEnrich}
                            >
                                Cancelar
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Fade>

            {/* Main Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems="center"
                    >
                        <Button 
                            component="label" 
                            variant="contained"
                            disabled={loading.active}
                        >
                            Importar JSON
                            <input
                                hidden
                                type="file"
                                accept="application/json"
                                onChange={handleFileUpload}
                            />
                        </Button>
                        <Button 
                            variant="outlined" 
                            onClick={handleUseExample}
                            disabled={loading.active}
                        >
                            Usar exemplo
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            disabled={!build || loading.active}
                            onClick={handleGenerate}
                            startIcon={<PdfIcon />}
                        >
                            Gerar PDF
                        </Button>
                        {hasEnrichedDescriptions && (
                            <Button
                                variant="outlined"
                                color="success"
                                disabled={loading.active}
                                onClick={handleDownloadEnrichedJson}
                            >
                                Salvar JSON com Traduções
                            </Button>
                        )}
                    </Stack>

                    {build && !loading.active && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                {build.name}
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 1 }}>
                                {build.class} (Nível {build.level}) · {build.ancestry} · {build.background}
                            </Typography>
                            
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                                <Chip 
                                    label={`${Object.keys(build.featDescriptions || {}).length} talentos`}
                                    size="small"
                                    variant="outlined"
                                />
                                <Chip 
                                    label={`${Object.keys(build.specialDescriptions || {}).length} habilidades`}
                                    size="small"
                                    variant="outlined"
                                />
                                <Chip 
                                    label={`${Object.keys(build.spellDescriptions || {}).length} magias`}
                                    size="small"
                                    variant="outlined"
                                />
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* CSS for animations */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </Box>
    )
}
