import { useState } from 'react'
import { Alert, Button, Snackbar } from '@mui/material'
import { gold } from '../../../theme'
import type { BuildInfo, FeatDescription } from '../../character-sheet/types'
import type { ConditionModifiers } from '../conditions'
import { activityOf, costLabel, type ActivityInfo } from '../activities'
import { useActivity } from './useActivity'
import type { MythicPointsApi } from './useMythicPoints'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
    name: string
    /** A descrição em cache; sem ela (ainda não baixada) não há custo para cobrar. */
    desc: FeatDescription | null | undefined
    /** Botão largo, como o "Rolar" do drawer de descrição. */
    fullWidth?: boolean
}

const Body = ({ build, mods, mythicPoints, name, info, fullWidth }: Omit<Props, 'desc'> & { info: ActivityInfo }) => {
    const { activate, uses } = useActivity(build, mods, mythicPoints)
    const [note, setNote] = useState<{ text: string; warn: boolean } | null>(null)
    const usedToday = info.daily && uses.usedOf(name) > 0

    const click = (e: React.MouseEvent) => {
        // A linha inteira abre a descrição: o botão não pode abri-la junto.
        e.stopPropagation()
        if (usedToday) { uses.unmark(name); return }
        const r = activate(name, info)
        const spent = r.spent.length ? `gastou ${r.spent.join(' e ')}` : 'nada a gastar'
        setNote({ text: `${name}: ${spent}${r.warnings.length ? ` — atenção: ${r.warnings.join('; ')}` : ''}.`, warn: r.warnings.length > 0 })
    }

    return (
        <>
            <Button
                size="small"
                variant={usedToday ? 'outlined' : 'contained'}
                onClick={click}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={usedToday ? `${name} já usada hoje — devolver` : `Usar ${name}`}
                title={info.trigger ? `Gatilho: ${info.trigger}` : usedToday ? 'Já usada hoje — toque para devolver' : undefined}
                fullWidth={fullWidth}
                sx={{
                    flexShrink: 0,
                    fontWeight: 700,
                    ...(fullWidth ? { mb: 2, minHeight: 40 } : { minHeight: 30, px: 1.25, fontSize: '0.75rem' }),
                    ...(usedToday ? { color: gold.deep, borderColor: gold.main } : {}),
                }}
            >
                {usedToday ? 'Usada hoje ↺' : `Usar · ${costLabel(info)}`}
            </Button>
            <Snackbar
                open={!!note}
                autoHideDuration={7000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setNote(null) }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {note ? <Alert severity={note.warn ? 'warning' : 'success'} onClose={() => setNote(null)}>{note.text}</Alert> : undefined}
            </Snackbar>
        </>
    )
}

/** O botão "Usar" de um talento/habilidade com custo no turno; nada quando é passivo ou tem caminho próprio. */
export const ActivityButton = ({ desc, ...rest }: Props) => {
    const info = activityOf(rest.name, desc)
    if (!info) return null
    return <Body {...rest} info={info} />
}
