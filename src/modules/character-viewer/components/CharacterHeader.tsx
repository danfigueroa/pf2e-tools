import { Box, Card, CardContent, Stack, Typography, Chip, Button, useTheme, useMediaQuery } from '@mui/material'
import { SwapHoriz as SwapIcon } from '@mui/icons-material'
import { SyncStatus } from './SyncStatus'
import type { BuildInfo } from '../../character-sheet/types'

interface Props {
    build: BuildInfo
    onReset: () => void
}

export const CharacterHeader = ({ build, onReset }: Props) => {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

    return (
        <Card
            sx={{
                mb: 3,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}14 0%, transparent 60%)`,
                borderColor: theme.palette.secondary.main,
                borderTop: `4px solid ${theme.palette.primary.main}`,
            }}
        >
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant={isMobile ? 'h4' : 'h3'}
                            component="h1"
                            sx={{
                                fontWeight: 700,
                                lineHeight: 1.1,
                                letterSpacing: '-0.02em',
                                mb: 0.5,
                                wordBreak: 'break-word',
                            }}
                        >
                            {build.name}
                        </Typography>
                        <Typography
                            variant="body1"
                            color="text.secondary"
                            sx={{ mb: 1.5 }}
                        >
                            {[build.ancestry, build.heritage].filter(Boolean).join(' · ')}
                            {' · '}
                            {build.class}
                            {build.dualClass ? ` / ${build.dualClass}` : ''}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                            <Chip
                                label={`Nível ${build.level}`}
                                color="primary"
                                size="small"
                                sx={{ fontWeight: 600 }}
                            />
                            {build.background && (
                                <Chip label={build.background} size="small" variant="outlined" />
                            )}
                            {build.deity && build.deity !== 'Not set' && (
                                <Chip label={build.deity} size="small" variant="outlined" />
                            )}
                            {build.alignment && (
                                <Chip label={build.alignment} size="small" variant="outlined" />
                            )}
                            {build.sizeName && (
                                <Chip label={build.sizeName} size="small" variant="outlined" />
                            )}
                        </Stack>
                    </Box>
                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        useFlexGap
                        sx={{ flexWrap: 'wrap', gap: 1, flexShrink: 0 }}
                    >
                        <SyncStatus build={build} />
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<SwapIcon />}
                            onClick={onReset}
                            sx={{ flexShrink: 0 }}
                        >
                            Trocar ficha
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    )
}
