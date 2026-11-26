import type { ReactNode } from 'react';
import { Box, ButtonBase, type SxProps, type Theme } from '@mui/material';
import { displayFont, gold, greenInk, ink, parchment, rule, status, TRADITION_COLORS } from '../../../theme';
import { tr } from '../../../i18n';
import { tint, warmShadow } from './uiTokens';
import { ICON_PATH, type ItemKind, type WhereTone } from './equipmentModel';

/*
 * Primitivas da aba Equipamento (redesign "Mochila e bancada"): ícone do item na cor do tipo, encaixes de runa em
 * losango (ouro = fundamental, verde = propriedade, tracejado = livre), medidores, contador − n +, seletor de degrau e o
 * selo de onde o item está. Cores só de `palette.ts`.
 */

const sxList = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : [sx]);

/** Traços de 24×24, sem preenchimento. */
const PATH: Record<ItemKind, string> = {
  weapon: 'M20 4l-9 9M20 4h-5M20 4v5M11 13l-4 4M5 15l4 4M4 20l2-2',
  armor: 'M8 3l4 2 4-2 4 3-2 5v9H6v-9L4 6z',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  worn: 'M7 3h5v9l6 3a2 2 0 011 2v3H7zM7 16h12',
  consumable: 'M10 3h4M10 3v5L6 15a4 4 0 004 6h4a4 4 0 004-6l-4-7V3M7.5 14h9',
  staff: 'M7 21L17 3M14 3h4v4',
  rune: 'M12 3l8 9-8 9-8-9zM12 8v8M9 12h6',
  material: 'M4 15l8-10 8 10-8 5z',
  relic: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z',
  gear: 'M8 7V5a4 4 0 018 0v2M5 9a2 2 0 012-2h10a2 2 0 012 2v11H5zM9 13h6',
  custom: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
};


