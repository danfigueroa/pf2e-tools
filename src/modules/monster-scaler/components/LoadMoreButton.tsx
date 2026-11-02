import { Button, CircularProgress } from '@mui/material'
import { tr } from '../../../i18n'

interface Props {
    loading: boolean
    onClick: () => void
}

/**
 * Buscar só por faixa de nível é como se monta encontro, e uma faixa de um
 * nível só já passa de cem criaturas: a lista precisa chegar até o fim.
 */
export function LoadMoreButton({ loading, onClick }: Props) {
    return (
        <Button
            fullWidth
            variant="outlined"
            sx={{ mt: 1 }}
            disabled={loading}
            onClick={onClick}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
            {loading ? tr('Carregando…', 'Loading…') : tr('Carregar mais', 'Load more')}
        </Button>
    )
}
