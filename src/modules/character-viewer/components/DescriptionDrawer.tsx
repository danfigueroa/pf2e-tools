import { Drawer, useTheme, useMediaQuery } from '@mui/material'
import { DescriptionContent, type DescriptionContentProps, type DescriptionRequest } from './DescriptionContent'
import { drawerEmbedProps, useEmbedContainer } from '../embedContext'

export type { DescriptionRequest, SpellCasterInfo } from './DescriptionContent'

interface Props extends Omit<DescriptionContentProps, 'request'> {
    request: DescriptionRequest | null
}

export const DescriptionDrawer = ({ request, ...rest }: Props) => {
    const theme = useTheme()
    const embed = useEmbedContainer()
    // Embutida num painel estreito, a gaveta sobe de baixo como no celular.
    const isMobile = useMediaQuery(theme.breakpoints.down('md')) || !!embed

    return (
        <Drawer
            {...drawerEmbedProps(embed)}
            anchor={isMobile ? 'bottom' : 'right'}
            open={!!request}
            onClose={rest.onClose}
            PaperProps={{
                sx: embed
                    // Preso ao painel estreito: ocupa a largura dele (os 520 px
                    // do desktop vazavam para fora) e sobe de baixo como no celular.
                    ? {
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        maxHeight: '88%',
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        backgroundImage: 'none',
                    }
                    : {
                        width: { xs: '100%', md: 520 },
                        maxHeight: { xs: '88vh', md: '100%' },
                        borderTopLeftRadius: { xs: 16, md: 0 },
                        borderTopRightRadius: { xs: 16, md: 0 },
                        backgroundImage: 'none',
                    },
            }}
        >
            {request && <DescriptionContent request={request} {...rest} />}
        </Drawer>
    )
}
