import { memo, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Box, Button, IconButton, Link, Typography } from '@mui/material'
import { Campaign as ShareIcon, VisibilityOff as SecretIcon } from '@mui/icons-material'
import { bodySerif, displayFont, gold, green, ink, parchment, rule, greenInk } from '../../theme'
import { useImageUrl } from '../../services/images'
import { alignAtEnd, headingSlug, linkName, splitAlign, splitSegments, WIKI_HREF, withWikiLinks, type TextAlign } from './blocks'
import { ImageLightbox } from '../ImageLightbox'
import { tr } from '../../i18n'

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
    /**
     * Para onde um `[[Nome]]` aponta (vence o `knownNames`): `known` no próprio lugar, `wiki` numa
     * página da Wiki (ganha o selo "Wiki"), `missing` ainda não existe ("criar").
     */
    resolveLink?: (name: string) => 'known' | 'wiki' | 'missing'
    /** Corpo mais compacto (cartão da mesa). */
    dense?: boolean
    /** Parágrafos justificados nas duas margens (o padrão da Wiki); `::centro` etc. mudam o trecho. */
    justify?: boolean
    /** Primeira letra grande no primeiro parágrafo (a página da Wiki). */
    dropCap?: boolean
    /** O visual de artigo da Wiki: serifa, títulos com losango e filete dourado, citação em destaque. */
    article?: boolean
}

/** O texto puro de um filho do React (para a âncora do título). */
const textOf = (node: ReactNode): string => {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(textOf).join('')
    if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: ReactNode } }).props.children)
    return ''
}

/** `idb:` (imagem só deste aparelho, sem Supabase) é nosso; o resto passa pela limpeza padrão. */
const urlTransform = (url: string) => (url.startsWith('idb:') ? url : defaultUrlTransform(url))

