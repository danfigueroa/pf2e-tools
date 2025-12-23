import { useState } from 'react'
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
import { parseCharacterJson } from './types'
import type { BuildInfo } from './types'
import { downloadCharacterPdf } from './pdf'

interface LoadingState {
    active: boolean
    phase: 'idle' | 'fetching' | 'translating' | 'done'
    current: string
    progress: number
    total: number
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
        const names = (b.feats || []).map((f: any) =>
            Array.isArray(f) ? String(f[0]) : String(f?.name ?? f)
        )
        const unique = Array.from(new Set(names))
        const missing = unique.filter(
            (n) => !b.featDescriptions || !b.featDescriptions[n]
        )
        if (!missing.length) return b
        
        const copy: BuildInfo = {
            ...b,
            featDescriptions: { ...(b.featDescriptions || {}) },
        }
        
        for (const n of missing) {
            updateProgress(n)
            try {
                const r = await fetch(`/api/feat?name=${encodeURIComponent(n)}`)
                if (!r.ok) continue
                const data = await r.json()
                if (data && data.description) {
                    copy.featDescriptions![n] = String(data.description)
                }
            } catch {}
        }
        
        return copy
    }

    const enrichSpecialDescriptions = async (b: BuildInfo, updateProgress: (current: string) => void) => {
        const names = (b.specials || []).map((s) => String(s))
        const unique = Array.from(new Set(names))
        const missing = unique.filter(
            (n) => !b.specialDescriptions || !b.specialDescriptions[n]
        )
        if (!missing.length) return b
        
        const copy: BuildInfo = {
            ...b,
            specialDescriptions: { ...(b.specialDescriptions || {}) },
        }
        
        for (const n of missing) {
            updateProgress(n)
            try {
                const r = await fetch(`/api/search?name=${encodeURIComponent(n)}`)
                if (!r.ok) continue
                const data = await r.json()
                if (data && data.description) {
                    copy.specialDescriptions![n] = String(data.description)
                }
            } catch {}
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
            Object.values(b.focus).forEach((tradition: any) => {
                Object.values(tradition).forEach((abilityGroup: any) => {
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
        
        for (const n of missing) {
            updateProgress(n)
            try {
                const r = await fetch(`/api/spell?name=${encodeURIComponent(n)}`)
                if (!r.ok) continue
                const data = await r.json()
                // Salva o objeto completo se tiver nome ou descrição
                if (data && (data.name || data.description || data.actions)) {
                    copy.spellDescriptions![n] = data
                }
            } catch {}
        }
        
        return copy
    }

    const enrichDescriptions = async (b: BuildInfo): Promise<BuildInfo> => {
        const apiAvailable = await checkApiAvailable()
        
        if (!apiAvailable) {
            const existingFeats = Object.keys(b.featDescriptions || {}).length
            const existingSpecials = Object.keys(b.specialDescriptions || {}).length
            const existingSpells = Object.keys(b.spellDescriptions || {}).length
            
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
        const featNames = Array.from(new Set((b.feats || []).map((f: any) =>
            Array.isArray(f) ? String(f[0]) : String(f?.name ?? f)
        )))
        const specialNames = Array.from(new Set((b.specials || []).map((s) => String(s))))
        const spellNames: string[] = []
        b.spellCasters?.forEach((caster) => {
            caster.spells.forEach((level) => spellNames.push(...level.list))
        })
        
        const missingFeats = featNames.filter(n => !b.featDescriptions?.[n])
        const missingSpecials = specialNames.filter(n => !b.specialDescriptions?.[n])
        const missingSpells = Array.from(new Set(spellNames)).filter(n => !b.spellDescriptions?.[n])
        
        const total = missingFeats.length + missingSpecials.length + missingSpells.length
        
        if (total === 0) return b
        
        let progress = 0
        const updateProgress = (current: string) => {
            progress++
            setLoading(prev => ({
                ...prev,
                current,
                progress,
            }))
        }
        
        setLoading({
            active: true,
            phase: 'fetching',
            current: '',
            progress: 0,
            total,
        })
        
        try {
            let enriched = b
            
            if (missingFeats.length > 0) {
                setLoading(prev => ({ ...prev, phase: 'fetching', current: 'Buscando talentos...' }))
                enriched = await enrichFeatDescriptions(enriched, updateProgress)
            }
            
            if (missingSpecials.length > 0) {
                setLoading(prev => ({ ...prev, phase: 'fetching', current: 'Buscando habilidades...' }))
                enriched = await enrichSpecialDescriptions(enriched, updateProgress)
            }
            
            if (missingSpells.length > 0) {
                setLoading(prev => ({ ...prev, phase: 'fetching', current: 'Buscando magias...' }))
                enriched = await enrichSpellDescriptions(enriched, updateProgress)
            }
            
            setLoading(prev => ({ ...prev, phase: 'done', current: 'Concluído!' }))
            
            // Pequeno delay para mostrar "Concluído"
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
            setBuild(parsed)
        } catch (err: unknown) {
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
            setBuild(parsed)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Não foi possível carregar o exemplo.'
            setError(message)
        }
    }

    const handleGenerate = async () => {
        if (!build) return
        await downloadCharacterPdf(build)
    }

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
                        bgcolor: 'rgba(20, 184, 166, 0.08)',
                        border: '1px solid rgba(20, 184, 166, 0.3)',
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
                                bgcolor: 'rgba(20, 184, 166, 0.1)',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 3,
                                    bgcolor: 'primary.main',
                                },
                            }}
                        />
                        
                        <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ mt: 1, display: 'block' }}
                        >
                            Cada item leva alguns segundos devido ao rate limit da API de tradução
                        </Typography>
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
