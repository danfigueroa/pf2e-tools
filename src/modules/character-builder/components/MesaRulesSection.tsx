import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Skeleton, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { fetchMesaRules, saveMesaRules } from '../../../services/builds';
import { displayFont } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { sources, type RuleSource } from '../rules';
import { allowsLegacyBook, sanitizeMesaRules } from '../mesaRules';
import type { MesaRules, MesaVariants, Rarity } from '../types';

const RARITY_LABEL: Record<Rarity, string> = {
  allow: tr('Permitir', 'Allow'),
  ask: tr('Avisar (pedir ao GM)', 'Warn (ask the GM)'),
  deny: tr('Não permitir', 'Don\'t allow'),
};

type FlagVariant = Exclude<keyof MesaVariants, 'mythic'>;

/** As variantes da mesa (REGRAS-OPCIONAIS). As sem `ready` ainda não são calculadas: o Criador avisa. */
const VARIANTS: { key: FlagVariant; label: string; ready: boolean }[] = [
  { key: 'freeArchetype', label: tr('Arquétipo Livre (Free Archetype)', 'Free Archetype'), ready: true },
  { key: 'ancestralParagon', label: tr('Paragão Ancestral (Ancestral Paragon)', 'Ancestral Paragon'), ready: true },
  { key: 'abp', label: tr('Progressão Automática de Bônus (ABP)', 'Automatic Bonus Progression'), ready: true },
  { key: 'pwl', label: tr('Proficiência sem Nível (PwL)', 'Proficiency without Level'), ready: false },
  { key: 'dualClass', label: tr('Classe Dupla (Dual Class)', 'Dual Class'), ready: false },
  { key: 'gradualBoosts', label: tr('Aumentos Graduais (Gradual Boosts)', 'Gradual Ability Boosts'), ready: false },
];

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

/**
 * "Criação de personagem" em `/mesa` (só GM; o servidor confere o papel real): livros liberados, raridade, variantes,
 * nível e riqueza inicial. A lista de livros vem do catálogo (`core/sources`), não da AON.
 */
