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
import { tr } from '../../../i18n'

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
            setError(e instanceof Error ? e.message : tr('Erro ao listar os mapas', 'Error listing the maps'))
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
            setError(e instanceof Error ? e.message : tr('Algo deu errado', 'Something went wrong'))
        } finally { setBusy(false) }
    }

    const create = () => run(async () => {
        const map = await createMap(name.trim() || tr(`Mapa ${(maps?.length ?? 0) + 1}`, `Map ${(maps?.length ?? 0) + 1}`))
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
                    {tr('Mapas da sessão', 'Session maps')}</Typography>
                <Box sx={{ height: 2, width: 120, backgroundColor: gold.main }} />

                {gm && (
                    <Box
                        component="form"
                        onSubmit={(e) => { e.preventDefault(); void create() }}
                        sx={{ display: 'flex', gap: 1 }}
                    >
                        <TextField
                            size="small"
                            label={tr("Novo mapa", 'New map')}
                            placeholder={tr("Ex.: Cripta de Belcorra", 'E.g.: Belcorra\'s Crypt')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            sx={{ flex: 1 }}
                        />
                        <Button type="submit" variant="contained" disabled={busy} startIcon={<AddIcon />}>
                            {tr('Criar', 'Create')}</Button>
                    </Box>
                )}

                {error && <Typography color="error" variant="body2">{error}</Typography>}

                <List disablePadding sx={{ flex: 1, overflow: 'auto' }}>
                    {maps?.length === 0 && (
                        <Typography variant="body2" sx={{ color: ink.secondary, py: 2 }}>
                            {gm ? tr('Nenhum mapa ainda.', 'No maps yet.') : tr('Nenhum mapa revelado ainda. O GM cria e revela os mapas.', 'No map revealed yet. The GM creates and reveals the maps.')}
                        </Typography>
                    )}
                    {maps?.map((map) => (
                        <ListItem
                            key={map.id}
                            disablePadding
                            secondaryAction={gm && (
                                <Box sx={{ display: 'flex' }}>
                                    <Tooltip title={map.private ? tr('Revelar e levar a mesa para este mapa', 'Reveal and take the table to this map') : tr('Levar a mesa para este mapa', 'Take the table to this map')}>
                                        <span>
                                            <IconButton
                                                aria-label={tr(`Levar a mesa para ${map.name}`, `Take the table to ${map.name}`)}
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
                                    <Tooltip title={map.private ? tr('Revelar à mesa', 'Reveal to the table') : tr('Esconder da mesa', 'Hide from the table')}>
                                        <span>
                                            <IconButton
                                                aria-label={map.private ? tr(`Revelar ${map.name} à mesa`, `Reveal ${map.name} to the table`) : tr(`Esconder ${map.name} da mesa`, `Hide ${map.name} from the table`)}
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
                                        aria-label={tr(`Apagar ${map.name}`, `Delete ${map.name}`)}
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
                                            {activeId === map.id && <Chip label={tr("A mesa está aqui", 'The table is here')} size="small" color="primary" component="span" />}
                                            {map.private && <Chip label={tr("Privado", 'Private')} size="small" color="warning" icon={<HideIcon />} component="span" />}
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
                    {tr('Apague os mapas depois do jogo: imagem, tokens e posições vão junto. O token de cada personagem fica — ele é da ficha.', 'Delete the maps after the game: image, tokens and positions go with them. Each character\'s token stays — it belongs to the sheet.')}</Typography>
            </Box>

            <Dialog open={!!renaming} onClose={() => setRenaming(null)}>
                <DialogTitle sx={{ fontWeight: 700 }}>{tr('Renomear mapa', 'Rename map')}</DialogTitle>
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
                    <Button onClick={() => setRenaming(null)}>{tr('Cancelar', 'Cancel')}</Button>
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
                        {tr('Salvar', 'Save')}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
                <DialogTitle sx={{ fontWeight: 700 }}>{tr('Apagar “', 'Delete “')}{deleting?.name}”?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {tr('O mapa some para a mesa inteira, com a imagem, os tokens e as posições. O encontro da Iniciativa ligado a ele continua no aparelho do GM.', 'The map disappears for the whole table, with the image, the tokens and the positions. The Initiative encounter tied to it stays on the GM\'s device.')}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)}>{tr('Cancelar', 'Cancel')}</Button>
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
                        {tr('Apagar', 'Delete')}</Button>
                </DialogActions>
            </Dialog>
        </Drawer>
    )
}
