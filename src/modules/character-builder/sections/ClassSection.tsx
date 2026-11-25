import { useState } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { displayFont } from '../../../theme';
import { tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { PickerField } from '../components/PickerField';
import { attributeLabel } from '../engine/attributes';
import { rankName } from '../engine/compile';
import type { Rank } from '../engine/types';
import type { RuleEntry } from '../rules/types';
import { Fact } from './OriginSection';
import type { SectionProps } from './types';

const ranks = (record: Partial<Record<string, number>> | undefined, labels: Record<string, string>) =>
  Object.entries(record ?? {}).filter(([, r]) => (r ?? 0) > 0)
    .map(([k, r]) => `${labels[k] ?? k} ${rankName((r ?? 0) as Rank).toLowerCase()}`).join(', ') || '—';

const ATTACKS: Record<string, string> = { simple: tr('simples', 'simple'), martial: tr('marciais', 'martial'), advanced: tr('avançadas', 'advanced'), unarmed: tr('desarmado', 'unarmed') };
const DEFENSES: Record<string, string> = { light: tr('leve', 'light'), medium: tr('média', 'medium'), heavy: tr('pesada', 'heavy'), unarmored: tr('sem armadura', 'unarmored') };
const SAVES: Record<string, string> = { fortitude: tr('Fortitude', 'Fortitude'), reflex: tr('Reflexos', 'Reflex'), will: tr('Vontade', 'Will') };

const classFacts = (e: RuleEntry) => {
  const c = e.class;
  return (
    <Stack spacing={0.25}>
      <Fact label={tr('PV por nível', 'HP per level')} value={c?.hp !== undefined ? tr(`${c.hp} + CON`, `${c.hp} + CON`) : '—'} />
      <Fact label={tr('Atributo-chave', 'Key attribute')} value={(c?.keyAttribute ?? []).map(attributeLabel).join(tr(' ou ', ' or ')) || '—'} />
      <Fact label={tr('Percepção', 'Perception')} value={c?.perception ? rankName(c.perception) : '—'} />
      <Fact label={tr('Salvaguardas', 'Saves')} value={ranks(c?.saves, SAVES)} />
      <Fact label={tr('Ataques', 'Attacks')} value={ranks(c?.attacks, ATTACKS)} />
      <Fact label={tr('Defesas', 'Defenses')} value={ranks(c?.defenses, DEFENSES)} />
      <Fact label={tr('Perícias', 'Skills')} value={tr(`${(c?.trainedSkills?.fixed ?? []).join(', ') || '—'} + ${c?.trainedSkills?.additional ?? 0} + INT`, `${(c?.trainedSkills?.fixed ?? []).join(', ') || '—'} + ${c?.trainedSkills?.additional ?? 0} + INT`)} />
    </Stack>
  );
};

/** Aba Classe: a classe e o atributo-chave (o boost da classe, Player Core pg. 17). */
export function ClassSection({ state, update, core, mesaRules, canEdit, index }: SectionProps) {
  const [open, setOpen] = useState(false);
  const cls = index.get(state.class.id);
  const keys = cls?.class?.keyAttribute ?? [];
  const setClass = (patch: Partial<typeof state.class>) => update((s) => ({ ...s, class: { ...s.class, ...patch } }));

  return (
    <Stack spacing={2}>
      <PickerField label={tr('Classe', 'Class')} value={cls?.name} onOpen={() => setOpen(true)} disabled={!canEdit}
        hint={cls?.class?.hp !== undefined ? tr(`${cls.class.hp} PV + CON por nível`, `${cls.class.hp} HP + CON per level`) : undefined} />
      {cls && (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700, mb: 1 }}>{tr('Atributo-chave', 'Key attribute')}</Typography>
          {keys.length > 1 ? (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {keys.map((k) => (
                <Chip key={k} label={attributeLabel(k)} color={state.class.keyAttribute === k ? 'primary' : 'default'}
                  variant={state.class.keyAttribute === k ? 'filled' : 'outlined'} onClick={canEdit ? () => setClass({ keyAttribute: k }) : undefined} />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2">{keys[0] ? attributeLabel(keys[0]) : '—'}</Typography>
          )}
          <Box sx={{ mt: 2 }}>{classFacts(cls)}</Box>
          {state.level > 1 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {tr('As características dos níveis seguintes entram na próxima etapa do Criador.', 'Features of the following levels arrive in the next stage of the Builder.')}
            </Typography>
          )}
        </Paper>
      )}
      <ContentPicker open={open} title={tr('Classe', 'Class')} entries={core.classes} value={state.class.id}
        onPick={(id) => setClass({ id, keyAttribute: undefined })} onClose={() => setOpen(false)} mesaRules={mesaRules} facts={classFacts}
        secondary={(e) => (e.class ? `${e.class.hp ?? '—'} ${tr('PV', 'HP')} · ${(e.class.keyAttribute ?? []).map(attributeLabel).join('/')}` : undefined)} />
    </Stack>
  );
}
