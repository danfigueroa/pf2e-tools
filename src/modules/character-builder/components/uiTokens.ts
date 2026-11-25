import { gold, green, greenInk, ink, isDark, parchment, rule, status, TRADITION_COLORS } from '../../../theme';
import { tr } from '../../../i18n';

// Tokens das primitivas do redesign (`ui.tsx`): véus, sombra, cartão, botão de ouro e rótulos. Só cores de `palette.ts`.

/** Véu de um acento sobre o pergaminho (alfa em hex de 2 dígitos). */
const veil = (hex: string, light: string, dark: string) => hex + (isDark ? dark : light);
export const tint = {
  green: veil(greenInk.main, '14', '1A'),
  gold: isDark ? gold.bright + '24' : gold.main + '1F',
  warn: veil(status.warning, '1A', '1F'),
  error: veil(status.error, '12', '1F'),
  ok: veil(status.success, '1A', '1F'),
  info: veil(status.info, '14', '1F'),
  arcane: veil(TRADITION_COLORS.arcane, '1A', '1F'),
  occult: veil(TRADITION_COLORS.occult, '1A', '1F'),
  divine: veil(TRADITION_COLORS.divine, '1F', '1F'),
};

/** Sombra quente e discreta dos cartões (tinta a 5–6%). */
export const warmShadow = isDark ? '0 1px 2px #0000004D, 0 4px 12px #00000040' : '0 1px 2px #23201A0F, 0 4px 12px #23201A0D';

export const cardSx = {
  bgcolor: parchment.paper, border: `1px solid ${rule}`, borderRadius: '6px', boxShadow: warmShadow,
};

/** Botão cheio de ouro ("Subir de nível", "Revisar e aplicar"): tinta da moldura sobre o ouro vivo. */
export const goldButtonSx = {
  bgcolor: gold.bright, color: green.deepest, border: `1px solid ${gold.main}`, boxShadow: 'none',
  '&:hover': { bgcolor: gold.bright, boxShadow: 'none', filter: 'brightness(1.06)' },
};

export const labelSx = {
  fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: ink.secondary,
} as const;

export const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

export const rarityBadge = (rarity?: string): ContentBadgeKind | null =>
  rarity === 'uncommon' ? 'uncommon' : rarity === 'rare' ? 'rare' : rarity === 'unique' ? 'unique' : null;

export const RANK_LABEL = [tr('Destreinado', 'Untrained'), tr('Treinado', 'Trained'), tr('Perito', 'Expert'), tr('Mestre', 'Master'), tr('Lendário', 'Legendary')];

export type ContentBadgeKind = 'mesa' | 'legacy' | 'out' | 'uncommon' | 'rare' | 'unique' | 'trait';
