import { memo, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Box, Button, IconButton, Link, Typography } from '@mui/material'
import { Campaign as ShareIcon, VisibilityOff as SecretIcon } from '@mui/icons-material'
import { bodyFont, bodySerif, chrome, displayFont, gold, green, ink, parchment, rule, greenInk, status } from '../../theme'
import { useImageUrl } from '../../services/images'
import { alignAtEnd, firstParagraphLine, headingSlug, linkName, splitAlign, splitSegments, WIKI_HREF, withWikiLinks, type TextAlign } from './blocks'
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
    /** Sobre a moldura verde (o cartão escuro da Wiki): tinta clara no texto e nos links. */
    onDark?: boolean
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

function useComponents({ onShareImage, onWikiLink, knownNames, resolveLink, article = false, onDark = false }: Props): Components {
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
                        sx={onDark || article
                            ? {
                                font: 'inherit', verticalAlign: 'baseline', textAlign: 'inherit', textUnderlineOffset: '4px',
                                fontWeight: known ? 700 : 600,
                                color: onDark ? chrome.text : known ? gold.deep : 'inherit',
                                textDecorationLine: 'underline',
                                textDecorationStyle: known ? 'solid' : 'dashed',
                                textDecorationThickness: known ? '2px' : '1px',
                                textDecorationColor: known ? gold.bright : onDark ? chrome.linkMissing : status.error,
                            }
                            : {
                                font: 'inherit', verticalAlign: 'baseline', fontWeight: 600,
                                color: known ? greenInk.mid : gold.deep,
                                textDecorationStyle: known ? 'solid' : 'dashed',
                            }}
                    >
                        {children}
                        {where === 'wiki' && (
                            <Box component="sup" sx={{ ml: 0.25, fontSize: '0.65em', fontWeight: 700, color: onDark ? gold.bright : gold.deep, letterSpacing: 0.3 }}>
                                {tr('Wiki', 'Wiki')}</Box>
                        )}
                    </Link>
                )
            }
            return <Link href={href} target="_blank" rel="noopener noreferrer">{children}</Link>
        },
        // Na Wiki, a última linha da citação que começa com travessão é a assinatura ("— Fianara").
        ...(article ? {
            blockquote: ({ children }) => {
                const kids = (Array.isArray(children) ? children : [children]).filter((c) => !(typeof c === 'string' && !c.trim()))
                const last = kids[kids.length - 1]
                const sign = kids.length > 1 && /^\s*(—|--)\s*/.test(textOf(last)) ? textOf(last).replace(/^\s*(—|--)\s*/, '') : null
                return (
                    <Box component="figure">
                        <blockquote>{sign ? kids.slice(0, -1) : children}</blockquote>
                        {sign && (
                            <Box component="figcaption" sx={{ mt: 1.5, fontFamily: bodyFont, fontSize: '0.875rem', fontWeight: 600, letterSpacing: 0.5, color: gold.deep }}>
                                — {sign}</Box>
                        )}
                    </Box>
                )
            },
        } : {}),
        h2: ({ children }) => <h2 id={headingSlug(textOf(children))}>{children}</h2>,
        h3: ({ children }) => <h3 id={headingSlug(textOf(children))}>{children}</h3>,
        img: ({ src, alt }) => (typeof src === 'string' && src
            ? <MdImage src={src} alt={alt ?? ''} onShare={onShareImage} />
            : null),
    }), [onShareImage, onWikiLink, knownNames, resolveLink, article, onDark])
}

