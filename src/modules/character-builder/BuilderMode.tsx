import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Badge, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Drawer, MenuItem, Paper,
  Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { ArrowBack as BackIcon, DeleteOutline as DeleteIcon, Checklist as PendingIcon } from '@mui/icons-material';
import { trashBuild } from '../../services/builds';
import { displayFont } from '../../theme';
import { tr } from '../../i18n';
import { ReadOnlyTheme } from '../character-viewer/components/ReadOnlyTheme';
import { VIEW_OK } from '../character-viewer/sheetAccess';
import { useBuild, type SaveStatus } from './hooks/useBuild';
import { useRules } from './hooks/useRules';
import { compileBuild } from './engine/compile';
import { StatusHeader } from './components/StatusHeader';
import { PendingPanel } from './components/PendingPanel';
import { OriginSection } from './sections/OriginSection';
import { ClassSection } from './sections/ClassSection';
import { AttributesSection } from './sections/AttributesSection';
import { SkillsSection } from './sections/SkillsSection';
import type { SectionProps } from './sections/types';
import { tabOf, type BuilderTab } from './tabs';
import type { BuildState } from './types';

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  pending: tr('Alterações por salvar…', 'Unsaved changes…'),
  saving: tr('Salvando…', 'Saving…'),
  saved: tr('Salvo', 'Saved'),
  offline: tr('Sem conexão — salvo neste aparelho', 'No connection — saved on this device'),
  error: tr('Não foi possível salvar — salvo neste aparelho', 'Could not save — saved on this device'),
};

const TABS: { key: BuilderTab; label: string }[] = [
  { key: 'origin', label: tr('Origem', 'Origin') },
  { key: 'class', label: tr('Classe', 'Class') },
  { key: 'attributes', label: tr('Atributos', 'Attributes') },
  { key: 'skills', label: tr('Perícias', 'Skills') },
  { key: 'details', label: tr('Detalhes', 'Details') },
];

type DetailKey = keyof BuildState['details'];
const DETAIL_FIELDS: { key: DetailKey; label: string }[] = [
  { key: 'age', label: tr('Idade', 'Age') },
  { key: 'gender', label: tr('Gênero', 'Gender') },
  { key: 'pronouns', label: tr('Pronomes', 'Pronouns') },
  { key: 'ethnicity', label: tr('Etnia', 'Ethnicity') },
  { key: 'nationality', label: tr('Nacionalidade', 'Nationality') },
];

/**
 * O modo editar de um personagem: resumo ao vivo, abas (Origem, Classe, Atributos, Perícias, Detalhes) e as pendências
 * e avisos do motor. Na F7 passa a ser montado pela Ficha em `?modo=editar`.
 */
