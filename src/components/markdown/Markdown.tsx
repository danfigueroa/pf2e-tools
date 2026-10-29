import { memo, useMemo, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Box, Button, IconButton, Link, Typography } from '@mui/material'
import { Campaign as ShareIcon } from '@mui/icons-material'
import { displayFont, gold, green, ink, parchment, rule } from '../../theme'
import { useImageUrl } from '../../services/images'
import { splitSegments, WIKI_HREF, withWikiLinks } from './blocks'

// Markdown do Diário de Campanha e do cartão do que o GM mostra à mesa.
//
// `react-markdown` + `remark-gfm` (tabelas, riscado, listas de tarefa), sem HTML
// cru — o padrão seguro da biblioteca. Pesa ~40 kB gzip: só entra nos chunks do
// diário e do cartão, NUNCA no principal (confira a lista do `npm run build`).
//
// As duas marcas do diário (`:::jogadores` e `[[Nome]]`) são resolvidas antes,
// em `blocks.ts`. Toda imagem passa pelo `useImageUrl` (`idb:` sem Supabase,
// URL antiga do Blob), como o resto do app.

interface Props {
    source: string
    /** Mostra o botão "Mostrar à mesa" em cada trecho `:::jogadores`. */
    onShareBlock?: (title: string, text: string) => void
    /** Mostra o botão de mostrar cada imagem à mesa. */
    onShareImage?: (url: string, alt: string) => void
    /** Tocar num `[[Nome]]`. Sem ele, o nome sai como texto. */
    onWikiLink?: (name: string) => void
    /** Nomes que existem no catálogo (sem caixa); os outros saem como "criar". */
    knownNames?: ReadonlySet<string>
    /** Corpo mais compacto (cartão da mesa). */
    dense?: boolean
}

/** `idb:` (imagem só deste aparelho, sem Supabase) é nosso; o resto passa pela limpeza padrão. */
const urlTransform = (url: string) => (url.startsWith('idb:') ? url : defaultUrlTransform(url))

function MdImage({ src, alt, onShare }: { src: string; alt: string; onShare?: (url: string, alt: string) => void }) {
    const url = useImageUrl(src)
    if (!url) return null
    return (
        <Box component="span" sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%', my: 0.5 }}>
            <Box
                component="img"
                src={url}
                alt={alt}
                loading="lazy"
                sx={{ display: 'block', maxWidth: '100%', maxHeight: 480, borderRadius: 1, border: `1px solid ${rule}` }}
            />
            {onShare && (
                <IconButton
                    size="small"
                    aria-label={`Mostrar à mesa: ${alt || 'imagem'}`}
                    title="Mostrar à mesa"
                    onClick={() => onShare(src, alt)}
                    sx={{
                        position: 'absolute', top: 6, right: 6, bgcolor: green.main, color: gold.bright,
                        '&:hover': { bgcolor: green.mid },
                    }}
                >
                    <ShareIcon fontSize="small" />
                </IconButton>
            )}
        </Box>
    )
}

function useComponents({ onShareImage, onWikiLink, knownNames }: Props): Components {
    return useMemo<Components>(() => ({
        a: ({ href, children }) => {
            if (href?.startsWith(WIKI_HREF)) {
                const name = decodeURIComponent(href.slice(WIKI_HREF.length))
                if (!onWikiLink) return <strong>{children}</strong>
                const known = !knownNames || knownNames.has(name.toLowerCase())
                return (
                    <Link
                        component="button"
                        type="button"
                        onClick={() => onWikiLink(name)}
                        title={known ? `Abrir ${name}` : `Criar a ficha de ${name}`}
                        sx={{
                            font: 'inherit', verticalAlign: 'baseline', fontWeight: 600,
                            color: known ? green.mid : gold.deep,
                            textDecorationStyle: known ? 'solid' : 'dashed',
                        }}
                    >
                        {children}
                    </Link>
                )
            }
            return <Link href={href} target="_blank" rel="noopener noreferrer">{children}</Link>
        },
        img: ({ src, alt }) => (typeof src === 'string' && src
            ? <MdImage src={src} alt={alt ?? ''} onShare={onShareImage} />
            : null),
    }), [onShareImage, onWikiLink, knownNames])
}

