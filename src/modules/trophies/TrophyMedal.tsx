import { useId } from 'react';
import { Box } from '@mui/material';
import { ink, parchment, TROPHY_TIERS } from '../../theme';
import type { TrophyTier } from '../../services/trophies';
import { glyphOf } from './glyphs';

/**
 * A medalha do troféu, desenhada em SVG (sem imagem). A SILHUETA é do grau — bronze disco, prata
 * escudo, ouro selo raiado, platina estrela — e o glifo gravado no centro é da categoria (sem
 * categoria: a taça). Relevo metálico por gradiente (`hi` → `medal` → `lo`). O bloqueado é só o
 * contorno tracejado com o cadeado, sem glifo (não dá pista do secreto). O grau também vai por
 * extenso ao lado, em quem usa — cor e forma não podem ser o único sinal.
 */

/** Estrela/selo de `n` pontas em volta do centro (24, 24). */
function burst(n: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(24 + Math.cos(a) * r).toFixed(2)} ${(24 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}z`;
}

const circle = (r: number) => `M${24 - r} 24a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const SHAPE: Record<TrophyTier, string> = {
  bronze: circle(21),
  prata: 'M24 2.5L42.5 8.5V23c0 10.5-8 18.5-18.5 22.5C13.5 41.5 5.5 33.5 5.5 23V8.5z',
  ouro: burst(16, 22.5, 19.5),
  platina: burst(8, 23, 17),
};
/** O disco rebaixado onde o glifo é gravado. */
const WELL: Record<TrophyTier, number> = { bronze: 15.5, prata: 14, ouro: 15, platina: 13.5 };

export function TrophyMedal({ tier, category, locked, size = 56 }: { tier: TrophyTier; category?: string | null; locked?: boolean; size?: number }) {
  const c = TROPHY_TIERS[tier];
  const id = useId().replace(/:/g, '');
  const sx = { width: size, height: size, flexShrink: 0, display: 'block' };

  if (locked) {
    return (
      <Box component="svg" viewBox="0 0 48 48" aria-hidden sx={sx}>
        <path d={SHAPE[tier]} fill={parchment.page} stroke={ink.disabled} strokeWidth="1.5" strokeDasharray="3 3" strokeLinejoin="round" />
        <path d="M20.5 22.5v-3a3.5 3.5 0 0 1 7 0v3M19 22.5h10v7H19z" fill={parchment.sunken} stroke={ink.disabled} strokeWidth="1.4" strokeLinejoin="round" />
      </Box>
    );
  }

  const glyph = glyphOf(category);
  const well = WELL[tier];
  return (
    <Box component="svg" viewBox="0 0 48 48" aria-hidden sx={sx}>
      <defs>
        <linearGradient id={`${id}a`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={c.hi} />
          <stop offset="0.5" stopColor={c.medal} />
          <stop offset="1" stopColor={c.lo} />
        </linearGradient>
        {/* O rebaixo recebe a luz ao contrário: sombra em cima, luz embaixo. */}
        <linearGradient id={`${id}b`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={c.lo} />
          <stop offset="0.45" stopColor={c.medal} />
          <stop offset="1" stopColor={c.hi} />
        </linearGradient>
      </defs>
      <path d={SHAPE[tier]} fill={`url(#${id}a)`} stroke={c.lo} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={circle(well + 1.6)} fill={`url(#${id}b)`} />
      <path d={circle(well)} fill={c.medal} />
      <g transform={`translate(${24 - well * 0.8} ${24 - well * 0.8}) scale(${(well * 1.6) / 24})`}>
        {glyph.fill && <path d={glyph.fill} fill={c.engrave} />}
        {glyph.stroke && <path d={glyph.stroke} fill="none" stroke={c.engrave} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />}
      </g>
      {/* O reflexo, no alto à esquerda. */}
      <path d={`M${24 - well + 2.5} 21A${well - 2} ${well - 2} 0 0 1 21 ${24 - well + 2.5}`} fill="none" stroke={c.hi} strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    </Box>
  );
}
