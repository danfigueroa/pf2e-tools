import { Box, Stack } from '@mui/material';
import { displayFont, gold, greenInk, ink, parchment, rule, status, TRADITION_COLORS } from '../../../theme';
import { tr } from '../../../i18n';
import { attributeLabel, attributeScore, type BoostGroup } from '../engine/attributes';
import { ATTRIBUTES, type AttributeKey } from '../engine/types';
import { Pill } from '../components/ui';
import { cardSx, signed, warmShadow } from '../components/uiTokens';
import { setChoice, type SectionProps } from './types';

/** De onde vem cada +1: ancestralidade, background, classe, livres do 1º, boosts de nível e flaw. */
type Source = { key: string; letter: string; label: string; color: string };
const SRC = {
  ancestry: { key: 'A', letter: 'A', label: tr('Ancestralidade', 'Ancestry'), color: greenInk.mid },
  background: { key: 'B', letter: 'B', label: tr('Background', 'Background'), color: TRADITION_COLORS.arcane },
  class: { key: 'C', letter: 'C', label: tr('Classe', 'Class'), color: gold.deep },
  free: { key: 'L', letter: 'L', label: tr('Livre', 'Free'), color: ink.secondary },
  level: { key: 'N', letter: '5', label: tr('Nível', 'Level'), color: TRADITION_COLORS.occult },
  flaw: { key: 'F', letter: '−', label: tr('Flaw', 'Flaw'), color: status.error },
} satisfies Record<string, Source>;

const Square = ({ s, letter }: { s: Source; letter?: string }) => (
  <Box component="i" title={s.label} sx={{
    width: 16, height: 16, borderRadius: '3px', font: `700 9px/16px "Source Sans 3", sans-serif`, fontStyle: 'normal', textAlign: 'center',
    color: parchment.paper, bgcolor: s.color, flex: 'none', display: 'inline-block',
  }}>{letter ?? s.letter}</Box>
);

/**
 * Atributos (redesign): os seis blocos com o modificador e, embaixo, um quadradinho por boost dizendo de onde ele veio
 * (A ancestralidade, B background, C classe, L livre, 5/10/15/20 nível, − flaw). Depois, um cartão por grupo de boosts
 * com os seis atributos em grade e o "2/2 ✓". Os fixos da ancestralidade aparecem travados.
 */