const bodySx = (dense: boolean) => ({
    color: ink.primary,
    fontSize: dense ? '0.95rem' : '1rem',
    lineHeight: 1.6,
    overflowWrap: 'anywhere' as const,
    '& > :first-of-type': { mt: 0 },
    '& > :last-child': { mb: 0 },
    '& h1, & h2, & h3, & h4': {
        fontFamily: displayFont, color: green.main, lineHeight: 1.25, mt: 2.5, mb: 1,
    },
    '& h1': { fontSize: '1.5rem', borderBottom: `2px solid ${gold.main}`, pb: 0.5 },
    '& h2': { fontSize: '1.25rem', borderBottom: `1px solid ${rule}`, pb: 0.25 },
    '& h3': { fontSize: '1.1rem' },
    '& h4': { fontSize: '1rem' },
    '& p': { my: 1 },
    '& ul, & ol': { pl: 3, my: 1 },
    '& li': { my: 0.25 },
    '& li > input[type=checkbox]': { mr: 1 },
    '& blockquote': {
        m: 0, my: 1.5, px: 2, py: 0.5, borderLeft: `3px solid ${gold.main}`, bgcolor: parchment.page,
        fontStyle: 'italic', color: ink.secondary,
    },
    '& code': { fontFamily: 'monospace', fontSize: '0.9em', bgcolor: parchment.sunken, px: 0.5, borderRadius: 0.5 },
    '& pre': { bgcolor: parchment.sunken, p: 1.5, borderRadius: 1, overflowX: 'auto' },
    '& pre code': { bgcolor: 'transparent', p: 0 },
    '& hr': { border: 0, borderTop: `1px solid ${rule}`, my: 2 },
    '& table': { borderCollapse: 'collapse', my: 1.5, display: 'block', overflowX: 'auto', maxWidth: '100%' },
    '& th, & td': { border: `1px solid ${rule}`, px: 1, py: 0.5, textAlign: 'left', verticalAlign: 'top' },
    '& th': { bgcolor: parchment.page, fontWeight: 700 },
})

function PlayersBlock({ title, children, onShare }: { title: string; children: ReactNode; onShare?: () => void }) {
    return (
        <Box
            component="section"
            aria-label={title ? `Para os jogadores: ${title}` : 'Para os jogadores'}
            sx={{
                my: 2, border: `1px solid ${gold.main}`, borderLeft: `4px solid ${gold.main}`, borderRadius: 1,
                bgcolor: parchment.page, overflow: 'hidden',
            }}
        >
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', px: 1.5, py: 0.5,
                borderBottom: `1px solid ${rule}`, bgcolor: parchment.sunken,
            }}>
                <Typography variant="caption" sx={{ color: gold.deep, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Para os jogadores
                </Typography>
                {title && <Typography variant="body2" sx={{ fontWeight: 600, color: ink.primary, minWidth: 0 }}>{title}</Typography>}
                {onShare && (
                    <Button
                        size="small"
                        startIcon={<ShareIcon />}
                        onClick={onShare}
                        sx={{ ml: 'auto', color: green.mid }}
                    >
                        Mostrar à mesa
                    </Button>
                )}
            </Box>
            <Box sx={{ px: 2, py: 1 }}>{children}</Box>
        </Box>
    )
}

export const Markdown = memo(function Markdown(props: Props) {
    const { source, onShareBlock, dense = false } = props
    const components = useComponents(props)
    const segments = useMemo(() => splitSegments(source), [source])
    const render = (text: string) => (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
            {withWikiLinks(text)}
        </ReactMarkdown>
    )
    return (
        <Box sx={bodySx(dense)}>
            {segments.map((seg, i) => (seg.kind === 'players'
                ? (
                    <PlayersBlock
                        key={i}
                        title={seg.title ?? ''}
                        onShare={onShareBlock ? () => onShareBlock(seg.title ?? '', seg.text) : undefined}
                    >
                        {render(seg.text)}
                    </PlayersBlock>
                )
                : <Box key={i}>{render(seg.text)}</Box>))}
        </Box>
    )
})
