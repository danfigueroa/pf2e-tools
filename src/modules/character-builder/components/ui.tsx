import type { ReactNode } from 'react';
import { Box, ButtonBase, type SxProps, type Theme } from '@mui/material';
import {
  chrome, displayFont, gold, green, greenInk, ink, parchment, RARITY_COLORS, RANK_COLORS, rule, status,
} from '../../../theme';
import { tr } from '../../../i18n';
import type { Rank } from '../engine/types';
import { labelSx, RANK_LABEL, tint, warmShadow, type ContentBadgeKind } from './uiTokens';

/*
 * Primitivas do redesign do Criador ("livro, não formulário"): fólio de escolha, cartão de slot, pílula e pips de
 * proficiência, selos, contador de pendência, caixa de nível na cor da raridade, trilha 1–20 e avisos. Todas leem as
 * cores de `palette.ts`; os véus são o próprio token com alfa em hex (regra 3).
 */






/** Rótulo pequeno em caixa alta ("ANCESTRALIDADE"). */
export const Label = ({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) => (
  <Box component="span" sx={[labelSx, ...(Array.isArray(sx) ? sx : [sx])]}>{children}</Box>
);

/** Título de seção do livro: Cinzel com filete dourado embaixo; à direita, uma nota curta. */
export function SectionHead({ children, note, component = 'h3' }: { children: ReactNode; note?: ReactNode; component?: 'h2' | 'h3' | 'div' }) {
  return (
    <Box component={component} sx={{
      m: 0, fontFamily: displayFont, fontWeight: 600, fontSize: 14, letterSpacing: '.06em', color: ink.primary, pb: 0.75,
      borderBottom: `1px solid ${gold.main}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap',
    }}>
      <span>{children}</span>
      {note && <Box component="small" sx={{ font: `500 12px "Source Sans 3", sans-serif`, letterSpacing: 0, color: ink.secondary }}>{note}</Box>}
    </Box>
  );
}

/** Cabeçalho verde com filete dourado (bloco de destaque: conjurador, revisão, painel de pendências). */
export function BandHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Box sx={{
      bgcolor: green.main, color: chrome.text, fontFamily: displayFont, fontWeight: 600, fontSize: 15, letterSpacing: '.04em',
      px: 1.75, py: 1.25, borderBottom: `2px solid ${gold.main}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
    }}>
      <Box component="span" sx={{ minWidth: 0 }}>{children}</Box>
      {right && <Box component="span" sx={{ flex: 'none', display: 'flex', gap: 0.75, alignItems: 'center', font: `700 13px "Source Sans 3", sans-serif`, color: gold.bright, letterSpacing: 0 }}>{right}</Box>}
    </Box>
  );
}

/** Medalhão do personagem: retrato ou a inicial em Cinzel, aro dourado. */
export function Medallion({ name, src, size = 56, dashed }: { name: string; src?: string | null; size?: number; dashed?: boolean }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <Box aria-hidden sx={{
      width: size, height: size, borderRadius: '50%', bgcolor: chrome.active, border: `2px ${dashed ? 'dashed' : 'solid'} ${gold.bright}`,
      boxShadow: `inset 0 0 0 3px ${chrome.hero}`, color: dashed ? chrome.textMuted : chrome.text, fontFamily: displayFont, fontWeight: 700,
      fontSize: Math.round(size * 0.43), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden',
      backgroundImage: src ? `url("${src}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
    }}>{src ? null : initial}</Box>
  );
}

/** Contador de pendência: ouro, nunca vermelho. Zero fica apagado. */
export function PendCount({ n, sx }: { n: number; sx?: SxProps<Theme> }) {
  return (
    <Box component="span" aria-label={tr(`${n} pendente${n === 1 ? '' : 's'}`, `${n} to do`)} sx={[{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 22, px: '7px', borderRadius: 999,
      bgcolor: n ? gold.bright : parchment.sunken, color: n ? green.deepest : ink.secondary, fontSize: 12, fontWeight: 700, flex: 'none',
    }, ...(Array.isArray(sx) ? sx : [sx])]}>{n}</Box>
  );
}

/** Ponto dourado de "tem pendência aqui". */
export const PendDot = () => <Box component="span" aria-hidden sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: gold.bright, flex: 'none', display: 'inline-block' }} />;

export type PublishState = 'draft' | 'published' | 'changed' | 'readonly';

/** Selo de estado do personagem (Rascunho · Aplicado na mesa · Alterações não aplicadas · Somente leitura). */
export function StateBadge({ state, onFrameBg }: { state: PublishState; onFrameBg?: boolean }) {
  const look = {
    draft: { bg: parchment.sunken, fg: ink.secondary, dot: ink.secondary, label: tr('Rascunho', 'Draft') },
    published: { bg: tint.ok, fg: status.success, dot: status.success, label: tr('Aplicado na mesa', 'Applied to the table') },
    changed: { bg: tint.warn, fg: ink.primary, dot: status.warning, label: tr('Alterações não aplicadas', 'Unapplied changes') },
    readonly: { bg: tint.info, fg: status.info, dot: status.info, label: tr('Somente leitura', 'Read only') },
  }[state];
  const frame = onFrameBg ? { bg: chrome.active, fg: chrome.text, dot: gold.bright } : look;
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 26, px: 1.25, borderRadius: 999, fontSize: 12, fontWeight: 700,
      whiteSpace: 'nowrap', bgcolor: frame.bg, color: frame.fg, maxWidth: 1, overflow: 'hidden',
    }}>
      <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: frame.dot, flex: 'none' }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{look.label}</Box>
    </Box>
  );
}


/** Selos do conteúdo: Da mesa, Legado, Fora das regras da mesa, raridade e traços. Sempre com texto. */
export function ContentBadge({ kind, children }: { kind: ContentBadgeKind; children?: ReactNode }) {
  const look: Record<ContentBadgeKind, { fg: string; bg?: string; label: string }> = {
    mesa: { fg: gold.deep, bg: tint.gold, label: tr('Da mesa', 'Table homebrew') },
    legacy: { fg: ink.secondary, label: tr('Legado', 'Legacy') },
    out: { fg: status.error, bg: tint.error, label: tr('Fora das regras da mesa', 'Outside table rules') },
    uncommon: { fg: RARITY_COLORS.uncommon, label: tr('Incomum', 'Uncommon') },
    rare: { fg: RARITY_COLORS.rare, label: tr('Raro', 'Rare') },
    unique: { fg: RARITY_COLORS.unique, label: tr('Único', 'Unique') },
    trait: { fg: ink.secondary, bg: parchment.sunken, label: '' },
  };
  const l = look[kind];
  const trait = kind === 'trait';
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5, height: trait ? 22 : 20, px: 0.75, borderRadius: '4px',
      fontSize: trait ? 12 : 11, fontWeight: trait ? 600 : 700, letterSpacing: trait ? 0 : '.04em', textTransform: trait ? 'none' : 'uppercase',
      border: `1px solid ${trait ? rule : 'currentColor'}`, color: l.fg, bgcolor: l.bg ?? 'transparent', whiteSpace: 'nowrap', flex: 'none',
    }}>{children ?? l.label}</Box>
  );
}


/** O nível na cor da raridade (a raridade também tem selo escrito: a cor nunca é a única pista). */
export function LevelBox({ level, rarity, title }: { level?: number | string; rarity?: string; title?: string }) {
  const color = RARITY_COLORS[(rarity ?? 'common') as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.common;
  return (
    <Box component="span" title={title} sx={{
      minWidth: 30, height: 24, borderRadius: '4px', border: '1.5px solid currentColor', color, fontSize: 12, fontWeight: 700, flex: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', px: '5px', fontVariantNumeric: 'tabular-nums',
    }}>{level ?? '—'}</Box>
  );
}

const ACTION_GLYPH: Record<string, string> = { '1': '◆', '2': '◆◆', '3': '◆◆◆', reaction: '↺', free: '◇' };
const ACTION_LABEL: Record<string, string> = {
  '1': tr('uma ação', 'one action'), '2': tr('duas ações', 'two actions'), '3': tr('três ações', 'three actions'),
  reaction: tr('reação', 'reaction'), free: tr('ação livre', 'free action'),
};

/** Ícone de ações (◆ ◆◆ ◆◆◆ ↺ ◇); sem ação, um traço. */
export function ActionGlyph({ actions, size = 12 }: { actions?: string; size?: number }) {
  const glyph = actions ? ACTION_GLYPH[actions] : undefined;
  return (
    <Box component="span" role={glyph ? 'img' : undefined} aria-label={glyph ? ACTION_LABEL[actions!] : undefined} aria-hidden={glyph ? undefined : true}
      sx={{ fontSize: size, color: greenInk.main, letterSpacing: '1px', whiteSpace: 'nowrap', fontWeight: 700 }}>
      {glyph ?? '—'}
    </Box>
  );
}

const RANK_LETTER = ['U', 'T', 'E', 'M', 'L'] as const;
const RANK_TINT = [parchment.sunken, tint.green, tint.arcane, tint.occult, tint.divine];
const rankColor = (rank: Rank) => (rank === 0 ? ink.secondary : RANK_COLORS[rank * 2]);

/** Pílula de proficiência ("Perito"), na cor do grau; `short` mostra só a letra. */
export function ProfPill({ rank, short, sx }: { rank: Rank; short?: boolean; sx?: SxProps<Theme> }) {
  return (
    <Box component="span" title={short ? RANK_LABEL[rank] : undefined} sx={[{
      display: 'inline-flex', alignItems: 'center', height: 24, px: short ? 0.75 : 1.125, borderRadius: 999, fontSize: 12, fontWeight: 700,
      whiteSpace: 'nowrap', color: rankColor(rank), bgcolor: RANK_TINT[rank], flex: 'none',
    }, ...(Array.isArray(sx) ? sx : [sx])]}>{short ? RANK_LETTER[rank] : RANK_LABEL[rank]}</Box>
  );
}

/** Pips T E M L, sempre com a letra (a cor nunca é a única pista). Crescem no celular. */
export function Pips({ rank, name }: { rank: Rank; name: string }) {
  return (
    <Box component="span" aria-label={`${RANK_LABEL[rank]} ${tr('em', 'in')} ${name}`} role="img" sx={{ display: 'inline-flex', gap: '3px', flex: 'none' }}>
      {(['T', 'E', 'M', 'L'] as const).map((p, i) => {
        const on = i < rank;
        const color = on ? RANK_COLORS[rank * 2] : undefined;
        return (
          <Box key={p} component="span" aria-hidden sx={{
            width: { xs: 24, sm: 22 }, height: { xs: 24, sm: 22 }, borderRadius: '4px', fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${color ?? rule}`, bgcolor: color ?? 'transparent', color: on ? parchment.paper : ink.disabled,
          }}>{p}</Box>
        );
      })}
    </Box>
  );
}

