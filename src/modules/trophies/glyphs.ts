/* i18n-ignore-file */
// Os glifos gravados no centro da medalha, um por categoria do catálogo (`category` em
// `api/_lib/trophies.js`). Caixa de 24×24; `stroke` é traço (sem preenchimento) e `fill` é
// preenchido. Categoria desconhecida (ou aviso antigo, sem categoria) cai na taça.

export interface Glyph { stroke?: string; fill?: string }

const TACA: Glyph = {
    fill: 'M7 4h10v5a5 5 0 0 1-10 0z M10 18h4l1 2H9z',
    stroke: 'M7 6H4.5a3 3 0 0 0 3 4 M17 6h2.5a3 3 0 0 1-3 4 M12 14v4',
}

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`

const GLYPHS: Record<string, Glyph> = {
    ficha: { stroke: 'M7 3h8l3 3v15H7z M15 3v3h3 M10 10h5 M10 13.5h5 M10 17h3' },
    historia: { stroke: 'M5 20c1-8 5-14 14-16-1 7-5 11-11 12 M5 20l4-5 M11 13l4-1' },
    presenca: { stroke: 'M7 3h10 M7 21h10 M8 3c0 5 3 6 4 9 1-3 4-4 4-9 M8 21c0-5 3-6 4-9 1 3 4 4 4 9' },
    dados: { stroke: 'M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z M12 7.5l4.5 7.5h-9z M12 2.5v5 M3.8 7.25l3.7 7.75 M20.2 7.25L16.5 15 M7.5 15L12 21.5l4.5-6.5' },
    sorte: { fill: [circle(8.6, 8.6, 3.3), circle(15.4, 8.6, 3.3), circle(8.6, 15.4, 3.3), circle(15.4, 15.4, 3.3)].join(' '), stroke: 'M12 12v9.5' },
    combate: { stroke: 'M4 4l11 11 M20 4L9 15 M4 4v3 M4 4h3 M20 4v3 M20 4h-3 M13 17l4-4 M7 13l4 4 M16.5 16.5L20 20 M7.5 16.5L4 20' },
    destaques: { fill: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z' },
    mesa: { fill: 'M12 3c3 3.5 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2.2-4.6.2 1.6 1 2.4 1.8 2.6C10.6 8 11 5.2 12 3z', stroke: 'M5 20.5l14-3 M5 17.5l14 3' },
    wiki: { stroke: 'M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z M12 6.5v13' },
    mestre: { stroke: 'M2.5 12C5 7.5 8.3 5.5 12 5.5s7 2 9.5 6.5c-2.5 4.5-5.8 6.5-9.5 6.5S5 16.5 2.5 12z', fill: circle(12, 12, 3) },
    platina: { fill: 'M3.5 8l4.5 4 4-7 4 7 4.5-4-1.8 10H5.3z', stroke: 'M5.5 20.5h13' },
}

export const glyphOf = (category?: string | null): Glyph => (category && GLYPHS[category]) || TACA
