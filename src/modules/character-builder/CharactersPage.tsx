import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper,
  Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { Add as AddIcon, RestoreFromTrash as RestoreIcon, Tune as RulesIcon } from '@mui/icons-material';
import { useRole } from '../../services/auth';
import { createBuild, fetchMesaRules, listBuilds, trashBuild } from '../../services/builds';
import { displayFont } from '../../theme';
import { tr } from '../../i18n';
import { BuilderMode } from './BuilderMode';
import { ImportFromSheet } from './ImportFromSheet';
import type { BuildHeader } from './types';

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

type PublishState = 'draft' | 'published' | 'changed';

/** Rascunho = nunca aplicado; Publicado = o aplicado é o atual; senão, há alterações não publicadas. */
const publishState = (b: Pick<BuildHeader, 'publishedRev' | 'rev'>): PublishState =>
  b.publishedRev === null ? 'draft' : b.publishedRev === b.rev ? 'published' : 'changed';

const PUBLISH_LABEL: Record<PublishState, string> = {
  draft: tr('Rascunho', 'Draft'),
  published: tr('Publicado', 'Published'),
  changed: tr('Alterações não publicadas', 'Unpublished changes'),
};

const subtitle = (b: BuildHeader) =>
  [b.className, tr(`nível ${b.level}`, `level ${b.level}`)].filter(Boolean).join(' · ');

const BuildCard = ({ build, showOwner }: { build: BuildHeader; showOwner: boolean }) => (
  <Card variant="outlined">
    <CardActionArea component={RouterLink} to={`/personagens/${build.id}`} sx={{ p: 1.5, height: 1 }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.05rem', overflowWrap: 'anywhere' }}>{build.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{subtitle(build)}</Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        <Chip size="small" label={PUBLISH_LABEL[publishState(build)]} color={publishState(build) === 'changed' ? 'warning' : 'default'} variant="outlined" />
        {showOwner && (
          <Chip size="small" variant="outlined"
            label={build.ownerName ? tr(`de ${build.ownerName}`, `by ${build.ownerName}`) : tr('sem dono', 'no owner')} />
        )}
      </Stack>
    </CardActionArea>
  </Card>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1.5, mb: 3 }}>{children}</Box>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>{children}</Typography>
);

/** "Novo personagem": nome provisório e nível inicial (padrão: o da mesa). */
function NewBuildDialog({ open, onClose, startingLevel }: { open: boolean; onClose: () => void; startingLevel: number }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(startingLevel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) setLevel(startingLevel); }, [open, startingLevel]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const out = await createBuild(trimmed, level);
    setBusy(false);
    if (!out.ok) {
      setError(out.error);
      return;
    }
    onClose();
    navigate(`/personagens/${out.value.id}`);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{tr('Novo personagem', 'New character')}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField autoFocus label={tr('Nome', 'Name')} value={name} onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 80 } }} helperText={tr('Pode mudar depois.', 'You can change it later.')}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} />
          <TextField select label={tr('Nível inicial', 'Starting level')} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {LEVELS.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{tr('Cancelar', 'Cancel')}</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || !name.trim()}>{tr('Criar', 'Create')}</Button>
      </DialogActions>
    </Dialog>
  );
}

function BuildList() {
  const { isGm, userId } = useRole();
  const [builds, setBuilds] = useState<BuildHeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [startingLevel, setStartingLevel] = useState(1);

  const load = useCallback(() => {
    void listBuilds().then((out) => {
      if (out.ok) setBuilds(out.value);
      else setError(out.error);
    });
  }, []);
  useEffect(() => {
    load();
    void fetchMesaRules().then((out) => { if (out.ok) setStartingLevel(out.value.startingLevel); });
  }, [load]);

  const groups = useMemo(() => {
    const live = (builds ?? []).filter((b) => !b.deletedAt);
    // Sem login (modo local), tudo é "meu".
    const isMine = (b: BuildHeader) => (userId ? b.ownerId === userId : b.canEdit === true);
    return {
      mine: live.filter(isMine),
      others: live.filter((b) => !isMine(b)),
      trash: (builds ?? []).filter((b) => b.deletedAt),
    };
  }, [builds, userId]);

  const restore = async (id: string) => {
    const out = await trashBuild(id, false);
    if (out.ok) load();
    else setError(out.error);
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5, alignItems: { sm: 'center' } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" variant="h4">{tr('Criador de Personagem', 'Character Builder')}</Typography>
          <Typography color="text.secondary">{tr('Crie e evolua personagens direto no Covil.', 'Create and level up characters right in the Covil.')}</Typography>
        </Box>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {isGm && (
            <Button component={RouterLink} to="/mesa#criacao" startIcon={<RulesIcon />} variant="outlined">
              {tr('Regras de criação', 'Creation rules')}</Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>{tr('Novo personagem', 'New character')}</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {!builds && !error && <Grid>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={96} />)}</Grid>}

      {builds && (
        <>
          <SectionTitle>{tr('Meus personagens', 'My characters')}</SectionTitle>
          {groups.mine.length ? (
            <Grid>{groups.mine.map((b) => <BuildCard key={b.id} build={b} showOwner={false} />)}</Grid>
          ) : (
            <Paper variant="outlined" sx={{ p: 2.5, mb: 3, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{tr('Crie seu primeiro personagem', 'Create your first character')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {tr('As escolhas ficam salvas aqui; a mesa só vê a ficha quando você aplicar.', 'Your choices are saved here; the table only sees the sheet once you apply it.')}
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>{tr('Novo personagem', 'New character')}</Button>
            </Paper>
          )}

          {groups.others.length > 0 && (
            <>
              <SectionTitle>{tr('Da mesa', 'From the table')}</SectionTitle>
              <Grid>{groups.others.map((b) => <BuildCard key={b.id} build={b} showOwner />)}</Grid>
            </>
          )}

          {groups.trash.length > 0 && (
            <>
              <SectionTitle>{tr('Lixeira', 'Trash')}</SectionTitle>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {tr('Some de vez depois de 30 dias, se nunca foi aplicado na mesa.', 'Deleted for good after 30 days, unless it was applied to the table.')}
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                {groups.trash.map((b) => (
                  <Paper key={b.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{b.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{subtitle(b)}</Typography>
                    </Box>
                    <Button startIcon={<RestoreIcon />} onClick={() => void restore(b.id)}>{tr('Restaurar', 'Restore')}</Button>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
        </>
      )}

      <NewBuildDialog open={creating} onClose={() => setCreating(false)} startingLevel={startingLevel} />
    </Box>
  );
}

/** `/personagens` (lista) e `/personagens/:buildId` (o editor, até a F7 virar o modo editar da Ficha). */
export const CharactersPage = () => {
  const { buildId } = useParams();
  const [params] = useSearchParams();
  const importing = params.get('importar'); // i18n-ok: chave da URL
  if (importing && /^[a-z0-9-]{1,64}$/.test(importing)) return <ImportFromSheet slug={importing} />;
  return buildId ? <BuilderMode buildId={buildId} /> : <BuildList />;
};

export default CharactersPage;
