import { useMemo, useState } from 'react'
import { Box, Button } from '@mui/material'
import { Casino as DiceIcon } from '@mui/icons-material'
import { gold, green } from '../../../theme'
import type { BuildInfo } from '../../character-sheet/types'
import { DicePanel } from '../../battle-map/components/DicePanel'
import { postRoll } from '../../../services/rolls'
import { rollerIdentity } from '../rolls'
import type { TableRoll } from '../../../dice/tableRoll'

/**
 * Rolador de dados livre, o mesmo do Mapa de Combate: para a rolagem que a ficha
 * não monta sozinha (dano de uma habilidade, d% de tabela, um d20 qualquer).
 * Vai para o feed da mesa com o nome e a cor do personagem.
 */
export const DiceBar = ({ build }: { build: BuildInfo }) => {
    const [open, setOpen] = useState(false)
    const identity = useMemo(() => {
        const { by, color } = rollerIdentity(build)
        return { by, color }
    }, [build])
    return (
        <Box sx={{ mb: 2 }}>
            <Button
                size="small"
                variant={open ? 'contained' : 'outlined'}
                aria-pressed={open}
                onClick={() => setOpen((o) => !o)}
                startIcon={<DiceIcon fontSize="small" />}
                sx={open ? { bgcolor: green.main, color: gold.bright, '&:hover': { bgcolor: green.main } } : undefined}
                style={{ marginBottom: open ? 8 : 0 }}
            >
                Dados
            </Button>
            {open && <DicePanel identity={identity} onRoll={(roll: TableRoll) => { void postRoll(roll) }} />}
        </Box>
    )
}