/** Ícone de traço (24×24). */
export function StrokeIcon({ d, size = 20, sx }: { d: string; size?: number; sx?: SxProps<Theme> }) {
  return (
    <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={[{ width: size, height: size, flex: 'none', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, ...sxList(sx)]}>
      <path d={d} />
    </Box>
  );
}

const KIND_TONE: Record<ItemKind, { bg: string; fg: string }> = {
  weapon: { bg: tint.green, fg: greenInk.main },
  shield: { bg: tint.arcane, fg: TRADITION_COLORS.arcane },
  armor: { bg: tint.arcane, fg: TRADITION_COLORS.arcane },
  worn: { bg: tint.occult, fg: TRADITION_COLORS.occult },
  consumable: { bg: tint.divine, fg: TRADITION_COLORS.divine },
  staff: { bg: tint.occult, fg: TRADITION_COLORS.occult },
  rune: { bg: tint.gold, fg: gold.deep },
  material: { bg: parchment.sunken, fg: ink.secondary },
  relic: { bg: tint.gold, fg: gold.deep },
  gear: { bg: parchment.sunken, fg: ink.secondary },
  custom: { bg: tint.gold, fg: gold.deep },
};

/** Ladrilho do item na cor do tipo. */
export function ItemGlyph({ kind, size = 40 }: { kind: ItemKind; size?: number }) {
  const tone = KIND_TONE[kind];
  return (
    <Box component="span" aria-hidden sx={{
      width: size, height: size, borderRadius: '8px', bgcolor: tone.bg, color: tone.fg, flex: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <StrokeIcon d={PATH[kind]} size={Math.round(size * 0.5)} />
    </Box>
  );
}

export type SocketLook = 'f' | 'p' | 'e' | 'x';

/** Um losango: fundamental (ouro), propriedade (verde), livre (tracejado) ou a mais (âmbar). */
export function Gem({ look, size = 11 }: { look: SocketLook; size?: number }) {
  const s = {
    f: { bgcolor: gold.bright, border: `1.5px solid ${gold.main}` },
    p: { bgcolor: greenInk.mid, border: `1.5px solid ${greenInk.mid}` },
    e: { bgcolor: 'transparent', border: `1.5px dashed ${ink.disabled}` },
    x: { bgcolor: status.warning, border: `1.5px solid ${status.warning}` },
  }[look];
  return <Box component="span" aria-hidden sx={{ width: size, height: size, transform: 'rotate(45deg)', borderRadius: '2px', flex: 'none', display: 'inline-block', ...s }} />;
}

/** Fileira de encaixes, com o texto escondido para o leitor de tela. */
export function Sockets({ looks, label }: { looks: SocketLook[]; label?: string }) {
  if (!looks.length) return null;
  return (
    <Box component="span" title={label} sx={{ display: 'inline-flex', gap: '5px', alignItems: 'center', flex: 'none', px: '2px' }}>
      {looks.map((l, i) => <Gem key={i} look={l} />)}
      {label && <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</Box>}
    </Box>
  );
}

export type GaugeTone = 'ok' | 'warn' | 'error';

/** Cartão de medidor: rótulo, número grande e a barra (ou os quadradinhos). */
export function Gauge({ icon, label, value, small, tone = 'ok', children, foot, onClick, compact }: {
  icon: string;
  label: string;
  value: ReactNode;
  small?: ReactNode;
  tone?: GaugeTone;
  children?: ReactNode;
  foot?: ReactNode;
  onClick?: () => void;
  compact?: boolean;
}) {
  const border = tone === 'error' ? status.error : tone === 'warn' ? status.warning : rule;
  const bg = tone === 'error' ? tint.error : tone === 'warn' ? tint.warn : parchment.paper;
  const body = (
    <>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: { xs: 10, sm: 11 }, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: tone === 'error' ? status.error : ink.secondary }}>
        <StrokeIcon d={icon} size={14} sx={{ display: { xs: 'none', sm: 'block' } }} />
        {tone !== 'ok' && <span aria-hidden>{tone === 'error' ? '✗' : '⚠'}</span>}
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Box>
      </Box>
      <Box component="span" sx={{ fontFamily: displayFont, fontWeight: 700, lineHeight: 1, fontSize: compact ? 18 : { xs: 16, sm: 22 }, color: tone === 'error' ? status.error : ink.primary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}{small && <Box component="small" sx={{ font: '600 13px "Source Sans 3", sans-serif', fontSize: { xs: 11, sm: 13 }, color: ink.secondary, ml: 0.5 }}>{small}</Box>}
      </Box>
      {children}
      {foot && <Box component="span" sx={{ fontSize: 12, color: ink.secondary, lineHeight: 1.3, display: { xs: 'none', sm: 'block' } }}>{foot}</Box>}
    </>
  );
  const sx: SxProps<Theme> = {
    bgcolor: bg, border: `1px solid ${border}`, borderRadius: '8px', boxShadow: warmShadow, p: { xs: '8px 10px', sm: '10px 12px' },
    display: 'flex', flexDirection: 'column', gap: { xs: 0.625, sm: 0.875 }, minWidth: 0, textAlign: 'left', alignItems: 'stretch', color: 'inherit',
  };
  return onClick ? <ButtonBase onClick={onClick} data-view="" sx={sx}>{body}</ButtonBase> : <Box sx={sx}>{body}</Box>;
}

/** Barra de medidor, com uma marca opcional (onde fica sobrecarregado). */
export function Meter({ fraction, mark, tone = 'ok', label }: { fraction: number; mark?: number; tone?: GaugeTone; label: string }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  const fill = tone === 'error' ? status.error : tone === 'warn' ? status.warning : greenInk.mid;
  return (
    <Box role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
      sx={{ position: 'relative', height: { xs: 6, sm: 10 }, borderRadius: 999, bgcolor: parchment.sunken }}>
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, bgcolor: fill }} />
      {mark !== undefined && <Box aria-hidden sx={{ position: 'absolute', top: -3, bottom: -3, left: `${Math.max(0, Math.min(1, mark)) * 100}%`, width: '2px', borderRadius: '1px', bgcolor: ink.secondary }} />}
    </Box>
  );
}

/** Dez quadradinhos de investidos (a mais em âmbar). */
export function InvestPips({ used, max = 10 }: { used: number; max?: number }) {
  const over = used > max;
  return (
    <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))`, gap: { xs: '2px', sm: '3px' } }}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < Math.min(used, max);
        const x = over && i === max - 1;
        return <Box key={i} component="span" sx={{ height: { xs: 6, sm: 10 }, borderRadius: '2px', border: `1px solid ${x ? status.warning : on ? TRADITION_COLORS.occult : rule}`, bgcolor: x ? status.warning : on ? TRADITION_COLORS.occult : 'transparent' }} />;
      })}
    </Box>
  );
}

/** Contador − n + (consumíveis na mochila, quantidade na sacola). */
export function Stepper({ value, onChange, min = 0, large, label, disabled }: { value: number; onChange: (n: number) => void; min?: number; large?: boolean; label: string; disabled?: boolean }) {
  const h = large ? 44 : 36;
  const btn: SxProps<Theme> = { width: large ? 44 : 34, height: 1, fontSize: 18, fontWeight: 700, color: greenInk.main, '&.Mui-disabled': { color: ink.disabled } };
  return (
    <Box role="group" aria-label={label} onClick={(e) => e.stopPropagation()} sx={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${rule}`, borderRadius: '8px', height: h, overflow: 'hidden', flex: 'none', bgcolor: parchment.paper }}>
      <ButtonBase aria-label={tr('Um a menos', 'One less')} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} sx={btn}>−</ButtonBase>
      <Box component="b" aria-live="polite" sx={{ minWidth: large ? 40 : 26, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: large ? 18 : 15 }}>{value}</Box>
      <ButtonBase aria-label={tr('Um a mais', 'One more')} disabled={disabled || value >= 999} onClick={() => onChange(value + 1)} sx={btn}>+</ButtonBase>
    </Box>
  );
}

