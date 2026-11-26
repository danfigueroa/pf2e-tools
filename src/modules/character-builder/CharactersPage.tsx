import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, Menu, MenuItem, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import {
  Add as AddIcon, ChevronRight as OpenIcon, DownloadOutlined as ImportIcon, ExpandMore as MoreIcon, RestoreFromTrash as RestoreIcon,
  Tune as RulesIcon,
} from '@mui/icons-material';
import { useRole } from '../../services/auth';
import { createBuild, fetchMesaRules, listBuilds, trashBuild } from '../../services/builds';
import { listPublished, type PublishedSummary } from '../../services/sheets';
import { chrome, displayFont, gold, ink, parchment, rule } from '../../theme';
import { locale, tr } from '../../i18n';
import { BuilderMode } from './BuilderMode';
import { ImportFromSheet } from './ImportFromSheet';
import { CatalogButton } from './components/CatalogBrowser';
import { BuildMedallion } from './components/BuildMedallion';
import { Medallion, SectionHead, SlotCard, StateBadge, type PublishState } from './components/ui';
import { cardSx, tint, warmShadow } from './components/uiTokens';
import type { BuildHeader } from './types';

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Rascunho = nunca aplicado; aplicado = o aplicado é o atual; senão, há alterações não aplicadas. */
const publishState = (b: Pick<BuildHeader, 'publishedRev' | 'rev'>): PublishState =>
  b.publishedRev === null ? 'draft' : b.publishedRev === b.rev ? 'published' : 'changed';

const subtitle = (b: BuildHeader) => (b.className ? `${b.className} ${b.level}` : tr(`Nível ${b.level}`, `Level ${b.level}`));

/** "há 2 h", "ontem": a data relativa no idioma da conta. */
function ago(ms: number | null): string {
  if (!ms) return '';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const s = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

const ownerLine = (b: BuildHeader, mine: boolean) => {
  const when = b.updatedAt ? (publishState(b) === 'published' ? tr(`aplicado ${ago(b.updatedAt)}`, `applied ${ago(b.updatedAt)}`) : tr(`editado ${ago(b.updatedAt)}`, `edited ${ago(b.updatedAt)}`)) : '';
  const who = mine ? tr('Seu', 'Yours') : b.ownerName ? tr(`De ${b.ownerName}`, `${b.ownerName}'s`) : tr('Sem dono', 'No owner');
  return [who, when].filter(Boolean).join(' · ');
};

/** Cartão do personagem: celular = medalhão ao lado do nome; desktop = faixa verde com o medalhão. */
const BuildCard = ({ build, mine }: { build: BuildHeader; mine: boolean }) => (
  <ButtonBase component={RouterLink} to={`/personagens/${build.id}`} sx={[cardSx, { display: 'flex', flexDirection: 'column', alignItems: 'stretch', overflow: 'hidden', textAlign: 'left', width: 1 }]}>
    <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 1.75 }, alignItems: 'center', px: { xs: 1.75, md: 2.25 }, py: { xs: 1.5, md: 2 },
      bgcolor: { md: chrome.hero }, borderBottom: { md: `2px solid ${gold.main}` } }}>
      <BuildMedallion slug={build.slug} name={build.name} portrait={build.portrait} size={56} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <Box component="span" sx={{ font: `700 19px ${displayFont}`, fontSize: { md: 21 }, color: { md: chrome.text }, overflowWrap: 'anywhere' }}>{build.name}</Box>
        <Box component="span" sx={{ fontSize: 14, color: { xs: ink.secondary, md: chrome.textSoft } }}>{subtitle(build)}</Box>
        <Box component="span" sx={{ fontSize: 12, color: ink.secondary, display: { md: 'none' } }}>{ownerLine(build, mine)}</Box>
      </Box>
      <OpenIcon sx={{ color: ink.secondary, display: { md: 'none' } }} />
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1.75, md: 2.25 }, py: 1.25, borderTop: { xs: `1px solid ${rule}`, md: 0 } }}>
      <StateBadge state={publishState(build)} />
    </Box>
    <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, px: 2.25, pb: 1.5, fontSize: 12, color: ink.secondary }}>{ownerLine(build, mine)}</Box>
  </ButtonBase>
);

/** "Novo personagem": nome provisório e nível inicial (padrão: o da mesa). Abre a criação guiada. */
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
    navigate(`/personagens/${out.value.id}?guiado=1`);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontFamily: displayFont }}>{tr('Novo personagem', 'New character')}</DialogTitle>
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