export type SlotLook = 'filled' | 'todo' | 'auto' | 'warn' | 'plan';

/**
 * Cartão de slot: o rótulo pequeno em cima ("TALENTO DE CLASSE · 6") e o escolhido; pendente em tracejado ouro, automático
 * afundado, com aviso em âmbar, planejado tracejado e apagado. A linha inteira é o alvo de toque.
 */
export function SlotCard({ kicker, name, look = 'filled', why, trailing, onClick, disabled, sx }: {
  kicker?: ReactNode;
  name: ReactNode;
  look?: SlotLook;
  why?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}) {
  const border = {
    filled: `1px solid ${rule}`, todo: `1.5px dashed ${gold.main}`, auto: '1px solid transparent', warn: `1px solid ${status.warning}`, plan: `1px dashed ${rule}`,
  }[look];
  const bg = { filled: parchment.paper, todo: tint.gold, auto: parchment.sunken, warn: tint.warn, plan: 'transparent' }[look];
  const nameColor = look === 'todo' ? gold.deep : look === 'plan' ? ink.secondary : ink.primary;
  const body = (
    <>
      <Box component="span" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {kicker && <Box component="span" sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: ink.secondary, fontWeight: 700 }}>{kicker}</Box>}
        <Box component="span" sx={{ fontWeight: look === 'plan' ? 500 : 600, color: nameColor, fontSize: 15, overflowWrap: 'anywhere' }}>{name}</Box>
        {why && <Box component="span" sx={{ fontSize: 13, color: ink.primary, display: 'flex', gap: 0.625, alignItems: 'center', fontWeight: 600 }}>{why}</Box>}
      </Box>
      {trailing}
    </>
  );
  const base: SxProps<Theme> = {
    display: 'flex', alignItems: 'center', gap: 1.25, py: 1.125, pl: 1.5, pr: 0.75, borderRadius: '6px', bgcolor: bg, border,
    minHeight: 52, textAlign: 'left', width: 1, justifyContent: 'flex-start', font: 'inherit', color: 'inherit',
  };
  if (!onClick) return <Box sx={[base, ...(Array.isArray(sx) ? sx : [sx])]}>{body}</Box>;
  return <ButtonBase onClick={onClick} disabled={disabled} data-view="" sx={[base, ...(Array.isArray(sx) ? sx : [sx])]}>{body}</ButtonBase>;
}

