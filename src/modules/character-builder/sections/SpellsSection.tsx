import { useState } from 'react';
import { Box, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { displayFont } from '../../../theme';
import { tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { attributeLabel } from '../engine/attributes';
import { rankName } from '../engine/compile';
import type { Caster } from '../engine/spells';
import type { RuleEntry } from '../rules/types';
import type { CasterChoices } from '../types';
import { setChoice, type SectionProps } from './types';

const TRADITION_LABEL: Record<string, string> = {
  arcane: tr('Arcana', 'Arcane'), divine: tr('Divina', 'Divine'), occult: tr('Ocultista', 'Occult'), primal: tr('Primal', 'Primal'),
};
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

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

  const casterCard = (caster: Caster) => {
    const c = lists(caster.key);
    const field = caster.type === 'spontaneous' ? 'repertoire' : 'prepared';
    const ranks = caster.perDay.map((n, r) => ({ n, r })).filter(({ n }) => n > 0);
    const needsTradition = compiled.pending.some((p) => p.key === 'spell-tradition') || (index.get(state.class.id)?.class?.casting?.traditions.length ?? 0) > 1;
    return (
      <Paper key={caster.key} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700 }}>{caster.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {[caster.tradition ? TRADITION_LABEL[caster.tradition] : tr('tradição a escolher', 'tradition to choose'),
            caster.type === 'prepared' ? tr('preparado', 'prepared') : tr('espontâneo', 'spontaneous'),
            `${attributeLabel(caster.attribute)}`, rankName(caster.rank)].join(' · ')}
        </Typography>
        {needsTradition && (
          <TextField select size="small" label={tr('Tradição (pela subclasse)', 'Tradition (from the subclass)')} sx={{ mb: 1.5, minWidth: 220 }}
            value={caster.tradition ?? ''} disabled={!canEdit}
            onChange={(e) => setChoice(update, 'spell-tradition', e.target.value ? { value: e.target.value } : null)}>
            <MenuItem value="">{tr('Escolher…', 'Choose…')}</MenuItem>
            {(index.get(state.class.id)?.class?.casting?.traditions ?? []).map((t) => <MenuItem key={t} value={t}>{TRADITION_LABEL[t] ?? t}</MenuItem>)}
          </TextField>
        )}
        <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
          <Typography title={`10 + ${rankName(caster.rank)} + ${attributeLabel(caster.attribute)}`}>{tr('CD', 'DC')} <b>{caster.dc}</b></Typography>
          <Typography>{tr('Ataque', 'Attack')} <b>{signed(caster.attack)}</b></Typography>
          {caster.source && <Typography variant="caption" color="text.secondary">{tr(`Tabela: ${caster.source}`, `Table: ${caster.source}`)}</Typography>}
        </Stack>

        {caster.spellbook && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{tr('Grimório', 'Spellbook')}</Typography>
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
              {(c.spellbook ?? []).map((id, i) => (
                <Chip key={`${id}-${i}`} size="small" label={name(id)} onDelete={canEdit ? () => removeAt(caster.key, 'spellbook', 0, i) : undefined} />
              ))}
              {canEdit && <Chip size="small" icon={<AddIcon />} label={tr('Adicionar', 'Add')} variant="outlined" onClick={() => setPicking({ caster: caster.key, field: 'spellbook', rank: 0 })} />}
            </Stack>
          </Box>
        )}

        <Stack spacing={1}>
          {ranks.map(({ n, r }) => {
            const chosen = c[field]?.[String(r)] ?? [];
            const left = field === 'prepared' ? Math.max(0, n - chosen.length) : null;
            return (
              <Box key={r}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {r === 0 ? tr('Truques', 'Cantrips') : tr(`Rank ${r}`, `Rank ${r}`)}
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                    {' · '}{r > 0 ? tr(`${n} por dia`, `${n} per day`)
                      : field === 'prepared' ? tr(`${n} preparados`, `${n} prepared`) : tr(`${n} no repertório`, `${n} in the repertoire`)}
                    {left !== null && left > 0 ? tr(` · restam ${left}`, ` · ${left} left`) : ''}
                  </Box>
                </Typography>
                <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {chosen.map((id, i) => (
                    <Chip key={`${id}-${i}`} size="small" label={name(id)} onDelete={canEdit ? () => removeAt(caster.key, field, r, i) : undefined} />
                  ))}
                  {canEdit && <Chip size="small" icon={<AddIcon />} label={tr('Adicionar', 'Add')} variant="outlined" onClick={() => setPicking({ caster: caster.key, field, rank: r })} />}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Paper>
    );
  };

  const focus = compiled.focus;
  const focusChoices = lists('focus').repertoire ?? {};
  return (
    <Stack spacing={2}>
      {compiled.casters.length === 0 && (
        <Typography color="text.secondary">{tr('Esta classe não conjura magias por espaço. Magias de foco ficam abaixo.', 'This class has no spell slots. Focus spells are below.')}</Typography>
      )}
      {compiled.casters.map(casterCard)}

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700 }}>{tr('Magias de foco', 'Focus spells')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {tr(`Pool: ${focus.points} ponto(s) — uma por magia de foco, até 3 (Player Core pg. 298). Lançadas no rank ${focus.heightened}.`,
            `Pool: ${focus.points} point(s) — one per focus spell, up to 3 (Player Core pg. 298). Cast at rank ${focus.heightened}.`)}
        </Typography>
        {([['focus0', tr('Truques de foco (não contam no pool)', 'Focus cantrips (not counted in the pool)')], ['focus1', tr('Magias de foco', 'Focus spells')]] as const).map(([f, label]) => (
          <Box key={f} sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {(focusChoices[f === 'focus0' ? '0' : '1'] ?? []).map((id, i) => (
                <Chip key={`${id}-${i}`} size="small" label={name(id)}
                  onDelete={canEdit ? () => removeAt('focus', 'repertoire', f === 'focus0' ? 0 : 1, i) : undefined} />
              ))}
              {canEdit && <Chip size="small" icon={<AddIcon />} label={tr('Adicionar', 'Add')} variant="outlined" onClick={() => setPicking({ caster: 'focus', field: f, rank: 0 })} />}
            </Stack>
          </Box>
        ))}
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700 }}>{tr('Rituais', 'Rituals')}</Typography>
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          {(lists('rituals').spellbook ?? []).map((id, i) => (
            <Chip key={`${id}-${i}`} size="small" label={name(id)} onDelete={canEdit ? () => removeAt('rituals', 'spellbook', 0, i) : undefined} />
          ))}
          {canEdit && <Chip size="small" icon={<AddIcon />} label={tr('Adicionar', 'Add')} variant="outlined" onClick={() => setPicking({ caster: 'rituals', field: 'rituals', rank: 0 })} />}
        </Stack>
      </Paper>

      {picking && (
        <ContentPicker open title={picking.field === 'rituals' ? tr('Rituais', 'Rituals') : picking.field === 'spellbook' ? tr('Grimório', 'Spellbook') : picking.field.startsWith('focus') ? tr('Magias de foco', 'Focus spells') : tr(`Magias — rank ${picking.rank}`, `Spells — rank ${picking.rank}`)}
          entries={candidates(picking)} onPick={(id) => add(picking, id)} onClose={() => setPicking(null)} mesaRules={mesaRules}
          secondary={(e) => [e.spell?.cantrip ? tr('truque', 'cantrip') : tr(`rank ${e.spell?.rank ?? e.level ?? 0}`, `rank ${e.spell?.rank ?? e.level ?? 0}`), (e.spell?.traditions ?? []).join('/')].filter(Boolean).join(' · ')} />
      )}
    </Stack>
  );
}