/** Segmentado de duas ou mais opções (Por tipo / Onde está, Comprado / Ganho). */
export function Segmented<T extends string>({ value, options, onChange, height = 34, label, disabled }: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  height?: number;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', bgcolor: parchment.sunken, borderRadius: '8px', p: '2px', gap: '2px' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <ButtonBase key={o.value} role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o.value)} sx={{
            height, borderRadius: '6px', fontSize: 14, fontWeight: 600, px: 1, color: on ? ink.primary : ink.secondary,
            bgcolor: on ? parchment.paper : 'transparent', boxShadow: on ? warmShadow : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            '&.Mui-disabled': { color: on ? ink.primary : ink.disabled },
          }}>{o.label}</ButtonBase>
        );
      })}
    </Box>
  );
}

export interface TierOption {
  tier: number;
  label: string;
  sub: string;
  /** Acima do nível do personagem: ⚠, mas escolhível. */
  high?: boolean;
}

/** Degraus de uma runa fundamental: cada opção com o nível e o preço; acima do nível, ⚠. */
export function TierPicker({ value, options, onChange, label, disabled }: { value: number; options: TierOption[]; onChange: (t: number) => void; label: string; disabled?: boolean }) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{
      display: 'grid', gridAutoFlow: 'column', gridAutoColumns: options.length > 4 ? 'minmax(64px, 1fr)' : 'minmax(0, 1fr)',
      bgcolor: parchment.sunken, borderRadius: '8px', p: '3px', gap: '3px', overflowX: options.length > 4 ? 'auto' : 'visible',
    }}>
      {options.map((o) => {
        const on = o.tier === value;
        return (
          <ButtonBase key={o.tier} role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o.tier)} title={o.high ? tr('Acima do nível do personagem', 'Above the character level') : undefined} sx={{
            minHeight: 50, borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '1px', px: '2px', py: 0.5,
            bgcolor: on ? greenInk.main : 'transparent', boxShadow: on ? warmShadow : 'none',
            '&.Mui-disabled': { opacity: 1 },
          }}>
            <Box component="b" sx={{ fontSize: 14, fontWeight: 700, color: on ? parchment.paper : o.high ? ink.secondary : ink.primary }}>{o.label}</Box>
            <Box component="small" sx={{ fontSize: 11, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: on ? parchment.paper : o.high ? status.warning : ink.secondary, fontWeight: o.high && !on ? 700 : 400 }}>{o.sub}</Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

/** Selo de onde o item está (Em mãos, Vestida, ✦ Investido). */
export function WherePill({ text, tone }: { text: string; tone: WhereTone }) {
  const look = {
    hand: { bg: tint.green, fg: greenInk.main },
    worn: { bg: tint.arcane, fg: TRADITION_COLORS.arcane },
    invested: { bg: tint.occult, fg: TRADITION_COLORS.occult },
    stowed: { bg: parchment.sunken, fg: ink.secondary },
  }[tone];
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 24, px: 1, borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flex: 'none', bgcolor: look.bg, color: look.fg }}>{text}</Box>
  );
}

/** Faixa de grupo da lista ("CONSUMÍVEIS · 7 ········ 174 po"). */
export function GroupBar({ title, count, right }: { title: string; count: number; right?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: ink.secondary, bgcolor: parchment.sunken, borderBottom: `1px solid ${rule}` }}>
      <Box component="b" sx={{ color: ink.primary }}>{title}</Box>· {count}
      <Box component="span" sx={{ flex: 1 }} />
      {right}
    </Box>
  );
}

/** Botão redondo "+" (pôr na sacola). */
export function PlusButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <ButtonBase aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onClick(); }} sx={{
      width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${greenInk.mid}`, bgcolor: parchment.paper, color: greenInk.main, flex: 'none',
    }}><StrokeIcon d={ICON_PATH.plus} /></ButtonBase>
  );
}
