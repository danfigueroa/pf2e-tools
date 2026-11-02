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
import { tr } from '../../../i18n'

interface Props {
    open: boolean
    /** Nome do alvo, só para o título dizer em quem está aplicando. */
    targetName: string | null
    onClose: () => void
    onApply: (affliction: AfflictionState) => void
}

const saveLabel = (def: AfflictionDef) =>
    def.dc !== null && def.save
        ? tr(`CD ${def.dc} ${def.save === 'fortitude' ? 'Fortitude' : def.save === 'reflex' ? tr('Reflexos', 'Reflex') : tr('Vontade', 'Will')}`, `DC ${def.dc} ${def.save === 'fortitude' ? 'Fortitude' : def.save === 'reflex' ? tr('Reflexos', 'Reflex') : tr('Vontade', 'Will')}`)
        : (def.raw ?? tr('salvaguarda não estruturada', 'unstructured saving throw'))

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
                {tr('Aplicar aflição', 'Apply affliction')}{targetName ? ` — ${targetName}` : ''}
            </DialogTitle>
            <DialogContent sx={{ px: { xs: 1.5, sm: 3 } }}>
                {!chosen && (
                    <>
                        <TextField
                            autoFocus
                            fullWidth
                            size="small"
                            placeholder={tr("Nome do veneno ou doença (em inglês)", 'Name of the poison or disease')}
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
                            {tr('O índice da AON é em inglês: "venom", "poison", "fever"…', 'AON\'s index is in English: "venom", "poison", "fever"…')}</Typography>

                        {searched && results.length === 0 && !loading && (
                            <Alert severity="info" sx={{ mt: 1 }}>{tr('Nenhuma aflição com esse nome.', 'No affliction with that name.')}</Alert>
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
                                        {saveLabel(def)} · {def.stages.length} {tr('estágio(s)', 'stage(s)')}{def.maxDurationRaw ? tr(` · máx. ${def.maxDurationRaw}`, ` · max ${def.maxDurationRaw}`) : ''}
                                        {def.onsetRaw ? tr(` · início em ${def.onsetRaw}`, ` · onset ${def.onsetRaw}`) : ''}
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
                            {chosen.maxDurationRaw ? tr(` · duração máxima ${chosen.maxDurationRaw}`, ` · maximum duration ${chosen.maxDurationRaw}`) : ''}
                        </Typography>
                        {chosen.onsetRaw && (
                            <Alert severity="info" sx={{ mt: 1 }}>
                                {tr('Início em ', 'Onset ')}{chosen.onsetRaw}{tr(': só aplique quando esse tempo passar.', ': only apply it once that time passes.')}</Alert>
                        )}
                        {chosen.virulent && (
                            <Chip size="small" label={tr("Virulento", 'Virulent')} sx={{ mt: 1 }} />
                        )}

                        <Box sx={{ mt: 1.5, border: `1px solid ${rule}`, borderRadius: 1 }}>
                            {chosen.stages.map((s, i) => (
                                <Box key={i} sx={{ px: 1, py: 0.75, borderTop: i ? `1px solid ${rule}88` : 'none' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: gold.deep }}>
                                        {tr('Estágio ', 'Stage ')}{i + 1}
                                        {s.durationRaw ? ` · ${s.durationRaw}` : ''}
                                        {s.durationRounds === null && s.durationRaw ? tr(' (fora do combate)', ' (outside combat)') : ''}
                                    </Typography>
                                    <Typography variant="body2">{s.text}</Typography>
                                </Box>
                            ))}
                        </Box>

                        <Typography variant="overline" sx={{ display: 'block', mt: 2, color: gold.deep }}>
                            {tr('Resultado da salvaguarda inicial', 'Initial saving throw result')}</Typography>
                        <Typography variant="caption" sx={{ color: ink.secondary }}>
                            {tr('Falha entra no estágio 1; falha crítica, no 2. Sucesso não aflige. O dano do estágio é rolado e aplicado na hora — o aviso traz o valor e o "Desfazer".', 'A failure enters stage 1; a critical failure, stage 2. A success doesn\'t afflict. The stage\'s damage is rolled and applied right away — the notice brings the amount and the "Undo".')}</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1, mt: 1 }}>
                            {SAVE_DEGREES.map((d) => (
                                <Button key={d.id} variant="outlined" onClick={() => apply(d.id)}>
                                    {d.label}
                                </Button>
                            ))}
                        </Box>

                        <Button sx={{ mt: 1 }} onClick={() => setChosen(null)}>{tr('Escolher outra', 'Choose another')}</Button>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    )
}
