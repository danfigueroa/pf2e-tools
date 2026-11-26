import { useState } from 'react';
import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { displayFont, gold, ink, rule, status, TRADITION_COLORS } from '../../../theme';
import { tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { attributeLabel } from '../engine/attributes';
import { rankName } from '../engine/compile';
import type { Caster } from '../engine/spells';
import type { RuleEntry } from '../rules/types';
import type { CasterChoices } from '../types';
import { BandHead, Label, PendCount, Pill, SectionHead, SlotCard } from '../components/ui';
import { cardSx, signed } from '../components/uiTokens';
import { setChoice, type SectionProps } from './types';

const TRADITION_LABEL: Record<string, string> = {
  arcane: tr('Arcana', 'Arcane'), divine: tr('Divina', 'Divine'), occult: tr('Oculta', 'Occult'), primal: tr('Primal', 'Primal'),
};

type Field = 'repertoire' | 'prepared' | 'spellbook' | 'focus0' | 'focus1' | 'rituals';
type Picking = { caster: string; field: Field; rank: number } | null;

export interface SpellsProps extends SectionProps {
  /** Todas as magias carregadas (listas da tradição e de foco). */
  spells: RuleEntry[];
}

/**
 * Aba Magias (UX §1.2): por conjurador, a tradição, o atributo, CD e ataque com a conta, as magias por dia e as escolhas
 * (grimório, preparadas, repertório). Embaixo, as magias de foco e o pool. "Restam N" só onde a regra fixa o número.
 */
export function SpellsSection({ state, update, compiled, canEdit, index, mesaRules, spells }: SpellsProps) {
  const [picking, setPicking] = useState<Picking>(null);
  const name = (id: string) => index.get(id)?.name ?? id;

  const lists = (key: string): CasterChoices => state.spellcasting[key] ?? {};
  const setList = (key: string, field: 'repertoire' | 'prepared' | 'spellbook', rank: number, ids: string[]) =>
    update((s) => {
      const current = { ...(s.spellcasting[key] ?? {}) };
      if (field === 'spellbook') current.spellbook = ids;
      else current[field] = { ...(current[field] ?? {}), [String(rank)]: ids };
      return { ...s, spellcasting: { ...s.spellcasting, [key]: current } };
    });
  const add = (p: NonNullable<Picking>, id: string) => {
    if (p.field === 'rituals') {
      const prev = lists('rituals').spellbook ?? [];
      if (!prev.includes(id)) setList('rituals', 'spellbook', 0, [...prev, id]);
      return;
    }
    if (p.field === 'focus0' || p.field === 'focus1') {
      const rank = p.field === 'focus0' ? 0 : 1;
      const prev = lists('focus').repertoire?.[String(rank)] ?? [];
      if (!prev.includes(id)) setList('focus', 'repertoire', rank, [...prev, id]);
      return;
    }
    const c = lists(p.caster);
    if (p.field === 'spellbook') {
      if (!(c.spellbook ?? []).includes(id)) setList(p.caster, 'spellbook', 0, [...(c.spellbook ?? []), id]);
      return;
    }
    const prev = c[p.field]?.[String(p.rank)] ?? [];
    // Preparadas repetem de propósito (várias cópias); repertório não.
    if (p.field === 'repertoire' && prev.includes(id)) return;
    setList(p.caster, p.field, p.rank, [...prev, id]);
  };
  const removeAt = (caster: string, field: 'repertoire' | 'prepared' | 'spellbook', rank: number, i: number) => {
    const c = lists(caster);
    const prev = field === 'spellbook' ? c.spellbook ?? [] : c[field]?.[String(rank)] ?? [];
    setList(caster, field, rank, prev.filter((_, j) => j !== i));
  };

  /** Candidatos: da tradição, até o rank (truque só no 0); preparado de grimório escolhe do grimório. */
  const candidates = (p: NonNullable<Picking>): RuleEntry[] => {
    if (p.field === 'rituals') return spells.filter((s) => s.spell?.ritual);
    if (p.field === 'focus0' || p.field === 'focus1') {
      const wantCantrip = p.field === 'focus0';
      return spells.filter((s) => (s.spell?.focus || (s.traits ?? []).includes('Focus')) && !!(s.spell?.cantrip || (s.traits ?? []).includes('Cantrip')) === wantCantrip);
    }
    const caster = compiled.casters.find((c) => c.key === p.caster);
    if (!caster) return [];
    if (p.field === 'prepared' && caster.spellbook) {
      return (lists(p.caster).spellbook ?? []).map((id) => index.get(id)).filter((e): e is RuleEntry => !!e)
        .filter((s) => (p.rank === 0) === !!s.spell?.cantrip && (s.spell?.rank ?? 0) <= Math.max(p.rank, 1));
    }
    const maxRank = p.field === 'spellbook' ? caster.perDay.reduce((m, n, r) => (n > 0 ? r : m), 0) : p.rank;
    return spells.filter((s) => !s.spell?.focus && !s.spell?.ritual && (!caster.tradition || (s.spell?.traditions ?? []).some((t) => t.toLowerCase() === caster.tradition))
      && (p.field === 'spellbook' ? (s.spell?.rank ?? 0) <= maxRank : (p.rank === 0) === !!s.spell?.cantrip && (s.spell?.rank ?? 0) <= Math.max(p.rank, 1)));
  };

  /** Um chip de magia escolhida (tocar tira) e o convite "+ Escolher". */
  const spellChips = (ids: string[], onRemove: (i: number) => void, onAdd: () => void, empty = 1) => (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {ids.map((id, i) => (
        <Pill key={`${id}-${i}`} onClick={canEdit ? () => onRemove(i) : undefined} title={canEdit ? tr('Tocar para tirar', 'Tap to remove') : undefined}>
          {name(id)}{canEdit && <CloseIcon sx={{ fontSize: 14, color: ink.secondary }} />}
        </Pill>
      ))}
      {canEdit && Array.from({ length: Math.max(1, empty) }, (_, k) => (
        <Pill key={`add-${k}`} look="add" onClick={onAdd}>{tr('+ Escolher', '+ Choose')}</Pill>
      ))}
    </Box>
  );

  const casterCard = (caster: Caster) => {
    const c = lists(caster.key);
    const field = caster.type === 'spontaneous' ? 'repertoire' : 'prepared';
    const ranks = caster.perDay.map((n, r) => ({ n, r })).filter(({ n }) => n > 0);
    const needsTradition = compiled.pending.some((p) => p.key === 'spell-tradition') || (index.get(state.class.id)?.class?.casting?.traditions.length ?? 0) > 1;
    const color = caster.tradition ? TRADITION_COLORS[caster.tradition] : ink.secondary;
    return (
      <Box key={caster.key} sx={[cardSx, { overflow: 'hidden' }]}>
        <BandHead right={caster.tradition ? TRADITION_LABEL[caster.tradition] : tr('tradição a escolher', 'tradition to choose')}>{caster.name}</BandHead>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', textAlign: 'center', py: 1.25, px: 0.5, borderBottom: `1px solid ${rule}` }}>
          <Box title={`10 + ${rankName(caster.rank)} + ${attributeLabel(caster.attribute)}`}>
            <Box sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{caster.dc}</Box><Label>{tr('CD', 'DC')}</Label>
          </Box>
          <Box><Box sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{signed(caster.attack)}</Box><Label>{tr('Ataque', 'Attack')}</Label></Box>
          <Box><Box sx={{ fontSize: 15, fontWeight: 700, pt: 0.5 }}>{caster.type === 'prepared' ? tr('Preparado', 'Prepared') : tr('Espontâneo', 'Spontaneous')}</Box><Label>{tr('Lista', 'List')}</Label></Box>
          <Box><Box sx={{ fontSize: 15, fontWeight: 700, pt: 0.5, color }}>{attributeLabel(caster.attribute)}</Box><Label>{tr('Atributo', 'Attribute')}</Label></Box>
        </Box>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {needsTradition && (
            <TextField select size="small" label={tr('Tradição (pela subclasse)', 'Tradition (from the subclass)')} sx={{ minWidth: 220, alignSelf: 'flex-start' }}
              value={caster.tradition ?? ''} disabled={!canEdit}
              onChange={(e) => setChoice(update, 'spell-tradition', e.target.value ? { value: e.target.value } : null)}>
              <MenuItem value="">{tr('Escolher…', 'Choose…')}</MenuItem>
              {(index.get(state.class.id)?.class?.casting?.traditions ?? []).map((t) => <MenuItem key={t} value={t}>{TRADITION_LABEL[t] ?? t}</MenuItem>)}
            </TextField>
          )}
          {caster.source && <Box sx={{ fontSize: 12, color: ink.secondary }}>{tr(`Tabela: ${caster.source} · ${rankName(caster.rank)}`, `Table: ${caster.source} · ${rankName(caster.rank)}`)}</Box>}
          {caster.spellbook && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Box component="b" sx={{ font: `700 15px ${displayFont}` }}>{tr('Grimório', 'Spellbook')}</Box>
                <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{tr(`${(c.spellbook ?? []).length} magias`, `${(c.spellbook ?? []).length} spells`)}</Box>
              </Box>
              {spellChips(c.spellbook ?? [], (i) => removeAt(caster.key, 'spellbook', 0, i), () => setPicking({ caster: caster.key, field: 'spellbook', rank: 0 }))}
            </Box>
          )}
          {ranks.map(({ n, r }) => {
            const chosen = c[field]?.[String(r)] ?? [];
            const left = field === 'prepared' ? Math.max(0, n - chosen.length) : 0;
            const full = field === 'prepared' && left === 0;
            return (
              <Box key={r} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Box component="b" sx={{ font: `700 15px ${displayFont}` }}>{r === 0 ? tr('Truques', 'Cantrips') : tr(`Rank ${r}`, `Rank ${r}`)}</Box>
                  <Box component="span" sx={{ fontSize: 13, color: ink.secondary, flex: 1 }}>
                    {r > 0 ? tr(`${n} por dia`, `${n} per day`) : field === 'prepared' ? tr(`${n} preparados`, `${n} prepared`) : tr(`${n} no repertório`, `${n} in the repertoire`)}
                  </Box>
                  {field === 'prepared' && (
                    <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: full ? status.success : gold.deep }}>{`${Math.min(chosen.length, n)}/${n}${full ? ' ✓' : ''}`}</Box>
                  )}
                </Box>
                {spellChips(chosen, (i) => removeAt(caster.key, field, r, i), () => setPicking({ caster: caster.key, field, rank: r }), field === 'prepared' ? left : 1)}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  const focus = compiled.focus;
  const focusChoices = lists('focus').repertoire ?? {};
  const focusPending = compiled.pending.find((p) => p.key.startsWith('spells-focus') || p.key === 'focus');
  return (
    <Stack spacing={1.5}>
      {compiled.casters.length === 0 && (
        <Typography color="text.secondary">{tr('Esta classe não conjura magias por espaço. Magias de foco ficam abaixo.', 'This class has no spell slots. Focus spells are below.')}</Typography>
      )}
      {compiled.casters.map(casterCard)}

      <Box sx={[cardSx, { p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }]}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Label>{tr('Magias de foco', 'Focus spells')}</Label>
            <Box component="b">{tr(`Lançadas no rank ${focus.heightened}`, `Cast at rank ${focus.heightened}`)}</Box>
          </Box>
          <Box component="span" role="img" aria-label={tr(`${focus.points} ponto(s) de foco`, `${focus.points} focus point(s)`)} sx={{ display: 'flex', gap: '3px' }}>
            {Array.from({ length: 3 }, (_, i) => (
              <Box key={i} component="span" sx={{ width: 14, height: 14, borderRadius: '4px', border: `1px solid ${i < focus.points ? TRADITION_COLORS.divine : rule}`, bgcolor: i < focus.points ? TRADITION_COLORS.divine : 'transparent' }} />
            ))}
          </Box>
          <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums' }}>{focus.points}</Box>
        </Box>
        <Box sx={{ fontSize: 12, color: ink.secondary }}>
          {tr('Um ponto por magia de foco, até 3 (Player Core pg. 298).', 'One point per focus spell, up to 3 (Player Core pg. 298).')}
        </Box>
        {focusPending && <SlotCard look="todo" kicker={focusPending.label} name={tr('Escolher magia de foco', 'Choose a focus spell')} trailing={<PendCount n={focusPending.missing || 1} />}
          onClick={canEdit ? () => setPicking({ caster: 'focus', field: 'focus1', rank: 0 }) : undefined} />}
        {([['focus0', tr('Truques de foco (não contam no pool)', 'Focus cantrips (not counted in the pool)')], ['focus1', tr('Magias de foco', 'Focus spells')]] as const).map(([f, label]) => (
          <Box key={f} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box component="span" sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Box>
            {spellChips(focusChoices[f === 'focus0' ? '0' : '1'] ?? [], (i) => removeAt('focus', 'repertoire', f === 'focus0' ? 0 : 1, i), () => setPicking({ caster: 'focus', field: f, rank: 0 }))}
          </Box>
        ))}
      </Box>

      <Box sx={[cardSx, { p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }]}>
        <SectionHead>{tr('Rituais', 'Rituals')}</SectionHead>
        {spellChips(lists('rituals').spellbook ?? [], (i) => removeAt('rituals', 'spellbook', 0, i), () => setPicking({ caster: 'rituals', field: 'rituals', rank: 0 }))}
      </Box>

      {picking && (
        <ContentPicker open title={picking.field === 'rituals' ? tr('Rituais', 'Rituals') : picking.field === 'spellbook' ? tr('Grimório', 'Spellbook') : picking.field.startsWith('focus') ? tr('Magias de foco', 'Focus spells') : tr(`Magias — rank ${picking.rank}`, `Spells — rank ${picking.rank}`)}
          entries={candidates(picking)} onPick={(id) => add(picking, id)} onClose={() => setPicking(null)} mesaRules={mesaRules}
          secondary={(e) => [e.spell?.cantrip ? tr('truque', 'cantrip') : tr(`rank ${e.spell?.rank ?? e.level ?? 0}`, `rank ${e.spell?.rank ?? e.level ?? 0}`), (e.spell?.traditions ?? []).map((t) => TRADITION_LABEL[t.toLowerCase()] ?? t).join('/')].filter(Boolean).join(' · ')} />
      )}
    </Stack>
  );
}
