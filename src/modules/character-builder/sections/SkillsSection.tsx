import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { gold, ink, rule, status } from '../../../theme';
import { tr } from '../../../i18n';
import { SKILLS } from '../../character-viewer/checks';
import { attributeLabel } from '../engine/attributes';
import { proficiencyBonus, rankName } from '../engine/compile';
import { loreName } from '../engine/skills';
import { SKILL_ATTRIBUTE, type Rank, type SkillKey } from '../engine/types';
import type { SkillSlot } from '../engine/skills';
import { PendCount, Pill, Pips, SectionHead } from '../components/ui';
import { cardSx, signed, tint } from '../components/uiTokens';
import { setChoice, type SectionProps } from './types';

const LABEL = Object.fromEntries(SKILLS.map((s) => [s.key, s.label])) as Record<SkillKey, string>;

const refLabel = (ref: string) => (ref.startsWith('skill:') ? LABEL[ref.slice(6) as SkillKey] ?? ref.slice(6) : tr(`Lore (${loreName(ref)})`, `${loreName(ref)} Lore`));

/** Aba Perícias: treinos automáticos, escolhas da classe, perícias livres (com Lore), aumentos por nível. */
export function SkillsSection({ state, update, compiled, canEdit }: SectionProps) {
  const [lore, setLore] = useState<Record<string, string>>({});
  const { rank, lores } = compiled.skills;
  const level = compiled.level;
  const mod = compiled.attributes.mod;

  const pick = (slot: SkillSlot, ref: string) => {
    const single = slot.count === 1 && (slot.kind === 'increase' || slot.key === 'skills-dedication-2' || slot.key === 'skills-esoterica') || slot.key.startsWith('class-skill');
    const next = single ? (slot.chosen.includes(ref) ? [] : [ref])
      : slot.chosen.includes(ref) ? slot.chosen.filter((x) => x !== ref) : [...slot.chosen, ref];
    setChoice(update, slot.key, next.length ? { skills: next } : null);
  };
  const addLore = (slot: SkillSlot) => {
    const name = (lore[slot.key] ?? '').trim();
    if (!name) return;
    const ref = `lore:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    if (ref !== 'lore:' && !slot.chosen.includes(ref)) setChoice(update, slot.key, { skills: slot.key === 'skills-dedication-2' ? [ref] : [...slot.chosen, ref] });
    setLore({ ...lore, [slot.key]: '' });
  };

  // De onde veio cada treino (automático pela origem/classe ou a escolha de qual slot).
  const sourceOf = new Map<string, string>();
  for (const a of compiled.automaticSkills) sourceOf.set(a.ref, a.source);
  for (const slot of compiled.skillSlots) for (const ref of slot.chosen) if (!sourceOf.has(ref)) sourceOf.set(ref, slot.label);
  const trainSlots = compiled.skillSlots.filter((sl) => sl.kind === 'train' && sl.count > 0);
  const trainLeft = trainSlots.reduce((n, sl) => n + Math.max(0, sl.count - sl.chosen.length), 0);
  const trainTotal = trainSlots.reduce((n, sl) => n + sl.count, 0);
  const row = (key: string, name: string, attr: string, r: Rank, total: number, last: boolean) => (
    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48, py: 0.5, px: 1.5, borderBottom: last ? 0 : `1px solid ${rule}` }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box component="span" sx={{ fontWeight: 600, fontSize: 15, overflowWrap: 'anywhere' }}>{name}</Box>
        <Box component="span" sx={{ fontSize: 12, color: ink.secondary }}>{[attr, sourceOf.get(key)].filter(Boolean).join(' · ')}</Box>
      </Box>
      <Pips rank={r} name={name} />
      <Box component="b" sx={{ width: 36, textAlign: 'right', fontSize: 16, fontVariantNumeric: 'tabular-nums', color: r ? ink.primary : ink.secondary }}
        title={`${rankName(r)} ${signed(proficiencyBonus(r, level))} · ${attr}`}>{signed(total)}</Box>
    </Box>
  );

  return (
    <Stack spacing={1.5}>
      {trainLeft > 0 && (
        <Box sx={{ px: 1.75, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, border: `1.5px dashed ${gold.main}`, bgcolor: tint.gold, borderRadius: '6px' }}>
          <PendCount n={trainLeft} />
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box component="b" sx={{ fontSize: 15 }}>{tr(`${trainTotal - trainLeft} de ${trainTotal} treinos escolhidos`, `${trainTotal - trainLeft} of ${trainTotal} trainings chosen`)}</Box>
            <Box component="span" sx={{ fontSize: 12, color: ink.secondary }}>{tr('Escolha nos cartões abaixo.', 'Choose in the cards below.')}</Box>
          </Box>
        </Box>
      )}
      <Box sx={[cardSx, { overflow: 'hidden', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, columnGap: 0 }]}>
        {SKILLS.map((sk, i) => {
          const r = rank[sk.key as SkillKey] ?? 0;
          const attr = SKILL_ATTRIBUTE[sk.key as SkillKey];
          const total = proficiencyBonus(r, level) + mod[attr] + (compiled.skillBonus[sk.key as SkillKey] ?? 0);
          return row(`skill:${sk.key}`, sk.label, attributeLabel(attr), r, total, i === SKILLS.length - 1 && !lores.length);
        })}
        {lores.map((l, i) => row(l.key, tr(`Lore (${l.name})`, `${l.name} Lore`), attributeLabel('int'), l.rank, proficiencyBonus(l.rank, level) + mod.int, i === lores.length - 1))}
      </Box>

      {compiled.pending.some((p) => p.key === 'abp-skills') || 'abp-skills' in state.choices ? (
        <Box sx={[cardSx, { p: { xs: 1.5, sm: 2 } }]}>
          <SectionHead>{tr('Potência de perícia (ABP)', 'Skill potency (ABP)')}</SectionHead>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {tr('Escolha na ordem: a primeira recebe a maior potência do nível (GM Core pg. 83).', 'Pick in order: the first gets the level\'s highest potency (GM Core pg. 83).')}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {SKILLS.map((sk) => {
              const ref = `skill:${sk.key}`;
              const order = (() => { const c = state.choices['abp-skills']; return c && 'skills' in c ? c.skills : []; })();
              const i = order.indexOf(ref);
              return (
                <Pill key={ref} look={i >= 0 ? 'sel' : 'default'}
                  onClick={canEdit ? () => setChoice(update, 'abp-skills', (() => { const next = i >= 0 ? order.filter((x) => x !== ref) : [...order, ref]; return next.length ? { skills: next } : null; })()) : undefined}>
                  {i >= 0 ? `${i + 1}. ${sk.label}` : sk.label}</Pill>
              );
            })}
          </Stack>
        </Box>
      ) : null}

      {compiled.automaticSkills.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {tr('Automáticas: ', 'Automatic: ')}{compiled.automaticSkills.map((a) => `${refLabel(a.ref)} (${a.source})`).join(', ')}
        </Typography>
      )}

      {compiled.skillSlots.filter((s) => s.count > 0).map((slot) => {
        const left = Math.max(0, slot.count - slot.chosen.length);
        const options = slot.loreOnly ? [] : slot.options.length ? slot.options : SKILLS.map((s) => `skill:${s.key}`);
        const customLores = slot.chosen.filter((ref) => ref.startsWith('lore:') && !options.includes(ref));
        return (
          <Box key={slot.key} sx={[cardSx, { p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }, left ? { border: `1.5px dashed ${gold.main}` } : {}]}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Box component="h3" sx={{ m: 0, fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{slot.label}</Box>
              <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: left ? gold.deep : status.success }}>
                {left ? tr(`Restam ${left}`, `${left} left`) : `${slot.chosen.length}/${slot.count} ✓`}</Box>
            </Box>
            {slot.kind === 'increase' && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {tr('Treina uma perícia nova ou sobe uma treinada; mestre a partir do 7, lendário do 15 (Player Core pg. 92).', 'Train a new skill or raise a trained one; master from 7th, legendary from 15th (Player Core pg. 92).')}
              </Typography>
            )}
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {[...options, ...customLores].map((ref) => {
                const on = slot.chosen.includes(ref);
                const key = ref.slice(6) as SkillKey;
                // No treino, a perícia já treinada por outra fonte não aparece como opção (a não ser a desta escolha).
                const taken = slot.kind === 'train' && !on && ref.startsWith('skill:') && (rank[key] ?? 0) > 0;
                return (
                  <Pill key={ref} look={on ? 'sel' : taken ? 'lock' : 'default'} disabled={taken}
                    onClick={canEdit && !taken ? () => pick(slot, ref) : undefined}>{refLabel(ref)}</Pill>
                );
              })}
            </Stack>
            {slot.kind === 'train' && !slot.key.startsWith('class-skill') && slot.key !== 'skills-esoterica' && canEdit && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <TextField size="small" label={tr('Lore (nome)', 'Lore (name)')} value={lore[slot.key] ?? ''} sx={{ flex: 1, maxWidth: 280 }}
                  onChange={(e) => setLore({ ...lore, [slot.key]: e.target.value })} slotProps={{ htmlInput: { maxLength: 40 } }}
                  onKeyDown={(e) => { if (e.key === 'Enter') addLore(slot); }} />
                <Button onClick={() => addLore(slot)}>{tr('Adicionar Lore', 'Add Lore')}</Button>
              </Stack>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
