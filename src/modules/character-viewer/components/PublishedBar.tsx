import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { CloudDone as PublishedIcon, History as RestoreIcon } from '@mui/icons-material'
import type { PublishedSheet } from '../../../services/sheets'

const when = (ts: number) => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Faixa sob o cabeçalho quando a ficha aberta é a publicada pela mesa. É
 * também o caminho de volta: sem login, uma publicação errada tem de poder
 * ser desfeita por qualquer um, a qualquer hora — não só no aviso que some.
 */
export const PublishedBar = ({ sheet, onRestore }: { sheet: PublishedSheet; onRestore: () => void }) => {
    const [confirming, setConfirming] = useState(false)
    const prev = sheet.previous

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                mt: -1.5,
                mb: 2,
                px: 0.5,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: '1 1 220px', minWidth: 0 }}>
                <PublishedIcon fontSize="small" sx={{ color: 'primary.main', flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
                    Ficha da mesa · publicada em {when(sheet.publishedAt)}
                </Typography>
            </Box>
            {prev && (
                <Button size="small" startIcon={<RestoreIcon />} onClick={() => setConfirming(true)}>
                    Versão anterior
                </Button>
            )}

            <Dialog open={confirming} onClose={() => setConfirming(false)}>
                <DialogTitle>Voltar à versão anterior?</DialogTitle>
                <DialogContent>
                    <Typography>
                        A ficha da mesa volta para a versão publicada em {prev ? when(prev.publishedAt) : ''}
                        {prev?.level != null ? ` (nível ${prev.level})` : ''}, para todos. A versão de agora
                        fica guardada no lugar dela, então dá para desfazer.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirming(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={() => { setConfirming(false); onRestore() }}>
                        Restaurar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