/**
 * Fólio de escolha: o rótulo, o nome em Cinzel e o que a escolha muda. Sem escolha, tracejado ouro com o convite
 * ("Escolher background") e o que ela vai dar.
 */
export function Folio({ label, name, meta, icon, todo, onClick, disabled, trailing }: {
  label?: ReactNode;
  name: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  todo?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <ButtonBase onClick={onClick} disabled={disabled || !onClick} data-view="" sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, pl: 1.75, pr: 1, width: 1, minHeight: 64, textAlign: 'left',
      justifyContent: 'flex-start', borderRadius: '6px', bgcolor: todo ? tint.gold : parchment.paper,
      border: todo ? `1.5px dashed ${gold.main}` : `1px solid ${rule}`, boxShadow: todo ? 'none' : warmShadow, color: 'inherit',
      '&.Mui-disabled': { opacity: 1 },
    }}>
      {icon && (
        <Box component="span" aria-hidden sx={{
          width: 40, height: 40, borderRadius: '50%', bgcolor: todo ? tint.gold : tint.green, color: todo ? gold.deep : greenInk.main,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', '& svg': { fontSize: 20 },
        }}>{icon}</Box>
      )}
      <Box component="span" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {label && <Label>{label}</Label>}
        <Box component="span" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: 18, lineHeight: 1.2, color: todo ? gold.deep : ink.primary, overflowWrap: 'anywhere' }}>{name}</Box>
        {meta && <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{meta}</Box>}
      </Box>
      {trailing}
    </ButtonBase>
  );
}

