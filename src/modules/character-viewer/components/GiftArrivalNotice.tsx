import { useEffect, useState } from 'react'
import { Snackbar } from '@mui/material'
import type { BuildInfo } from '../../../pathbuilder/types'
import { charSlug } from '../charId'
import { onArrival, trackIncoming } from '../../../services/gifts'
import { useRoster } from '../useRoster'

/** "Fulano te enviou 2× Healing Potion" — aparece em qualquer aba da ficha. */
export const GiftArrivalNotice = ({ build }: { build: BuildInfo }) => {
    const me = charSlug(build)
    const roster = useRoster()
    const [text, setText] = useState<string | null>(null)

    useEffect(() => { trackIncoming(me) }, [me])
    useEffect(() => onArrival((list) => {
        // Quem não está na lista (ficha só neste aparelho): o slug com cara de nome.
        const label = (slug: string) => roster.find((r) => r.slug === slug)?.label
            ?? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        setText(list.map((a) => `${label(a.from)} te enviou ${a.n}× ${a.name}`).join(' · '))
    }), [roster])

    return (
        <Snackbar
            open={!!text}
            autoHideDuration={8000}
            onClose={(_, reason) => { if (reason !== 'clickaway') setText(null) }}
            message={text}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        />
    )
}
