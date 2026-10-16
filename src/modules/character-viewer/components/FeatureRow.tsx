import { Stack, Typography } from '@mui/material'

/** Uma linha das faixas de classe (Magus, Patrulheiro…): nome à esquerda, controles à direita. */
export const FeatureRow = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Stack direction="row" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 120 }}>{title}</Typography>
        {children}
    </Stack>
)