const bodySx = (dense: boolean, justify: boolean, dropCap: boolean, article: boolean, onDark = false) => ({
    color: onDark ? chrome.text : ink.primary,
    fontSize: dense ? '0.95rem' : article ? '1.2rem' : '1rem',
    lineHeight: article ? 1.65 : 1.6,
    ...(article ? { fontFamily: bodySerif } : {}),
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
            scrollMarginTop: { xs: '132px', md: '80px' },
            '&::before': { content: '""', width: 10, height: 10, transform: 'rotate(45deg)', bgcolor: gold.bright, flex: 'none' },
            '&::after': { content: '""', flex: 1, height: '1px', backgroundImage: `linear-gradient(90deg, ${gold.bright}, transparent)` },
        },
        '& h3': { fontSize: '1.3rem', scrollMarginTop: { xs: '132px', md: '80px' } },
        '& figure': {
            position: 'relative', borderRadius: 2.5, bgcolor: parchment.sunken, py: 2.5, pr: 3, pl: { xs: 6, sm: 8 }, my: 2.5, mx: 0,
            '&::before': {
                content: '"\\201C"', position: 'absolute', left: { xs: 12, sm: 20 }, top: 0, fontFamily: displayFont, fontWeight: 700,
                fontSize: '4.5rem', lineHeight: 1, color: gold.bright,
            },
        },
        '& figure > blockquote': {
            m: 0, p: 0, border: 0, bgcolor: 'transparent', fontSize: '1.1em', lineHeight: 1.55, fontStyle: 'italic', color: ink.primary,
        },
    } : {}),
    ...(justify ? { '& p, & li, & blockquote': { textAlign: 'justify', hyphens: 'auto' as const } } : {}),
    ...(dropCap ? {
        '& p.md-dropcap::first-letter': {
            float: 'left', fontFamily: displayFont, fontWeight: 700, fontSize: '3.7em', lineHeight: 0.82,
            pr: '0.12em', pt: '0.1em', color: gold.deep,
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
function GmBlock({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
    return (
        <Box
            component="aside"
            id={id}
            aria-label={title ? tr(`Trecho do mestre: ${title}`, `GM-only part: ${title}`) : tr('Trecho do mestre', 'GM-only part')}
            sx={{
                my: 2.5, px: 2.5, py: 2, borderRadius: 2.25, border: `1.5px dashed ${gold.main}`, scrollMarginTop: { xs: '132px', md: '80px' },
                backgroundImage: `repeating-linear-gradient(135deg, ${parchment.paper} 0 12px, ${parchment.page} 12px 24px)`,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1, fontFamily: bodyFont }}>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.75rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: gold.deep }}>
                    <SecretIcon sx={{ fontSize: 16 }} />{tr('Trecho do mestre', 'GM-only part')}{title ? ` · ${title}` : ''}</Box>
                <Box component="span" sx={{ fontSize: '0.8rem', color: ink.secondary }}>{tr('Os jogadores não veem este bloco', 'Players don\'t see this block')}</Box>
            </Box>
            <Box sx={{ '& > div > div > :first-of-type': { mt: 0 } }}>{children}</Box>
        </Box>
    )
}

export const Markdown = memo(function Markdown(props: Props) {
    const { source, onShareBlock, dense = false, justify = false, dropCap = false, article = false, onDark = false } = props
    const components = useComponents(props)
    const segments = useMemo(() => splitSegments(source), [source])
    // A âncora de cada trecho do mestre (`mestre-1`…), a mesma do sumário (`headingsOf`).
    const gmIndex = useMemo(() => {
        const m = new Map<number, number>()
        segments.forEach((seg, i) => { if (seg.kind === 'gm') m.set(i, m.size + 1) })
        return m
    }, [segments])
    // O alinhamento em vigor segue de um trecho ao outro (uma marca `::centro` vale depois dos blocos).
    let running: TextAlign | null = null
    // A capitular vai no primeiro parágrafo de texto corrido da página (não na citação nem no título).
    let capPending = dropCap
    const render = (text: string, plain = true) => {
        const parts = splitAlign(text, running)
        running = alignAtEnd(text, running)
        return parts.map((part, i) => {
            const line = capPending && plain && (!part.align || part.align === 'justify' || part.align === 'left') ? firstParagraphLine(withWikiLinks(part.text)) : null
            if (line !== null) capPending = false
            return (
            <Box key={i} sx={part.align ? alignSx(part.align) : undefined}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={line === null ? components : { ...components, p: ({ node, children }) => <p className={node?.position?.start.line === line ? 'md-dropcap' : undefined}>{children}</p> }}
                    urlTransform={urlTransform}
                >
                    {withWikiLinks(part.text)}
                </ReactMarkdown>
            </Box>
            )
        })
    }
    return (
        <Box sx={bodySx(dense, justify, dropCap, article, onDark)}>
            {segments.map((seg, i) => (seg.kind === 'gm'
                ? <GmBlock key={i} id={`mestre-${gmIndex.get(i)}`} title={seg.title ?? ''}>{render(seg.text, false)}</GmBlock>
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
