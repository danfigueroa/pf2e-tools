// Escolher as magias do monstro.
//
// O motor sabe QUANTOS slots o nível novo dá e em que rank; quem decide QUAIS
// magias entram é o GM — a ferramenta nunca escolhe conteúdo por ele, mesma
// política que faz slot vazio ficar visível em vez de ser preenchido sozinho.
//
// O diálogo é TOTALMENTE CONTROLADO: não guarda cópia da lista. Toda mudança
// devolve a lista inteira como nova origem da escada (`buildSpellEdits`), volta
// pela página, passa pelo motor e desce de novo como `blocks`. Guardar uma cópia
// local abriria a porta para ela divergir do nível-alvo, que o GM troca no
// painel ao lado com o diálogo aberto.

import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Switch,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material'
import { gold, ink, parchment, rule } from '../../../theme'
import { searchSpellList, type AonSpell } from '../../../services/spellList'
import { buildSpellEdits, groupLabel, spellCopies, withCopies } from '../spellcasting'
import type { ScaledSpellBlock, ScaledSpellGroup, SpellEdits, SpellEntry } from '../types'

interface Props {
    open: boolean
    blocks: ScaledSpellBlock[]
    /** Nível-alvo: é nele que a lista editada fica ancorada. */
    level: number
    /** `true` quando já existe edição — habilita o "restaurar". */
    edited: boolean
    onChange: (edits: SpellEdits) => void
    onReset: () => void
    onClose: () => void
}

/** Onde o "+ Adicionar" está aberto: bloco e grupo. */
type Target = { block: number; group: number } | null

const sameTarget = (a: Target, b: Target) =>
    a?.block === b?.block && a?.group === b?.group

export function SpellEditorDialog({
    open, blocks, level, edited, onChange, onReset, onClose,
}: Props) {
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
    const [target, setTarget] = useState<Target>(null)

    useEffect(() => { if (!open) setTarget(null) }, [open])

    /** Troca um grupo e devolve a lista inteira como nova origem. */
    const replaceGroup = (blockIndex: number, groupIndex: number, spells: SpellEntry[]) => {
        const next = blocks.map((block, b) => (b !== blockIndex ? block : {
            ...block,
            groups: block.groups.map((group, g) => (g !== groupIndex ? group : { ...group, spells })),
        }))
        onChange(buildSpellEdits(next, level))
    }

    return (
        <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="md" fullWidth>
            <DialogTitle sx={{ fontFamily: 'Cinzel, serif' }}>
                Magias do monstro
                <Typography variant="body2" sx={{ color: ink.secondary, fontFamily: 'inherit' }}>
                    nível-alvo {level}
                </Typography>
            </DialogTitle>

            <DialogContent dividers>
                {blocks.length === 0 && (
                    <Typography variant="body2" sx={{ color: ink.secondary }}>
                        Esta criatura não conjura magias.
                    </Typography>
                )}

                {blocks.map((block, b) => (
                    <Box key={b} sx={{ mb: 2.5 }}>
                        <Typography variant="overline" sx={{ color: gold.deep, letterSpacing: '0.06em' }}>
                            {block.label}
                        </Typography>

                        {block.kind === 'ritual' && (
                            <Typography variant="caption" sx={{ display: 'block', color: ink.secondary, mb: 0.5 }}>
                                Ritual é conjurado de um livro, em downtime: o rank dele não acompanha
                                o nível da criatura (GM Core pg. 123).
                            </Typography>
                        )}

                        {block.groups.map((group, g) => (
                            <GroupRow
                                key={g}
                                block={block}
                                group={group}
                                adding={sameTarget(target, { block: b, group: g })}
                                onToggleAdd={() => setTarget((prev) =>
                                    sameTarget(prev, { block: b, group: g }) ? null : { block: b, group: g })}
                                onChange={(spells) => replaceGroup(b, g, spells)}
                            />
                        ))}
                    </Box>
                ))}
            </DialogContent>

            <DialogActions sx={{ justifyContent: 'space-between' }}>
                <Button size="small" disabled={!edited} onClick={onReset}>
                    Restaurar as magias da AON
                </Button>
                <Button onClick={onClose} variant="contained">Pronto</Button>
            </DialogActions>
        </Dialog>
    )
}

interface RowProps {
    block: ScaledSpellBlock
    group: ScaledSpellGroup
    adding: boolean
    onToggleAdd: () => void
    onChange: (spells: SpellEntry[]) => void
}

/**
 * Onde repetir a mesma magia quer dizer alguma coisa: em PREPARADA, três slots
 * de 3º rank podem levar Fireball duas vezes e Haste uma; em INATA, a contagem
 * é quantas vezes por dia a magia sai. No repertório de uma espontânea, não:
 * saber a mesma magia duas vezes não conjura nada a mais. Truque é à vontade e
 * constante está sempre ligada, então em nenhum dos dois há o que contar.
 */
const allowsCopies = (block: ScaledSpellBlock, group: ScaledSpellGroup) =>
    group.kind === 'rank' && (block.kind === 'prepared' || block.kind === 'innate')