/** Escolha filha (talento da herança, opção de um talento): recuada, com o traço de ligação ao pai. */
export const ChildRow = ({ children }: { children: ReactNode }) => (
  <Box sx={{
    ml: '22px', position: 'relative',
    '&::before': {
      content: '""', position: 'absolute', left: -14, top: -8, width: 10, height: 36,
      borderLeft: `1.5px solid ${rule}`, borderBottom: `1.5px solid ${rule}`, borderBottomLeftRadius: 6,
    },
  }}>{children}</Box>
);

export type NoticeTone = 'warn' | 'info' | 'error' | 'ok';

/** Aviso do livro: véu da cor do tom, ícone à esquerda, texto e ação. */
export function Notice({ tone, icon, children, action }: { tone: NoticeTone; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  const bg = { warn: tint.warn, info: tint.info, error: tint.error, ok: tint.ok }[tone];
  const fg = { warn: status.warning, info: status.info, error: status.error, ok: status.success }[tone];
  return (
    <Box role={tone === 'error' ? 'alert' : undefined} sx={{ display: 'flex', gap: 1.25, p: 1.5, borderRadius: '6px', bgcolor: bg, alignItems: 'flex-start' }}>
      {icon && <Box component="span" aria-hidden sx={{ color: fg, display: 'flex', flex: 'none', '& svg': { fontSize: 20 } }}>{icon}</Box>}
      <Box sx={{ flex: 1, minWidth: 0, fontSize: 14, display: 'flex', flexDirection: 'column', gap: 0.75, overflowWrap: 'anywhere' }}>
        {children}
        {action && <Box sx={{ alignSelf: 'flex-start' }}>{action}</Box>}
      </Box>
    </Box>
  );
}

export type RibbonLook = 'done' | 'cur' | 'next' | 'plan';

/** Um quadrado da trilha 1–20: pronto (verde), atual (ouro), próximo (tracejado ouro), planejado (tracejado). */
export function RibbonCell({ n, look, pending, onClick, height = 28 }: { n: number; look: RibbonLook; pending?: boolean; onClick?: () => void; height?: number }) {
  const sx: SxProps<Theme> = {
    height, borderRadius: '4px', fontSize: height > 30 ? 13 : 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', fontVariantNumeric: 'tabular-nums', minWidth: 0, width: 1,
    ...(look === 'done' && { bgcolor: greenInk.mid, color: parchment.paper }),
    ...(look === 'cur' && { bgcolor: gold.bright, color: green.deepest, boxShadow: `0 0 0 2px ${parchment.page}, 0 0 0 4px ${gold.main}` }),
    ...(look === 'next' && { bgcolor: tint.gold, color: gold.deep, border: `1.5px dashed ${gold.main}` }),
    ...(look === 'plan' && { border: `1px dashed ${rule}`, color: ink.disabled }),
    ...(pending && {
      '&::after': {
        content: '""', position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', bgcolor: gold.bright,
        border: `1.5px solid ${parchment.paper}`,
      },
    }),
  };
  const label = `${tr('Nível', 'Level')} ${n}: ${{ done: tr('pronto', 'done'), cur: tr('atual', 'current'), next: tr('próximo', 'next'), plan: tr('planejado', 'planned') }[look]}${pending ? tr(', com pendência', ', to do') : ''}`;
  if (!onClick) return <Box component="span" aria-label={label} sx={sx}>{n}</Box>;
  return <ButtonBase aria-label={label} title={label} onClick={onClick} sx={sx}>{n}</ButtonBase>;
}

/** O círculo do nível na linha do tempo do Plano. */
export function LevelDisc({ n, look, size = 40 }: { n: number; look: RibbonLook; size?: number }) {
  return (
    <Box component="span" aria-hidden sx={{
      width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: displayFont,
      fontWeight: 700, fontSize: 15, flex: 'none',
      ...(look === 'done' && { bgcolor: greenInk.mid, color: parchment.paper }),
      ...(look === 'cur' && { bgcolor: gold.bright, color: green.deepest, boxShadow: `0 0 0 3px ${parchment.page}, 0 0 0 5px ${gold.main}` }),
      ...(look === 'next' && { border: `2px dashed ${gold.main}`, color: gold.deep, bgcolor: tint.gold }),
      ...(look === 'plan' && { border: `1.5px dashed ${rule}`, color: ink.disabled }),
    }}>{n}</Box>
  );
}

/** Linha de diferença: rótulo, antes (riscado), depois e o delta. */
export function DiffRows({ rows }: { rows: { label: string; from?: string; to: string; delta?: string }[] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: '8px 10px', alignItems: 'center', fontSize: 14 }}>
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: 'contents' }}>
          <span>{r.label}</span>
          <Box component="span" sx={{ color: ink.disabled, textDecoration: r.from ? 'line-through' : 'none', fontVariantNumeric: 'tabular-nums' }}>{r.from ?? ''}</Box>
          <Box component="span" sx={{ fontWeight: 700, color: greenInk.main, fontVariantNumeric: 'tabular-nums' }}>{r.to}</Box>
          <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: status.success, bgcolor: r.delta ? tint.ok : 'transparent', borderRadius: 999, px: '7px', py: '1px', whiteSpace: 'nowrap' }}>{r.delta ?? ''}</Box>
        </Box>
      ))}
    </Box>
  );
}

