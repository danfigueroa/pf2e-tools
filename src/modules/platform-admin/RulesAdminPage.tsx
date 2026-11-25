import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, LinearProgress, List, ListItemButton, ListItemText, MenuItem, Paper, Skeleton, Stack,
  TextField, Typography,
} from '@mui/material';
import { Refresh as CheckIcon, CloudDownload as ImportIcon, Publish as PublishIcon } from '@mui/icons-material';
import { useRole } from '../../services/auth';
import {
  cancelImport, checkRuleNews, fetchEntryMechanics, fetchRulesOverview, publishCatalog, runImport, saveEntryMechanics,
  searchRuleEntries, startImport, type EntryMechanics, type ImportJob, type RuleSearchHit, type RuleSourceRow, type SourceState,
} from '../../services/rulesAdmin';
import { displayFont } from '../../theme';
import { locale, tr } from '../../i18n';

const STATE_LABEL: Record<SourceState, string> = {
  new: tr('Novo', 'New'),
  errata: tr('Errata nova', 'New errata'),
  imported: tr('Importado', 'Imported'),
  legacy: tr('Legado', 'Legacy'),
  empty: tr('Sem conteúdo de jogador', 'No player content'),
};
const STATE_COLOR: Partial<Record<SourceState, 'success' | 'warning' | 'default'>> = { new: 'success', errata: 'warning' };

type Filter = 'news' | 'imported' | 'legacy' | 'all';
const FILTER_LABEL: Record<Filter, string> = {
  news: tr('Novos e erratas', 'New and errata'),
  imported: tr('Importados', 'Imported'),
  legacy: tr('Legado (pré-Remaster)', 'Legacy (pre-Remaster)'),
  all: tr('Todos', 'All'),
};

const n = (value: number | null | undefined) => (value ?? 0).toLocaleString(locale);
const ago = (iso: string | null) => {
  if (!iso) return tr('nunca', 'never');
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? tr('hoje', 'today') : tr(`há ${days} dia${days > 1 ? 's' : ''}`, `${days} day${days > 1 ? 's' : ''} ago`);
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
    <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 1.5 }}>{title}</Typography>
    {children}
  </Paper>
);

/** "412 novas · 3 alteradas · 9 sem mecânica". */
function countsLine(job: ImportJob) {
  const c = job.counts;
  const parts = [
    tr(`${n(c.new)} novas`, `${n(c.new)} new`),
    tr(`${n(c.changed)} alteradas`, `${n(c.changed)} changed`),
    tr(`${n(c.same)} sem mudança`, `${n(c.same)} unchanged`),
  ];
  if (c.removed) parts.push(tr(`${n(c.removed)} removidas`, `${n(c.removed)} removed`));
  if (c.invalid) parts.push(tr(`${n(c.invalid)} inválidas`, `${n(c.invalid)} invalid`));
  const without = job.report?.catalog?.withoutMechanics;
  if (without) parts.push(tr(`${n(without)} sem mecânica`, `${n(without)} without mechanics`));
  return parts.join(' · ');
}

function JobReport({ job }: { job: ImportJob }) {
  const status: Record<ImportJob['status'], string> = {
    running: tr('Em andamento', 'Running'), done: tr('Concluída', 'Done'), failed: tr('Falhou', 'Failed'), cancelled: tr('Cancelada', 'Cancelled'),
  };
  return (
    <Box sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {new Date(job.startedAt).toLocaleString(locale)} · {status[job.status]}
        {job.report?.catalog ? tr(` · versão ${job.report.catalog.version}`, ` · version ${job.report.catalog.version}`) : ''}
      </Typography>
      <Typography variant="body2" color="text.secondary">{countsLine(job)}</Typography>
      {Object.entries(job.report?.sources ?? {}).slice(0, 12).map(([id, s]) => (
        <Typography key={id} variant="caption" component="p" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {s.name}: {tr(`${n(s.new)} novas, ${n(s.changed)} alteradas, ${n(s.same)} iguais`, `${n(s.new)} new, ${n(s.changed)} changed, ${n(s.same)} same`)}
          {s.removed ? tr(`, ${n(s.removed)} removidas`, `, ${n(s.removed)} removed`) : ''}
        </Typography>
      ))}
    </Box>
  );
}

