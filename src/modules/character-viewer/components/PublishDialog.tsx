import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material'
import type { BuildInfo } from '../../character-sheet/types'
import { diffSheets } from '../sheetDiff'

/** A versão contra a qual o JSON enviado é comparado. */
export interface PublishBase {
    build: BuildInfo
    /** `published` = a ficha que a mesa já usa; `static` = o arquivo fixo da campanha. */
    from: 'published' | 'static'
    publishedAt?: number
}

interface Props {
    open: boolean
    incoming: BuildInfo
    base: PublishBase | null
    busy: boolean
    error: string | null
    onViewOnly: () => void
    onPublish: () => void
    onCancel: () => void
}

const MAX_NAMES = 12

/**
 * Antes de sobrescrever a ficha da mesa, mostra o que muda. Sem login,
 * qualquer pessoa publica — então a diferença à vista (e a versão anterior
 * guardada no servidor) é o que impede um JSON errado de passar despercebido.
 */
export const PublishDialog = ({ open, incoming, base, busy, error, onViewOnly, onPublish, onCancel }: Props) => {
    const diff = base ? diffSheets(base.build, incoming) : null
    const baseLabel = base?.from === 'published'
        ? `a ficha publicada${base.publishedAt ? ` em ${new Date(base.publishedAt).toLocaleDateString('pt-BR')}` : ''}`
        : 'a ficha da campanha'

    return (
        <Dialog open={open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="sm">
            <DialogTitle>{incoming.name}</DialogTitle>
            <DialogContent dividers>
                {!base ? (
                    <Typography sx={{ mb: 1 }}>
                        Personagem novo na mesa. Publicar faz ele aparecer para todos — na Ficha Virtual,
                        na Iniciativa e na Transformação.
                    </Typography>
                ) : diff?.identical ? (
                    <Typography sx={{ mb: 1 }}>Igual a {baseLabel}. Não há o que atualizar.</Typography>
                ) : (
                    <>
                        <Typography sx={{ mb: 1.5 }}>
                            Comparado com {baseLabel}:
                        </Typography>
                        {diff && diff.levelFrom !== diff.levelTo && (
                            <Chip
                                label={`Nível ${diff.levelFrom} → ${diff.levelTo}`}
                                color="primary"
                                sx={{ fontWeight: 700, mb: 1.5 }}
                            />
                        )}
                        <Stack spacing={1.5}>
                            {diff?.changes.map((c) => (
                                <Box key={c.label}>
                                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {c.label}
                                    </Typography>
                                    <NameList sign="+" names={c.added} />
                                    <NameList sign="−" names={c.removed} />
                                </Box>
                            ))}
                            {diff && diff.changes.length === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    Talentos, magias e itens são os mesmos; mudaram só números da ficha.
                                </Typography>
                            )}
                        </Stack>
                    </>
                )}

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Ao publicar, a ficha passa a valer para toda a mesa e um guia de como jogar é gerado
                    por IA para a versão nova. A versão anterior fica guardada e pode ser restaurada.
                    PV, condições e slots não mudam.
                </Typography>

                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button onClick={onViewOnly} disabled={busy}>Só ver neste aparelho</Button>
                <Button
                    variant="contained"
                    onClick={onPublish}
                    disabled={busy || !!diff?.identical}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    Publicar para a mesa
                </Button>
            </DialogActions>
        </Dialog>
    )
}

const NameList = ({ sign, names }: { sign: '+' | '−'; names: string[] }) => {
    if (names.length === 0) return null
    const shown = names.slice(0, MAX_NAMES)
    const rest = names.length - shown.length
    return (
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            <Box component="span" sx={{ fontWeight: 700, color: sign === '+' ? 'success.main' : 'error.main', mr: 0.75 }}>
                {sign}
            </Box>
            {shown.join(', ')}
            {rest > 0 ? ` e mais ${rest}` : ''}
        </Typography>
    )
}
