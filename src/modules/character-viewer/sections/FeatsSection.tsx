import { Box, Card, CardContent, Stack, Typography, Chip } from '@mui/material'
import { ChevronRight as ChevronIcon } from '@mui/icons-material'
import { useMemo } from 'react'
import { parseFeatEntry, type BuildInfo } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
}

export const FeatsSection = ({ build, onSelect }: Props) => {
    const grouped = useMemo(() => {
        const map: Record<string, Array<{ name: string; level: number }>> = {}
        for (const entry of build.feats || []) {
            const { name, type, level } = parseFeatEntry(entry)
            if (!map[type]) map[type] = []
            map[type].push({ name, level })
        }
        return map
    }, [build.feats])

    if (Object.keys(grouped).length === 0) {
        return (
            <Card>
                <CardContent>
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Sem talentos registrados.
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Stack spacing={2}>
            {Object.entries(grouped).map(([type, feats]) => (
                <Card key={type}>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                        <Box sx={{
                            px: 2, py: 1.25,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: 'background.paper',
                        }}>
                            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: '0.06em', color: 'primary.light' }}>
                                {type}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                ({feats.length})
                            </Typography>
                        </Box>
                        {feats.map((f, idx) => (
                            <FeatRow
                                key={`${f.name}-${idx}`}
                                name={f.name}
                                level={f.level}
                                onClick={() => onSelect({ type: 'feat', name: f.name, level: f.level })}
                            />
                        ))}
                    </CardContent>
                </Card>
            ))}
        </Stack>
    )
}

const FeatRow = ({ name, level, onClick }: { name: string; level: number; onClick: () => void }) => (
    <Box
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            cursor: 'pointer',
            borderBottom: '1px solid',
            borderColor: 'divider',
            transition: 'background-color 0.15s',
            '&:last-of-type': { borderBottom: 'none' },
            '&:hover': { backgroundColor: 'action.hover' },
            '&:focus-visible': { backgroundColor: 'action.focus', outline: 'none' },
        }}
    >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            {/* Cortar com reticências escondia justamente o fim do nome do
                talento no celular; melhor deixar quebrar em duas linhas. */}
            <Typography sx={{ fontWeight: 500, minWidth: 0 }}>
                {name}
            </Typography>
            <Chip label={`Nv ${level}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }} />
        </Stack>
        <ChevronIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1, flexShrink: 0 }} />
    </Box>
)
