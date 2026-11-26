import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ListItemIcon,
  ListItemText, Menu, MenuItem, Skeleton, Stack, TextField,
} from '@mui/material';
import {
  ArrowBack as BackIcon, ArrowForward as NextIcon, ArrowUpwardRounded as UpIcon, CheckRounded as DoneIcon, ChevronLeft as ChevronIcon,
  Close as CloseIcon, CloudOffOutlined as OfflineIcon, DownloadOutlined as DownloadIcon, HistoryRounded as VersionsIcon,
  LockOutlined as LockIcon, MoreVert as MoreIcon, TaskAltRounded as ApplyIcon, SyncProblemOutlined as ConflictIcon,
} from '@mui/icons-material';
import { trashBuild } from '../../services/builds';
import { chrome, displayFont, gold, greenInk, ink, parchment, rule, status } from '../../theme';
import { ReadOnlyTheme } from '../character-viewer/components/ReadOnlyTheme';
import { VIEW_OK } from '../character-viewer/sheetAccess';
import { useBuild } from './hooks/useBuild';
import { useRules, type FeatListNeeds } from './hooks/useRules';
import { needsOf } from './engine/catalog';
import { compileBuild } from './engine/compile';
import { CharacterHero, SaveIndicator } from './components/CharacterHero';
import { heroSubtitle } from './components/heroText';
import { PendingAside, PendingSheet } from './components/PendingPanel';
import { OriginSection } from './sections/OriginSection';
import { ClassSection } from './sections/ClassSection';
import { AttributesSection } from './sections/AttributesSection';
import { SkillsSection } from './sections/SkillsSection';
import { ProgressionSection } from './sections/ProgressionSection';
import { SpellsSection } from './sections/SpellsSection';
import { EquipmentSection } from './sections/EquipmentSection';
import { CompanionsSection } from './sections/CompanionsSection';
import { DetailsSection } from './sections/DetailsSection';
import { DETAIL_FIELDS } from './sections/detailFields';
import type { SectionProps } from './sections/types';
import { TAB_LABEL, TABS, tabOf, type BuilderTab } from './tabs';
import { RemasterDialog } from './components/RemasterDialog';
import { BuildExceptions } from './hooks/buildExceptions';
import { ApplyDialog } from './components/ApplyDialog';
import { LevelUpDialog } from './components/LevelUpDialog';
import { HeroPortrait } from './components/HeroPortrait';
import { statDiff } from './components/levelDiff';
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
import { Label, PendDot, StateBadge, type PublishState } from './components/ui';
import { cardSx, goldButtonSx, tint, warmShadow } from './components/uiTokens';

/** Os passos da criação guiada: o começo, as seções na ordem do livro e a revisão. */
type Step = 'start' | Exclude<BuilderTab, 'companions'> | 'review';
const STEPS: Step[] = ['start', 'origin', 'class', 'attributes', 'skills', 'progression', 'spells', 'equipment', 'details', 'review'];
const STEP_LABEL: Record<Step, string> = {
  start: tr('Começo', 'Start'), origin: TAB_LABEL.origin, class: TAB_LABEL.class, attributes: TAB_LABEL.attributes, skills: TAB_LABEL.skills,
  progression: tr('Talentos', 'Feats'), spells: TAB_LABEL.spells, equipment: TAB_LABEL.equipment, details: TAB_LABEL.details, review: tr('Revisão', 'Review'),
};

const publishOf = (b: { publishedRev: number | null; rev: number }): PublishState =>
  b.publishedRev === null ? 'draft' : b.publishedRev === b.rev ? 'published' : 'changed';

/**
 * O editor de um personagem (redesign "livro, não formulário"): o resumo com presença no topo, as seções (Plano, Origem,
 * Classe…) em chips no celular e numa coluna no desktop, o painel de pendências e avisos sempre à mão e, para um personagem
 * novo (`?guiado=1`), a criação em passos com "Pular" e voltar. Montado também pela Ficha em "Editar no Criador".
 */
