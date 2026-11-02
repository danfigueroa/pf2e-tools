import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Tooltip, Typography } from '@mui/material'
import { CloudDone as SavedIcon, CloudOff as OfflineIcon, CloudUpload as SavingIcon, Map as MapIcon } from '@mui/icons-material'
import { listMaps, type MapSummary } from '../../../services/maps'
import { gold, status as statusColor } from '../../../theme/palette'
import type { CloudStatus } from '../useEncounterCloud'
import { tr } from '../../../i18n'

interface Props {
    mapId: string | null
    onChange: (mapId: string | null) => void
    cloud: CloudStatus
}

const CLOUD: Record<CloudStatus, { label: string; hint: string; tone: string; Icon: typeof SavedIcon }> = {
    saved: {
        label: tr('Na nuvem', 'In the cloud'),
        hint: tr('Este encontro abre igual em qualquer aparelho, e o que mudar em outro aparece aqui.', 'This encounter opens the same on any device, and what changes on another shows up here.'),
        tone: statusColor.success,
        Icon: SavedIcon,
    },
    saving: { label: 'Salvando…', hint: tr('Enviando o encontro para a nuvem.', 'Sending the encounter to the cloud.'), tone: gold.deep, Icon: SavingIcon },
    offline: {
        label: tr('Não subiu', 'Didn\'t upload'),
        hint: tr('Sem contato com a nuvem. O encontro fica salvo aqui e sobe na próxima mudança ou quando a conexão voltar.', 'No contact with the cloud. The encounter is saved here and goes up on the next change or when the connection comes back.'),
        tone: statusColor.warning,
        Icon: OfflineIcon,
    },
    local: {
        label: tr('Só neste aparelho', 'Only on this device'),
        hint: tr('Sem nuvem disponível: o encontro fica salvo só neste navegador.', 'No cloud available: the encounter is saved only in this browser.'),
        tone: statusColor.warning,
        Icon: OfflineIcon,
    },
}

const NONE = '__none__'

/**
 * Qual mapa de combate este encontro ocupa. Cada mapa tem o SEU encontro:
 * trocar aqui guarda o atual e abre o do outro mapa.
 */
export const EncounterMapPicker = ({ mapId, onChange, cloud }: Props) => {
    const navigate = useNavigate()
    const [maps, setMaps] = useState<MapSummary[]>([])

    // Com os privados: o mapa recém-criado nasce privado, e sem ele aqui o
    // encontro montado para ele pareceria de um mapa apagado.
    const reload = () => { listMaps({ gm: true }).then((b) => setMaps(b.maps)).catch(() => {}) }
    useEffect(reload, [])

    // Mapa apagado depois do jogo: o encontro dele ainda está neste aparelho,
    // então a opção continua aparecendo — sumir com ela esconderia o encontro.
    const missing = mapId !== null && !maps.some((m) => m.id === mapId)
    const { label, hint, tone, Icon } = CLOUD[cloud]

    return (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ flex: '1 1 220px', maxWidth: 420 }}>
                <InputLabel id="encounter-map">{tr('Mapa de combate', 'Battle map')}</InputLabel>
                <Select
                    labelId="encounter-map"
                    label={tr("Mapa de combate", 'Battle map')}
                    value={mapId ?? NONE}
                    onOpen={reload}
                    onChange={(e) => onChange(e.target.value === NONE ? null : String(e.target.value))}
                >
                    <MenuItem value={NONE}>{tr('Sem mapa', 'No map')}</MenuItem>
                    {maps.map((m) => <MenuItem key={m.id} value={m.id}>{m.private ? tr(`${m.name} · privado`, `${m.name} · private`) : m.name}</MenuItem>)}
                    {missing && <MenuItem value={mapId}>{tr('Mapa apagado', 'Map deleted')}</MenuItem>}
                </Select>
            </FormControl>
            {mapId && !missing && (
                <Button variant="outlined" startIcon={<MapIcon />} onClick={() => navigate(`/mapa/${mapId}`)}>
                    {tr('Abrir mapa', 'Open map')}</Button>
            )}
            <Tooltip title={hint} enterDelay={400}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Icon sx={{ fontSize: '1rem', color: tone }} />
                    <Typography variant="caption" sx={{ color: tone, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {label}
                    </Typography>
                </Box>
            </Tooltip>
        </Box>
    )
}
