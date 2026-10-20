import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { isOwnRoll, useTableShares } from '../services/rolls'
import type { TableShare } from '../services/tableShare'

// Regras compartilhadas com a mesa (`services/tableShare.ts`), em qualquer
// página — montado UMA vez no `MainLayout`, como o feed de rolagens.
//
// Um cartão por vez: o compartilhamento novo substitui o anterior, e o cartão
// só sai pelo × (ler uma regra e discutir leva bem mais que os 30 s de uma
// rolagem). Mesma regra de "já visto" do feed: o que estava na mesa ao abrir o
// app não aparece, e o que saiu deste aparelho também não — quem compartilhou
// já está com a descrição aberta.

const SharedRuleCard = lazy(() => import('./SharedRuleCard'))

export const SharedRuleLayer = memo(function SharedRuleLayer() {
    const { shares, ready } = useTableShares()
    const seen = useRef<Set<string> | null>(null)
    const [shown, setShown] = useState<TableShare | null>(null)

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
            <SharedRuleCard key={shown.id} share={shown} onClose={() => setShown(null)} />
            <Box
                role="status"
                sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' }}
            >
                {`${shown.by || 'Alguém'} compartilhou ${shown.name}`}
            </Box>
        </Suspense>
    )
})