function MdImage({ src, alt, onShare }: { src: string; alt: string; onShare?: (url: string, alt: string) => void }) {
    const url = useImageUrl(src)
    const [open, setOpen] = useState(false)
    if (!url) return null
    return (
        <Box component="span" sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%', my: 0.5 }}>
            <Box
                component="img"
                src={url}
                alt={alt}
                loading="lazy"
                role="button"
                tabIndex={0}
                title={tr('Ampliar', 'Enlarge')}
                onClick={() => setOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
                sx={{ display: 'block', maxWidth: '100%', maxHeight: 480, borderRadius: 1, border: `1px solid ${rule}`, cursor: 'zoom-in' }}
            />
            {onShare && (
                <IconButton
                    size="small"
                    aria-label={tr(`Mostrar à mesa: ${alt || 'imagem'}`, `Show the table: ${alt || 'image'}`)}
                    title={tr("Mostrar à mesa", 'Show the table')}
                    onClick={() => onShare(src, alt)}
                    sx={{
                        position: 'absolute', top: 6, right: 6, bgcolor: green.main, color: gold.bright,
                        '&:hover': { bgcolor: green.mid },
                    }}
                >
                    <ShareIcon fontSize="small" />
                </IconButton>
            )}
            {open && (
                <ImageLightbox
                    src={url}
                    title={alt || tr('Imagem', 'Image')}
                    onClose={() => setOpen(false)}
                    onShow={onShare ? () => { onShare(src, alt); setOpen(false) } : undefined}
                />
            )}
        </Box>
    )
}

function useComponents({ onShareImage, onWikiLink, knownNames, resolveLink }: Props): Components {
    return useMemo<Components>(() => ({
        a: ({ href, children }) => {
            if (href?.startsWith(WIKI_HREF)) {
                const target = decodeURIComponent(href.slice(WIKI_HREF.length))
                const name = linkName(target)
                if (!onWikiLink) return <strong>{children}</strong>
                const where = resolveLink
                    ? resolveLink(target)
                    : !knownNames || knownNames.has(target.toLowerCase()) ? 'known' : 'missing'
                const known = where !== 'missing'
                return (
                    <Link
                        component="button"
                        type="button"
                        onClick={() => onWikiLink(target)}
                        title={known ? tr(`Abrir ${name}`, `Open ${name}`) : tr(`Criar a página de ${name}`, `Create ${name}'s page`)}
                        sx={{
                            font: 'inherit', verticalAlign: 'baseline', fontWeight: 600,
                            color: known ? greenInk.mid : gold.deep,
                            textDecorationStyle: known ? 'solid' : 'dashed',
                        }}
                    >
                        {children}
                        {where === 'wiki' && (
                            <Box component="sup" sx={{ ml: 0.25, fontSize: '0.65em', fontWeight: 700, color: gold.deep, letterSpacing: 0.3 }}>
                                {tr('Wiki', 'Wiki')}</Box>
                        )}
                    </Link>
                )
            }
            return <Link href={href} target="_blank" rel="noopener noreferrer">{children}</Link>
        },
        h2: ({ children }) => <h2 id={headingSlug(textOf(children))}>{children}</h2>,
        h3: ({ children }) => <h3 id={headingSlug(textOf(children))}>{children}</h3>,
        img: ({ src, alt }) => (typeof src === 'string' && src
            ? <MdImage src={src} alt={alt ?? ''} onShare={onShareImage} />
            : null),
    }), [onShareImage, onWikiLink, knownNames, resolveLink])
}

const bodySx = (dense: boolean, justify: boolean, dropCap: boolean, article: boolean) => ({
    color: ink.primary,
    fontSize: dense ? '0.95rem' : article ? '1.2rem' : '1rem',
    lineHeight: article ? 1.65 : 1.6,
    ...(article ? { fontFamily: bodySerif } : {}),
    scrollMarginTop: 80,
    overflowWrap: 'anywhere' as const,
    '& > :first-of-type': { mt: 0 },
    '& > :last-child': { mb: 0 },
    '& h1, & h2, & h3, & h4': {
        fontFamily: displayFont, color: greenInk.main, lineHeight: 1.25, mt: 2.5, mb: 1,
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
    ...(article ? {
        '& h2': {
            display: 'flex', alignItems: 'center', gap: 1.5, fontSize: '1.6rem', fontWeight: 600, border: 0, pb: 0, mt: 4, mb: 1.5,
            scrollMarginTop: '80px',
            '&::before': { content: '""', width: 10, height: 10, transform: 'rotate(45deg)', bgcolor: gold.bright, flex: 'none' },
            '&::after': { content: '""', flex: 1, height: '1px', backgroundImage: `linear-gradient(90deg, ${gold.bright}, transparent)` },
        },
        '& h3': { fontSize: '1.3rem', scrollMarginTop: '80px' },
        '& blockquote': {
            position: 'relative', border: 0, borderRadius: 2.5, bgcolor: parchment.sunken, py: 2.5, pr: 3, pl: 8, my: 2.5,
            fontSize: '1.15em', fontStyle: 'italic', color: ink.primary,
            '&::before': {
                content: '"\\201C"', position: 'absolute', left: 20, top: 0, fontFamily: displayFont, fontWeight: 700,
                fontSize: '4.5rem', lineHeight: 1, color: gold.bright, fontStyle: 'normal',
            },
        },
    } : {}),
    ...(justify ? { '& p, & li, & blockquote': { textAlign: 'justify', hyphens: 'auto' as const } } : {}),
    ...(dropCap ? {
        '& > div:first-of-type > div:first-of-type > p:first-child::first-letter': {
            float: 'left', fontFamily: displayFont, fontWeight: 700, fontSize: '3.4em', lineHeight: 0.85,
            pr: '0.1em', pt: '0.08em', color: gold.deep,
        },
    } : {}),
})

/** Um trecho de alinhamento próprio (`::centro`…): vale para parágrafos, listas e títulos dele. */
const alignSx = (align: TextAlign) => ({
    '& p, & li, & blockquote, & h1, & h2, & h3, & h4': {
        textAlign: align, hyphens: align === 'justify' ? ('auto' as const) : ('manual' as const), // i18n-ok
    },
    ...(align === 'center' ? { '& ul, & ol': { listStylePosition: 'inside', pl: 0 } } : {}),
})

function PlayersBlock({ title, children, onShare }: { title: string; children: ReactNode; onShare?: () => void }) {
    return (
        <Box
            component="section"
            aria-label={title ? tr(`Para os jogadores: ${title}`, `For the players: ${title}`) : tr('Para os jogadores', 'For the players')}
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
                    {tr('Para os jogadores', 'For the players')}</Typography>
                {title && <Typography variant="body2" sx={{ fontWeight: 600, color: ink.primary, minWidth: 0 }}>{title}</Typography>}
                {onShare && (
                    <Button
                        size="small"
                        startIcon={<ShareIcon />}
                        onClick={onShare}
                        sx={{ ml: 'auto', color: greenInk.mid }}
                    >
                        {tr('Mostrar à mesa', 'Show the table')}</Button>
                )}
            </Box>
            <Box sx={{ px: 2, py: 1 }}>{children}</Box>
        </Box>
    )
}

/** O segredo do GM numa página da Wiki: só chega ao GM (o servidor o corta para o jogador). */
function GmBlock({ title, children }: { title: string; children: ReactNode }) {
    return (
        <Box
            component="section"
            aria-label={title ? tr(`Só o mestre vê: ${title}`, `GM only: ${title}`) : tr('Só o mestre vê', 'GM only')}
            sx={{ my: 2, border: `1px dashed ${ink.secondary}`, borderLeft: `4px solid ${ink.secondary}`, borderRadius: 1, bgcolor: parchment.sunken }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', px: 1.5, py: 0.5, borderBottom: `1px dashed ${rule}` }}>
                <SecretIcon sx={{ fontSize: 16, color: ink.secondary }} />
                <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {tr('Só o mestre vê', 'GM only')}</Typography>
                {title && <Typography variant="body2" sx={{ fontWeight: 600, color: ink.primary, minWidth: 0 }}>{title}</Typography>}
            </Box>
            <Box sx={{ px: 2, py: 1 }}>{children}</Box>
        </Box>
    )
}

export const Markdown = memo(function Markdown(props: Props) {
    const { source, onShareBlock, dense = false, justify = false, dropCap = false, article = false } = props
    const components = useComponents(props)
    const segments = useMemo(() => splitSegments(source), [source])
    // O alinhamento em vigor segue de um trecho ao outro (uma marca `::centro` vale depois dos blocos).
    let running: TextAlign | null = null
    const render = (text: string) => {
        const parts = splitAlign(text, running)
        running = alignAtEnd(text, running)
        return parts.map((part, i) => (
            <Box key={i} sx={part.align ? alignSx(part.align) : undefined}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
                    {withWikiLinks(part.text)}
                </ReactMarkdown>
            </Box>
        ))
    }
    return (
        <Box sx={bodySx(dense, justify, dropCap, article)}>
            {segments.map((seg, i) => (seg.kind === 'gm'
                ? <GmBlock key={i} title={seg.title ?? ''}>{render(seg.text)}</GmBlock>
                : seg.kind === 'players'
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