export function BuilderMode({ buildId }: { buildId: string }) {
  const navigate = useNavigate();
  const rules = useRules();
  const [className, setClassName] = useState<string | null>(null);
  const { build, state, canEdit, loading, error, status, conflict, update, keepMine, takeTheirs, reload } = useBuild(buildId, className);
  const [tab, setTab] = useState<BuilderTab>('origin');
  const [pendingOpen, setPendingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const compiled = useMemo(() => (state && rules.index ? compileBuild(state, { rules: rules.index, mesaRules: rules.mesaRules ?? undefined }) : null),
    [state, rules.index, rules.mesaRules]);
  const clsName = rules.index?.get(state?.class.id)?.name ?? null;
  useEffect(() => setClassName(clsName), [clsName]);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Skeleton variant="rounded" height={72} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={320} />
      </Box>
    );
  }
  if (error && !state) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Alert severity="error" action={<Button color="inherit" onClick={reload}>{tr('Tentar de novo', 'Try again')}</Button>}>{error}</Alert>
        <Button component={RouterLink} to="/personagens" startIcon={<BackIcon />} sx={{ mt: 2 }}>{tr('Personagens', 'Characters')}</Button>
      </Box>
    );
  }
  if (!state || !build) return null;

  const setName = (name: string) => update((s) => ({ ...s, name }));
  const setLevel = (level: number) => update((s) => ({ ...s, level }));
  const setDetail = (key: DetailKey, value: string) =>
    update((s) => {
      const details = { ...s.details };
      if (value) details[key] = value;
      else delete details[key];
      return { ...s, details };
    });
  const discard = (key: string) => update((s) => {
    const choices = { ...s.choices };
    delete choices[key];
    return { ...s, choices };
  });

  const remove = async () => {
    const out = await trashBuild(build.id, true);
    if (!out.ok) {
      setDeleteError(out.error);
      return;
    }
    navigate('/personagens');
  };

  const nameMissing = !state.name.trim();
  const rulesVersion = rules.core?.version ?? null;
  const pendingCount = compiled ? compiled.pending.length : 0;
  const tabPending = (key: BuilderTab) => compiled?.pending.filter((p) => tabOf(p.key) === key).length ?? 0;
  const go = (next: BuilderTab) => {
    setTab(next);
    setPendingOpen(false);
  };

  const sectionProps: SectionProps | null = compiled && rules.core && rules.index
    ? { state, update, core: rules.core, index: rules.index, mesaRules: rules.mesaRules, compiled, canEdit }
    : null;

  const panel = compiled && <PendingPanel compiled={compiled} onGo={go} onDiscard={discard} canEdit={canEdit} />;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Button component={RouterLink} to="/personagens" startIcon={<BackIcon />} sx={{ mb: 1 }} {...VIEW_OK}>
        {tr('Personagens', 'Characters')}</Button>

      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {tr('Somente leitura — personagem de outra pessoa.', 'Read only — someone else\'s character.')}
        </Alert>
      )}
      {rules.error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {tr('Não foi possível carregar as regras agora. O que você já escolheu continua salvo.', 'Could not load the rules right now. What you already chose stays saved.')}
        </Alert>
      )}
      {canEdit && rulesVersion && state.rulesVersion && state.rulesVersion !== rulesVersion && (
        <Alert severity="info" sx={{ mb: 2 }}
          action={<Button color="inherit" onClick={() => update((s) => ({ ...s, rulesVersion }))}>{tr('Usar as novas', 'Use the new ones')}</Button>}>
          {tr(`Regras atualizadas desde a última edição (${state.rulesVersion} → ${rulesVersion}). Nada muda até você escolher usar as novas.`,
            `Rules updated since the last edit (${state.rulesVersion} → ${rulesVersion}). Nothing changes until you choose to use the new ones.`)}
        </Alert>
      )}

      <ReadOnlyTheme on={!canEdit}>
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 96px', sm: '1fr 120px' }, gap: 1.5 }}>
            <TextField label={tr('Nome', 'Name')} value={state.name} onChange={(e) => setName(e.target.value)} size="small"
              error={nameMissing} helperText={nameMissing ? tr('O nome não pode ficar vazio.', 'The name can\'t be empty.') : undefined}
              slotProps={{ htmlInput: { maxLength: 80, readOnly: !canEdit } }} />
            <TextField select size="small" label={tr('Nível', 'Level')} value={state.level} onChange={(e) => setLevel(Number(e.target.value))}
              disabled={!canEdit}>
              {LEVELS.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
          </Box>
          <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {status !== 'idle' && (
              <Chip size="small" variant="outlined" label={STATUS_LABEL[status]}
                color={status === 'offline' || status === 'error' ? 'warning' : 'default'} />
            )}
            {rulesVersion && <Typography variant="caption" color="text.secondary">{tr(`Regras ${rulesVersion}`, `Rules ${rulesVersion}`)}</Typography>}
            <Box sx={{ flex: 1 }} />
            <Button size="small" startIcon={<Badge badgeContent={pendingCount} color="warning"><PendingIcon /></Badge>}
              onClick={() => setPendingOpen(true)} sx={{ display: { md: 'none' } }} {...VIEW_OK}>
              {tr('Pendências', 'To do')}</Button>
          </Stack>
        </Paper>

        {compiled ? <StatusHeader compiled={compiled} /> : <Skeleton variant="rounded" height={64} sx={{ mb: 2 }} />}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' }, gap: 2, alignItems: 'start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Tabs value={tab} onChange={(_, v: BuilderTab) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
              {TABS.map((t) => (
                <Tab key={t.key} value={t.key} data-view=""
                  label={tabPending(t.key) ? <Badge color="warning" variant="dot">{t.label}</Badge> : t.label} />
              ))}
            </Tabs>

            {!sectionProps && tab !== 'details' && <Skeleton variant="rounded" height={240} />}
            {sectionProps && tab === 'origin' && <OriginSection {...sectionProps} />}
            {sectionProps && tab === 'class' && <ClassSection {...sectionProps} />}
            {sectionProps && tab === 'attributes' && <AttributesSection {...sectionProps} />}
            {sectionProps && tab === 'skills' && <SkillsSection {...sectionProps} />}
            {tab === 'details' && (
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 1.5 }}>{tr('Detalhes', 'Details')}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
                  {DETAIL_FIELDS.map(({ key, label }) => (
                    <TextField key={key} label={label} value={state.details[key] ?? ''} onChange={(e) => setDetail(key, e.target.value)}
                      slotProps={{ htmlInput: { maxLength: 80, readOnly: !canEdit } }} />
                  ))}
                </Box>
                {canEdit && (
                  <Button color="error" startIcon={<DeleteIcon />} onClick={() => setConfirmDelete(true)} sx={{ mt: 2 }}>
                    {tr('Mandar para a lixeira', 'Move to trash')}</Button>
                )}
              </Paper>
            )}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'sticky', top: 16 }}>{panel}</Box>
        </Box>

        <Drawer anchor="bottom" open={pendingOpen} onClose={() => setPendingOpen(false)}
          slotProps={{ paper: { sx: { maxHeight: '80vh', p: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))' } } }}>
          {panel}
        </Drawer>
      </ReadOnlyTheme>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>{tr('Mandar para a lixeira?', 'Move to trash?')}</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <DialogContentText>
            {tr('Dá para restaurar pela lista de personagens por 30 dias.', 'You can restore it from the character list for 30 days.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>{tr('Cancelar', 'Cancel')}</Button>
          <Button color="error" variant="contained" onClick={() => void remove()}>{tr('Mandar para a lixeira', 'Move to trash')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!conflict}>
        <DialogTitle>{tr('Este personagem mudou em outro aparelho', 'This character changed on another device')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {tr('Alguém gravou uma versão mais nova enquanto você editava. Qual versão fica?', 'Someone saved a newer version while you were editing. Which version stays?')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={takeTheirs}>{tr('Usar a do outro aparelho', 'Use the other device\'s')}</Button>
          <Button variant="contained" onClick={keepMine}>{tr('Manter a minha', 'Keep mine')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
