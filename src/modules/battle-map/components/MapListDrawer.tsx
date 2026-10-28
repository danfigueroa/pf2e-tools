import { useEffect, useState } from 'react'
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Add as AddIcon,
    Campaign as ActivateIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Visibility as RevealIcon,
    VisibilityOff as HideIcon,
} from '@mui/icons-material'
import {
    activateMap,
    createMap,
    deleteMap,
    listMaps,
    renameMap,
    onMapsChanged,
    setMapVisibility,
    type MapSummary,
} from '../../../services/maps'
import { gold, ink } from '../../../theme'

interface Props {
    open: boolean
    currentId: string | null
    gm: boolean
    onClose: () => void
    onOpenMap: (id: string | null) => void
}

/**
 * Os mapas da sessão. Abrir é de cada um; "Levar a mesa" e apagar são
 * coletivos — apagar leva junto a imagem e os tokens, por isso confirma.
 *
 * Mapa novo nasce privado: só o Modo GM o vê (o servidor nem o entrega aos
 * outros) até ser revelado aqui ou levado à mesa, que revela junto.
 */
export const MapListDrawer = ({ open, currentId, gm, onClose, onOpenMap }: Props) => {
    const [maps, setMaps] = useState<MapSummary[] | null>(null)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [renaming, setRenaming] = useState<MapSummary | null>(null)
    const [newName, setNewName] = useState('')
    const [deleting, setDeleting] = useState<MapSummary | null>(null)

    const reload = async () => {
        try {
            const body = await listMaps({ gm })
            setMaps(body.maps)
            setActiveId(body.activeId)
            setError(null)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao listar os mapas')
        }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps -- `reload` lê o `gm` desta renderização
    useEffect(() => { if (open) void reload() }, [open, gm])

    // Aberta, a lista acompanha o que outro aparelho cria, renomeia, esconde ou apaga.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idem
    useEffect(() => (open ? onMapsChanged(() => { void reload() }) : undefined), [open, gm])

    const run = async (work: () => Promise<void>) => {
        setBusy(true)
        try { await work() } catch (e) {
            setError(e instanceof Error ? e.message : 'Algo deu errado')
        } finally { setBusy(false) }
    }

    const create = () => run(async () => {
        const map = await createMap(name.trim() || `Mapa ${(maps?.length ?? 0) + 1}`)
        setName('')
        await reload()
        onOpenMap(map.id)
    })

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            slotProps={{ paper: { sx: { width: 340, maxWidth: '100vw' } } }}
        >
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
                    Mapas da sessão
                </Typography>
                <Box sx={{ height: 2, width: 120, backgroundColor: gold.main }} />

                {gm && (
                    <Box
                        component="form"
                        onSubmit={(e) => { e.preventDefault(); void create() }}
                        sx={{ display: 'flex', gap: 1 }}
                    >
                        <TextField
                            size="small"
                            label="Novo mapa"
                            placeholder="Ex.: Cripta de Belcorra"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            sx={{ flex: 1 }}
                        />
                        <Button type="submit" variant="contained" disabled={busy} startIcon={<AddIcon />}>
                            Criar
                        </Button>
                    </Box>
                )}

                {error && <Typography color="error" variant="body2">{error}</Typography>}

                <List disablePadding sx={{ flex: 1, overflow: 'auto' }}>
                    {maps?.length === 0 && (
                        <Typography variant="body2" sx={{ color: ink.secondary, py: 2 }}>
                            {gm ? 'Nenhum mapa ainda.' : 'Nenhum mapa revelado ainda. O GM cria e revela os mapas.'}
                        </Typography>
                    )}
                    {maps?.map((map) => (
                        <ListItem
                            key={map.id}
                            disablePadding
                            secondaryAction={gm && (
                                <Box sx={{ display: 'flex' }}>
                                    <Tooltip title={map.private ? 'Revelar e levar a mesa para este mapa' : 'Levar a mesa para este mapa'}>
                                        <span>
                                            <IconButton
                                                aria-label={`Levar a mesa para ${map.name}`}
                                                disabled={busy || activeId === map.id}
                                                onClick={() => run(async () => {
                                                    await activateMap(map.id)
                                                    await reload()
                                                })}
                                            >
                                                <ActivateIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title={map.private ? 'Revelar à mesa' : 'Esconder da mesa'}>
                                        <span>
                                            <IconButton
                                                aria-label={map.private ? `Revelar ${map.name} à mesa` : `Esconder ${map.name} da mesa`}
                                                disabled={busy}
                                                onClick={() => run(async () => {
                                                    await setMapVisibility(map.id, !map.private)
                                                    await reload()
                                                })}
                                            >
                                                {map.private ? <HideIcon /> : <RevealIcon />}
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <IconButton
                                        aria-label={`Renomear ${map.name}`}
                                        onClick={() => { setRenaming(map); setNewName(map.name) }}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        aria-label={`Apagar ${map.name}`}
                                        onClick={() => setDeleting(map)}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            )}
                            sx={{ '& .MuiListItemButton-root': { pr: gm ? 22 : 2 } }}
                        >
                            <ListItemButton
                                selected={map.id === currentId}
                                onClick={() => { onOpenMap(map.id); onClose() }}
                                sx={{ borderRadius: 1 }}
                            >
                                <ListItemText
                                    primary={map.name}
                                    secondary={(activeId === map.id || map.private) ? (
                                        <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                                            {activeId === map.id && <Chip label="A mesa está aqui" size="small" color="primary" component="span" />}
                                            {map.private && <Chip label="Privado" size="small" color="warning" icon={<HideIcon />} component="span" />}
                                        </Box>
                                    ) : null}
                                    slotProps={{ primary: { sx: { fontWeight: 600 } }, secondary: { component: 'span' } }}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>

                <Divider />
                <Typography variant="caption" sx={{ color: ink.secondary }}>
                    Apague os mapas depois do jogo: imagem, tokens e posições vão junto. O token
                    de cada personagem fica — ele é da ficha.
                </Typography>
            </Box>

            <Dialog open={!!renaming} onClose={() => setRenaming(null)}>
                <DialogTitle sx={{ fontWeight: 700 }}>Renomear mapa</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        margin="dense"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenaming(null)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        disabled={!newName.trim() || busy}
                        onClick={() => run(async () => {
                            if (!renaming) return
                            await renameMap(renaming.id, newName.trim())
                            setRenaming(null)
                            await reload()
                        })}
                    >
                        Salvar
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
                <DialogTitle sx={{ fontWeight: 700 }}>Apagar “{deleting?.name}”?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        O mapa some para a mesa inteira, com a imagem, os tokens e as posições. O
                        encontro da Iniciativa ligado a ele continua no aparelho do GM.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)}>Cancelar</Button>
                    <Button
                        color="error"
                        variant="contained"
                        disabled={busy}
                        onClick={() => run(async () => {
                            if (!deleting) return
                            await deleteMap(deleting.id)
                            if (deleting.id === currentId) onOpenMap(null)
                            setDeleting(null)
                            await reload()
                        })}
                    >
                        Apagar
                    </Button>
                </DialogActions>
            </Dialog>
        </Drawer>
    )
}
