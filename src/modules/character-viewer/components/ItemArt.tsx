import { useRef, useState } from 'react'
import { Box, Button, ButtonBase, CircularProgress, DialogActions, DialogContent, DialogTitle, Snackbar } from '@mui/material'
import { AddPhotoAlternateOutlined as AddPhotoIcon } from '@mui/icons-material'
import { deleteImage, imageErrorText, shrinkImage, uploadImage, useImageUrl } from '../../../services/images'
import { useSheetReadOnly, VIEW_OK } from '../sheetAccess'
import { EmbedDialog } from './EmbedDialog'
import type { ItemArtApi } from './useItemArt'
import { MAX_ITEM_ART } from '../itemArt'
import { tr } from '../../../i18n'

/** Lado máximo da imagem enviada: cabe no diálogo grande sem pesar na lista. A imagem vai INTEIRA, sem recorte. */
const ITEM_ART_MAX_SIDE = 512
const SIZE = 44

interface Props {
    /** O personagem (vai no nome do arquivo, só para quem olha o bucket). */
    slug: string
    /** Nome canônico do item (a chave da imagem). */
    name: string
    /** Como aparece na lista. */
    label: string
    art: ItemArtApi
    /** Alguma linha tem imagem: sem a dela, a ficha somente leitura guarda o espaço para a lista não desalinhar. */
    reserve: boolean
    /** Lado da miniatura (o cartão da relíquia usa uma maior). */
    size?: number
}

/**
 * A miniatura do item na linha do Inventário. Sem imagem, o botão de enviar (só para quem pode editar a ficha);
 * com imagem, tocar abre a imagem grande, com "Trocar" e "Remover". A imagem vem do Storage (`items/`), e o campo
 * `art` da mesa guarda a URL — todo mundo que abre a ficha vê a mesma.
 */
export function ItemArt({ slug, name, label, art, reserve, size = SIZE }: Props) {
    const url = art.artOf(name)
    const src = useImageUrl(url)
    const readOnly = useSheetReadOnly()
    const input = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [open, setOpen] = useState(false)

    const upload = async (file: File) => {
        // Cheio: subir a imagem deixaria um arquivo órfão no bucket (o campo a recusaria).
        if (!url && art.count >= MAX_ITEM_ART) {
            setError(tr(`No máximo ${MAX_ITEM_ART} itens com imagem por ficha. Remova a de outro item.`, `At most ${MAX_ITEM_ART} items with an image per sheet. Remove another item's image.`))
            if (input.current) input.current.value = ''
            return
        }
        setBusy(true)
        setError(null)
        try {
            const { blob } = await shrinkImage(file, ITEM_ART_MAX_SIDE)
            const next = await uploadImage(blob, 'items', `${slug}-${name}`)
            art.setArt(name, next)
            if (url && url !== next) void deleteImage(url)
        } catch (e) {
            setError(imageErrorText(e))
        } finally {
            setBusy(false)
            if (input.current) input.current.value = ''
        }
    }
    const remove = () => {
        art.setArt(name, null)
        if (url) void deleteImage(url)
        setOpen(false)
    }
    const pick = () => input.current?.click()

    if (!url && readOnly) {
        return reserve ? <Box aria-hidden sx={{ width: size, height: size, flexShrink: 0, ml: 2 }} /> : null
    }

    return (
        <>
            <ButtonBase
                onClick={url ? () => setOpen(true) : pick}
                disabled={busy}
                aria-label={url ? tr(`Ver a imagem de ${label}`, `See ${label}'s image`) : tr(`Enviar uma imagem para ${label}`, `Upload an image for ${label}`)}
                title={url ? undefined : tr('Enviar uma imagem do item', 'Upload an image of the item')}
                sx={{
                    width: size, height: size, flexShrink: 0, ml: 2, borderRadius: 1, overflow: 'hidden',
                    border: '1px solid', borderColor: url ? 'divider' : 'transparent',
                    color: 'text.secondary', opacity: url || busy ? 1 : 0.55,
                    backgroundColor: url ? 'background.default' : 'transparent',
                    '&:hover, &:focus-visible': { opacity: 1, borderColor: 'divider' },
                }}
            >
                {busy ? <CircularProgress size={20} />
                    : src ? <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <AddPhotoIcon fontSize="small" />}
            </ButtonBase>
            <input
                ref={input}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }}
            />
            <EmbedDialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ pb: 1 }}>{label}</DialogTitle>
                <DialogContent>
                    {src && (
                        <Box component="img" src={src} alt={label} sx={{ display: 'block', width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 1 }} />
                    )}
                </DialogContent>
                <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
                    {!readOnly && <Button color="error" onClick={remove} sx={{ mr: 'auto' }}>{tr('Remover', 'Remove')}</Button>}
                    {!readOnly && <Button onClick={() => { setOpen(false); pick() }}>{tr('Trocar imagem', 'Change image')}</Button>}
                    <Button variant="contained" onClick={() => setOpen(false)} {...VIEW_OK}>{tr('Fechar', 'Close')}</Button>
                </DialogActions>
            </EmbedDialog>
            <Snackbar
                open={!!error}
                autoHideDuration={10000}
                onClose={() => setError(null)}
                message={error}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </>
    )
}
