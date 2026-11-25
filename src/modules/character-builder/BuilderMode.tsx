import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Badge, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Drawer, MenuItem, Paper,
  Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { ArrowBack as BackIcon, DeleteOutline as DeleteIcon, Checklist as PendingIcon } from '@mui/icons-material';
import { trashBuild } from '../../services/builds';
import { displayFont } from '../../theme';
import { ReadOnlyTheme } from '../character-viewer/components/ReadOnlyTheme';
import { VIEW_OK } from '../character-viewer/sheetAccess';
import { useBuild, type SaveStatus } from './hooks/useBuild';
import { useRules, type FeatListNeeds } from './hooks/useRules';
import { needsOf } from './engine/catalog';
import { compileBuild } from './engine/compile';
import { StatusHeader } from './components/StatusHeader';
import { PendingPanel } from './components/PendingPanel';
import { OriginSection } from './sections/OriginSection';
import { ClassSection } from './sections/ClassSection';
import { AttributesSection } from './sections/AttributesSection';
import { SkillsSection } from './sections/SkillsSection';
import { ProgressionSection } from './sections/ProgressionSection';
import { SpellsSection } from './sections/SpellsSection';
import { EquipmentSection } from './sections/EquipmentSection';
import { CompanionsSection } from './sections/CompanionsSection';
import type { SectionProps } from './sections/types';
import { tabOf, type BuilderTab } from './tabs';
import { RemasterDialog } from './components/RemasterDialog';
import { BuildExceptions } from './hooks/buildExceptions';
import { ApplyDialog } from './components/ApplyDialog';
import { BackgroundNotes } from './components/BackgroundNotes';
import { ManualSection } from './sections/ManualSection';
import { createBuild, saveBuild, saveMesaRules } from '../../services/builds';
import { exportBuild } from './engine/export';
import { assignBuild, fetchBuildVersions, restoreBuildVersion, type BuildVersion } from '../../services/builds';
import { assignSheet, fetchMembers, type MemberRow } from '../../services/members';
import { mesaName, useAuth, useRole } from '../../services/auth';
import { currentMesa, switchMesa } from '../../services/mesa';
import { copyBuildToMesa } from '../../services/builds';
import { setWikiSeed } from '../../services/wiki';
import { locale, tr } from '../../i18n';
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
  { key: 'progression', label: tr('Progressão', 'Progression') },
  { key: 'spells', label: tr('Magias', 'Spells') },
  { key: 'equipment', label: tr('Equipamento', 'Equipment') },
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
  const [needs, setNeeds] = useState<FeatListNeeds | undefined>(undefined);
  const rules = useRules(needs);
  const [className, setClassName] = useState<string | null>(null);
  const [browseArchetype, setBrowseArchetype] = useState<string | null>(null);
  // A aba Equipamento pede as listas de item mesmo com o inventário vazio.
  const [itemsWanted, setItemsWanted] = useState(false);
  // Tradições dos conjuradores que o motor achou (arquétipo incluído): as listas delas também baixam.
  const [casterTraditions, setCasterTraditions] = useState<string>('');
  const { build, state, canEdit, loading, error, status, conflict, update, keepMine, takeTheirs, reload, saveNow } = useBuild(buildId, className);

  // Listas de talento que este personagem usa: classe, ancestralidade, herança versátil, mítico e os arquétipos dos
  // talentos escolhidos (pelo qualificador) mais o que o seletor está navegando.
  const core = rules.core;
  const needsKey = useMemo(() => {
    if (!core || !state) return '';
    return JSON.stringify(needsOf(state, core, rules.mesaRules, { browseArchetype, itemsWanted, traditions: casterTraditions.split(',').filter(Boolean) }));
  }, [core, state, browseArchetype, rules.mesaRules, itemsWanted, casterTraditions]);
  useEffect(() => { if (needsKey) setNeeds(JSON.parse(needsKey) as FeatListNeeds); }, [needsKey]);
  const [tab, setTab] = useState<BuilderTab>('origin');
  const [pendingOpen, setPendingOpen] = useState(false);
  const [remasterOpen, setRemasterOpen] = useState(false);
  const exceptions = useMemo(() => new Set(rules.mesaRules?.exceptions.filter((e) => e.buildId === buildId).flatMap((e) => e.ids)), [rules.mesaRules, buildId]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [versions, setVersions] = useState<BuildVersion[] | null>(null);
  // GM: membros da mesa para escolher o dono (F8.2).
  const { isGm, username, displayName } = useRole();
  const auth = useAuth();
  const otherMesas = auth.status === 'in' ? auth.mesas.filter((m) => m.id !== currentMesa.id) : [];
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState<{ mesa: string; id: string } | null>(null);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isGm) return;
    let alive = true;
    void fetchMembers().then((out) => { if (alive && out.ok) setMembers(out.data.members.filter((m) => !m.anonymous)); });
    return () => { alive = false; };
  }, [isGm]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const compiled = useMemo(() => (state && rules.index && core
    ? compileBuild(state, { rules: rules.index, mesaRules: rules.mesaRules ?? undefined, classOptions: core.classFeatures, tables: rules.tables ?? undefined, buildId })
    : null), [state, rules.index, rules.mesaRules, core, rules.tables, buildId]);
  const traditionsKey = compiled ? [...new Set(compiled.casters.map((c) => c.tradition).filter(Boolean))].sort().join(',') : '';
  useEffect(() => setCasterTraditions(traditionsKey), [traditionsKey]);
  const clsName = rules.index?.get(state?.class.id)?.name ?? null;
  useEffect(() => setClassName(clsName), [clsName]);

  // "Subir de nível" vindo da Ficha (`?subir=1`): um nível a mais e a aba Progressão, uma vez.
  const [params, setParams] = useSearchParams();
  const levelUp = params.get('subir') === '1'; // i18n-ok: chave da URL
  const [swapSlot] = useState(() => params.get('trocar')); // i18n-ok: chave da URL
  useEffect(() => {
    if (!swapSlot) return;
    setTab('progression');
    setParams((p) => { p.delete('trocar'); return p; }, { replace: true }); // i18n-ok: chave da URL
  }, [swapSlot, setParams]);
  useEffect(() => {
    if (!levelUp || !state || !canEdit) return;
    if (state.level < 20) update((s) => ({ ...s, level: s.level + 1 }));
    setTab('progression');
    setParams((p) => { p.delete('subir'); return p; }, { replace: true });
  }, [levelUp, state, canEdit, update, setParams]);

  // O retrato de agora (estável entre renders do mesmo estado, para o diff do diálogo não refazer à toa).
  const exportSheet = useCallback(() => (state && compiled && rules.index && build
    ? exportBuild(state, compiled, { rules: rules.index, buildId: build.id }) : null), [state, compiled, rules.index, build]);

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
    if (next === 'equipment') setItemsWanted(true);
    setTab(next);
    setPendingOpen(false);
  };

  // Retreino (F8.6): trocar a escolha de um slot que já tinha valor, num personagem já aplicado na mesa, fica no
  // histórico (quem, quando, de quê para quê). Escolher pela primeira vez não é retreino.
  const describe = (c: BuildState['choices'][string] | undefined) => !c ? '—'
    : 'id' in c ? (rules.index?.get(c.id)?.name ?? c.id) : 'boosts' in c ? c.boosts.join(', ') : 'skills' in c ? c.skills.join(', ') : 'lore' in c ? c.lore : c.value;
  const updateWithHistory: SectionProps['update'] = (change) => update((s) => {
    const next = change(s);
    if (build.publishedRev === null || next.choices === s.choices) return next;
    const retrained = Object.keys(s.choices).filter((k) => s.choices[k] && JSON.stringify(s.choices[k]) !== JSON.stringify(next.choices[k]));
    if (!retrained.length) return next;
    const at = new Date().toISOString();
    const entries = retrained.map((k) => ({ at, by: (displayName ?? username ?? 'local').slice(0, 60), kind: 'retrain' as const,
      note: `${k}: ${describe(s.choices[k])} → ${describe(next.choices[k])}`.slice(0, 200) }));
    return { ...next, history: [...next.history, ...entries].slice(-100) };
  });

  const sectionProps: SectionProps | null = compiled && rules.core && rules.index
    ? { state, update: updateWithHistory, core: rules.core, index: rules.index, mesaRules: rules.mesaRules, compiled, canEdit }
    : null;

  // GM libera uma entrada só para este personagem (F8.5): exceção nas regras da mesa, sem mexer no resto.
  const allow = isGm ? (entryId: string) => {
    const current = rules.mesaRules
    if (!current) return
    const exceptions = [...current.exceptions]
    const mine = exceptions.find((e) => e.buildId === build.id)
    if (mine) { if (!mine.ids.includes(entryId)) mine.ids = [...mine.ids, entryId] } else exceptions.push({ buildId: build.id, ids: [entryId] })
    void saveMesaRules({ ...current, exceptions }).then((out) => { if (out.ok) rules.setMesaRules(out.value) })
  } : undefined
  const panel = compiled && <PendingPanel compiled={compiled} onGo={go} onDiscard={discard} canEdit={canEdit} onAllow={allow} />;

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
            {canEdit && compiled && rules.index && (
              <Button size="small" variant="contained" onClick={() => setApplyOpen(true)}>{tr('Aplicar na mesa', 'Apply to the table')}</Button>
            )}
            {compiled && rules.index && (
              <Button size="small" {...VIEW_OK} onClick={() => {
                const doc = exportBuild(state, compiled, { rules: rules.index!, buildId: build.id });
                const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `${build.slug}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}>{tr('Baixar JSON', 'Download JSON')}</Button>
            )}
            {isGm && members && (
              <TextField select size="small" label={tr('Dono', 'Owner')} sx={{ minWidth: 160 }}
                value={(owner === undefined ? build.ownerId : owner) ?? ''}
                onChange={(e) => {
                  const user = e.target.value || null;
                  setOwner(user);
                  void assignBuild(build.id, user).then((out) => {
                    // A ficha que já está na mesa acompanha o dono do build.
                    if (out.ok && build.publishedRev !== null) void assignSheet(build.slug, user);
                  });
                }}>
                <MenuItem value="">{tr('Sem dono', 'No owner')}</MenuItem>
                {members.map((m) => <MenuItem key={m.userId} value={m.userId}>{m.displayName ?? m.username ?? m.userId.slice(0, 8)}</MenuItem>)}
              </TextField>
            )}
            {canEdit && (
              <Button size="small" {...VIEW_OK} onClick={() => void fetchBuildVersions(build.id).then((out) => setVersions(out.ok ? out.value : []))}>
                {tr('Versões', 'Versions')}</Button>
            )}
            <Button size="small" startIcon={<Badge badgeContent={pendingCount} color="warning"><PendingIcon /></Badge>}
              onClick={() => setPendingOpen(true)} sx={{ display: { md: 'none' } }} {...VIEW_OK}>
              {tr('Pendências', 'To do')}</Button>
          </Stack>
        </Paper>

        {compiled ? <StatusHeader compiled={compiled} /> : <Skeleton variant="rounded" height={64} sx={{ mb: 2 }} />}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' }, gap: 2, alignItems: 'start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Tabs value={tab} onChange={(_, v: BuilderTab) => { if (v === 'equipment') setItemsWanted(true); setTab(v); }} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
              {TABS.map((t) => (
                <Tab key={t.key} value={t.key} data-view=""
                  label={tabPending(t.key) ? <Badge color="warning" variant="dot">{t.label}</Badge> : t.label} />
              ))}
            </Tabs>

            <BuildExceptions.Provider value={exceptions}>
              {!sectionProps && tab !== 'details' && <Skeleton variant="rounded" height={240} />}
              {sectionProps && tab === 'origin' && <OriginSection {...sectionProps} />}
              {sectionProps && tab === 'class' && <ClassSection {...sectionProps} />}
              {sectionProps && tab === 'attributes' && <AttributesSection {...sectionProps} />}
              {sectionProps && tab === 'skills' && <SkillsSection {...sectionProps} />}
              {sectionProps && tab === 'equipment' && (
                <Stack spacing={2}>
                  <EquipmentSection {...sectionProps} entries={rules.feats}
                    wealth={(rules.tables as { wealth?: { levels: Record<string, { currency: number; lumpSum: number }>; source?: string } } | null)?.wealth} />
                  <CompanionsSection {...sectionProps} entries={rules.feats} />
                </Stack>
              )}
              {sectionProps && tab === 'spells' && <SpellsSection {...sectionProps} spells={rules.feats.filter((e) => e.type === 'spell')} />}
              {sectionProps && tab === 'progression' && (
                <ProgressionSection {...sectionProps} feats={rules.feats} archetypes={core?.archetypes ?? []}
                  browseArchetype={browseArchetype} setBrowseArchetype={setBrowseArchetype} initialSlot={swapSlot} />
              )}
            </BuildExceptions.Provider>
            {tab === 'details' && (
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 1.5 }}>{tr('Detalhes', 'Details')}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
                  {DETAIL_FIELDS.map(({ key, label }) => (
                    <TextField key={key} label={label} value={state.details[key] ?? ''} onChange={(e) => setDetail(key, e.target.value)}
                      slotProps={{ htmlInput: { maxLength: 80, readOnly: !canEdit } }} />
                  ))}
                </Box>
                {state.history.some((h) => h.kind === 'retrain') && (
                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{tr('Retreinos', 'Retraining')}</Typography>
                    {state.history.filter((h) => h.kind === 'retrain').slice(-10).reverse().map((h, i) => (
                      <Typography key={i} variant="body2" color="text.secondary">
                        {new Date(h.at).toLocaleDateString(locale)} · {h.by} · {h.note}
                      </Typography>
                    ))}
                  </Box>
                )}
                {build.publishedRev !== null && <Box sx={{ mt: 2 }}><BackgroundNotes slug={build.slug} canEdit={canEdit} /></Box>}
                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 2 }}>
                  {canEdit && core && <Button onClick={() => setRemasterOpen(true)}>{tr('Converter para o Remaster', 'Convert to Remaster')}</Button>}
                  {canEdit && (
                    <Button color="error" startIcon={<DeleteIcon />} onClick={() => setConfirmDelete(true)}>
                      {tr('Mandar para a lixeira', 'Move to trash')}</Button>
                  )}
                  <Button {...VIEW_OK} onClick={() => void (async () => {
                    // Duplicar (F8.7): um build novo com as mesmas escolhas, slug próprio, sem ficha na mesa.
                    const copy = await createBuild(tr(`${state.name} (cópia)`, `${state.name} (copy)`).slice(0, 80), state.level);
                    if (!copy.ok) return;
                    const saved = await saveBuild(copy.value.id, copy.value.rev, { ...state, name: copy.value.name }, className);
                    if (saved.ok) navigate(`/personagens/${copy.value.id}`);
                  })()}>{tr('Duplicar', 'Duplicate')}</Button>
                  {/* Página na Wiki (9.9): NPC com a ficha rápida, o retrato e os detalhes; se já existe, a Wiki só abre. */}
                  <Button {...VIEW_OK} onClick={() => {
                    const name = (id?: string) => (id ? rules.index?.get(id)?.name : undefined);
                    const anc = name(state.origin.ancestry);
                    const her = name(state.origin.heritage);
                    const ancestry = her ? (anc && !her.includes(anc) ? `${anc} (${her})` : her) : anc ?? '';
                    const role = [clsName, tr(`nível ${state.level}`, `level ${state.level}`)].filter(Boolean).join(', ');
                    const lines = DETAIL_FIELDS.filter(({ key }) => state.details[key]?.trim()).map(({ key, label }) => `- **${label}:** ${state.details[key]!.trim()}`);
                    setWikiSeed({
                      summary: tr(`Personagem de jogador${displayName ? ` (${displayName})` : ''}.`, `Player character${displayName ? ` (${displayName})` : ''}.`),
                      image: state.details.portrait?.trim() || undefined,
                      fields: { ...(ancestry ? { ancestry } : {}), ...(role ? { role } : {}) },
                      body: [tr('## Quem é', '## Who they are'), '', ...(lines.length ? lines : [tr('_Escreva aqui._', '_Write here._')])].join('\n'),
                    });
                    navigate(`/wiki?nova=${encodeURIComponent(state.name)}&tipo=npc&semente=1`);
                  }}>{tr('Criar página na Wiki', 'Create wiki page')}</Button>
                  {/* Copiar para outra mesa (9.6): só as mesas de que a pessoa faz parte; abre a cópia lá (troca de mesa recarrega). */}
                  {otherMesas.map((m) => (
                    <Button key={m.id} {...VIEW_OK} onClick={() => void (async () => {
                      const out = await copyBuildToMesa(build.id, m.id);
                      if (!out.ok) { setCopyError(out.error); return; }
                      if (out.value) setCopied({ mesa: m.id, id: out.value.id });
                    })()}>{tr(`Copiar para ${mesaName(auth, m.id, m.id)}`, `Copy to ${mesaName(auth, m.id, m.id)}`)}</Button>
                  ))}
                </Stack>
                {copyError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setCopyError(null)}>{copyError}</Alert>}
                {copied && (
                  <Alert severity="success" sx={{ mt: 1 }} onClose={() => setCopied(null)}
                    action={<Button color="inherit" onClick={() => switchMesa(copied.mesa, `/personagens/${copied.id}`)}>{tr('Abrir lá', 'Open there')}</Button>}>
                    {tr(`Cópia criada em ${mesaName(auth, copied.mesa, copied.mesa)}. As regras de lá passam a valer.`, `Copy created in ${mesaName(auth, copied.mesa, copied.mesa)}. Its rules now apply.`)}
                  </Alert>
                )}
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                  {tr('Regras e textos de jogo: ', 'Game rules and text: ')}
                  <RouterLink to="/creditos">{tr('créditos e licenças', 'credits and licenses')}</RouterLink>
                </Typography>
              </Paper>
            )}
            {sectionProps && tab === 'details' && <Box sx={{ mt: 2 }}><ManualSection {...sectionProps} /></Box>}
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

      {compiled && rules.index && (
        <ApplyDialog open={applyOpen} onClose={() => setApplyOpen(false)} buildId={build.id} slug={build.slug} compiled={compiled}
          sheet={exportSheet} saveNow={saveNow} />
      )}

      <Dialog open={versions !== null} onClose={() => setVersions(null)} fullWidth maxWidth="xs">
        <DialogTitle>{tr('Versões aplicadas na mesa', 'Versions applied to the table')}</DialogTitle>
        <DialogContent>
          {versions?.length === 0 && <DialogContentText>{tr('Nenhuma versão aplicada ainda.', 'No version applied yet.')}</DialogContentText>}
          <Stack spacing={1}>
            {versions?.map((v) => (
              <Stack key={v.id} direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <Typography sx={{ flex: 1 }}>{new Date(v.publishedAt).toLocaleString(locale)} · {tr(`nível ${v.level}`, `level ${v.level}`)}</Typography>
                <Button size="small" onClick={() => void restoreBuildVersion(build.id, v.id, build.rev).then((out) => { if (out.ok) { setVersions(null); reload(); } })}>
                  {tr('Restaurar', 'Restore')}</Button>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setVersions(null)}>{tr('Fechar', 'Close')}</Button></DialogActions>
      </Dialog>

      {remasterOpen && canEdit && core && rules.index && <RemasterDialog state={state} core={core} entries={rules.feats}
        mesaRules={rules.mesaRules} exceptions={exceptions} update={updateWithHistory} onClose={() => setRemasterOpen(false)} />}

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