export function MesaRulesSection() {
  const [rules, setRules] = useState<MesaRules | null>(null);
  const [books, setBooks] = useState<RuleSource[] | null>(null);
  const [edition, setEdition] = useState<'allow' | 'legacy'>('allow');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchMesaRules().then((out) => {
      if (!alive) return;
      if (out.ok) setRules(sanitizeMesaRules(out.value));
      else setError(out.error);
    });
    sources()
      .then((list) => alive && setBooks([...list].sort((a, b) => a.name.localeCompare(b.name, locale))))
      .catch(() => alive && setBooks([]));
    return () => { alive = false; };
  }, []);

  // `/mesa#criacao` (atalho da lista de personagens): rola até aqui quando as regras chegam.
  const ready = rules !== null;
  useEffect(() => {
    if (ready && window.location.hash === '#criacao') document.getElementById('criacao')?.scrollIntoView({ block: 'start' });
  }, [ready]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (books ?? []).filter((b) => !q || b.name.toLowerCase().includes(q));
  }, [books, filter]);

  if (!rules) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
        {error ? <Alert severity="error">{error}</Alert> : <Skeleton variant="rounded" height={160} />}
      </Paper>
    );
  }

  const change = (patch: Partial<MesaRules>) => {
    setSaved(false);
    setRules({ ...rules, ...patch });
  };
  const setVariant = (patch: Partial<MesaVariants>) => change({ variants: { ...rules.variants, ...patch } });
  const previousBooks = rules.sources.allow.length ? rules.sources.allow : (books ?? []).map((b) => b.id);
  const legacyBooks = rules.sources.legacy ?? (rules.legacy ? previousBooks : []);
  const allowed = new Set(edition === 'allow' ? rules.sources.allow : legacyBooks);
  const markBooks = (ids: string[], on: boolean) => {
    const next = new Set(allowed);
    for (const id of ids) {
      if (rules.sources.deny?.includes(id)) continue;
      if (on) next.add(id);
      else next.delete(id);
    }
    // Fixe o legado antigo antes de mudar a lista Remaster compartilhada pelas mesas anteriores.
    change({ sources: { ...rules.sources, legacy: legacyBooks, [edition]: [...next].sort() } });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const out = await saveMesaRules(rules);
    setBusy(false);
    if (out.ok) {
      setRules(sanitizeMesaRules(out.value));
      setSaved(true);
    } else setError(out.error);
  };

  return (
    <Paper id="criacao" variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5, scrollMarginTop: 80 }}>
      <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 0.5 }}>
        {tr('Criação de personagem', 'Character creation')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tr('O que o Criador de Personagem oferece nesta mesa. Fora disso, o Criador avisa — não trava.', 'What the Character Builder offers at this table. Anything else gets a warning — it never blocks.')}
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" onClose={() => setSaved(false)} sx={{ mb: 2 }}>{tr('Regras de criação salvas.', 'Creation rules saved.')}</Alert>}

      <Typography sx={{ fontWeight: 600, mb: 1 }}>{tr('Variantes', 'Variant rules')}</Typography>
      <Stack sx={{ mb: 2 }}>
        {VARIANTS.map((v) => (
          <Box key={v.key}>
            <FormControlLabel control={<Switch checked={rules.variants[v.key]} onChange={(e) => setVariant({ [v.key]: e.target.checked })} />}
              label={v.label} />
            {!v.ready && rules.variants[v.key] && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ ml: 6, mt: -0.5 }}>
                {tr('O Criador ainda não calcula esta variante: os números saem sem ela, com aviso.', 'The Builder doesn\'t calculate this variant yet: numbers come out without it, with a warning.')}
              </Typography>
            )}
          </Box>
        ))}
        <FormControlLabel
          control={<Switch checked={rules.variants.mythic.enabled} onChange={(e) => setVariant({ mythic: { ...rules.variants.mythic, enabled: e.target.checked } })} />}
          label={tr('Mítico', 'Mythic')} />
        {rules.variants.mythic.enabled && (
          <TextField select size="small" label={tr('Progressão mítica', 'Mythic progression')} value={rules.variants.mythic.progression}
            onChange={(e) => setVariant({ mythic: { ...rules.variants.mythic, progression: e.target.value === 'trials' ? 'trials' : 'level' } })}
            sx={{ ml: { sm: 6 }, mt: 1, maxWidth: 280 }}>
            <MenuItem value="level">{tr('Por nível', 'By level')}</MenuItem>
            <MenuItem value="trials">{tr('Por provações', 'By trials')}</MenuItem>
          </TextField>
        )}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5, mb: 2 }}>
        <TextField select size="small" label={tr('Incomum', 'Uncommon')} value={rules.rarity.uncommon}
          onChange={(e) => change({ rarity: { ...rules.rarity, uncommon: e.target.value as Rarity } })}>
          {(Object.keys(RARITY_LABEL) as Rarity[]).map((r) => <MenuItem key={r} value={r}>{RARITY_LABEL[r]}</MenuItem>)}
        </TextField>
        <TextField select size="small" label={tr('Raro', 'Rare')} value={rules.rarity.rare}
          onChange={(e) => change({ rarity: { ...rules.rarity, rare: e.target.value as Rarity } })}>
          {(Object.keys(RARITY_LABEL) as Rarity[]).map((r) => <MenuItem key={r} value={r}>{RARITY_LABEL[r]}</MenuItem>)}
        </TextField>
        <TextField select size="small" label={tr('Nível inicial sugerido', 'Suggested starting level')} value={rules.startingLevel}
          onChange={(e) => change({ startingLevel: Number(e.target.value) })}>
          {LEVELS.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
        <TextField select size="small" label={tr('Riqueza inicial', 'Starting wealth')} value={rules.wealth}
          onChange={(e) => change({ wealth: e.target.value === 'free' ? 'free' : 'table' })}>
          <MenuItem value="table">{tr('Tabela do GM Core', 'GM Core table')}</MenuItem>
          <MenuItem value="free">{tr('Livre', 'Free')}</MenuItem>
        </TextField>
      </Box>

      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{tr('Livros liberados', 'Allowed books')}</Typography>
      <TextField select size="small" label={tr('Edição', 'Edition')} value={edition} sx={{ mt: 1, mb: 1, minWidth: 160 }}
        onChange={(e) => setEdition(e.target.value === 'legacy' ? 'legacy' : 'allow')}>
        <MenuItem value="allow">{tr('Remaster', 'Remaster')}</MenuItem>
        <MenuItem value="legacy">{tr('Legado', 'Legacy')}</MenuItem>
      </TextField>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {edition === 'allow' && allowed.size === 0 ? tr('Sem seleção, o Remaster usa todos os livros permitidos.', 'An empty selection includes all permitted books for Remaster content.')
          : tr(`${allowed.size} de ${books?.length ?? '…'} livros do catálogo.`, `${allowed.size} of ${books?.length ?? '…'} catalog books.`)}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ my: 1, alignItems: { sm: 'center' } }}>
        <TextField size="small" label={tr('Filtrar livros', 'Filter books')} value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1}>
          <Button size="small" disabled={!shown.length} onClick={() => markBooks(shown.map((b) => b.id), true)}>{tr('Marcar todos', 'Select all')}</Button>
          <Button size="small" disabled={!shown.length} onClick={() => markBooks(shown.map((b) => b.id), false)}>{tr('Desmarcar', 'Clear')}</Button>
        </Stack>
      </Stack>
      {!books ? <Skeleton variant="rounded" height={120} /> : (
        <Box sx={{ maxHeight: 320, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, px: 1, mb: 2,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {shown.map((b) => (
            <FormControlLabel key={b.id} sx={{ mr: 0, minWidth: 0, '& .MuiFormControlLabel-label': { overflowWrap: 'anywhere' } }}
              control={<Checkbox size="small" disabled={rules.sources.deny?.includes(b.id)} checked={edition === 'legacy' ? allowsLegacyBook(rules, b.id) : allowed.has(b.id)} onChange={(e) => markBooks([b.id], e.target.checked)} />}
              label={<Typography variant="body2">{b.name}{b.remaster ? '' : tr(' (legado)', ' (legacy)')}</Typography>} />
          ))}
        </Box>
      )}

      <Button variant="contained" onClick={() => void save()} disabled={busy}>{tr('Salvar regras de criação', 'Save creation rules')}</Button>
    </Paper>
  );
}
