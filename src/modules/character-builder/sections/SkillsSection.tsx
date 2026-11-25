import { useState } from 'react';
import { Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { displayFont } from '../../../theme';
import { tr } from '../../../i18n';
import { SKILLS } from '../../character-viewer/checks';
import { attributeLabel } from '../engine/attributes';
import { proficiencyBonus, rankName } from '../engine/compile';
import { loreName } from '../engine/skills';
import { SKILL_ATTRIBUTE, type Rank, type SkillKey } from '../engine/types';
import type { SkillSlot } from '../engine/skills';
import { setChoice, type SectionProps } from './types';

const LABEL = Object.fromEntries(SKILLS.map((s) => [s.key, s.label])) as Record<SkillKey, string>;
const PIPS = ['T', 'E', 'M', 'L'];
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

const refLabel = (ref: string) => (ref.startsWith('skill:') ? LABEL[ref.slice(6) as SkillKey] ?? ref.slice(6) : tr(`Lore (${loreName(ref)})`, `${loreName(ref)} Lore`));

/** Os pips T E M L com rótulo acessível ("Treinado em Atletismo"). */
const Pips = ({ rank, name }: { rank: Rank; name: string }) => (
  <Box component="span" aria-label={`${rankName(rank)} ${tr('em', 'in')} ${name}`} sx={{ display: 'inline-flex', gap: 0.25 }}>
    {PIPS.map((p, i) => (
      <Box key={p} component="span" aria-hidden sx={{
        width: 18, height: 18, borderRadius: 0.5, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: 1, borderColor: i < rank ? 'primary.main' : 'divider', bgcolor: i < rank ? 'primary.main' : 'transparent', color: i < rank ? 'primary.contrastText' : 'text.disabled',
      }}>{p}</Box>
    ))}
  </Box>
);

/** Aba Perícias: treinos automáticos, escolhas da classe, perícias livres (com Lore), aumentos por nível. */
export function SkillsSection({ state, update, compiled, canEdit }: SectionProps) {
  const [lore, setLore] = useState<Record<string, string>>({});
  const { rank, lores } = compiled.skills;
  const level = compiled.level;
  const mod = compiled.attributes.mod;

  const pick = (slot: SkillSlot, ref: string) => {
    const single = slot.count === 1 && (slot.kind === 'increase' || slot.key === 'skills-dedication-2') || slot.key.startsWith('class-skill');
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

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 1.5 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 2, rowGap: 0.5 }}>
          {SKILLS.map((s) => {
            const r = rank[s.key as SkillKey] ?? 0;
            const attr = SKILL_ATTRIBUTE[s.key as SkillKey];
            return (
              <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
                title={`${rankName(r)} ${signed(proficiencyBonus(r, level))} · ${attributeLabel(attr)} ${signed(mod[attr])}`}>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{s.label}</Typography>
                <Pips rank={r} name={s.label} />
                <Typography variant="body2" sx={{ fontWeight: 700, width: 32, textAlign: 'right' }}>{signed(proficiencyBonus(r, level) + mod[attr] + (compiled.skillBonus[s.key as SkillKey] ?? 0))}</Typography>
              </Box>
            );
          })}
          {lores.map((l) => (
            <Box key={l.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{tr(`Lore (${l.name})`, `${l.name} Lore`)}</Typography>
              <Pips rank={l.rank} name={l.name} />
              <Typography variant="body2" sx={{ fontWeight: 700, width: 32, textAlign: 'right' }}>{signed(proficiencyBonus(l.rank, level) + mod.int)}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {compiled.pending.some((p) => p.key === 'abp-skills') || 'abp-skills' in state.choices ? (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700 }}>{tr('Potência de perícia (ABP)', 'Skill potency (ABP)')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {tr('Escolha na ordem: a primeira recebe a maior potência do nível (GM Core pg. 83).', 'Pick in order: the first gets the level\'s highest potency (GM Core pg. 83).')}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {SKILLS.map((sk) => {
              const ref = `skill:${sk.key}`;
              const order = (() => { const c = state.choices['abp-skills']; return c && 'skills' in c ? c.skills : []; })();
              const i = order.indexOf(ref);
              return (
                <Chip key={ref} label={i >= 0 ? `${i + 1}. ${sk.label}` : sk.label} color={i >= 0 ? 'primary' : 'default'} variant={i >= 0 ? 'filled' : 'outlined'}
                  onClick={canEdit ? () => setChoice(update, 'abp-skills', (() => { const next = i >= 0 ? order.filter((x) => x !== ref) : [...order, ref]; return next.length ? { skills: next } : null; })()) : undefined} />
              );
            })}
          </Stack>
        </Paper>
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
          <Paper key={slot.key} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700, flex: 1, minWidth: 0 }}>{slot.label}</Typography>
              <Typography variant="body2" color={left ? 'warning.main' : 'text.secondary'}>{left ? tr(`Restam ${left}`, `${left} left`) : tr('Completo', 'Done')}</Typography>
            </Stack>
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
                  <Chip key={ref} label={refLabel(ref)} color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'}
                    disabled={taken} onClick={canEdit && !taken ? () => pick(slot, ref) : undefined} />
                );
              })}
            </Stack>
            {slot.kind === 'train' && !slot.key.startsWith('class-skill') && canEdit && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <TextField size="small" label={tr('Lore (nome)', 'Lore (name)')} value={lore[slot.key] ?? ''} sx={{ flex: 1, maxWidth: 280 }}
                  onChange={(e) => setLore({ ...lore, [slot.key]: e.target.value })} slotProps={{ htmlInput: { maxLength: 40 } }}
                  onKeyDown={(e) => { if (e.key === 'Enter') addLore(slot); }} />
                <Button onClick={() => addLore(slot)}>{tr('Adicionar Lore', 'Add Lore')}</Button>
              </Stack>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