export function AttributesSection({ state, update, compiled, canEdit }: SectionProps) {
  const { mod, partial, breakdown } = compiled.attributes;

  const sources = (a: AttributeKey): { s: Source; letter?: string }[] => [
    ...(breakdown.ancestryBoosts.includes(a) || breakdown.ancestryFree.includes(a) ? [{ s: SRC.ancestry }] : []),
    ...(breakdown.backgroundBoosts.includes(a) ? [{ s: SRC.background }] : []),
    ...(breakdown.classBoosts.includes(a) ? [{ s: SRC.class }] : []),
    ...(breakdown.mapLevelledBoosts['1']?.includes(a) ? [{ s: SRC.free }] : []),
    ...Object.entries(breakdown.mapLevelledBoosts).filter(([lvl, list]) => lvl !== '1' && list.includes(a)).map(([lvl]) => ({ s: SRC.level, letter: lvl })),
    ...(breakdown.ancestryFlaws.includes(a) ? [{ s: SRC.flaw }] : []),
  ];

  const toggle = (group: BoostGroup, a: AttributeKey) => {
    if (group.key === 'class-key') {
      update((s) => ({ ...s, class: { ...s.class, keyAttribute: a } }));
      return;
    }
    const current = group.chosen;
    const next = current.includes(a) ? current.filter((x) => x !== a) : [...current, a];
    setChoice(update, group.key, next.length ? { boosts: next } : null);
  };

  const hint = (g: BoostGroup) => g.oneOf
    ? tr(`${g.options.map(attributeLabel).join(' ou ')}, e 1 livre`, `${g.options.map(attributeLabel).join(' or ')}, and 1 free`)
    : g.key === 'class-key' ? (g.count ? tr('Escolha o atributo-chave', 'Choose the key attribute') : tr('Atributo-chave da classe', 'The class key attribute'))
      : g.fixed.length && g.count ? tr(`${g.fixed.map(attributeLabel).join(', ')} fixos e ${g.count} livre${g.count > 1 ? 's' : ''}`, `${g.fixed.map(attributeLabel).join(', ')} fixed and ${g.count} free`)
        : g.fixed.length ? tr('Fixos da ancestralidade', 'Fixed by the ancestry')
          : tr('Um por atributo', 'One per attribute');

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(6, minmax(0, 1fr))' }, gap: 1 }}>
        {ATTRIBUTES.map((a) => {
          const src = sources(a);
          const zero = mod[a] === 0;
          return (
            <Box key={a} title={tr(`Pontuação no export: ${attributeScore(mod[a], partial[a])}`, `Export score: ${attributeScore(mod[a], partial[a])}`)} sx={{
              bgcolor: parchment.paper, border: `1px solid ${compiled.keyAttribute === a ? gold.main : rule}`, borderRadius: '6px', pt: 1.25, pb: 1, px: 0.75,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, boxShadow: warmShadow,
            }}>
              <Box component="span" sx={{ font: `700 13px ${displayFont}`, letterSpacing: '.08em', color: compiled.keyAttribute === a ? gold.deep : ink.secondary }}>
                {attributeLabel(a)}{compiled.keyAttribute === a ? ' ◆' : ''}
              </Box>
              <Box component="span" sx={{ font: `700 28px/1 "Source Sans 3", sans-serif`, color: zero ? ink.disabled : ink.primary, fontVariantNumeric: 'tabular-nums' }}>
                {signed(mod[a])}{partial[a] ? '½' : ''}
              </Box>
              <Box component="span" sx={{ display: 'flex', gap: '3px', minHeight: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {src.length ? src.map((x, i) => <Square key={i} s={x.s} letter={x.letter} />)
                  : <Box component="i" aria-hidden sx={{ width: 16, height: 16, borderRadius: '3px', border: `1px dashed ${rule}` }} />}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 12, alignItems: 'center', color: ink.secondary }}>
        {[SRC.ancestry, SRC.background, SRC.class, SRC.free, SRC.level, SRC.flaw].map((s) => (
          <Box key={s.key} component="span" sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center' }}><Square s={s} />{s.label}</Box>
        ))}
      </Box>
      {ATTRIBUTES.some((a) => partial[a]) && (
        <Box sx={{ fontSize: 12, color: ink.secondary }}>
          {tr('½ = boost parcial: o próximo boost sobe +1 (Player Core pg. 17).', '½ = partial boost: the next boost raises it by 1 (Player Core pg. 17).')}
        </Box>
      )}

      {compiled.boostGroups.filter((g) => g.count > 0 || g.fixed.length > 0).map((group) => {
        const done = group.chosen.length;
        const complete = group.count === 0 || done >= group.count;
        return (
          <Box key={group.key} sx={[cardSx, { p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }]}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
              <Box component="h3" sx={{ m: 0, fontWeight: 600, fontSize: 14 }}>{group.label}</Box>
              <Box component="span" sx={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: complete ? status.success : gold.deep }}>
                {group.count === 0 ? tr('automático', 'automatic') : `${Math.min(done, group.count)}/${group.count}${complete ? ' ✓' : ''}`}
              </Box>
            </Box>
            <Box sx={{ fontSize: 12, color: ink.secondary, mt: -0.75 }}>{hint(group)}</Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 0.5 }}>
              {ATTRIBUTES.map((a) => {
                const fixed = group.fixed.includes(a);
                const on = fixed || group.chosen.includes(a);
                const offered = group.key === 'class-key' ? group.options.includes(a) : !fixed;
                const clickable = canEdit && offered && group.count > 0;
                return (
                  <Pill key={a} look={on ? 'sel' : !offered ? 'lock' : 'default'} disabled={!offered && !on}
                    onClick={clickable ? () => toggle(group, a) : undefined} title={fixed ? tr('Fixo da ancestralidade', 'Fixed by the ancestry') : undefined}
                    sx={{ px: 0, fontSize: 13, minHeight: { xs: 40, sm: 36 } }}>{attributeLabel(a)}</Pill>
                );
              })}
            </Box>
          </Box>
        );
      })}

      {state.origin.alternateBoosts && (
        <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Boosts alternativos da ancestralidade ligados (seção Origem).', 'Alternate ancestry boosts on (Origin section).')}</Box>
      )}
    </Stack>
  );
}
