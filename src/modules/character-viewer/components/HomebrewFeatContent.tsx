import { useEffect, useState } from 'react'
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { tr } from '../../../i18n'
import type { HomebrewFeatRef } from '../../../pathbuilder/types'
import { fetchHomebrew } from '../../../services/builds'
import { useSheetReadOnly, VIEW_OK } from '../sheetAccess'

export function HomebrewFeatContent({ feat, buildId, onClose }: { feat: HomebrewFeatRef; buildId?: string; onClose: () => void }) {
    const readOnly = useSheetReadOnly()
    const [result, setResult] = useState<{ name: string; text: string } | null>(null)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        let alive = true
        void fetchHomebrew(true).then((out) => {
            if (!alive) return
            if (!out.ok) { setError(out.error); return }
            const entry = out.value.find((row) => row.kind === 'feat' && row.entry.id === feat.id)?.entry
            setResult({
                name: entry?.name ?? feat.name,
                text: entry ? entry.summary || tr('O GM ainda não escreveu uma descrição.', 'The GM has not added a description yet.')
                    : tr('Este talento já não está no catálogo da mesa.', 'This feat is no longer in the table catalog.'),
            })
        })
        return () => { alive = false }
    }, [feat.id, feat.name, attempt])
    return (
        <Stack spacing={2} sx={{ p: 2.5, overflowWrap: 'anywhere' }}>
            <Box>
                <Typography variant="overline">{tr('Talento da mesa', 'Table homebrew feat')}</Typography>
                <Typography component="h2" variant="h5">{result?.name ?? feat.name}</Typography>
            </Box>
            {result && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{result.text}</Typography>}
            {!result && !error && <CircularProgress size={24} aria-label={tr('Carregando descrição', 'Loading description')} />}
            {error && <Box role="alert"><Typography>{error}</Typography>
                <Button {...VIEW_OK} onClick={() => { setError(''); setAttempt((n) => n + 1) }}>{tr('Tentar de novo', 'Try again')}</Button></Box>}
            {!readOnly && buildId && feat.slot && <Button component={RouterLink} to={`/personagens/${buildId}?trocar=${encodeURIComponent(feat.slot)}`} variant="outlined">
                {tr('Trocar talento no Criador', 'Swap feat in the Builder')}</Button>}
            <Button {...VIEW_OK} onClick={onClose}>{tr('Fechar', 'Close')}</Button>
        </Stack>
    )
}
