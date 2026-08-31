// Aplicar um veneno ou doença num combatente.
//
// Busca na AON (~230 aflições com estágios) e pede o grau da salvaguarda
// INICIAL — a salvaguarda é rolagem de quem está jogando, então quem informa o
// resultado é o GM. RAW: falha entra no estágio 1, falha crítica no 2, sucesso
// não afeta. O DANO do estágio, esse o app rola e aplica sozinho ao entrar.

import { useEffect, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    InputAdornment,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { Search as SearchIcon } from '@mui/icons-material'
import { gold, ink, parchment, rule } from '../../../theme'
import { searchAfflictions } from '../../../services/afflictions'
import { initialStage, newAffliction, SAVE_DEGREES, type AfflictionDef, type AfflictionState } from '../afflictions'

interface Props {
    open: boolean
    /** Nome do alvo, só para o título dizer em quem está aplicando. */
    targetName: string | null
    onClose: () => void
    onApply: (affliction: AfflictionState) => void
}

const saveLabel = (def: AfflictionDef) =>
    def.dc !== null && def.save
        ? `CD ${def.dc} ${def.save === 'fortitude' ? 'Fortitude' : def.save === 'reflex' ? 'Reflexos' : 'Vontade'}`
        : (def.raw ?? 'salvaguarda não estruturada')

export function AfflictionDialog({ open, targetName, onClose, onApply }: Props) {
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<AfflictionDef[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [chosen, setChosen] = useState<AfflictionDef | null>(null)

    // Reabrir para outro alvo não deve trazer a escolha anterior.
    useEffect(() => {
        if (!open) return
        setChosen(null)
    }, [open])

    // Debounce: a AON não precisa ver "v", "ve", "ven".
    useEffect(() => {
        const term = query.trim()
        if (term.length < 2) {
            setResults([])
            setSearched(false)
            return
        }
        let cancelled = false
        setLoading(true)
        const timer = setTimeout(() => {
            void searchAfflictions(term, 12).then((found) => {
                if (cancelled) return
                setResults(found)
                setSearched(true)
                setLoading(false)
            })
        }, 350)
        return () => { cancelled = true; clearTimeout(timer); setLoading(false) }
    }, [query])

    const apply = (degree: (typeof SAVE_DEGREES)[number]['id']) => {
        if (!chosen) return
        const stage = initialStage(degree)
        // Sucesso não aflige: fecha sem aplicar nada.
        if (stage === null) { onClose(); return }
        onApply(newAffliction(chosen, Math.min(stage, chosen.stages.length)))
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>
                Aplicar aflição{targetName ? ` — ${targetName}` : ''}
            </DialogTitle>
            <DialogContent sx={{ px: { xs: 1.5, sm: 3 } }}>
                {!chosen && (
                    <>
                        <TextField
                            autoFocus
                            fullWidth
                            size="small"
                            placeholder="Nome do veneno ou doença (em inglês)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        {loading ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: ink.secondary }}>
                            O índice da AON é em inglês: "venom", "poison", "fever"…
                        </Typography>

                        {searched && results.length === 0 && !loading && (
                            <Alert severity="info" sx={{ mt: 1 }}>Nenhuma aflição com esse nome.</Alert>
                        )}

                        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            {results.map((def) => (
                                <Box
                                    key={def.url ?? def.name}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setChosen(def)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChosen(def) }
                                    }}
                                    sx={{
                                        p: 1, borderRadius: 1, cursor: 'pointer',
                                        border: `1px solid ${rule}`,
                                        backgroundColor: parchment.sunken,
                                        '&:hover': { borderColor: gold.main },
                                        '&:focus-visible': { outline: `2px solid ${gold.main}`, outlineOffset: 2 },
                                    }}
                                >
                                    <Typography sx={{ fontWeight: 600 }}>{def.name}</Typography>
                                    <Typography variant="caption" sx={{ color: ink.secondary }}>
                                        {saveLabel(def)} · {def.stages.length} estágio(s)
                                        {def.maxDurationRaw ? ` · máx. ${def.maxDurationRaw}` : ''}
                                        {def.onsetRaw ? ` · início em ${def.onsetRaw}` : ''}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </>
                )}

                {chosen && (
                    <Box>
                        <Typography sx={{ fontWeight: 700 }}>{chosen.name}</Typography>
                        <Typography variant="caption" sx={{ color: ink.secondary, display: 'block' }}>
                            {saveLabel(chosen)}
                            {chosen.maxDurationRaw ? ` · duração máxima ${chosen.maxDurationRaw}` : ''}
                        </Typography>
                        {chosen.onsetRaw && (
                            <Alert severity="info" sx={{ mt: 1 }}>
                                Início em {chosen.onsetRaw}: só aplique quando esse tempo passar.
                            </Alert>
                        )}
                        {chosen.virulent && (
                            <Chip size="small" label="Virulento" sx={{ mt: 1 }} />
                        )}

                        <Box sx={{ mt: 1.5, border: `1px solid ${rule}`, borderRadius: 1 }}>
                            {chosen.stages.map((s, i) => (
                                <Box key={i} sx={{ px: 1, py: 0.75, borderTop: i ? `1px solid ${rule}88` : 'none' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: gold.deep }}>
                                        Estágio {i + 1}
                                        {s.durationRaw ? ` · ${s.durationRaw}` : ''}
                                        {s.durationRounds === null && s.durationRaw ? ' (fora do combate)' : ''}
                                    </Typography>
                                    <Typography variant="body2">{s.text}</Typography>
                                </Box>
                            ))}
                        </Box>

                        <Typography variant="overline" sx={{ display: 'block', mt: 2, color: gold.deep }}>
                            Resultado da salvaguarda inicial
                        </Typography>
                        <Typography variant="caption" sx={{ color: ink.secondary }}>
                            Falha entra no estágio 1; falha crítica, no 2. Sucesso não aflige.
                            O dano do estágio é rolado e aplicado na hora — o aviso traz o valor
                            e o "Desfazer".
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1, mt: 1 }}>
                            {SAVE_DEGREES.map((d) => (
                                <Button key={d.id} variant="outlined" onClick={() => apply(d.id)}>
                                    {d.label}
                                </Button>
                            ))}
                        </Box>

                        <Button sx={{ mt: 1 }} onClick={() => setChosen(null)}>Escolher outra</Button>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    )
}