export function BuilderMode({ buildId }: { buildId: string }) {
  const navigate = useNavigate();
  const [needs, setNeeds] = useState<FeatListNeeds | undefined>(undefined);
  const rules = useRules(needs);
  const [className, setClassName] = useState<string | null>(null);
  const [browseArchetype, setBrowseArchetype] = useState<string | null>(null);
  // A seção Equipamento pede as listas de item mesmo com o inventário vazio.
  const [itemsWanted, setItemsWanted] = useState(false);
  // Tradições dos conjuradores que o motor achou (arquétipo incluído): as listas delas também baixam.
  const [casterTraditions, setCasterTraditions] = useState<string>('');
  // Talentos concedidos que o motor não achou nas listas carregadas: entram nas referências que o `useRules` busca.
  const [grantRefs, setGrantRefs] = useState<string>('');
  const { build, state, canEdit, loading, error, status: saveStatus, conflict, update, keepMine, takeTheirs, reload, saveNow } = useBuild(buildId, className);

  // Listas de talento que este personagem usa: classe, ancestralidade, herança versátil, mítico e os arquétipos dos
  // talentos escolhidos (pelo qualificador) mais o que o seletor está navegando.
  const core = rules.core;
  const needsKey = useMemo(() => {
    if (!core || !state) return '';
    return JSON.stringify(needsOf(state, core, rules.mesaRules, { browseArchetype, itemsWanted, traditions: casterTraditions.split(',').filter(Boolean),
      references: grantRefs.split(',').filter(Boolean) }));
  }, [core, state, browseArchetype, rules.mesaRules, itemsWanted, casterTraditions, grantRefs]);
  useEffect(() => { if (needsKey) setNeeds(JSON.parse(needsKey) as FeatListNeeds); }, [needsKey]);

  const [params, setParams] = useSearchParams();
  const [guided, setGuided] = useState(() => params.get('guiado') === '1'); // i18n-ok: chave da URL
  const [step, setStep] = useState<Step>('start');
  const [skipped, setSkipped] = useState<Set<Step>>(new Set());
  const [tab, setTab] = useState<BuilderTab | null>(null);
  const [focus, setFocus] = useState<{ key: string; n: number } | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [remasterOpen, setRemasterOpen] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
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

  const ctx = useMemo(() => (rules.index && core
    ? { rules: rules.index, mesaRules: rules.mesaRules ?? undefined, classOptions: core.classFeatures, tables: rules.tables ?? undefined, buildId }
    : null), [rules.index, rules.mesaRules, core, rules.tables, buildId]);
  const compiled = useMemo(() => (state && ctx ? compileBuild(state, ctx) : null), [state, ctx]);
  const traditionsKey = compiled ? [...new Set(compiled.casters.map((c) => c.tradition).filter(Boolean))].sort().join(',') : '';
  useEffect(() => setCasterTraditions(traditionsKey), [traditionsKey]);
  const grantKey = compiled ? compiled.missingRefs.join(',') : '';
  useEffect(() => { if (grantKey) setGrantRefs((prev) => [...new Set([...prev.split(','), ...grantKey.split(',')].filter(Boolean))].sort().join(',')); }, [grantKey]);
  const clsName = rules.index?.get(state?.class.id)?.name ?? null;
  useEffect(() => setClassName(clsName), [clsName]);

  // A seção aberta: o Plano para quem já tem classe, a Origem para um personagem vazio.
  const section: BuilderTab = tab ?? (state?.class.id ? 'progression' : 'origin');
  const current: Step | BuilderTab = guided ? step : section;

  // O personagem um nível acima (cartão "próximo nível" do Plano e o "Subir de nível").
  const wantsNext = !!state && state.level < 20 && (levelUpOpen || current === 'progression');
  const nextCompiled = useMemo(() => (wantsNext && state && ctx ? compileBuild({ ...state, level: state.level + 1 }, ctx) : null), [wantsNext, state, ctx]);
  const next = useMemo(() => (compiled && nextCompiled ? { compiled: nextCompiled, diff: statDiff(compiled, nextCompiled) } : null), [compiled, nextCompiled]);

  // "Subir de nível" vindo da Ficha (`?subir=1`) abre o diálogo; "Trocar talento" (`?trocar=slot`) abre o seletor do slot.
  const levelUpParam = params.get('subir') === '1'; // i18n-ok: chave da URL
  const [swapSlot] = useState(() => params.get('trocar')); // i18n-ok: chave da URL
  useEffect(() => {
    if (!swapSlot) return;
    setTab('progression');
    setFocus({ key: swapSlot, n: 1 });
    setParams((p) => { p.delete('trocar'); return p; }, { replace: true }); // i18n-ok: chave da URL
  }, [swapSlot, setParams]);
  useEffect(() => {
    if (!levelUpParam || !state || !canEdit) return;
    if (state.level < 20) setLevelUpOpen(true);
    setTab('progression');
    setParams((p) => { p.delete('subir'); return p; }, { replace: true }); // i18n-ok: chave da URL
  }, [levelUpParam, state, canEdit, setParams]);
  useEffect(() => {
    if (params.get('guiado') !== '1') return; // i18n-ok: chave da URL
    setParams((p) => { p.delete('guiado'); return p; }, { replace: true }); // i18n-ok: chave da URL
  }, [params, setParams]);

  // O retrato de agora (estável entre renders do mesmo estado, para o diff do diálogo não refazer à toa).
  const exportSheet = useCallback(() => (state && compiled && rules.index && build
    ? exportBuild(state, compiled, { rules: rules.index, buildId: build.id }) : null), [state, compiled, rules.index, build]);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Skeleton variant="rounded" height={180} sx={{ mb: 2, mx: { xs: -1.5, sm: 0 }, mt: { xs: -2, sm: 0 }, borderRadius: { xs: 0, sm: 1 } }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px', lg: '200px minmax(0, 1fr) 300px' }, gap: 3 }}>
          <Skeleton variant="rounded" height={380} sx={{ display: { xs: 'none', lg: 'block' } }} />
          <Skeleton variant="rounded" height={600} />
          <Skeleton variant="rounded" height={320} sx={{ display: { xs: 'none', md: 'block' } }} />
        </Box>
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

  const rulesVersion = rules.core?.version ?? null;
  const setPortrait = (url: string) => update((s) => ({ ...s, details: { ...s.details, portrait: url } }));
  const tabPending = (key: BuilderTab) => compiled?.pending.filter((p) => tabOf(p.key) === key).length ?? 0;
  const open = (nextTab: BuilderTab, key?: string) => {
    if (nextTab === 'equipment') setItemsWanted(true);
    if (guided) setGuided(false);
    setTab(nextTab);
    setPendingOpen(false);
    if (key && nextTab === 'progression') setFocus((f) => ({ key, n: (f?.n ?? 0) + 1 }));
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Retreino (F8.6): trocar a escolha de um slot que já tinha valor, num personagem já aplicado na mesa, fica no
  // histórico (quem, quando, de quê para quê). Escolher pela primeira vez não é retreino.
  const describe = (c: BuildState['choices'][string] | undefined) => !c ? '—'
    : 'id' in c ? (rules.index?.get(c.id)?.name ?? c.id) : 'boosts' in c ? c.boosts.join(', ') : 'skills' in c ? c.skills.join(', ') : 'lore' in c ? c.lore : c.value;
  const updateWithHistory: SectionProps['update'] = (change) => update((s) => {
    const nextState = change(s);
    if (build.publishedRev === null || nextState.choices === s.choices) return nextState;
    const retrained = Object.keys(s.choices).filter((k) => s.choices[k] && JSON.stringify(s.choices[k]) !== JSON.stringify(nextState.choices[k]));
    if (!retrained.length) return nextState;
    const at = new Date().toISOString();
    const entries = retrained.map((k) => ({ at, by: (displayName ?? username ?? 'local').slice(0, 60), kind: 'retrain' as const,
      note: `${k}: ${describe(s.choices[k])} → ${describe(nextState.choices[k])}`.slice(0, 200) }));
    return { ...nextState, history: [...nextState.history, ...entries].slice(-100) };
  });

  const sectionProps: SectionProps | null = compiled && rules.core && rules.index
    ? { state, update: updateWithHistory, core: rules.core, index: rules.index, mesaRules: rules.mesaRules, compiled, canEdit }
    : null;

  // GM libera uma entrada só para este personagem (F8.5): exceção nas regras da mesa, sem mexer no resto.
  const allow = isGm ? (entryId: string) => {
    const currentRules = rules.mesaRules;
    if (!currentRules) return;
    const list = [...currentRules.exceptions];
    const mine = list.find((e) => e.buildId === build.id);
    if (mine) { if (!mine.ids.includes(entryId)) mine.ids = [...mine.ids, entryId]; } else list.push({ buildId: build.id, ids: [entryId] });
    void saveMesaRules({ ...currentRules, exceptions: list }).then((out) => { if (out.ok) rules.setMesaRules(out.value); });
  } : undefined;

  const name = (id?: string) => (id ? rules.index?.get(id)?.name : undefined);
  const subclass = compiled?.classChoices.find((c) => c.level === 1 && c.chosen);
  const subclassName = subclass ? subclass.options.find((o) => o.id === subclass.chosen)?.name ?? name(subclass.chosen) : undefined;
  const subtitle = heroSubtitle({ className: clsName, level: state.level, ancestry: name(state.origin.ancestry), subclass: subclassName });
  const publish = canEdit ? publishOf(build) : 'readonly';
  const who = [state.name.trim() || tr('Sem nome', 'Unnamed'), clsName ? `${clsName} ${state.level}` : null].filter(Boolean).join(' · ');

  const downloadJson = () => {
    if (!compiled || !rules.index) return;
    const doc = exportBuild(state, compiled, { rules: rules.index, buildId: build.id });
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${build.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const openVersions = () => void fetchBuildVersions(build.id).then((out) => setVersions(out.ok ? out.value : []));
  const canApply = canEdit && !!compiled && !!rules.index;

  const heroActions = (
    <>
      {canEdit && state.level < 20 && (
        <Button size="small" variant="outlined" startIcon={<UpIcon />} onClick={() => setLevelUpOpen(true)}
          sx={{ display: { xs: 'none', md: 'inline-flex' }, color: chrome.text, borderColor: chrome.lineStrong, '&:hover': { borderColor: gold.bright, bgcolor: chrome.active } }}>
          {tr('Subir de nível', 'Level up')}</Button>
      )}
      {canApply && (
        <Button size="small" variant="contained" onClick={() => setApplyOpen(true)} sx={[goldButtonSx, { display: { xs: 'none', md: 'inline-flex' } }]}>
          {tr('Revisar e aplicar', 'Review and apply')}</Button>
      )}
      <IconButton aria-label={tr('Mais opções', 'More options')} onClick={(e) => setMenu(e.currentTarget)} sx={{ color: chrome.text }} {...VIEW_OK}><MoreIcon /></IconButton>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {canApply && (
          <MenuItem onClick={() => { setMenu(null); setApplyOpen(true); }} sx={{ display: { md: 'none' } }}>
            <ListItemIcon><ApplyIcon fontSize="small" /></ListItemIcon><ListItemText>{tr('Revisar e aplicar', 'Review and apply')}</ListItemText>
          </MenuItem>
        )}
        {canEdit && state.level < 20 && (
          <MenuItem onClick={() => { setMenu(null); setLevelUpOpen(true); }} sx={{ display: { md: 'none' }, bgcolor: tint.gold }}>
            <ListItemIcon><UpIcon fontSize="small" sx={{ color: gold.deep }} /></ListItemIcon>
            <ListItemText secondary={tr(`para o nível ${state.level + 1}`, `to level ${state.level + 1}`)}>{tr('Subir de nível', 'Level up')}</ListItemText>
          </MenuItem>
        )}
        {canEdit && (
          <MenuItem onClick={() => { setMenu(null); openVersions(); }} {...VIEW_OK}>
            <ListItemIcon><VersionsIcon fontSize="small" /></ListItemIcon><ListItemText>{tr('Versões aplicadas', 'Applied versions')}</ListItemText>
          </MenuItem>
        )}
        {compiled && rules.index && (
          <MenuItem onClick={() => { setMenu(null); downloadJson(); }} {...VIEW_OK}>
            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText>{tr('Baixar JSON', 'Download JSON')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { setMenu(null); open('details'); }} {...VIEW_OK}>
          <ListItemIcon><MoreIcon fontSize="small" /></ListItemIcon><ListItemText>{tr('Detalhes e ações', 'Details and actions')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );

  // Detalhes: as ações do personagem (duplicar, Wiki, copiar para outra mesa, Remaster, lixeira).
  const detailActions = [
    ...(canEdit && core ? [{ key: 'remaster', label: tr('Converter para o Remaster', 'Convert to Remaster'), onClick: () => setRemasterOpen(true) }] : []),
    {
      key: 'dup', label: tr('Duplicar', 'Duplicate'), onClick: () => void (async () => {
        // Duplicar (F8.7): um build novo com as mesmas escolhas, slug próprio, sem ficha na mesa.
        const copy = await createBuild(tr(`${state.name} (cópia)`, `${state.name} (copy)`).slice(0, 80), state.level);
        if (!copy.ok) return;
        const saved = await saveBuild(copy.value.id, copy.value.rev, { ...state, name: copy.value.name }, className);
        if (saved.ok) navigate(`/personagens/${copy.value.id}`);
      })(),
    },
    {
      // Página na Wiki (9.9): NPC com a ficha rápida, o retrato e os detalhes; se já existe, a Wiki só abre.
      key: 'wiki', label: tr('Criar página na Wiki', 'Create wiki page'), onClick: () => {
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
      },
    },
    // Copiar para outra mesa (9.6): só as mesas de que a pessoa faz parte; abre a cópia lá (troca de mesa recarrega).
    ...otherMesas.map((m) => ({
      key: `copy-${m.id}`, label: tr(`Copiar para ${mesaName(auth, m.id, m.id)}`, `Copy to ${mesaName(auth, m.id, m.id)}`), onClick: () => void (async () => {
        const out = await copyBuildToMesa(build.id, m.id);
        if (!out.ok) { setCopyError(out.error); return; }
        if (out.value) setCopied({ mesa: m.id, id: out.value.id });
      })(),
    })),
    ...(canEdit ? [{ key: 'trash', label: tr('Mandar para a lixeira', 'Move to trash'), danger: true, onClick: () => setConfirmDelete(true) }] : []),
  ];
  const detailNotice = (
    <>
      {copyError && <Alert severity="error" onClose={() => setCopyError(null)}>{copyError}</Alert>}
      {copied && (
        <Alert severity="success" onClose={() => setCopied(null)}
          action={<Button color="inherit" onClick={() => switchMesa(copied.mesa, `/personagens/${copied.id}`)}>{tr('Abrir lá', 'Open there')}</Button>}>
          {tr(`Cópia criada em ${mesaName(auth, copied.mesa, copied.mesa)}. As regras de lá passam a valer.`, `Copy created in ${mesaName(auth, copied.mesa, copied.mesa)}. Its rules now apply.`)}
        </Alert>
      )}
    </>
  );

  const renderSection = (key: BuilderTab) => {
    if (key === 'details') {
      return (
        <Stack spacing={2}>
          <DetailsSection state={state} build={build} update={update} canEdit={canEdit} actions={detailActions} notice={detailNotice}
            members={isGm ? members : null} owner={(owner === undefined ? build.ownerId : owner) ?? null}
            onOwner={isGm ? (user) => {
              setOwner(user);
              void assignBuild(build.id, user).then((out) => {
                // A ficha que já está na mesa acompanha o dono do build.
                if (out.ok && build.publishedRev !== null) void assignSheet(build.slug, user);
              });
            } : undefined} />
          {sectionProps && <ManualSection {...sectionProps} />}
        </Stack>
      );
    }
    if (!sectionProps) {
      return (
        <Box sx={[cardSx, { p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }]} role="status">
          <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Carregando o catálogo de regras…', 'Loading the rules catalog…')}</Box>
          <Box sx={{ height: 4, borderRadius: 999, bgcolor: parchment.sunken, overflow: 'hidden' }}><Box sx={{ height: 1, width: '40%', bgcolor: greenInk.mid }} /></Box>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}
        </Box>
      );
    }
    switch (key) {
      case 'origin': return <OriginSection {...sectionProps} />;
      case 'class': return <ClassSection {...sectionProps} />;
      case 'attributes': return <AttributesSection {...sectionProps} />;
      case 'skills': return <SkillsSection {...sectionProps} />;
      case 'spells': return <SpellsSection {...sectionProps} spells={rules.feats.filter((e) => e.type === 'spell')} />;
      case 'equipment':
        return <EquipmentSection {...sectionProps} entries={rules.feats} sheet={exportSheet}
          wealth={(rules.tables as { wealth?: { levels: Record<string, { currency: number; lumpSum: number }>; source?: string } } | null)?.wealth} />;
      case 'companions': return <CompanionsSection {...sectionProps} entries={rules.feats} />;
      case 'progression':
        return (
          <ProgressionSection {...sectionProps} feats={rules.feats} archetypes={core?.archetypes ?? []} who={who}
            browseArchetype={browseArchetype} setBrowseArchetype={setBrowseArchetype} initialSlot={focus?.key} focusNonce={focus?.n}
            next={next} onLevelUp={state.level < 20 ? () => setLevelUpOpen(true) : undefined} />
        );
    }
  };

  // Marca de cada seção na navegação: pendências em ouro ou ✓.
  const mark = (key: BuilderTab) => {
    const n = tabPending(key);
    return n ? { text: String(n), color: gold.deep } : key === 'companions' && !state.companions.length ? { text: '—', color: ink.secondary } : { text: '✓', color: status.success };
  };

  const chips = (
    <Box component="nav" aria-label={tr('Seções do personagem', 'Character sections')} sx={{
      display: { xs: 'flex', lg: 'none' }, gap: 0.75, overflowX: 'auto', px: { xs: 2, sm: 0 }, py: 1.25, mx: { xs: -1.5, sm: 0 },
      bgcolor: { xs: parchment.paper, sm: 'transparent' }, borderBottom: { xs: `1px solid ${rule}`, sm: 0 }, mb: 2, scrollbarWidth: 'none',
    }}>
      {TABS.map((key) => {
        const on = section === key;
        return (
          <ButtonBase key={key} onClick={() => open(key)} aria-current={on ? 'page' : undefined} data-view="" sx={{
            flex: 'none', height: 36, px: 1.5, borderRadius: 999, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 0.75,
            border: `1px solid ${on ? greenInk.main : rule}`, bgcolor: on ? greenInk.main : parchment.paper, color: on ? parchment.paper : ink.secondary, fontWeight: on ? 600 : 400,
          }}>
            {TAB_LABEL[key]}{tabPending(key) > 0 && <PendDot />}
          </ButtonBase>
        );
      })}
    </Box>
  );

  const sideNav = (
    <Box component="nav" aria-label={tr('Seções do personagem', 'Character sections')} sx={[cardSx, { p: 1, alignSelf: 'start', display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', gap: '2px', position: 'sticky', top: 16 }]}>
      {TABS.map((key) => {
        const on = section === key;
        const m = mark(key);
        return (
          <ButtonBase key={key} onClick={() => open(key)} aria-current={on ? 'page' : undefined} data-view="" sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, height: 42, px: 1.25, borderRadius: '6px', width: 1, justifyContent: 'flex-start',
            bgcolor: on ? greenInk.main : 'transparent', color: on ? parchment.paper : ink.primary, fontWeight: on ? 700 : 500, fontSize: 15,
          }}>
            <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>{TAB_LABEL[key]}</Box>
            <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: on ? parchment.paper : m.color }}>{m.text}</Box>
          </ButtonBase>
        );
      })}
    </Box>
  );

  // Criação guiada: o passo, a barra de progresso (pronto em verde, pulado em ouro) e Voltar/Próximo.
  const stepIndex = STEPS.indexOf(step);
  const stepColor = (s: Step, i: number) => (i < stepIndex ? (skipped.has(s) ? gold.bright : greenInk.mid) : i === stepIndex ? ink.primary : rule);
  const goStep = (s: Step) => {
    if (s === 'equipment') setItemsWanted(true);
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const stepHasPending = (s: Step) => s !== 'start' && s !== 'review' && tabPending(s) > 0;
  const advance = (skip: boolean) => {
    const nextStep = STEPS[stepIndex + 1];
    if (!nextStep) return;
    if (skip || stepHasPending(step)) setSkipped((prev) => new Set(prev).add(step));
    if (nextStep === 'spells' && compiled && !compiled.casters.length && !compiled.focus.points) { setSkipped((prev) => new Set(prev)); goStep('equipment'); return; }
    goStep(nextStep);
  };
  const back = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) goStep(prev === 'spells' && compiled && !compiled.casters.length && !compiled.focus.points ? 'progression' : prev);
  };
  const stepHeader = guided && (
    <Box sx={[cardSx, { px: 2, py: 1.25, mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }]}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flex: 1, minWidth: 0 }}>
          <Label>{tr(`Passo ${stepIndex + 1} de ${STEPS.length}`, `Step ${stepIndex + 1} of ${STEPS.length}`)}</Label>
          <Box component="b" sx={{ font: `700 16px ${displayFont}` }}>{STEP_LABEL[step]}</Box>
        </Box>
        {step !== 'review' && <Button size="small" onClick={() => advance(true)}>{tr('Pular', 'Skip')}</Button>}
        <IconButton size="small" aria-label={tr('Sair do passo a passo', 'Leave the guided steps')} title={tr('Sair do passo a passo', 'Leave the guided steps')}
          onClick={() => { setGuided(false); setTab(step === 'start' || step === 'review' ? null : step); }}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`, gap: '3px' }}>
        {STEPS.map((s, i) => (
          <ButtonBase key={s} aria-label={`${i + 1}. ${STEP_LABEL[s]}`} title={STEP_LABEL[s]} onClick={() => goStep(s)} sx={{ height: 12, display: 'flex', alignItems: 'center' }}>
            <Box component="span" sx={{ height: 5, width: 1, borderRadius: 3, bgcolor: stepColor(s, i) }} />
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
  const stepBar = guided && (
    <Box sx={{
      position: 'sticky', bottom: { xs: 'var(--tabbar-h)', md: 0 }, zIndex: 5, mt: 2, mx: { xs: -1.5, sm: 0 }, px: 2, py: 1.25,
      bgcolor: parchment.paper, borderTop: `1px solid ${rule}`, display: 'flex', gap: 1.25, boxShadow: '0 -4px 12px #23201A14', borderRadius: { sm: '6px 6px 0 0' },
    }}>
      <Button variant="outlined" sx={{ flex: 1 }} disabled={stepIndex === 0} onClick={back} startIcon={<ChevronIcon />}>
        {stepIndex > 0 ? STEP_LABEL[STEPS[stepIndex - 1]] : tr('Voltar', 'Back')}</Button>
      {step === 'review'
        ? <Button variant="contained" sx={{ flex: 1.4 }} disabled={!canApply} startIcon={<ApplyIcon />} onClick={() => setApplyOpen(true)}>{tr('Revisar e aplicar', 'Review and apply')}</Button>
        : <Button variant="contained" sx={{ flex: 1.4 }} endIcon={<NextIcon />} onClick={() => advance(false)}>{STEP_LABEL[STEPS[stepIndex + 1]]}</Button>}
    </Box>
  );

  const startStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={[cardSx, { p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }]}>
        <Box component="h2" sx={{ m: 0, font: `700 18px ${displayFont}` }}>{tr('Nome e nível inicial', 'Name and starting level')}</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 1.5 }}>
          <TextField size="small" label={tr('Nome', 'Name')} value={state.name} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 80, readOnly: !canEdit } }} helperText={tr('Pode mudar depois.', 'You can change it later.')} />
          <TextField select size="small" label={tr('Nível', 'Level')} value={state.level} disabled={!canEdit}
            onChange={(e) => update((s) => ({ ...s, level: Number(e.target.value) }))}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
        </Box>
      </Box>
      <Box sx={[cardSx, { p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, alignItems: 'flex-start' }]}>
        <Box component="h2" sx={{ m: 0, font: `700 18px ${displayFont}` }}>{tr('Comece pela origem', 'Start with the origin')}</Box>
        <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Ancestralidade, herança e background. Os números aparecem conforme você escolhe.', 'Ancestry, heritage and background. The numbers show up as you choose.')}</Box>
        <Button variant="contained" onClick={() => goStep('origin')}>{tr('Escolher ancestralidade', 'Choose an ancestry')}</Button>
      </Box>
      <Box sx={{ fontSize: 13, color: ink.secondary }}>
        {tr('Pode pular passos e voltar: o resumo no topo atualiza a cada escolha. No fim, revise e aplique na mesa.', 'You can skip steps and come back: the summary at the top updates with every choice. At the end, review and apply to the table.')}
      </Box>
    </Box>
  );
  const reviewStep = compiled && (
    <Box sx={[cardSx, { p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'flex-start' }]}>
      <Box component="h2" sx={{ m: 0, font: `700 20px ${displayFont}` }}>{tr('Tudo pronto?', 'All set?')}</Box>
      <Box sx={{ fontSize: 15, color: ink.secondary }}>
        {compiled.pending.length
          ? tr(`Faltam ${compiled.pending.length} escolha(s). Dá para aplicar assim mesmo e voltar depois.`, `${compiled.pending.length} choice(s) left. You can apply anyway and come back later.`)
          : tr('Nada pendente. Revise a ficha compacta e aplique na mesa.', 'Nothing left to do. Review the compact sheet and apply to the table.')}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" disabled={!canApply} startIcon={<ApplyIcon />} onClick={() => setApplyOpen(true)}>{tr('Revisar e aplicar', 'Review and apply')}</Button>
        <Button variant="outlined" onClick={() => { setGuided(false); setTab('progression'); }}>{tr('Ir para o Plano', 'Go to the Plan')}</Button>
      </Box>
    </Box>
  );

  const panelProps = compiled ? { compiled, onGo: open, onDiscard: discard, canEdit, onAllow: allow, name: state.name } : null;

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', pb: { xs: guided ? 0 : 9, md: 0 } }}>
      <ReadOnlyTheme on={!canEdit}>
        <CharacterHero name={state.name} subtitle={subtitle} portrait={state.details.portrait} compiled={compiled}
          back={(
            <Box component={RouterLink} to="/personagens" {...VIEW_OK} sx={{ display: { xs: 'none', md: 'inline-flex' }, gap: 0.5, alignItems: 'center', color: chrome.textSoft, fontSize: 13, textDecoration: 'none', mb: 1.25 }}>
              <ChevronIcon fontSize="small" />{tr('Personagens', 'Characters')}
            </Box>
          )}
          save={<SaveIndicator status={saveStatus} conflict={!!conflict} />}
          badge={<Box sx={{ display: { xs: 'none', md: 'block' } }}><StateBadge state={publish} onFrameBg={publish === 'changed'} /></Box>}
          actions={heroActions}
          avatar={(size) => (
            <HeroPortrait slug={build.slug} name={state.name} portrait={state.details.portrait} published={build.publishedRev !== null}
              canEdit={canEdit} onPortrait={setPortrait} size={size} />
          )} />

        {!canEdit && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, bgcolor: tint.info, borderBottom: `1px solid ${rule}`, mx: { xs: -1.5, sm: 0 }, fontSize: 14 }}>
            <LockIcon sx={{ color: status.info, fontSize: 20 }} />
            <Box component="span" sx={{ flex: 1 }}>
              <b>{tr('Somente leitura', 'Read only')}</b>{' — '}
              {build.ownerName ? tr(`personagem de ${build.ownerName}`, `${build.ownerName}'s character`) : tr('personagem de outra pessoa', 'someone else\'s character')}
            </Box>
          </Box>
        )}
        {(saveStatus === 'offline' || saveStatus === 'error') && (
          <Box role="status" sx={{ display: 'flex', gap: 1.25, px: 2, py: 1.5, bgcolor: parchment.sunken, borderBottom: `1px solid ${rule}`, mx: { xs: -1.5, sm: 0 }, fontSize: 14, alignItems: 'flex-start' }}>
            <OfflineIcon sx={{ fontSize: 20, color: ink.secondary }} />
            <Box component="span">
              {saveStatus === 'offline'
                ? <><b>{tr('Sem conexão.', 'No connection.')}</b> {tr('Suas mudanças ficam neste aparelho e sobem sozinhas quando a rede voltar. Aplicar na mesa precisa de rede.', 'Your changes stay on this device and upload on their own when the network is back. Applying to the table needs a connection.')}</>
                : <><b>{tr('Não deu para salvar agora.', 'Could not save right now.')}</b> {tr('O que você mudou está guardado neste aparelho; o Criador tenta de novo sozinho.', 'Your changes are kept on this device; the Builder retries on its own.')}</>}
            </Box>
          </Box>
        )}

        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5, '&:empty': { display: 'none' } }}>
          {rules.error && (
            <Alert severity="warning">
              {tr('Não foi possível carregar as regras agora. O que você já escolheu continua salvo.', 'Could not load the rules right now. What you already chose stays saved.')}
            </Alert>
          )}
          {canEdit && rulesVersion && state.rulesVersion && state.rulesVersion !== rulesVersion && (
            <Alert severity="info"
              action={<Button color="inherit" onClick={() => update((s) => ({ ...s, rulesVersion }))}>{tr('Usar as novas', 'Use the new ones')}</Button>}>
              {tr(`Regras atualizadas desde a última edição (${state.rulesVersion} → ${rulesVersion}). Nada muda até você escolher usar as novas.`,
                `Rules updated since the last edit (${state.rulesVersion} → ${rulesVersion}). Nothing changes until you choose to use the new ones.`)}
            </Alert>
          )}
        </Box>

        <Box sx={{ mt: { xs: guided ? 2 : 0, sm: 2 }, display: 'grid', gap: 3, alignItems: 'start',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 280px', lg: guided ? 'minmax(0, 1fr) 300px' : '200px minmax(0, 1fr) 300px' } }}>
          {!guided && sideNav}
          <Box sx={{ minWidth: 0 }}>
            {stepHeader}
            {!guided && chips}
            <BuildExceptions.Provider value={exceptions}>
              {guided ? (step === 'start' ? startStep : step === 'review' ? reviewStep : renderSection(step)) : renderSection(section)}
            </BuildExceptions.Provider>
            {stepBar}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'sticky', top: 16 }}>
            {panelProps ? <PendingAside {...panelProps} /> : <Skeleton variant="rounded" height={240} />}
          </Box>
        </Box>

        {panelProps && !guided && (
          <PendingSheet {...panelProps} open={pendingOpen} onOpen={() => setPendingOpen(true)} onClose={() => setPendingOpen(false)} />
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

      {compiled && rules.index && (
        <ApplyDialog open={applyOpen} onClose={() => setApplyOpen(false)} buildId={build.id} slug={build.slug} compiled={compiled}
          sheet={exportSheet} saveNow={saveNow} name={state.name} subtitle={subtitle} portrait={state.details.portrait}
          onVersions={canEdit ? openVersions : undefined} />
      )}

      {compiled && levelUpOpen && (
        <LevelUpDialog open onClose={() => setLevelUpOpen(false)} current={compiled} next={nextCompiled} name={state.name} className={clsName ?? undefined}
          portrait={state.details.portrait}
          onConfirm={() => {
            setLevelUpOpen(false);
            update((s) => ({ ...s, level: Math.min(20, s.level + 1) }));
            setGuided(false);
            setTab('progression');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} />
      )}

      <Dialog open={versions !== null} onClose={() => setVersions(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: displayFont }}>{tr('Versões aplicadas na mesa', 'Versions applied to the table')}</DialogTitle>
        <DialogContent>
          {versions?.length === 0 && <DialogContentText>{tr('Nenhuma versão aplicada ainda.', 'No version applied yet.')}</DialogContentText>}
          <Stack spacing={1}>
            {versions?.map((v) => (
              <Stack key={v.id} direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1 }}>{new Date(v.publishedAt).toLocaleString(locale)} · {tr(`nível ${v.level}`, `level ${v.level}`)}</Box>
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

      <Dialog open={!!conflict} fullWidth maxWidth="xs" aria-labelledby="conflito-titulo"
        slotProps={{ paper: { sx: { bgcolor: parchment.paper, borderRadius: '8px' } } }}>
        <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box id="conflito-titulo" component="h2" sx={{ m: 0, font: `700 20px/1.2 ${displayFont}`, display: 'flex', gap: 1, alignItems: 'center' }}>
            <ConflictIcon sx={{ color: gold.deep }} />
            {tr(`${state.name || 'O personagem'} mudou em outro aparelho`, `${state.name || 'The character'} changed on another device`)}
          </Box>
          <Box sx={{ fontSize: 14, color: ink.secondary }}>
            {tr('Alguém gravou uma versão mais nova enquanto você editava. Escolha qual segue.', 'Someone saved a newer version while you were editing. Choose which one stays.')}
          </Box>
          <ButtonBase onClick={keepMine} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '6px', border: `2px solid ${greenInk.mid}`, bgcolor: tint.green, textAlign: 'left', justifyContent: 'flex-start', boxShadow: warmShadow }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Label>{tr('Este aparelho', 'This device')}</Label>
              <b>{tr(`Nível ${state.level}`, `Level ${state.level}`)}{clsName ? ` · ${clsName}` : ''}</b>
              <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{tr('grava a minha por cima', 'save mine over it')}</Box>
            </Box>
            <DoneIcon sx={{ color: greenInk.mid }} />
          </ButtonBase>
          {conflict && (
            <ButtonBase onClick={takeTheirs} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '6px', border: `1px solid ${rule}`, bgcolor: parchment.paper, textAlign: 'left', justifyContent: 'flex-start' }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Label>
                  {tr('Outro aparelho', 'Other device')}
                  {conflict.theirs.updatedAt ? ` · ${new Date(conflict.theirs.updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Label>
                <b>{tr(`Nível ${conflict.theirs.state.level}`, `Level ${conflict.theirs.state.level}`)}{conflict.theirs.className ? ` · ${conflict.theirs.className}` : ''}</b>
                <Box component="span" sx={{ fontSize: 13, color: ink.secondary }}>{tr('descarta o que mudei aqui', 'discard what I changed here')}</Box>
              </Box>
            </ButtonBase>
          )}
        </Box>
      </Dialog>
    </Box>
  );
}
