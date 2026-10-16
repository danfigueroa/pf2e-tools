import { ButtonBase, type SxProps, type Theme } from '@mui/material'

/**
 * Torna um número da ficha tocável para rolar. O número continua sendo o
 * conteúdo — o gatilho é a área inteira, com alvo de toque grande, foco
 * visível e um nome para leitor de tela ("Rolar Fortitude").
 */
export const RollTrigger = ({ label, onClick, children, sx }: {
    label: string
    onClick: () => void
    children: React.ReactNode
    sx?: SxProps<Theme>
}) => (
    <ButtonBase
        onClick={onClick}
        aria-label={`Rolar ${label}`}
        title={`Rolar ${label}`}
        focusRipple
        sx={[
            {
                display: 'block',
                width: '100%',
                textAlign: 'inherit',
                font: 'inherit',
                color: 'inherit',
                borderRadius: 1,
                minHeight: 40,
                transition: 'background-color 150ms',
                '&:hover': { backgroundColor: 'action.hover' },
                '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
            },
            ...(Array.isArray(sx) ? sx : [sx]),
        ]}
    >
        {children}
    </ButtonBase>
)