/** Marca de pré-requisito: ✓ cumprido, ✗ não, ? o app não sabe conferir. */
export function PrereqMark({ result }: { result: 'ok' | 'fail' | 'unknown' }) {
  const look = {
    ok: { bg: tint.ok, fg: status.success, ch: '✓', label: tr('cumprido', 'met') },
    fail: { bg: tint.error, fg: status.error, ch: '✗', label: tr('não cumprido', 'not met') },
    unknown: { bg: parchment.sunken, fg: ink.secondary, ch: '?', label: tr('o app não confere', 'not checked by the app') },
  }[result];
  return (
    <Box component="span" role="img" aria-label={look.label} sx={{
      width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
      fontWeight: 700, flex: 'none', bgcolor: look.bg, color: look.fg,
    }}>{look.ch}</Box>
  );
}


export type PillLook = 'default' | 'sel' | 'lock' | 'add';

/** Chip do livro: escolhido (verde cheio), travado (afundado, tracejado), convite (tracejado ouro) ou comum. */
export function Pill({ look = 'default', children, onClick, disabled, title, sx }: {
  look?: PillLook;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  sx?: SxProps<Theme>;
}) {
  const base: SxProps<Theme> = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, minHeight: { xs: 40, sm: 32 }, px: 1.375, borderRadius: 999,
    fontSize: 14, whiteSpace: 'nowrap', border: `1px solid ${rule}`, bgcolor: parchment.paper, color: ink.primary, font: 'inherit', fontWeight: 400,
    ...(look === 'sel' && { bgcolor: greenInk.main, borderColor: greenInk.main, color: parchment.paper, fontWeight: 600 }),
    ...(look === 'lock' && { bgcolor: parchment.sunken, borderStyle: 'dashed', color: ink.secondary }),
    ...(look === 'add' && { borderStyle: 'dashed', borderColor: gold.main, color: gold.deep, bgcolor: tint.gold, fontWeight: 600 }),
    '&.Mui-disabled': { opacity: look === 'lock' ? 1 : 0.5 },
  };
  const all = [base, ...(Array.isArray(sx) ? sx : [sx])];
  if (!onClick) return <Box component="span" title={title} sx={all}>{children}</Box>;
  return <ButtonBase onClick={onClick} disabled={disabled} title={title} aria-pressed={look === 'sel'} data-view="" sx={all}>{children}</ButtonBase>;
}

/** Linha de opção dentro de um cartão (interruptor, "nenhum", chevron): alvo de 48 px. */
export function OptionRow({ label, value, onClick, control, last }: { label: ReactNode; value?: ReactNode; onClick?: () => void; control?: ReactNode; last?: boolean }) {
  const sx: SxProps<Theme> = {
    display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48, px: 1.75, width: 1, textAlign: 'left', justifyContent: 'flex-start',
    borderBottom: last ? 0 : `1px solid ${rule}`, bgcolor: 'transparent', color: 'inherit', font: 'inherit',
  };
  const body = (
    <>
      <Box component="span" sx={{ flex: 1 }}>{label}</Box>
      {value && <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{value}</Box>}
      {control}
    </>
  );
  return onClick ? <ButtonBase onClick={onClick} data-view="" sx={sx}>{body}</ButtonBase> : <Box sx={sx}>{body}</Box>;
}
