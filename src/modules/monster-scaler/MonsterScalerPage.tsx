// Escalar Monstro: pega uma ficha da AON e adapta para outro nível.
//
// Não é assistente de passos como o módulo de transformação. O GM fica
// iterando — troca o nível, troca um degrau, relê o bloco —, então controles e
// resultado ficam lado a lado no desktop e empilhados no celular.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    IconButton,
    Paper,
    TextField,
    Typography,
} from '@mui/material'
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material'
import { gold, ink, rule } from '../../theme'
import type { AonCreature } from '../../services/creatures'
import { fetchMonster } from '../../services/monster'
import { appendCombatants } from '../initiative-tracker/encounterStorage'
import { MonsterSearch } from './components/MonsterSearch'
import { MonsterStatBlock } from './components/MonsterStatBlock'
import { MonsterExport } from './components/MonsterExport'
import { ScaleAdjustPanel } from './components/ScaleAdjustPanel'
import { SpellEditorDialog } from './components/SpellEditorDialog'
import { MAX_LEVEL, MIN_LEVEL } from './data/creatureTables'
import { clampLevel, scaleMonster } from './scaling'
import { npcFromScaled } from './toCombatant'
import type { BenchColumn, MonsterDetail, SpellEdits } from './types'

export const MonsterScalerPage = () => {
    const navigate = useNavigate()
    const [monster, setMonster] = useState<MonsterDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [level, setLevel] = useState(1)
    const [overrides, setOverrides] = useState<Record<string, BenchColumn>>({})
    // A lista de magias montada à mão, ancorada no nível em que foi montada:
    // trocar o nível-alvo desloca a lista editada, não a da AON.
    const [spellEdits, setSpellEdits] = useState<SpellEdits | null>(null)
    const [spellsOpen, setSpellsOpen] = useState(false)
    // Uma busca por faixa devolve vinte resultados, e deixá-los abertos empurra
    // o nível-alvo e o ajuste fino para fora da tela justo quando passam a ser
    // o que o GM quer mexer. Escolher uma criatura recolhe a lista.
    const [searchOpen, setSearchOpen] = useState(true)
    const statBlockRef = useRef<HTMLDivElement>(null)

    const handleSelect = useCallback((creature: AonCreature) => {
        setLoading(true)
        setLoadError(null)
        void fetchMonster(creature.name).then((found) => {
            setLoading(false)
            if (!found) {
                setLoadError(`Não deu para carregar a ficha de "${creature.name}".`)
                return
            }
            setMonster(found)
            setSearchOpen(false)
            // Um monstro novo começa no próprio nível: o GM decide para onde ir,
            // e o nível do monstro anterior não diz nada sobre este.
            setLevel(clampLevel(found.level))
            setOverrides({})
            setSpellEdits(null)
        })
    }, [])

    // Trocar de monstro invalida qualquer degrau — e qualquer magia — escolhido à mão.
    useEffect(() => { setOverrides({}); setSpellEdits(null) }, [monster])

    const scaled = useMemo(
        () => (monster ? scaleMonster(monster, level, overrides, spellEdits) : null),
        [monster, level, overrides, spellEdits],
    )

    const handleSendToInitiative = () => {
        if (!scaled) return
        appendCombatants([npcFromScaled(scaled, 0, overrides, spellEdits)])
        navigate('/iniciativa')
    }

    const step = (delta: number) => setLevel((l) => clampLevel(l + delta))

    return (
        <Container maxWidth="xl" disableGutters>
            <Typography variant="h3" component="h1" gutterBottom>
                Escalar Monstro
            </Typography>
            <Typography variant="h6" sx={{ color: ink.secondary, mb: 3, fontWeight: 400 }}>
                Pegue a ficha de qualquer criatura do Archives of Nethys e adapte para o nível que a
                sua mesa precisa, pelas tabelas de construção de criaturas do GM Core.
            </Typography>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 380px) minmax(0, 1fr)' },
                    gap: 2,
                    alignItems: 'start',
                }}
            >
                {/* Coluna de controles */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {monster && !searchOpen && (
                        <Paper sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'break-word' }}>
                                    {monster.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: ink.secondary }}>
                                    ficha original de nível {monster.level}
                                </Typography>
                            </Box>
                            <Button size="small" onClick={() => setSearchOpen(true)}>Trocar criatura</Button>
                        </Paper>
                    )}

                    {searchOpen && (
                        <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
                            <MonsterSearch onSelect={handleSelect} selectedName={monster?.name ?? null} />
                        </Paper>
                    )}

                    {loading && (
                        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2">Carregando a ficha…</Typography>
                        </Paper>
                    )}

                    {loadError && <Alert severity="error">{loadError}</Alert>}

                    {scaled && (
                        <>
                            <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
                                <Typography variant="overline" sx={{ color: gold.deep, letterSpacing: '0.06em' }}>
                                    Nível-alvo
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    <IconButton
                                        onClick={() => step(-1)}
                                        disabled={level <= MIN_LEVEL}
                                        aria-label="Diminuir o nível-alvo"
                                        sx={{ border: `1px solid ${rule}` }}
                                    >
                                        <RemoveIcon />
                                    </IconButton>
                                    <TextField
                                        size="small"
                                        value={level}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/[^\d-]/g, '')
                                            const n = parseInt(raw, 10)
                                            if (Number.isFinite(n)) setLevel(clampLevel(n))
                                        }}
                                        inputProps={{ inputMode: 'numeric', style: { textAlign: 'center' }, 'aria-label': 'Nível-alvo' }}
                                        sx={{ width: 88 }}
                                    />
                                    <IconButton
                                        onClick={() => step(1)}
                                        disabled={level >= MAX_LEVEL}
                                        aria-label="Aumentar o nível-alvo"
                                        sx={{ border: `1px solid ${rule}` }}
                                    >
                                        <AddIcon />
                                    </IconButton>
                                    {level !== scaled.source.level && (
                                        <Button size="small" onClick={() => setLevel(clampLevel(scaled.source.level))}>
                                            Voltar ao original ({scaled.source.level})
                                        </Button>
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: ink.secondary }}>
                                    As tabelas do GM Core cobrem do nível {MIN_LEVEL} ao {MAX_LEVEL}.
                                </Typography>
                            </Paper>

                            {scaled.spellcasting.length > 0 && (
                                <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
                                    <Typography variant="overline" sx={{ color: gold.deep, letterSpacing: '0.06em' }}>
                                        Magias
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: ink.secondary, mb: 1 }}>
                                        O nível novo abre ranks e slots; as magias que entram neles
                                        são escolha sua.
                                    </Typography>
                                    <Button size="small" variant="outlined" onClick={() => setSpellsOpen(true)}>
                                        Editar magias
                                    </Button>
                                </Paper>
                            )}

                            <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
                                <ScaleAdjustPanel
                                    rows={scaled.rows}
                                    overrides={overrides}
                                    onOverride={(key, column) =>
                                        setOverrides((prev) => ({ ...prev, [key]: column }))
                                    }
                                    onReset={() => setOverrides({})}
                                />
                            </Paper>
                        </>
                    )}
                </Box>

                {/* Coluna do resultado */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    {!scaled && !loading && (
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="body2" sx={{ color: ink.secondary }}>
                                Busque uma criatura para começar. O nível, os degraus de cada
                                estatística e o stat block aparecem aqui.
                            </Typography>
                        </Paper>
                    )}

                    {scaled && (
                        <>
                            {/* O ref fica no wrapper, não no Card: a moldura entra no PNG. */}
                            <Box ref={statBlockRef} sx={{ backgroundColor: '#ffffff', p: { xs: 1, sm: 2 } }}>
                                <MonsterStatBlock monster={scaled} />
                            </Box>

                            <MonsterExport
                                target={statBlockRef}
                                monster={scaled}
                                onSendToInitiative={handleSendToInitiative}
                            />

                            {scaled.warnings.length > 0 && (
                                <Alert severity="warning">
                                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                        O que a ferramenta não ajustou
                                    </Typography>
                                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                        {scaled.warnings.map((w, i) => (
                                            <li key={i}>
                                                <Typography variant="body2">{w}</Typography>
                                            </li>
                                        ))}
                                    </Box>
                                </Alert>
                            )}
                        </>
                    )}
                </Box>
            </Box>

            {scaled && (
                <SpellEditorDialog
                    open={spellsOpen}
                    blocks={scaled.spellcasting}
                    level={level}
                    edited={spellEdits !== null}
                    onChange={setSpellEdits}
                    onReset={() => setSpellEdits(null)}
                    onClose={() => setSpellsOpen(false)}
                />
            )}
        </Container>
    )
}
