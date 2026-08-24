import { Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { MYTHIC_COLOR } from '../helpers'

/**
 * Legenda do "✦" que aparece nas salvaguardas, nas perícias e nos ataques.
 * É a mesma frase nos três lugares — se o texto mudar, muda em todos de uma vez.
 */
export const MythicNote = ({ sx }: { sx?: SxProps<Theme> }) => (
    <Typography
        variant="caption"
        sx={[
            { display: 'block', color: MYTHIC_COLOR, fontWeight: 600 },
            ...(Array.isArray(sx) ? sx : [sx]),
        ]}
    >
        ✦ valor com proficiência mítica (nível + 10) — ao gastar um Ponto Mítico
    </Typography>
)