/** Importar uma ficha já publicada na mesa (vinda do Pathbuilder): vira um build com o mesmo slug. */
function ImportDialog({ open, onClose, builds }: { open: boolean; onClose: () => void; builds: BuildHeader[] }) {
  const navigate = useNavigate();
  const { isGm, userId } = useRole();
  const [sheets, setSheets] = useState<PublishedSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError(null);
    listPublished().then((list) => alive && setSheets(list)).catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, [open]);
  const taken = new Set(builds.map((b) => b.slug));
  const offered = (sheets ?? []).filter((sh) => !taken.has(sh.slug) && (isGm || !userId || sh.ownerId === userId))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontFamily: displayFont }}>{tr('Importar ficha', 'Import a sheet')}</DialogTitle>
      <DialogContent>
        <Box sx={{ fontSize: 14, color: ink.secondary, mb: 1.5 }}>
          {tr('Fichas já na mesa (enviadas do Pathbuilder) viram um personagem do Criador. A ficha da mesa não muda até você aplicar.',
            'Sheets already at the table (uploaded from Pathbuilder) become a Builder character. The table sheet does not change until you apply.')}
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        {!sheets && !error && <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={52} />)}</Stack>}
        {sheets && offered.length === 0 && <Box sx={{ fontSize: 14 }}>{tr('Nenhuma ficha para importar.', 'No sheet to import.')}</Box>}
        <Stack spacing={1}>
          {offered.map((sh) => (
            <SlotCard key={sh.slug} kicker={`${sh.className} ${sh.level}`} name={sh.name} onClick={() => { onClose(); navigate(`/personagens?importar=${encodeURIComponent(sh.slug)}`); }}
              trailing={<OpenIcon sx={{ color: ink.secondary }} />} />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>{tr('Fechar', 'Close')}</Button></DialogActions>
    </Dialog>
  );
}

type View = 'mine' | 'table' | 'trash';

function BuildList() {
  const { isGm, userId } = useRole();
  const [builds, setBuilds] = useState<BuildHeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [startingLevel, setStartingLevel] = useState(1);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [ownerMenu, setOwnerMenu] = useState<HTMLElement | null>(null);
  const [view, setView] = useState<View>('mine');

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

  // Sem login (modo local), tudo é "meu".
  const isMine = useCallback((b: BuildHeader) => (userId ? b.ownerId === userId : b.canEdit === true), [userId]);
  const groups = useMemo(() => {
    const live = (builds ?? []).filter((b) => !b.deletedAt);
    return {
      mine: live.filter(isMine),
      others: live.filter((b) => !isMine(b) && (!ownerFilter || (b.ownerName ?? '') === ownerFilter)),
      othersAll: live.filter((b) => !isMine(b)),
      trash: (builds ?? []).filter((b) => b.deletedAt),
    };
  }, [builds, isMine, ownerFilter]);
  const owners = useMemo(() => [...new Set(groups.othersAll.map((b) => b.ownerName).filter((n): n is string => !!n))].sort(), [groups.othersAll]);

  const restore = async (id: string) => {
    const out = await trashBuild(id, false);
    if (out.ok) load();
    else setError(out.error);
  };

  const tabs: { key: View; label: string; n?: number }[] = [
    { key: 'mine', label: tr('Meus', 'Mine'), n: groups.mine.length },
    { key: 'table', label: tr('Da mesa', 'Table'), n: groups.othersAll.length },
    { key: 'trash', label: tr('Lixeira', 'Trash') },
  ];

  const newButton = (full?: boolean) => (
    <Button variant="contained" startIcon={<AddIcon />} fullWidth={full} onClick={() => setCreating(true)}>{tr('Novo personagem', 'New character')}</Button>
  );

  const empty = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.25, py: 5, px: 3.5, textAlign: 'center' }}>
      <Box sx={{ position: 'relative', width: 148, height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px dashed ${gold.main}`, bgcolor: tint.gold }} />
        <Medallion name="?" size={104} />
      </Box>
      <Box component="h2" sx={{ m: 0, font: `700 24px/1.15 ${displayFont}` }}>{tr('Crie seu primeiro personagem', 'Create your first character')}</Box>
      <Box sx={{ fontSize: 15, color: ink.secondary, maxWidth: 320 }}>
        {tr('Escolha origem, classe e talentos. O Criador faz as contas e leva o herói para a mesa.', 'Choose origin, class and feats. The Builder does the math and takes the hero to the table.')}
      </Box>
      <Stack spacing={1.25} sx={{ width: 1, maxWidth: 300 }}>
        {newButton(true)}
        <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => setImporting(true)}>{tr('Importar ficha da mesa', 'Import a table sheet')}</Button>
        <CatalogButton variant="text">{tr('Explorar o catálogo', 'Browse the catalog')}</CatalogButton>
      </Stack>
    </Box>
  );

  const grid = (list: BuildHeader[], mine: boolean, withNew?: boolean) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1.25, md: 2.25 } }}>
      {list.map((b) => <BuildCard key={b.id} build={b} mine={mine} />)}
      {withNew && (
        <ButtonBase onClick={() => setCreating(true)} sx={{
          display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.25, minHeight: 200,
          border: `1.5px dashed ${gold.main}`, bgcolor: tint.gold, borderRadius: '6px', color: gold.deep,
        }}>
          <Box component="span" sx={{ width: 52, height: 52, borderRadius: '50%', border: `1.5px solid ${gold.main}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AddIcon /></Box>
          <Box component="span" sx={{ font: `700 17px ${displayFont}` }}>{tr('Novo personagem', 'New character')}</Box>
          <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{tr('criação guiada, passo a passo', 'guided, step by step')}</Box>
        </ButtonBase>
      )}
    </Box>
  );

  // GM no desktop: os personagens dos outros numa tabela (dono, estado, atualização).
  const table = (list: BuildHeader[]) => (
    <Box sx={[cardSx, { overflow: 'hidden', display: { xs: 'none', md: 'block' } }]}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 1.6fr 1fr', gap: 1.5, px: 2.25, py: 1.25, borderBottom: `1px solid ${rule}`, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: ink.secondary }}>
        <span>{tr('Personagem', 'Character')}</span><span>{tr('Classe', 'Class')}</span><span>{tr('Dono', 'Owner')}</span><span>{tr('Estado', 'Status')}</span><span>{tr('Atualizado', 'Updated')}</span>
      </Box>
      {list.map((b) => (
        <ButtonBase key={b.id} component={RouterLink} to={`/personagens/${b.id}`} sx={{
          display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 1.6fr 1fr', gap: 1.5, px: 2.25, py: 1.25, width: 1, alignItems: 'center', textAlign: 'left',
          borderBottom: `1px solid ${rule}`, fontSize: 14, '&:last-of-type': { borderBottom: 0 },
        }}>
          <Box component="span" sx={{ display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 0 }}>
            <BuildMedallion slug={b.slug} name={b.name} portrait={b.portrait} size={34} /><Box component="b" sx={{ font: `700 15px ${displayFont}`, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</Box>
          </Box>
          <span>{subtitle(b)}</span>
          <Box component="span" sx={{ color: ink.secondary }}>{b.ownerName ?? tr('sem dono', 'no owner')}</Box>
          <span><StateBadge state={publishState(b)} /></span>
          <Box component="span" sx={{ color: ink.secondary }}>{ago(b.updatedAt)}</Box>
        </ButtonBase>
      ))}
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'flex-end' } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" variant="h4">{tr('Personagens', 'Characters')}</Typography>
          <Box sx={{ color: ink.secondary, fontSize: 15, mt: 0.5 }}>{tr('Crie, evolua e leve seus heróis para a mesa.', 'Create, level up and take your heroes to the table.')}</Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'none' }, gridAutoFlow: { md: 'column' }, gap: 1, alignItems: 'center' }}>
          {isGm && (
            <Button component={RouterLink} to="/mesa#criacao" startIcon={<RulesIcon />} size="small" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, justifySelf: { xs: 'start', md: 'auto' } }}>
              {tr('Regras de criação', 'Creation rules')}</Button>
          )}
          <CatalogButton size="small" />
          <Button variant="outlined" size="small" startIcon={<ImportIcon />} onClick={() => setImporting(true)}>{tr('Importar ficha', 'Import sheet')}</Button>
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>{newButton(true)}</Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: { md: `1px solid ${rule}` }, flexWrap: 'wrap' }}>
        <Box role="tablist" sx={{
          display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: 'minmax(0, 1fr)', md: 'auto' }, gap: { xs: '3px', md: 2 }, flex: { xs: 1, md: 'none' },
          bgcolor: { xs: parchment.sunken, md: 'transparent' }, borderRadius: '8px', p: { xs: '3px', md: 0 },
        }}>
          {tabs.map((t) => {
            const on = view === t.key;
            return (
              <ButtonBase key={t.key} role="tab" aria-selected={on} onClick={() => setView(t.key)} sx={{
                height: { xs: 38, md: 44 }, px: { xs: 1, md: 0.5 }, gap: 0.75, fontSize: 14, fontWeight: on ? 700 : 600, borderRadius: { xs: '6px', md: 0 },
                color: on ? ink.primary : ink.secondary, bgcolor: { xs: on ? parchment.paper : 'transparent', md: 'transparent' },
                boxShadow: { xs: on ? warmShadow : 'none', md: 'none' }, borderBottom: { md: `2px solid ${on ? gold.main : 'transparent'}` },
              }}>
                {t.label}{t.n !== undefined && (
                  <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 999, bgcolor: parchment.sunken, color: ink.secondary, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.n}</Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
        {view === 'table' && isGm && owners.length > 1 && (
          <>
            <Button size="small" variant="outlined" onClick={(e) => setOwnerMenu(e.currentTarget)} endIcon={<MoreIcon />} sx={{ borderRadius: 999, mb: { md: 0.75 } }}>
              <Box component="span" sx={{ color: ink.secondary, mr: 0.5 }}>{tr('Dono:', 'Owner:')}</Box>{ownerFilter || tr('Todos', 'All')}
            </Button>
            <Menu anchorEl={ownerMenu} open={!!ownerMenu} onClose={() => setOwnerMenu(null)}>
              <MenuItem selected={!ownerFilter} onClick={() => { setOwnerFilter(''); setOwnerMenu(null); }}>{tr('Todos', 'All')}</MenuItem>
              {owners.map((o) => <MenuItem key={o} selected={ownerFilter === o} onClick={() => { setOwnerFilter(o); setOwnerMenu(null); }}>{o}</MenuItem>)}
            </Menu>
          </>
        )}
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {!builds && !error && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={150} />)}
        </Box>
      )}

      {builds && view === 'mine' && (groups.mine.length ? grid(groups.mine, true, true) : empty)}

      {builds && view === 'table' && (
        groups.others.length ? (
          <>
            {isGm && (
              <SectionHead component="h2" note={tr('personagens dos outros jogadores · você (GM) edita', 'other players\' characters · you (GM) can edit')}>
                {tr('Da mesa', 'From the table')}</SectionHead>
            )}
            {isGm ? table(groups.others) : null}
            <Box sx={{ display: isGm ? { md: 'none' } : 'block' }}>{grid(groups.others, false)}</Box>
          </>
        ) : <Box sx={{ fontSize: 15, color: ink.secondary, py: 3 }}>{tr('Nenhum personagem de outros jogadores ainda.', 'No other players\' characters yet.')}</Box>
      )}

      {builds && view === 'trash' && (
        <Stack spacing={1}>
          <Box sx={{ fontSize: 14, color: ink.secondary }}>
            {tr('Some de vez depois de 30 dias, se nunca foi aplicado na mesa.', 'Deleted for good after 30 days, unless it was applied to the table.')}
          </Box>
          {groups.trash.length === 0 && <Box sx={{ fontSize: 15, color: ink.secondary, py: 2 }}>{tr('A lixeira está vazia.', 'The trash is empty.')}</Box>}
          {groups.trash.map((b) => (
            <Box key={b.id} sx={[cardSx, { p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }]}>
              <BuildMedallion slug={b.slug} name={b.name} portrait={b.portrait} size={40} dashed />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ font: `700 16px ${displayFont}`, overflowWrap: 'anywhere' }}>{b.name}</Box>
                <Box sx={{ fontSize: 14, color: ink.secondary }}>{subtitle(b)}</Box>
              </Box>
              <Button startIcon={<RestoreIcon />} onClick={() => void restore(b.id)}>{tr('Restaurar', 'Restore')}</Button>
            </Box>
          ))}
        </Stack>
      )}

      <NewBuildDialog open={creating} onClose={() => setCreating(false)} startingLevel={startingLevel} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} builds={builds ?? []} />
    </Box>
  );
}

/** `/personagens` (lista) e `/personagens/:buildId` (o editor, até a F7 virar o modo editar da Ficha). */
export const CharactersPage = () => {
  const { buildId } = useParams();
  const [params] = useSearchParams();
  const importing = params.get('importar'); // i18n-ok: chave da URL
  if (importing && /^[a-z0-9-]{1,64}$/.test(importing)) return <ImportFromSheet slug={importing} levelUp={params.get('subir') === '1'} />; // i18n-ok: chave da URL
  return buildId ? <BuilderMode buildId={buildId} /> : <BuildList />;
};

export default CharactersPage;