function GroupRow({ block, group, adding, onToggleAdd, onChange }: RowProps) {
    const copies = allowsCopies(block, group)

    /** O × tira uma cópia de cada vez; a última tira a magia. */
    const remove = (index: number) => {
        const entry = group.spells[index]
        const count = spellCopies(entry)
        if (copies && count > 1) {
            onChange(group.spells.map((e, i) => (i === index ? withCopies(e, count - 1) : e)))
            return
        }
        onChange(group.spells.filter((_, i) => i !== index))
    }

    const add = (spell: AonSpell, atWill: boolean) => {
        const at = group.spells.findIndex(
            (e) => e.name.toLowerCase() === spell.name.toLowerCase())
        // Escolher de novo a mesma magia soma uma cópia, em vez de repetir o chip:
        // é assim que a AON escreve ("Fear (2)", "Charm (×3)") e é o que a conta
        // de slots lê.
        if (at >= 0) {
            if (!copies) return
            onChange(group.spells.map((e, i) =>
                (i === at ? withCopies(e, spellCopies(e) + 1) : e)))
            return
        }
        onChange([...group.spells, { name: spell.name, note: atWill ? 'at will' : null }])
    }

    return (
        <Box sx={{ borderTop: `1px solid ${rule}88`, py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0 }}>
                    {groupLabel(group)}
                </Typography>
                {group.slots !== null && (
                    <Typography variant="caption" sx={{ color: ink.secondary }}>
                        {group.slots} {group.slots === 1 ? 'slot' : 'slots'}
                        {group.empty > 0 ? ` · ${group.empty} sem magia` : ''}
                    </Typography>
                )}
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={onToggleAdd}
                    sx={{ ml: 'auto' }}
                >
                    {adding ? 'Fechar' : 'Adicionar'}
                </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {group.spells.length === 0 && !adding && (
                    <Typography variant="caption" sx={{ color: ink.disabled, fontStyle: 'italic' }}>
                        nenhuma magia escolhida
                    </Typography>
                )}
                {/* O nome fica em INGLÊS: é a chave de busca na AON. */}
                {group.spells.map((entry, i) => (
                    <Chip
                        key={`${entry.name}-${i}`}
                        size="small"
                        label={entry.note ? `${entry.name} (${entry.note})` : entry.name}
                        onDelete={() => remove(i)}
                        title={spellCopies(entry) > 1 ? 'Tirar uma cópia' : 'Tirar a magia'}
                        sx={{ backgroundColor: parchment.sunken }}
                    />
                ))}
            </Box>

            {adding && <SpellPicker block={block} group={group} copies={copies} onPick={add} />}
        </Box>
    )
}

interface PickerProps {
    block: ScaledSpellBlock
    group: ScaledSpellGroup
    /** Se repetir a mesma magia soma uma cópia em vez de não fazer nada. */
    copies: boolean
    onPick: (spell: AonSpell, atWill: boolean) => void
}

/**
 * Busca da AON, presa à tradição do bloco e ao rank do grupo.
 *
 * O rank é TETO, não igualdade: magia de rank menor cabe em slot maior (é assim
 * que se prepara uma magia elevada) e magia inata é escrita no rank em que a
 * criatura conjura. O GM Core (pg. 122) diz que a criatura não está estritamente
 * presa à tradição, então há como abrir a lista inteira — mas o padrão é a
 * tradição do bloco, que é o que a ficha declara.
 */
function SpellPicker({ block, group, copies, onPick }: PickerProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<AonSpell[]>([])
    const [loading, setLoading] = useState(false)
    const [anyTradition, setAnyTradition] = useState(false)
    const [atWill, setAtWill] = useState(false)

    const kind = group.kind === 'cantrip' ? 'cantrip' : (block.kind === 'focus' ? 'focus' : 'spell')
    const tradition = anyTradition ? null : block.tradition
    const already = useMemo(
        () => new Set(group.spells.map((s) => s.name.toLowerCase())),
        [group.spells],
    )

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        const timer = setTimeout(() => {
            void searchSpellList(query, 24, { tradition, maxRank: group.rank, kind })
                .then((page) => {
                    if (cancelled) return
                    setResults(page.results)
                    setLoading(false)
                })
        }, 350)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [query, tradition, group.rank, kind])

    return (
        <Box sx={{ mt: 1, p: 1, backgroundColor: parchment.sunken, borderRadius: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                    size="small"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Magia de até ${group.rank}º rank`}
                    InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: ink.disabled }} /> }}
                    sx={{ flex: '1 1 200px' }}
                />
                {block.tradition && (
                    <FormControlLabel
                        control={<Switch size="small" checked={anyTradition} onChange={(e) => setAnyTradition(e.target.checked)} />}
                        label={<Typography variant="caption">Fora da tradição</Typography>}
                    />
                )}
                {block.kind === 'innate' && (
                    <FormControlLabel
                        control={<Switch size="small" checked={atWill} onChange={(e) => setAtWill(e.target.checked)} />}
                        label={<Typography variant="caption">À vontade</Typography>}
                    />
                )}
            </Box>

            {loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption">Buscando…</Typography>
                </Box>
            )}

            {!loading && results.length === 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                    Nenhuma magia encontrada com esse filtro.
                </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1, maxHeight: 220, overflowY: 'auto' }}>
                {results.map((spell) => {
                    const has = already.has(spell.name.toLowerCase())
                    return (
                        <Chip
                            key={spell.name}
                            size="small"
                            icon={<AddIcon fontSize="small" />}
                            label={`${spell.name} · ${spell.rank}º`}
                            // Já escolhida: soma uma cópia onde isso quer dizer
                            // alguma coisa, e fica apagada onde não quer.
                            disabled={has && !copies}
                            title={has && copies ? 'Somar uma cópia' : undefined}
                            onClick={() => onPick(spell, atWill)}
                            sx={{
                                backgroundColor: parchment.paper,
                                border: `1px solid ${spell.rarity === 'common' ? rule : gold.main}`,
                            }}
                        />
                    )
                })}
            </Box>
        </Box>
    )
}
