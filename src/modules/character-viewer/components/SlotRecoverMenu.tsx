import { ListSubheader, Menu, MenuItem } from '@mui/material'
import { Restore as RestoreIcon } from '@mui/icons-material'

export interface RecoverOption {
    key: string
    label: string
    onPick: () => void
}

interface Props {
    anchor: HTMLElement | null
    onClose: () => void
    title: string
    options: RecoverOption[]
}

/**
 * O menu do "recuperar" no resumo dos slots: um item por slot que dá para devolver. No espontâneo é um só (o
 * slot é do rank); no preparado, um por magia com cópia gasta, porque o slot é a cópia preparada.
 * Recuperar é só desfazer, como tocar no pip gasto: não devolve ação.
 */
export function SlotRecoverMenu({ anchor, onClose, title, options }: Props) {
    return (
        <Menu anchorEl={anchor} open={anchor != null && options.length > 0} onClose={onClose}>
            <ListSubheader sx={{ lineHeight: 2.2, fontSize: '0.75rem' }}>{title}</ListSubheader>
            {options.map((o) => (
                <MenuItem key={o.key} dense onClick={() => { o.onPick(); onClose() }} sx={{ gap: 1 }}>
                    <RestoreIcon fontSize="small" />
                    {o.label}
                </MenuItem>
            ))}
        </Menu>
    )
}
