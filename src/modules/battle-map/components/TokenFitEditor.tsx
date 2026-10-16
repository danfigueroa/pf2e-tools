import { useImageUrl } from '../../../services/images'
import { writeMapField, type MapData } from '../../../services/maps'
import { isDefaultFit, type TokenFit } from '../tokenFit'
import type { TokenView } from './MapCanvas'
import { TokenFitDialog } from './TokenFitDialog'

interface Props {
    mapId: string
    tokenId: string
    data: MapData
    views: Map<string, TokenView>
    onClose: () => void
}

/**
 * Liga o diálogo de enquadramento ao mapa: acha a imagem e as cópias do token e
 * grava o `fit:<id>`. O padrão (centro, sem ampliação) APAGA o campo — o token
 * volta a ser o de sempre e o mapa não guarda número à toa.
 */
export const TokenFitEditor = ({ mapId, tokenId, data, views, onClose }: Props) => {
    const view = views.get(tokenId)
    const token = data.tokens[tokenId]
    const src = useImageUrl(view?.image)
    if (!view || !token || !view.image || !src) return null

    const copies = [...views.values()].filter((v) => v.id !== tokenId && v.image === view.image).map((v) => v.id)

    const save = (fit: TokenFit, applyToCopies: boolean) => {
        const value = isDefaultFit(fit) ? null : fit
        for (const id of applyToCopies ? [tokenId, ...copies] : [tokenId]) {
            writeMapField(mapId, `fit:${id}`, value)
        }
        onClose()
    }

    return (
        <TokenFitDialog
            name={token.name}
            src={src}
            initial={view.fit}
            copies={copies.length}
            pc={token.kind === 'pc'}
            onSave={save}
            onClose={onClose}
        />
    )
}
