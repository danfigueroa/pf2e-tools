import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { isOwnRoll, useTableShares } from '../services/rolls'
import { isRuleShare, sanitizeTableShare, type TableShare } from '../services/tableShare'

// Regras compartilhadas com a mesa (`services/tableShare.ts`), em qualquer
// página — montado UMA vez no `MainLayout`, como o feed de rolagens.
//
// Um cartão por vez: o compartilhamento novo substitui o anterior, e o cartão
// só sai pelo × (ler uma regra e discutir leva bem mais que os 30 s de uma
// rolagem). Mesma regra de "já visto" do feed: o que estava na mesa ao abrir o
// app não aparece, e o que saiu deste aparelho também não — quem compartilhou
// já está com a descrição aberta.

const loadCard = () => import('./SharedRuleCard')
const SharedRuleCard = lazy(loadCard)
// O que o GM mostra pelo Diário de Campanha: cartão próprio (traz o Markdown, ~40 kB gzip).
const loadHandout = () => import('./HandoutCard')
const HandoutCard = lazy(loadHandout)

/**
 * Baixa o cartão com o app ocioso (~18 kB gzip; na Ficha Virtual quase tudo já
 * veio com o drawer). Sem isso, o primeiro compartilhamento da sessão esperava
 * o código chegar e só DEPOIS começava a ler os pacotes de descrições.
 */
function prefetchCard() {
    const run = () => {
        void loadCard().catch(() => { /* o lazy tenta de novo quando precisar */ })
        void loadHandout().catch(() => {})
    }
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 5000 })
    else setTimeout(run, 2000)
}

export const SharedRuleLayer = memo(function SharedRuleLayer() {
    const { shares, ready } = useTableShares()
    const seen = useRef<Set<string> | null>(null)
    const [shown, setShown] = useState<TableShare | null>(null)

    useEffect(() => {
        if (ready) prefetchCard()
    }, [ready])

    // A notificação de regra compartilhada (o sino) reabre o cartão — já fechado, ou de quando o app estava fechado.
    useEffect(() => {
        const reopen = (e: Event) => {
            const share = sanitizeTableShare((e as CustomEvent).detail)
            if (share) setShown(share)
        }
        window.addEventListener('pf2e:show-share', reopen)
        return () => window.removeEventListener('pf2e:show-share', reopen)
    }, [])

    useEffect(() => {
        if (!ready) return
        if (seen.current === null) {
            seen.current = new Set(shares.map((s) => s.id))
            return
        }
        // A lista vem com o mais novo primeiro.
        const fresh = shares.find((s) => !seen.current!.has(s.id) && !isOwnRoll(s.id))
        shares.forEach((s) => seen.current!.add(s.id))
        if (fresh) setShown(fresh)
    }, [shares, ready])

    if (!shown) return null
    return (
        <Suspense fallback={null}>
            {isRuleShare(shown)
                ? <SharedRuleCard key={shown.id} share={shown} onClose={() => setShown(null)} />
                : <HandoutCard key={shown.id} share={shown} onClose={() => setShown(null)} />}
            <Box
                role="status"
                sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' }}
            >
                {isRuleShare(shown) ? `${shown.by || 'Alguém'} compartilhou ${shown.name}` : `${shown.by || 'O GM'} mostrou à mesa: ${shown.name}`}
            </Box>
        </Suspense>
    )
})