/** Correção manual da mecânica de uma entrada, com a referência na AON (nunca inventar regra). */
function MechanicsEditor() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<RuleSearchHit[]>([]);
  const [current, setCurrent] = useState<EntryMechanics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const rulesRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => void searchRuleEntries(term).then(setHits), 300);
    return () => clearTimeout(t);
  }, [q]);

  const open = async (hit: RuleSearchHit) => {
    setError(null);
    setSaved(false);
    const out = await fetchEntryMechanics(hit.id.slice(hit.id.indexOf(':') + 1));
    if (out.ok) setCurrent(out.value);
    else setError(out.error);
  };

  const save = async () => {
    if (!current) return;
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rulesRef.current?.value ?? '[]');
    } catch {
      setError(tr('A mecânica não é um JSON válido.', 'The mechanics are not valid JSON.'));
      return;
    }
    if (!Array.isArray(parsed)) {
      setError(tr('A mecânica precisa ser uma lista de rule elements.', 'The mechanics must be a list of rule elements.'));
      return;
    }
    const out = await saveEntryMechanics(current.entry.aon_id, parsed, current.mechanics?.unsupported ?? [], noteRef.current?.value ?? '');
    if (out.ok) setSaved(true);
    else setError(out.error);
  };

  return (
    <Section title={tr('Corrigir mecânica de uma entrada', 'Fix an entry\'s mechanics')}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {tr('A correção vira origem "manual" e a importação do Foundry não passa mais por cima. Para valer no Criador, publique uma versão nova.', 'The fix becomes "manual" origin and the Foundry import no longer overwrites it. To reach the Builder, publish a new version.')}
      </Typography>
      <TextField size="small" fullWidth label={tr('Buscar entrada pelo nome', 'Search entry by name')} value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && !current && (
        <List dense sx={{ maxHeight: 240, overflowY: 'auto' }}>
          {hits.map((hit) => (
            <ListItemButton key={hit.id} onClick={() => void open(hit)}>
              <ListItemText primary={hit.name} secondary={`${hit.type}${hit.level !== null ? ` ${hit.level}` : ''} · ${hit.id}${hit.remaster ? '' : tr(' · legado', ' · legacy')}`} />
            </ListItemButton>
          ))}
        </List>
      )}
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mt: 1.5 }}>{tr('Correção salva. Publique uma versão nova para o Criador ver.', 'Fix saved. Publish a new version for the Builder to see it.')}</Alert>}
      {current && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontWeight: 600 }}>{current.entry.name} <Typography component="span" variant="body2" color="text.secondary">{current.entry.id}</Typography></Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {current.mechanics ? tr(`Origem: ${current.mechanics.origin}`, `Origin: ${current.mechanics.origin}`) : tr('Sem mecânica ainda.', 'No mechanics yet.')}
            {current.mechanics?.unsupported.length ? tr(` · não suportado: ${current.mechanics.unsupported.join(', ')}`, ` · unsupported: ${current.mechanics.unsupported.join(', ')}`) : ''}
          </Typography>
          <TextField key={current.entry.aon_id} fullWidth multiline minRows={6} label={tr('Rule elements (JSON)', 'Rule elements (JSON)')}
            defaultValue={JSON.stringify(current.mechanics?.rules ?? [], null, 2)} inputRef={rulesRef}
            slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'monospace', fontSize: 13 } } }} />
          <TextField key={`${current.entry.aon_id}-note`} fullWidth size="small" sx={{ mt: 1.5 }} inputRef={noteRef} defaultValue={current.mechanics?.note ?? ''}
            label={tr('De onde vem (livro e página na AON)', 'Source (book and page on AON)')} slotProps={{ htmlInput: { maxLength: 500 } }} />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button variant="contained" onClick={() => void save()}>{tr('Salvar correção', 'Save fix')}</Button>
            <Button onClick={() => { setCurrent(null); setSaved(false); }}>{tr('Outra entrada', 'Another entry')}</Button>
          </Stack>
        </Box>
      )}
    </Section>
  );
}

/**
 * Plataforma → Base de regras (BASE-DE-REGRAS §6): verificar novidades na AON, importar livros escolhidos em passos que
 * este navegador conduz, ver o relatório e corrigir mecânica à mão. Só admin da plataforma (o servidor confere).
 */
