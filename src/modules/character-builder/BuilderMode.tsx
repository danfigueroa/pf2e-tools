import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, Paper, Skeleton,
  Stack, TextField, Typography,
} from '@mui/material';
import { ArrowBack as BackIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { trashBuild } from '../../services/builds';
import { displayFont } from '../../theme';
import { tr } from '../../i18n';
import { ReadOnlyTheme } from '../character-viewer/components/ReadOnlyTheme';
import { VIEW_OK } from '../character-viewer/sheetAccess';
import { useBuild, type SaveStatus } from './hooks/useBuild';
import { openRules } from './rules';
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

type DetailKey = keyof BuildState['details'];
const DETAIL_FIELDS: { key: DetailKey; label: string }[] = [
  { key: 'age', label: tr('Idade', 'Age') },
  { key: 'gender', label: tr('Gênero', 'Gender') },
  { key: 'pronouns', label: tr('Pronomes', 'Pronouns') },
  { key: 'ethnicity', label: tr('Etnia', 'Ethnicity') },
  { key: 'nationality', label: tr('Nacionalidade', 'Nationality') },
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
    <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 1.5 }}>{title}</Typography>
    {children}
  </Paper>
);

/**
 * O modo editar de um personagem. Na F2 tem o cabeçalho (nome, nível, estado do salvamento) e os detalhes; as etapas de
 * origem, classe, atributos e perícias entram na F3. Na F7 passa a ser montado pela Ficha em `?modo=editar`.
 */
export function BuilderMode({ buildId }: { buildId: string }) {
  const navigate = useNavigate();
  const { build, state, canEdit, loading, error, status, conflict, update, keepMine, takeTheirs, reload } = useBuild(buildId);
  const [rulesVersion, setRulesVersion] = useState<string | null>(null);
  const [rulesFailed, setRulesFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Abre o catálogo já na entrada (as etapas da F3 leem dele). Nenhuma chamada à AON: só Storage/IndexedDB.
  useEffect(() => {
    let alive = true;
    openRules().then((v) => alive && setRulesVersion(v)).catch(() => alive && setRulesFailed(true));
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Skeleton variant="rounded" height={72} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={220} />
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

  const remove = async () => {
    const out = await trashBuild(build.id, true);
    if (!out.ok) {
      setDeleteError(out.error);
      return;
    }
    navigate('/personagens');
  };

  const nameMissing = !state.name.trim();

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Button component={RouterLink} to="/personagens" startIcon={<BackIcon />} sx={{ mb: 1 }} {...VIEW_OK}>
        {tr('Personagens', 'Characters')}</Button>

      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {tr('Somente leitura — personagem de outra pessoa.', 'Read only — someone else\'s character.')}
        </Alert>
      )}
      {rulesFailed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {tr('Não foi possível carregar as regras agora. O que você já escolheu continua salvo.', 'Could not load the rules right now. What you already chose stays saved.')}
        </Alert>
      )}

      <ReadOnlyTheme on={!canEdit}>
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 120px' }, gap: 1.5 }}>
            <TextField label={tr('Nome', 'Name')} value={state.name} onChange={(e) => setName(e.target.value)}
              error={nameMissing} helperText={nameMissing ? tr('O nome não pode ficar vazio.', 'The name can\'t be empty.') : undefined}
              slotProps={{ htmlInput: { maxLength: 80, readOnly: !canEdit } }} />
            <TextField select label={tr('Nível', 'Level')} value={state.level} onChange={(e) => setLevel(Number(e.target.value))}
              disabled={!canEdit}>
              {LEVELS.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
          </Box>
          <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {status !== 'idle' && (
              <Chip size="small" variant="outlined" label={STATUS_LABEL[status]}
                color={status === 'offline' || status === 'error' ? 'warning' : 'default'} />
            )}
            {rulesVersion && (
              <Typography variant="caption" color="text.secondary">{tr(`Regras ${rulesVersion}`, `Rules ${rulesVersion}`)}</Typography>
            )}
          </Stack>
        </Paper>

        <Section title={tr('Detalhes', 'Details')}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
            {DETAIL_FIELDS.map(({ key, label }) => (
              <TextField key={key} label={label} value={state.details[key] ?? ''} onChange={(e) => setDetail(key, e.target.value)}
                slotProps={{ htmlInput: { maxLength: 80, readOnly: !canEdit } }} />
            ))}
          </Box>
        </Section>

        <Alert severity="info" sx={{ mb: 2.5 }}>
          {tr('Origem, classe, atributos e perícias chegam na próxima etapa do Criador.', 'Origin, class, attributes and skills arrive in the next stage of the Builder.')}
        </Alert>

        {canEdit && (
          <Button color="error" startIcon={<DeleteIcon />} onClick={() => setConfirmDelete(true)}>{tr('Mandar para a lixeira', 'Move to trash')}</Button>
        )}
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
