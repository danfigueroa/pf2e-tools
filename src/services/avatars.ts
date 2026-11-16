// A imagem de cada conta da mesa. A que a pessoa enviou; sem ela, o token da primeira ficha que
// possui (resolvido no servidor, `GET ?avatars=1`); sem nenhuma, o círculo com as iniciais.
// Quem manda é o servidor: aqui só um cache em memória com releitura por assinatura.

import { useEffect, useSyncExternalStore } from 'react'
import { stateApi } from './mesa'
import { TOKEN_MAX_SIDE, deleteImage, shrinkImage, uploadImage } from './images'
import { getAuthState } from './auth'

let avatars: Record<string, string> = {}
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function refreshAvatars(): Promise<void> {
    if (loading) return loading
    loading = (async () => {
        try {
            const res = await fetch(stateApi('?avatars=1'))
            if (!res.ok) return
            const data = await res.json()
            if (data && typeof data.avatars === 'object' && data.avatars) {
                avatars = Object.fromEntries(Object.entries(data.avatars).filter(([, v]) => typeof v === 'string')) as Record<string, string>
                emit()
            }
        } catch { /* sem rede: ficam as iniciais */ } finally {
            loaded = true
            loading = null
        }
    })()
    return loading
}

const subscribe = (cb: () => void) => {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
}

/** A URL da imagem de uma conta (ou `undefined`: use as iniciais). */
export function useAvatarUrl(userId: string | null | undefined): string | undefined {
    useEffect(() => {
        if (!loaded && getAuthState().status === 'in') void refreshAvatars()
    }, [])
    return useSyncExternalStore(subscribe, () => (userId ? avatars[userId] : undefined), () => undefined)
}

async function post(body: Record<string, unknown>): Promise<void> {
    const res = await fetch(stateApi(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === 'string' ? data.error : 'avatar')
    }
}

/** Reduz, sobe e grava a imagem da própria conta. Se o servidor recusar, apaga a que subiu. */
export async function uploadMyAvatar(file: File): Promise<void> {
    const { blob } = await shrinkImage(file, TOKEN_MAX_SIDE, true)
    const url = await uploadImage(blob, 'tokens', 'avatar')
    try {
        await post({ action: 'member-set-avatar', url })
    } catch (e) {
        void deleteImage(url)
        throw e
    }
    await refreshAvatars()
}

/** Volta ao padrão (token da ficha ou iniciais). */
export async function removeMyAvatar(): Promise<void> {
    await post({ action: 'member-set-avatar', url: null })
    await refreshAvatars()
}
