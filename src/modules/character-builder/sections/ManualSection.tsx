import { useState } from 'react';
import { Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { displayFont } from '../../../theme';
import { tr } from '../../../i18n';
import { attributeLabel } from '../engine/attributes';
import { ATTRIBUTES, type AttributeKey } from '../engine/types';
import type { Adjustment, BuildState } from '../types';
import type { SectionProps } from './types';

const KINDS: { value: Adjustment['effect']['kind']; label: string; target?: string }[] = [
  { value: 'hp', label: tr('PV', 'HP') },
  { value: 'speed', label: tr('Deslocamento', 'Speed') },
  { value: 'resistance', label: tr('Resistência', 'Resistance'), target: tr('tipo (fire, cold…)', 'type (fire, cold…)') },
  { value: 'sense', label: tr('Sentido', 'Sense'), target: tr('sentido (Darkvision…)', 'sense (Darkvision…)') },
  { value: 'language', label: tr('Idioma', 'Language'), target: tr('idioma', 'language') },
  { value: 'proficiency', label: tr('Proficiência (rank 1–4)', 'Proficiency (rank 1–4)'), target: tr('alvo (skill:athletics, fortitude…)', 'target (skill:athletics, fortitude…)') },
  { value: 'itemBonus', label: tr('Bônus de item', 'Item bonus'), target: tr('alvo (fortitude, reflex, will, perception)', 'target (fortitude, reflex, will, perception)') },
];
const FEAT_KINDS = [
  { value: 'general', label: tr('Geral', 'General') }, { value: 'skill', label: tr('Perícia', 'Skill') },
  { value: 'class', label: tr('Classe', 'Class') }, { value: 'ancestry', label: tr('Ancestralidade', 'Ancestry') },
] as const;
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

let seq = 0;

/**
 * Ajustes manuais (F8.3, MODELO §1 `manual`): o que a regra não cobre e a mesa decidiu — boosts e aumentos extras,
 * talento concedido, buffs permanentes com motivo e atributo definido à mão. Tudo entra nos números e avisa.
 */
export function ManualSection({ state, update, canEdit }: SectionProps) {
  const m = state.manual;
  const [kind, setKind] = useState<Adjustment['effect']['kind']>('hp');
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState('');
  const [value, setValue] = useState('');
  const [slotLevel, setSlotLevel] = useState(1);
  const [slotKind, setSlotKind] = useState<'general' | 'skill' | 'class' | 'ancestry'>('general');
  const setManual = (patch: Partial<BuildState['manual']>) => update((s) => ({ ...s, manual: { ...s.manual, ...patch } }));
  const spec = KINDS.find((k) => k.value === kind)!;

  const addAdjustment = () => {
    if (!label.trim() || !reason.trim()) return;
    const num = Number(value);
    const adj: Adjustment = {
      id: `adj-${Date.now().toString(36)}${(seq++).toString(36)}`, label: label.trim(), reason: reason.trim(),
      effect: { kind, ...(target.trim() ? { target: target.trim() } : {}), ...(value.trim() ? { value: Number.isFinite(num) ? num : value.trim() } : {}) },
    };
    setManual({ adjustments: [...(m.adjustments ?? []), adj] });
    setLabel(''); setReason(''); setTarget(''); setValue('');
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem' }}>{tr('Ajustes manuais', 'Manual adjustments')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tr('Para o que a regra não cobre e a mesa combinou. Entra nos números, sempre com aviso.', 'For what the rules do not cover and the table agreed on. It goes into the numbers, always with a warning.')}
      </Typography>

      <Typography sx={{ fontWeight: 600, mb: 1 }}>{tr('Atributo definido à mão (modificador final)', 'Attribute set by hand (final modifier)')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 1, mb: 2 }}>
        {ATTRIBUTES.map((a: AttributeKey) => (
          <TextField key={a} size="small" type="number" label={attributeLabel(a)} disabled={!canEdit}
            value={m.attributeOverride?.[a] ?? ''}
            onChange={(e) => {
              const next = { ...(m.attributeOverride ?? {}) };
              if (e.target.value === '') delete next[a];
              else next[a] = Math.max(-5, Math.min(15, Math.round(Number(e.target.value))));
              setManual({ attributeOverride: next });
            }} />
        ))}
      </Box>

      <Typography sx={{ fontWeight: 600, mb: 1 }}>{tr('Talento concedido (slot extra)', 'Granted feat (extra slot)')}</Typography>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 1 }}>
        {(m.extraFeatSlots ?? []).map((x, i) => (
          <Chip key={i} label={`${FEAT_KINDS.find((k) => k.value === x.kind)?.label} ${x.level}`}
            onDelete={canEdit ? () => setManual({ extraFeatSlots: (m.extraFeatSlots ?? []).filter((_, j) => j !== i) }) : undefined} />
        ))}
      </Stack>
      {canEdit && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <TextField select size="small" label={tr('Tipo', 'Kind')} value={slotKind} onChange={(e) => setSlotKind(e.target.value as typeof slotKind)} sx={{ minWidth: 130 }}>
            {FEAT_KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={tr('Nível', 'Level')} value={slotLevel} onChange={(e) => setSlotLevel(Number(e.target.value))} sx={{ width: 90 }}>
            {LEVELS.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
          <Button startIcon={<AddIcon />} onClick={() => setManual({ extraFeatSlots: [...(m.extraFeatSlots ?? []), { level: slotLevel, kind: slotKind }] })}>
            {tr('Adicionar slot', 'Add slot')}</Button>
        </Stack>
      )}

      <Typography sx={{ fontWeight: 600, mb: 1 }}>{tr('Ajustes permanentes', 'Permanent adjustments')}</Typography>
      <Stack spacing={0.5} sx={{ mb: 1 }}>
        {(m.adjustments ?? []).map((a) => (
          <Chip key={a.id} sx={{ justifyContent: 'space-between', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
            label={`${a.label}: ${KINDS.find((k) => k.value === a.effect.kind)?.label ?? a.effect.kind}${a.effect.target ? ` ${a.effect.target}` : ''}${a.effect.value !== undefined ? ` ${a.effect.value}` : ''} — ${a.reason}`}
            onDelete={canEdit ? () => setManual({ adjustments: (m.adjustments ?? []).filter((x) => x.id !== a.id) }) : undefined} />
        ))}
      </Stack>
      {canEdit && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1 }}>
          <TextField select size="small" label={tr('Efeito', 'Effect')} value={kind} onChange={(e) => setKind(e.target.value as Adjustment['effect']['kind'])}>
            {KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
          </TextField>
          {spec.target && <TextField size="small" label={spec.target} value={target} onChange={(e) => setTarget(e.target.value)} slotProps={{ htmlInput: { maxLength: 60 } }} />}
          {kind !== 'sense' && kind !== 'language' && <TextField size="small" label={tr('Valor', 'Value')} value={value} onChange={(e) => setValue(e.target.value)} slotProps={{ htmlInput: { maxLength: 20 } }} />}
          <TextField size="small" label={tr('Nome', 'Name')} value={label} onChange={(e) => setLabel(e.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }} />
          <TextField size="small" label={tr('Motivo', 'Reason')} value={reason} onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
          <Button startIcon={<AddIcon />} onClick={addAdjustment} disabled={!label.trim() || !reason.trim()}>{tr('Adicionar ajuste', 'Add adjustment')}</Button>
        </Box>
      )}
    </Paper>
  );
}
