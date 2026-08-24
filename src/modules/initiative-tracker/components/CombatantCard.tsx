import { useEffect, useState } from 'react'
import {
    Box,
    Card,
    CardContent,
    Checkbox,
    Chip,
    IconButton,
    Menu,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import {
    ArrowDownward as DownIcon,
    ArrowUpward as UpIcon,
    Bolt as ConditionIcon,
    ContentCopy as DuplicateIcon,
    Delete as DeleteIcon,
    HourglassEmpty as DelayIcon,
    MoreVert as MoreIcon,
    OpenInNew as LinkIcon,
    PlayArrow as RejoinIcon,
    Shield as AcIcon,
    Visibility as PerceptionIcon,
} from '@mui/icons-material'
import { gold, green, ink, parchment, rule } from '../../../theme'
import { signed } from '../../character-viewer/helpers'
import { translateTrait } from '../../transformation-statblock/i18n'
import { CombatantConditions } from './CombatantConditions'
import { CombatantVitals } from './CombatantVitals'
import type { CombatantView } from '../types'

interface Props {
    view: CombatantView
    selected: boolean
    onToggleSelect: () => void
    onSetInitiative: (value: number) => void
    onMove: (dir: -1 | 1) => void
    onDelay: () => void
    onRejoin: () => void
    onToggleDefeated: () => void
    onDuplicate: () => void
    onRemove: () => void
    onOpenConditions: () => void
}

export const CombatantCard = ({
    view,
    selected,
    onToggleSelect,
    onSetInitiative,
    onMove,
    onDelay,
    onRejoin,
    onToggleDefeated,
    onDuplicate,
    onRemove,
    onOpenConditions,
}: Props) => {
    const { combatant, isActive } = view
    const npc = combatant.kind === 'npc' ? combatant : null
    const theme = useTheme()
    // O bloco de controles muda de lugar conforme a largura. Renderizar nos dois
    // pontos com `display: none` deixaria dois botões de mesmo rótulo no DOM —
    // ruim para leitor de teclado e leitor de tela. Só um existe por vez.
    const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
    const [initiative, setInitiative] = useState(String(combatant.initiative))

    // O campo é local para não despachar a cada tecla, mas a iniciativa também
    // muda por fora: voltar de Adiar reescreve o valor (regra RAW). Sem esta
    // sincronia o cartão continuaria mostrando o número antigo.
    useEffect(() => setInitiative(String(combatant.initiative)), [combatant.initiative])

    const closeMenu = () => setMenuAnchor(null)
    const commitInitiative = () => {
        const parsed = parseInt(initiative, 10)
        onSetInitiative(Number.isFinite(parsed) ? parsed : 0)
    }

    const dimmed = combatant.defeated || combatant.delayed

    // No celular acompanha o nome; no desktop fecha a faixa à direita.
    const controls = (
        <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }}>
            <Tooltip title="Subir na ordem">
                <IconButton size="small" onClick={() => onMove(-1)} sx={{ p: 0.4 }} aria-label="Subir na ordem">
                    <UpIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
            </Tooltip>
            <Tooltip title="Descer na ordem">
                <IconButton size="small" onClick={() => onMove(1)} sx={{ p: 0.4 }} aria-label="Descer na ordem">
                    <DownIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
            </Tooltip>
            <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ p: 0.4 }}
                aria-label={`Mais ações para ${combatant.name}`}
            >
                <MoreIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
        </Stack>
    )

    return (
        <Card
            sx={{
                opacity: dimmed ? 0.6 : 1,
                borderLeft: `4px solid ${isActive ? green.main : 'transparent'}`,
                backgroundColor: isActive ? gold.main + '18' : parchment.paper,
                borderColor: isActive ? gold.main : rule,
            }}
        >
            <CardContent sx={{ p: { xs: 1.25, sm: 1.5 }, '&:last-child': { pb: { xs: 1.25, sm: 1.5 } } }}>
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 1, sm: 2 }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                    {/* Identidade — no celular carrega os controles junto, para
                        eles não caírem no rodapé do cartão quando a faixa vira coluna. */}
                    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
                        <Checkbox
                            checked={selected}
                            onChange={onToggleSelect}
                            size="small"
                            sx={{ p: 0.5, mt: -0.25 }}
                            inputProps={{ 'aria-label': `Selecionar ${combatant.name}` }}
                        />

                        <TextField
                            size="small"
                            value={initiative}
                            onChange={(e) => setInitiative(e.target.value.replace(/[^\d-]/g, ''))}
                            onBlur={commitInitiative}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            inputProps={{ inputMode: 'numeric', 'aria-label': `Iniciativa de ${combatant.name}` }}
                            sx={{
                                width: 52,
                                flexShrink: 0,
                                '& .MuiInputBase-input': { py: 0.4, textAlign: 'center', fontWeight: 700 },
                            }}
                        />

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                <Typography
                                    sx={{
                                        fontWeight: 700,
                                        textDecoration: combatant.defeated ? 'line-through' : undefined,
                                    }}
                                >
                                    {combatant.name}
                                </Typography>
                                {npc?.aonUrl && (
                                    <Tooltip title="Abrir no Archives of Nethys">
                                        <IconButton
                                            size="small"
                                            href={npc.aonUrl}
                                            target="_blank"
                                            rel="noopener"
                                            sx={{ p: 0.25 }}
                                            aria-label="Abrir no Archives of Nethys"
                                        >
                                            <LinkIcon sx={{ fontSize: '0.85rem' }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {combatant.delayed && (
                                    <Chip size="small" label="Adiado" sx={{ height: 18, fontSize: '0.65rem' }} />
                                )}
                            </Stack>

                            <Stack
                                direction="row"
                                spacing={1.25}
                                sx={{ flexWrap: 'wrap', color: ink.secondary, mt: 0.25 }}
                            >
                                <Typography variant="caption">
                                    {combatant.kind === 'pc' ? combatant.klass ?? 'Personagem' : 'Nível'} {combatant.level}
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={0.25}>
                                    <AcIcon sx={{ fontSize: '0.8rem' }} />
                                    <Typography variant="caption">{combatant.ac + view.mods.total.ac}</Typography>
                                </Stack>
                                {combatant.perception !== undefined && (
                                    <Stack direction="row" alignItems="center" spacing={0.25}>
                                        <PerceptionIcon sx={{ fontSize: '0.8rem' }} />
                                        <Typography variant="caption">{signed(combatant.perception)}</Typography>
                                    </Stack>
                                )}
                            </Stack>
                        </Box>

                        {isPhone && controls}
                    </Stack>

                    {/* PV: coluna própria a partir do tablet, para a faixa usar a
                        largura em vez de empilhar tudo e alongar a rolagem. */}
                    <Box sx={{ width: { xs: '100%', sm: 240 }, flexShrink: 0 }}>
                        <CombatantVitals view={view} />
                    </Box>

                    {!isPhone && controls}
                </Stack>

                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    <Tooltip title="Condições">
                        <IconButton size="small" onClick={onOpenConditions} sx={{ p: 0.4 }} aria-label="Condições">
                            <ConditionIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                    </Tooltip>
                    <CombatantConditions view={view} />
                </Stack>

                {(combatant.defenseNotes?.length || npc?.traits?.length) ? (
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                        {npc?.traits?.slice(0, 4).map((t: string) => (
                            <Chip key={t} size="small" label={translateTrait(t)} sx={{ height: 18, fontSize: '0.65rem' }} />
                        ))}
                        {combatant.defenseNotes?.map((note) => (
                            <Tooltip key={note} title="Defesa com ressalva — ajuste o dano à mão">
                                <Chip
                                    size="small"
                                    label={note}
                                    sx={{ height: 18, fontSize: '0.65rem', border: `1px dashed ${gold.main}` }}
                                    variant="outlined"
                                />
                            </Tooltip>
                        ))}
                    </Stack>
                ) : null}
            </CardContent>

            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
                {combatant.delayed ? (
                    <MenuItem onClick={() => { onRejoin(); closeMenu() }}>
                        <RejoinIcon fontSize="small" sx={{ mr: 1 }} /> Entrar agora
                    </MenuItem>
                ) : (
                    <MenuItem onClick={() => { onDelay(); closeMenu() }}>
                        <DelayIcon fontSize="small" sx={{ mr: 1 }} /> Adiar
                    </MenuItem>
                )}
                <MenuItem onClick={() => { onToggleDefeated(); closeMenu() }}>
                    {combatant.defeated ? 'Reativar no combate' : 'Marcar como derrotado'}
                </MenuItem>
                {combatant.kind === 'npc' && (
                    <MenuItem onClick={() => { onDuplicate(); closeMenu() }}>
                        <DuplicateIcon fontSize="small" sx={{ mr: 1 }} /> Duplicar
                    </MenuItem>
                )}
                <MenuItem onClick={() => { onRemove(); closeMenu() }}>
                    <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Remover
                </MenuItem>
            </Menu>
        </Card>
    )
}
