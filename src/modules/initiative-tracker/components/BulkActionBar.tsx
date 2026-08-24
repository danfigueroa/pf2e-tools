import { Box, Button, Stack, Typography } from '@mui/material'
import {
    Bolt as ConditionIcon,
    Close as ClearIcon,
    Favorite as HealIcon,
    LocalFireDepartment as DamageIcon,
} from '@mui/icons-material'
import { gold, HP_COLOR, ink, parchment } from '../../../theme'

interface Props {
    count: number
    onDamage: () => void
    onHeal: () => void
    onCondition: () => void
    onClear: () => void
}

/**
 * Barra de ações em lote. Fica presa no rodapé (`sticky`) porque na mesa a
 * ficha é usada no celular, com o polegar: subir até o topo para aplicar um
 * fireball em quatro alvos seria o gesto mais repetido da ferramenta.
 */
export const BulkActionBar = ({ count, onDamage, onHeal, onCondition, onClear }: Props) => (
    <Box
        sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 5,
            mt: 2,
            mx: { xs: -1.5, sm: -3 },
            px: { xs: 1.5, sm: 3 },
            py: 1.25,
            backgroundColor: parchment.paper,
            borderTop: `2px solid ${gold.main}`,
            boxShadow: '0 -4px 12px rgba(35, 32, 26, 0.12)',
        }}
    >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: ink.secondary, mr: 0.5 }}>
                {count} {count === 1 ? 'alvo' : 'alvos'}
            </Typography>

            <Button
                variant="contained"
                size="small"
                onClick={onDamage}
                startIcon={<DamageIcon />}
                sx={{ backgroundColor: HP_COLOR, '&:hover': { backgroundColor: '#8F3622' } }}
            >
                Dano
            </Button>
            <Button variant="outlined" size="small" onClick={onHeal} startIcon={<HealIcon />}>
                Cura
            </Button>
            <Button variant="outlined" size="small" onClick={onCondition} startIcon={<ConditionIcon />}>
                Condição
            </Button>

            <Box sx={{ flex: 1 }} />

            <Button size="small" onClick={onClear} startIcon={<ClearIcon />} sx={{ color: ink.secondary }}>
                Limpar
            </Button>
        </Stack>
    </Box>
)