export function RulesAdminPage() {
  const { isPlatformAdmin } = useRole();
  const [data, setData] = useState<{ sources: RuleSourceRow[]; version: string | null; jobs: ImportJob[] } | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [driving, setDriving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('news');
  const [line, setLine] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const runner = useRef<{ stop: () => void } | null>(null);

  const load = useCallback(async () => {
    const out = await fetchRulesOverview();
    if (!out.ok) {
      setError(out.error);
      return;
    }
    setData(out.value);
    setJob((current) => (current?.status === 'running' && driving ? current : out.value.job));
  }, [driving]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => runner.current?.stop(), []);

  const drive = (jobId: string) => {
    setDriving(true);
    runner.current?.stop();
    runner.current = runImport(jobId, (next) => {
      setJob(next);
      if (next.status !== 'running') {
        setDriving(false);
        setSelected(new Set());
        setNotice(next.status === 'done' ? countsLine(next) : null);
        void load();
      }
    }, (message) => {
      setDriving(false);
      setError(message);
    });
  };

  const lines = useMemo(() => [...new Set((data?.sources ?? []).map((s) => s.product_line).filter((l): l is string => !!l))].sort(), [data]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.sources ?? [])
      .filter((s) => filter === 'all'
        || (filter === 'news' && (s.state === 'new' || s.state === 'errata'))
        || (filter === 'imported' && s.state === 'imported')
        || (filter === 'legacy' && s.state === 'legacy'))
      .filter((s) => !line || s.product_line === line)
      .filter((s) => !term || s.name.toLowerCase().includes(term))
      .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? '') || a.name.localeCompare(b.name, locale));
  }, [data, filter, line, q]);

  if (!isPlatformAdmin) return <Alert severity="info">{tr('Só a administração da plataforma vê esta página.', 'Only platform admins see this page.')}</Alert>;

  const sources = data?.sources ?? [];
  const lastCheck = sources.reduce<string | null>((max, s) => (s.checked_at && (!max || s.checked_at > max) ? s.checked_at : max), null);
  const entries = sources.reduce((sum, s) => sum + (s.state === 'imported' || s.state === 'errata' ? s.our_count ?? 0 : 0), 0);
  const running = job?.status === 'running' ? job : null;
  const names = new Map(sources.map((s) => [s.aon_id, s.name]));

  const check = async () => {
    setBusy(true);
    setError(null);
    const out = await checkRuleNews();
    setBusy(false);
    if (!out.ok) return setError(out.error);
    const news = out.value.sources.filter((s) => s.state === 'new' || s.state === 'errata').length;
    setNotice(news ? tr(`${news} livro(s) com novidade.`, `${news} book(s) with news.`) : tr('Nada novo na AON.', 'Nothing new on AON.'));
    void load();
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const out = await startImport([...selected]);
    setBusy(false);
    if (!out.ok) return setError(out.error);
    setJob(out.value.job);
    drive(out.value.job.id);
  };

  const cancel = async () => {
    if (!running) return;
    runner.current?.stop();
    setDriving(false);
    const out = await cancelImport(running.id);
    if (out.ok) setJob(out.value.job);
    void load();
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    const out = await publishCatalog();
    setBusy(false);
    if (!out.ok) return setError(out.error);
    setNotice(tr(`Versão ${out.value.catalog.version} publicada: ${out.value.catalog.changedLists} listas novas, ${out.value.catalog.copiedLists} copiadas.`,
      `Version ${out.value.catalog.version} published: ${out.value.catalog.changedLists} new lists, ${out.value.catalog.copiedLists} copied.`));
    void load();
  };

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 0.5 }}>{tr('Base de regras', 'Rules base')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {data
          ? tr(`Versão ${data.version ?? '—'} · ${n(entries)} entradas · verificado ${ago(lastCheck)}`, `Version ${data.version ?? '—'} · ${n(entries)} entries · checked ${ago(lastCheck)}`)
          : '…'}
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 2 }}>{notice}</Alert>}

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
        <Button variant="outlined" startIcon={<CheckIcon />} onClick={() => void check()} disabled={busy || !!running}>{tr('Verificar novidades', 'Check for news')}</Button>
        <Button variant="outlined" startIcon={<PublishIcon />} onClick={() => void publish()} disabled={busy || !!running}>{tr('Publicar versão nova', 'Publish new version')}</Button>
      </Stack>

      {running && (
        <Section title={tr('Importação em andamento', 'Import in progress')}>
          <LinearProgress variant="determinate" value={Math.min(100, (running.index / Math.max(1, running.sources.length)) * 100)} sx={{ mb: 1 }} />
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {running.phase === 'publish'
              ? tr('Publicando a versão nova do catálogo…', 'Publishing the new catalog version…')
              : tr(`Livro ${Math.min(running.index + 1, running.sources.length)} de ${running.sources.length}: ${names.get(running.sources[running.index]) ?? '…'}`,
                `Book ${Math.min(running.index + 1, running.sources.length)} of ${running.sources.length}: ${names.get(running.sources[running.index]) ?? '…'}`)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{countsLine(running)}</Typography>
          <Stack direction="row" spacing={1}>
            {!driving && <Button variant="contained" onClick={() => drive(running.id)}>{tr('Continuar', 'Continue')}</Button>}
            <Button color="error" onClick={() => void cancel()}>{tr('Cancelar', 'Cancel')}</Button>
          </Stack>
          {!driving && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {tr('A importação anda enquanto esta página está aberta. Fechar não perde nada: "Continuar" segue de onde parou.', 'The import runs while this page is open. Closing loses nothing: "Continue" resumes where it stopped.')}
            </Typography>
          )}
        </Section>
      )}

      <Section title={tr('Livros', 'Books')}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5, mb: 1.5 }}>
          <TextField select size="small" label={tr('Mostrar', 'Show')} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => <MenuItem key={f} value={f}>{FILTER_LABEL[f]}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={tr('Linha de produto', 'Product line')} value={line} onChange={(e) => setLine(e.target.value)}>
            <MenuItem value="">{tr('Todas', 'All')}</MenuItem>
            {lines.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
          </TextField>
          <TextField size="small" label={tr('Buscar', 'Search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </Box>
        {!data ? <Skeleton variant="rounded" height={200} /> : shown.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {filter === 'news' ? tr('Nenhum livro novo ou com errata. Use "Verificar novidades".', 'No new or updated books. Use "Check for news".') : tr('Nenhum livro neste filtro.', 'No books in this filter.')}
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 480, overflowY: 'auto', mx: -1 }}>
            {shown.map((s) => (
              <Box key={s.aon_id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 1, py: 0.75, borderTop: 1, borderColor: 'divider' }}>
                <Checkbox size="small" sx={{ mt: -0.5 }} checked={selected.has(s.aon_id)} disabled={s.state === 'empty' || !!running}
                  onChange={(e) => toggle(s.aon_id, e.target.checked)} inputProps={{ 'aria-label': s.name }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary" component="p">
                    {[s.release_date?.slice(0, 7), s.product_line, tr(`${n(s.aon_count)} na AON`, `${n(s.aon_count)} on AON`),
                      s.state === 'imported' || s.state === 'errata' ? tr(`${n(s.our_count)} importadas`, `${n(s.our_count)} imported`) : null,
                      s.errata].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Chip size="small" variant="outlined" label={STATE_LABEL[s.state]} color={STATE_COLOR[s.state] ?? 'default'} />
              </Box>
            ))}
          </Box>
        )}
        {sources.some((s) => selected.has(s.aon_id) && s.state === 'legacy') && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            {tr('Livro legado entra na base, mas só aparece numa mesa quando o GM o liberar em "Regras de criação".', 'A legacy book enters the base, but only shows up at a table once the GM allows it in "Creation rules".')}
          </Alert>
        )}
        <Button variant="contained" startIcon={<ImportIcon />} sx={{ mt: 1.5 }} disabled={!selected.size || busy || !!running} onClick={() => void start()}>
          {tr(`Importar selecionados (${selected.size})`, `Import selected (${selected.size})`)}</Button>
      </Section>

      {data && data.jobs.length > 0 && (
        <Section title={tr('Últimas importações', 'Recent imports')}>
          {data.jobs.map((j) => <JobReport key={j.id} job={j} />)}
        </Section>
      )}

      <MechanicsEditor />
    </Box>
  );
}

export default RulesAdminPage;
