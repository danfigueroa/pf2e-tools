import { Box, Stack, Typography, useTheme } from '@mui/material'
import type { ReactNode } from 'react'

// Renderizador de markdown mínimo, só o suficiente para os guias de combate:
// títulos "## ", listas "- ", parágrafos e **negrito** inline.

interface Props { markdown: string }

// Divide um texto em nós React tratando **negrito**.
function renderInline(text: string): ReactNode[] {
    const nodes: ReactNode[] = []
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    parts.forEach((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
            nodes.push(
                <Box component="strong" key={i} sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {part.slice(2, -2)}
                </Box>,
            )
        } else if (part) {
            nodes.push(<span key={i}>{part}</span>)
        }
    })
    return nodes
}

export const GuideMarkdown = ({ markdown }: Props) => {
    const theme = useTheme()
    const lines = markdown.replace(/\r\n/g, '\n').split('\n')

    const blocks: ReactNode[] = []
    let bullets: string[] = []
    let key = 0

    const flushBullets = () => {
        if (bullets.length === 0) return
        const items = bullets
        bullets = []
        blocks.push(
            <Stack key={`ul-${key++}`} spacing={0.75} sx={{ mb: 1.5 }}>
                {items.map((b, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Box sx={{ color: 'primary.light', lineHeight: 1.6, userSelect: 'none' }}>•</Box>
                        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                            {renderInline(b)}
                        </Typography>
                    </Box>
                ))}
            </Stack>,
        )
    }

    for (const raw of lines) {
        const line = raw.trimEnd()
        const trimmed = line.trim()

        if (!trimmed) { flushBullets(); continue }

        const heading = trimmed.match(/^#{1,3}\s+(.*)$/)
        if (heading) {
            flushBullets()
            blocks.push(
                <Typography
                    key={`h-${key++}`}
                    variant="subtitle1"
                    sx={{
                        fontWeight: 800,
                        color: 'primary.light',
                        mt: blocks.length ? 2.25 : 0,
                        mb: 1,
                        letterSpacing: '0.01em',
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        pb: 0.5,
                    }}
                >
                    {renderInline(heading[1])}
                </Typography>,
            )
            continue
        }

        const bullet = trimmed.match(/^[-*]\s+(.*)$/)
        if (bullet) { bullets.push(bullet[1]); continue }

        flushBullets()
        blocks.push(
            <Typography key={`p-${key++}`} variant="body2" sx={{ mb: 1.25, lineHeight: 1.6 }}>
                {renderInline(trimmed)}
            </Typography>,
        )
    }
    flushBullets()

    return <Box>{blocks}</Box>
}
