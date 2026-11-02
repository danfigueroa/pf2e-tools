import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material'
import type { BuildInfo } from '../../../pathbuilder/types'
import { diffSheets } from '../sheetDiff'
import { EmbedDialog } from './EmbedDialog'
import { locale, tr } from '../../../i18n'

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
    onPublish: () => void
    onCancel: () => void
}

const MAX_NAMES = 12

/**
 * Antes de sobrescrever a ficha da mesa, mostra o que muda. Sem login,
 * qualquer pessoa publica — então a diferença à vista (e a versão anterior
 * guardada no servidor) é o que impede um JSON errado de passar despercebido.
 */
export const PublishDialog = ({ open, incoming, base, busy, error, onPublish, onCancel }: Props) => {
    const diff = base ? diffSheets(base.build, incoming) : null
    // Só a ficha JÁ publicada dispensa publicar de novo; o arquivo fixo da campanha ainda não está no banco.
    const alreadyPublished = !!diff?.identical && base?.from === 'published'
    const baseLabel = base?.from === 'published'
        ? tr(`a ficha publicada${base.publishedAt ? ` em ${new Date(base.publishedAt).toLocaleDateString(locale)}` : ''}`, `the published sheet${base.publishedAt ? ` from ${new Date(base.publishedAt).toLocaleDateString(locale)}` : ''}`)
        : tr('a ficha da campanha', 'the campaign sheet')

    return (
        <EmbedDialog open={open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="sm">
            <DialogTitle>{incoming.name}</DialogTitle>
            <DialogContent dividers>
                {!base ? (
                    <Typography sx={{ mb: 1 }}>
                        {tr('Personagem novo na mesa. Publicar faz ele aparecer para todos — na Ficha Virtual, na Iniciativa e na Transformação.', 'New character at the table. Publishing makes them show up for everyone — in the Virtual Sheet, Initiative and Transformation.')}</Typography>
                ) : alreadyPublished ? (
                    <Typography sx={{ mb: 1 }}>{tr('Igual a ', 'Same as ')}{baseLabel}{tr('. Não há o que atualizar.', '. There\'s nothing to update.')}</Typography>
                ) : diff?.identical ? (
                    <Typography sx={{ mb: 1 }}>
                        {tr('Igual a ', 'Same as ')}{baseLabel}{tr(', que ainda não está no banco da mesa. Publicar guarda a ficha lá, sempre disponível.', ', which isn\'t in the table\'s database yet. Publishing stores the sheet there, always available.')}</Typography>
                ) : (
                    <>
                        <Typography sx={{ mb: 1.5 }}>
                            {tr('Comparado com ', 'Compared with ')}{baseLabel}:
                        </Typography>
                        {diff && diff.levelFrom !== diff.levelTo && (
                            <Chip
                                label={tr(`Nível ${diff.levelFrom} → ${diff.levelTo}`, `Level ${diff.levelFrom} → ${diff.levelTo}`)}
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
                                    {tr('Talentos, magias e itens são os mesmos; mudaram só números da ficha.', 'Feats, spells and items are the same; only the sheet\'s numbers changed.')}</Typography>
                            )}
                        </Stack>
                    </>
                )}

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {tr('Toda ficha enviada é guardada no banco da mesa. Ao publicar, a ficha passa a valer para toda a mesa e um guia de como jogar é gerado por IA para a versão nova. A versão anterior fica guardada e pode ser restaurada. PV, condições e slots não mudam.', 'Every uploaded sheet is stored in the table\'s database. When you publish, the sheet becomes the one for the whole table and a how-to-play guide is generated by AI for the new version. The previous version is kept and can be restored. HP, conditions and slots don\'t change.')}</Typography>

                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button onClick={onCancel} disabled={busy}>{tr('Cancelar', 'Cancel')}</Button>
                <Button
                    variant="contained"
                    onClick={onPublish}
                    disabled={busy || alreadyPublished}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    {tr('Publicar para a mesa', 'Publish to the table')}</Button>
            </DialogActions>
        </EmbedDialog>
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
            {rest > 0 ? tr(` e mais ${rest}`, ` and ${rest} more`) : ''}
        </Typography>
    )
}
