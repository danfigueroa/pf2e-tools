import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { Map as MapIcon } from '@mui/icons-material'
import { listMaps, type MapSummary } from '../../../services/maps'

interface Props {
    mapId: string | null
    onChange: (mapId: string | null) => void
}

const NONE = '__none__'

/**
 * Qual mapa de combate este encontro ocupa. Cada mapa tem o SEU encontro:
 * trocar aqui guarda o atual e abre o do outro mapa.
 */
export const EncounterMapPicker = ({ mapId, onChange }: Props) => {
    const navigate = useNavigate()
    const [maps, setMaps] = useState<MapSummary[]>([])

    // Com os privados: o mapa recém-criado nasce privado, e sem ele aqui o
    // encontro montado para ele pareceria de um mapa apagado.
    const reload = () => { listMaps({ gm: true }).then((b) => setMaps(b.maps)).catch(() => {}) }
    useEffect(reload, [])

    // Mapa apagado depois do jogo: o encontro dele ainda está neste aparelho,
    // então a opção continua aparecendo — sumir com ela esconderia o encontro.
    const missing = mapId !== null && !maps.some((m) => m.id === mapId)

    return (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ flex: '1 1 220px', maxWidth: 420 }}>
                <InputLabel id="encounter-map">Mapa de combate</InputLabel>
                <Select
                    labelId="encounter-map"
                    label="Mapa de combate"
                    value={mapId ?? NONE}
                    onOpen={reload}
                    onChange={(e) => onChange(e.target.value === NONE ? null : String(e.target.value))}
                >
                    <MenuItem value={NONE}>Sem mapa</MenuItem>
                    {maps.map((m) => <MenuItem key={m.id} value={m.id}>{m.private ? `${m.name} · privado` : m.name}</MenuItem>)}
                    {missing && <MenuItem value={mapId}>Mapa apagado</MenuItem>}
                </Select>
            </FormControl>
            {mapId && !missing && (
                <Button variant="outlined" startIcon={<MapIcon />} onClick={() => navigate(`/mapa/${mapId}`)}>
                    Abrir mapa
                </Button>
            )}
        </Box>
    )
}
