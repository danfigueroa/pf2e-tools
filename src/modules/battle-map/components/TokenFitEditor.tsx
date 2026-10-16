import { useState } from 'react'
import { NPC_TOKEN_MAX_SIDE, deleteImage, imageErrorText, shrinkImage, uploadImage, useImageUrl } from '../../../services/images'
import { writeMapField, type MapData } from '../../../services/maps'
import { DEFAULT_FIT, isDefaultFit, type TokenFit } from '../tokenFit'
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
 * Liga o diálogo de enquadramento ao mapa: acha a imagem e as cópias do token,
 * deixa enviar uma imagem nova (só monstro) e grava o `fit:<id>`. O padrão
 * (centro, sem ampliação, sem imagem própria) APAGA o campo — o token volta a
 * ser o de sempre e o mapa não guarda número à toa.
 *
 * A imagem enviada aqui mora no `fit:` e vale POR CIMA da que a Iniciativa mandou
 * (`tok:`), que continua intacta: "Usar a imagem original" a restaura.
 */
export const TokenFitEditor = ({ mapId, tokenId, data, views, onClose }: Props) => {
    const view = views.get(tokenId)
    const token = data.tokens[tokenId]
    // `undefined` = a imagem não mudou; `null` = voltar à original; texto = a que acabou de subir.
    const [pending, setPending] = useState<string | null | undefined>(undefined)
    // Tudo que subiu nesta sessão: o que não for gravado é apagado do Blob.
    const [uploaded, setUploaded] = useState<string[]>([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const original = token?.image ?? null
    const shownUrl = pending === undefined ? (view?.image ?? null) : (pending ?? original)
    const src = useImageUrl(shownUrl)
    if (!view || !token) return null
    const isNpc = token.kind === 'npc'
    // Sem imagem ainda, o monstro abre o diálogo só para ENVIAR uma; o PC precisa já ter a dele.
    if (!isNpc && (!shownUrl || !src)) return null
    const savedUrl = view.fit.url
    const copies = [...views.values()].filter((v) => v.id !== tokenId && v.image === view.image).map((v) => v.id)

    const upload = async (file: File) => {
        setBusy(true)
        setError(null)
        try {
            // A imagem inteira: o recorte é só o enquadramento, e dá para mudá-lo depois.
            const { blob } = await shrinkImage(file, NPC_TOKEN_MAX_SIDE, false)
            const url = await uploadImage(blob, 'monsters', token.name)
            setUploaded((list) => [...list, url])
            setPending(url)
        } catch (e) {
            setError(imageErrorText(e))
        } finally {
            setBusy(false)
        }
    }

    /** Sai do diálogo; o que subiu e não foi gravado não pode ficar órfão no Blob. */
    const finish = (keep: string | null) => {
        for (const url of uploaded) if (url !== keep) void deleteImage(url)
        onClose()
    }

    const save = (fit: TokenFit, applyToCopies: boolean) => {
        const targets = applyToCopies ? [tokenId, ...copies] : [tokenId]
        const nextUrl = !isNpc ? undefined : pending === undefined ? savedUrl : (pending ?? undefined)
        const value: TokenFit = { x: fit.x, y: fit.y, z: fit.z, ...(nextUrl ? { url: nextUrl } : {}) }
        for (const id of targets) writeMapField(mapId, `fit:${id}`, isDefaultFit(value) ? null : value)

        // A imagem própria que ficou para trás só sai do Blob se ninguém mais a mostra.
        const stillShown = new Set<string>()
        for (const v of views.values()) if (!targets.includes(v.id) && v.image) stillShown.add(v.image)
        if (nextUrl) stillShown.add(nextUrl)
        for (const id of targets) {
            const old = views.get(id)?.fit.url
            if (old && old !== nextUrl && !stillShown.has(old)) void deleteImage(old)
        }
        finish(nextUrl ?? null)
    }

    return (
        <TokenFitDialog
            // Imagem nova = enquadramento novo: o que valia para a outra não vale para esta.
            key={String(pending)}
            name={token.name}
            src={shownUrl && src ? src : null}
            initial={pending === undefined ? view.fit : { ...DEFAULT_FIT }}
            copies={copies.length}
            pc={token.kind === 'pc'}
            onUpload={isNpc ? (file) => { void upload(file) } : undefined}
            uploading={busy}
            uploadError={error}
            onRevert={isNpc && (pending === undefined ? !!savedUrl : pending !== null) ? () => setPending(null) : undefined}
            onSave={save}
            onClose={() => finish(null)}
        />
    )
}
