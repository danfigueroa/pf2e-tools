import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Checkbox, Dialog, FormControlLabel, IconButton, useMediaQuery, useTheme } from '@mui/material';
import {
  ArrowBack as BackIcon, CheckRounded as DoneIcon, Close as CloseIcon, ErrorOutline as ErrorIcon, InfoOutlined as InfoIcon,
  RefreshRounded as RetryIcon, WarningAmberRounded as WarnIcon, RadioButtonUnchecked as TodoIcon,
} from '@mui/icons-material';
import { chrome, displayFont, gold, green, greenInk, ink, parchment, rule, status, TRADITION_COLORS } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { applyBuild } from '../../../services/builds';
import { CACHE_VERSION } from '../../../services/descriptions';
import { startPreparation, usePreparation } from '../../../services/sheetPreparation';
import { parseCharacterJson } from '../../../pathbuilder/types';
import { SKILLS } from '../../character-viewer/checks';
import { characterDescriptionNames, companionAnimalNames } from '../../character-viewer/descriptionNames';
import { diffSheets, type SheetDiff } from '../../character-viewer/sheetDiff';
import { fetchPublished } from '../../../services/sheets';
import { useImageUrl } from '../../../services/images';
import { attributeLabel } from '../engine/attributes';
import { ATTRIBUTES, SKILL_ATTRIBUTE, type Compiled, type Rank, type SkillKey } from '../engine/types';
import { proficiencyBonus } from '../engine/compile';
import { BandHead, ContentBadge, DiffRows, Medallion, Notice, PendDot, PrereqMark, ProfPill, SectionHead } from './ui';
import { cardSx, signed, tint } from './uiTokens';

const TRADITION_LABEL: Record<string, string> = {
  arcane: tr('Arcana', 'Arcane'), divine: tr('Divina', 'Divine'), occult: tr('Oculta', 'Occult'), primal: tr('Primal', 'Primal'),
};
const SKILL_LABEL = Object.fromEntries(SKILLS.map((s) => [s.key, s.label])) as Record<SkillKey, string>;

type Stage = 'review' | 'saving' | 'sending' | 'preparing' | 'ready' | 'error';

/** Uma linha de "como a mesa vai ver": nome, pílula do grau e o total. */
const ProfLine = ({ name, rank, value }: { name: string; rank: Rank; value: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 14 }}>
    <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{name}</Box>
    <ProfPill rank={rank} />
    <Box component="b" sx={{ width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
  </Box>
);

/**
 * Revisar e aplicar na mesa (UX §1.5, D7, redesign): a ficha compacta como a mesa vai ver, o que muda em relação à ficha
 * de hoje, os avisos agrupados ("Aplicar mesmo assim") e o preparo com progresso (o servidor monta a ficha e as descrições
 * pt/en pelo mesmo preparo da publicação). Aplicar com aviso é permitido. No fim, o personagem está na mesa.
 */
export function ApplyDialog({ open, onClose, buildId, slug: buildSlug, compiled, sheet, saveNow, name, subtitle, portrait, onVersions }: {
  open: boolean;
  onClose: () => void;
  buildId: string;
  /** Slug do build (= o da ficha na mesa). */
  slug: string;
  compiled: Compiled;
  /** O retrato `{ success, build }` já exportado. */
  sheet: () => unknown;
  /** Grava o pendente e devolve o `rev` salvo (o servidor compila esse estado), ou `null`. */
  saveNow: () => Promise<number | null>;
  name: string;
  subtitle: string;
  portrait?: string;
  onVersions?: () => void;
}) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const src = useImageUrl(portrait);
  const [stage, setStage] = useState<Stage>('review');
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [anyway, setAnyway] = useState(false);
  const prep = usePreparation(slug);
  // O que muda em relação à ficha que a mesa usa hoje (o mesmo diff do Publicar da Ficha).
  const [diff, setDiff] = useState<SheetDiff | null | 'new'>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setDiff(null);
    setAnyway(false);
    if (stage === 'ready' || stage === 'error') { setStage('review'); setSlug(null); setError(null); }
    fetchPublished(buildSlug).then((current) => {
      if (!alive) return;
      if (!current) { setDiff('new'); return; }
      try { setDiff(diffSheets(parseCharacterJson(current.json), parseCharacterJson(sheet()))); } catch { setDiff(null); }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, buildSlug, sheet]);

  useEffect(() => {
    if (!prep) return;
    if (prep.phase === 'ready') setStage('ready');
    else if (prep.phase === 'error' || prep.phase === 'gone') { setStage('error'); setError(prep.error ?? tr('O preparo parou.', 'Preparation stopped.')); }
    else setStage('preparing');
  }, [prep]);

  // O nível que a mesa usa hoje (null = nunca aplicado ou ainda comparando).
  const appliedLevel = diff && diff !== 'new' ? diff.levelFrom : null;
  const warnings = compiled.warnings.filter((w) => w.level !== 'info');
  const infos = compiled.warnings.filter((w) => w.level === 'info');
  const pending = compiled.pending;
  const needsAnyway = warnings.length > 0 || pending.length > 0;

  const apply = async () => {
    setError(null);
    setStage('saving');
    try {
      const rev = await saveNow();
      if (rev === null) {
        setStage('error');
        setError(tr('Não foi possível salvar as últimas mudanças. Resolva o salvamento e tente de novo.', 'Could not save the latest changes. Fix the save and try again.'));
        return;
      }
      setStage('sending');
      const json = sheet();
      const build = parseCharacterJson(json);
      const names = characterDescriptionNames(build);
      const out = await applyBuild(buildId, json, names, CACHE_VERSION, companionAnimalNames(build), rev);
      if (!out.ok) {
        setStage('error');
        setError(out.error);
        return;
      }
      startPreparation(out.value.slug, out.value);
      setSlug(out.value.slug);
      setStage('preparing');
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : tr('Não foi possível aplicar.', 'Could not apply.'));
    }
  };

  const busy = stage === 'saving' || stage === 'sending' || stage === 'preparing';
  const progress = prep?.draft?.progress;
  const pct = stage === 'saving' ? 8 : stage === 'sending' ? 20 : progress && progress.total ? Math.round(20 + 75 * (progress.done / progress.total)) : stage === 'preparing' ? 25 : 0;
  const lvl = compiled.level;
  const mod = compiled.attributes.mod;

  const appbar = (title: string, back?: boolean) => (
    <Box sx={{ bgcolor: green.main, color: chrome.text, borderBottom: `2px solid ${gold.main}`, display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, minHeight: 56, flex: 'none' }}>
      {back && <IconButton aria-label={tr('Voltar ao editor', 'Back to the editor')} onClick={onClose} disabled={busy} sx={{ color: chrome.text }}><BackIcon /></IconButton>}
      <Box component="h2" sx={{ m: 0, flex: 1, pl: back ? 0 : 1.5, font: `600 17px ${displayFont}`, fontSize: { md: 20 } }}>{title}</Box>
      {!back && <IconButton aria-label={tr('Fechar', 'Close')} onClick={onClose} sx={{ color: chrome.text }}><CloseIcon /></IconButton>}
    </Box>
  );

  const compact = (
    <Box sx={[cardSx, { overflow: 'hidden', display: 'flex', flexDirection: 'column' }]}>
      <BandHead right={<Box component="span" sx={{ fontWeight: 500, color: chrome.textSoft }}>{tr('como a mesa vai ver', 'how the table will see it')}</Box>}>{tr('Ficha compacta', 'Compact sheet')}</BandHead>
      <Box sx={{ p: { xs: 1.75, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'center', flexWrap: 'wrap' }}>
          <Medallion name={name} src={src} size={60} />
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Box sx={{ font: `700 24px ${displayFont}`, overflowWrap: 'anywhere' }}>{name}</Box>
            <Box sx={{ color: ink.secondary }}>{subtitle}</Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2.25, textAlign: 'center' }}>
            {[[String(compiled.stats.hp.total), tr('PV', 'HP')], [String(compiled.stats.ac.total), tr('CA', 'AC')], [String(compiled.stats.speed.total), tr('pés', 'ft')]].map(([v, l]) => (
              <Box key={l}><Box sx={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</Box><Box sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: ink.secondary }}>{l}</Box></Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 1 }}>
          {ATTRIBUTES.map((a) => (
            <Box key={a} sx={{ bgcolor: parchment.paper, border: `1px solid ${rule}`, borderRadius: '6px', py: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box component="span" sx={{ font: `700 12px ${displayFont}`, letterSpacing: '.08em', color: ink.secondary }}>{attributeLabel(a)}</Box>
              <Box component="span" sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{signed(mod[a])}</Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <SectionHead>{tr('Defesas e percepção', 'Defenses and perception')}</SectionHead>
            <ProfLine name={tr('Fortitude', 'Fortitude')} rank={compiled.proficiency.fortitude} value={signed(compiled.stats.fortitude.total)} />
            <ProfLine name={tr('Reflexos', 'Reflex')} rank={compiled.proficiency.reflex} value={signed(compiled.stats.reflex.total)} />
            <ProfLine name={tr('Vontade', 'Will')} rank={compiled.proficiency.will} value={signed(compiled.stats.will.total)} />
            <ProfLine name={tr('Percepção', 'Perception')} rank={compiled.proficiency.perception} value={signed(compiled.stats.perception.total)} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <SectionHead>{tr('Perícias', 'Skills')}</SectionHead>
            {(Object.keys(SKILL_ATTRIBUTE) as SkillKey[]).filter((k) => (compiled.skills.rank[k] ?? 0) > 0)
              .map((k) => ({ k, r: compiled.skills.rank[k], v: proficiencyBonus(compiled.skills.rank[k], lvl) + mod[SKILL_ATTRIBUTE[k]] + (compiled.skillBonus[k] ?? 0) }))
              .sort((a, b) => b.v - a.v)
              .map(({ k, r, v }) => <ProfLine key={k} name={SKILL_LABEL[k] ?? k} rank={r} value={signed(v)} />)}
          </Box>
        </Box>
        {(compiled.equipment.strikes.length > 0 || compiled.casters.length > 0) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <SectionHead>{tr('Golpes e magias', 'Strikes and spells')}</SectionHead>
            {compiled.equipment.strikes.slice(0, 4).map((s) => (
              <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 14, flexWrap: 'wrap' }}>
                <Box component="b" sx={{ flex: 1, minWidth: 140 }}>{s.display}</Box>
                <Box component="span" sx={{ color: ink.secondary }}>{s.dice}{s.die}{s.damageBonus ? signed(s.damageBonus) : ''} {s.damageType}</Box>
                <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums' }}>{signed(s.attack)}</Box>
              </Box>
            ))}
            {compiled.casters.map((c) => (
              <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 14, flexWrap: 'wrap' }}>
                {c.tradition && (
                  <Box component="span" sx={{ display: 'inline-flex', gap: 0.75, alignItems: 'center', color: TRADITION_COLORS[c.tradition], fontWeight: 700 }}>
                    <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'currentColor' }} />{TRADITION_LABEL[c.tradition]}
                  </Box>
                )}
                <Box component="span" sx={{ flex: 1, minWidth: 140 }}>
                  {[c.name, c.type === 'prepared' ? tr('preparado', 'prepared') : tr('espontâneo', 'spontaneous'), attributeLabel(c.attribute)].join(' · ')}
                </Box>
                <Box component="span" sx={{ color: ink.secondary }}>{tr(`CD ${c.dc} · ataque ${signed(c.attack)}`, `DC ${c.dc} · attack ${signed(c.attack)}`)}</Box>
              </Box>
            ))}
          </Box>
        )}
        {compiled.taken.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <SectionHead>{tr('Talentos', 'Feats')}</SectionHead>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {[...compiled.taken].sort((a, b) => a.level - b.level).map((t) => (
                <Box key={t.slot} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 28, px: 1.25, borderRadius: 999, border: `1px solid ${rule}`, bgcolor: parchment.paper, fontSize: 13 }}>
                  <Box component="b" sx={{ color: gold.deep, fontVariantNumeric: 'tabular-nums' }}>{t.level}</Box>{t.entry.name}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );

  const changes = (
    <Box sx={[cardSx, { px: 2.25, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }]}>
      <SectionHead note={appliedLevel != null && appliedLevel !== lvl ? tr(`nível ${appliedLevel} → ${lvl}`, `level ${appliedLevel} → ${lvl}`) : appliedLevel != null ? tr(`hoje: nível ${appliedLevel}`, `today: level ${appliedLevel}`) : undefined}>
        {tr('O que muda na mesa', 'What changes at the table')}
      </SectionHead>
      {diff === null && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Comparando com a ficha da mesa…', 'Comparing with the table sheet…')}</Box>}
      {diff === 'new' && <Box sx={{ fontSize: 14 }}>{tr('Personagem novo na mesa.', 'New character at the table.')}</Box>}
      {diff && diff !== 'new' && (
        <>
          {diff.levelFrom !== diff.levelTo && <DiffRows rows={[{ label: tr('Nível', 'Level'), from: String(diff.levelFrom), to: String(diff.levelTo), delta: signed(diff.levelTo - diff.levelFrom) }]} />}
          {diff.identical && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Sem mudança visível em talentos, magias e itens.', 'No visible change in feats, spells and items.')}</Box>}
          {diff.changes.map((c) => (
            <Box key={c.label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box component="span" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: ink.secondary }}>{c.label}</Box>
              {c.added.map((x) => (
                <Box key={`+${x}`} sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: 14 }}>
                  <Box component="span" sx={{ color: status.success, fontWeight: 700, width: 14 }}>+</Box><span>{x}</span>
                </Box>
              ))}
              {c.removed.map((x) => (
                <Box key={`-${x}`} sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: 14, color: ink.secondary }}>
                  <Box component="span" sx={{ fontWeight: 700, width: 14 }}>−</Box><Box component="span" sx={{ textDecoration: 'line-through' }}>{x}</Box>
                </Box>
              ))}
            </Box>
          ))}
        </>
      )}
      {pending.length > 0 && (
        <Box sx={{ pt: 1, borderTop: `1px solid ${rule}`, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {pending.slice(0, 6).map((p) => (
            <Box key={p.key} sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: 14 }}>
              <Box component="span" sx={{ width: 14, display: 'flex', justifyContent: 'center' }}><PendDot /></Box>
              <Box component="span" sx={{ flex: 1, color: gold.deep, fontWeight: 600 }}>{p.label}</Box>
              <Box component="span" sx={{ fontSize: 12, color: ink.secondary }}>{tr(`pendente · ${p.level}`, `to do · ${p.level}`)}</Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  const before = (
    <Box sx={[cardSx, { px: 2.25, py: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }]}>
      <SectionHead note={tr(`${warnings.length + infos.length} aviso${warnings.length + infos.length === 1 ? '' : 's'} · ${pending.length} pendência${pending.length === 1 ? '' : 's'}`,
        `${warnings.length + infos.length} warning${warnings.length + infos.length === 1 ? '' : 's'} · ${pending.length} to do`)}>
        {tr('Antes de aplicar', 'Before applying')}
      </SectionHead>
      {!needsAnyway && !infos.length && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Tudo em ordem.', 'All good.')}</Box>}
      {warnings.slice(0, 10).map((w, i) => (
        <Box key={`w${i}`} sx={{ display: 'flex', gap: 1.25, alignItems: 'center', fontSize: 14 }}>
          <WarnIcon sx={{ fontSize: 20, color: status.warning }} /><Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{w.message}</Box>
        </Box>
      ))}
      {infos.slice(0, 6).map((w, i) => (
        <Box key={`i${i}`} sx={{ display: 'flex', gap: 1.25, alignItems: 'center', fontSize: 14 }}>
          <InfoIcon sx={{ fontSize: 20, color: status.info }} /><Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{w.message}</Box>
          <Box component="span" sx={{ fontSize: 12, color: ink.secondary }}>{tr('informativo', 'informational')}</Box>
        </Box>
      ))}
      {pending.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', fontSize: 14 }}>
          <TodoIcon sx={{ fontSize: 20, color: gold.deep }} />
          <Box component="span" sx={{ flex: 1 }}>{tr(`${pending.length} escolha${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''}: a ficha vai sem elas`, `${pending.length} pending choice${pending.length > 1 ? 's' : ''}: the sheet goes without them`)}</Box>
          <Box component="span" sx={{ fontSize: 12, color: ink.secondary }}>{tr('Talentos', 'Feats')}</Box>
        </Box>
      )}
      {needsAnyway && (
        <FormControlLabel sx={{ m: 0, minHeight: 44 }} control={<Checkbox checked={anyway} onChange={(e) => setAnyway(e.target.checked)} />}
          label={<Box component="span" sx={{ fontWeight: 600 }}>{tr('Aplicar mesmo assim', 'Apply anyway')}</Box>} />
      )}
    </Box>
  );

  const stepRow = (state: 'done' | 'now' | 'todo', label: React.ReactNode) => (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', fontSize: 15 }}>
      {state === 'done' ? <PrereqMark result="ok" /> : (
        <Box component="span" aria-hidden sx={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', bgcolor: state === 'now' ? tint.gold : parchment.sunken, color: gold.deep, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{state === 'now' ? '•' : ''}</Box>
      )}
      <Box component="span" sx={{ color: state === 'todo' ? ink.secondary : ink.primary }}>{label}</Box>
    </Box>
  );
  const stepState = (i: number): 'done' | 'now' | 'todo' => {
    const at = stage === 'saving' ? 0 : stage === 'sending' ? 1 : stage === 'preparing' ? 2 : stage === 'ready' ? 4 : 0;
    return i < at ? 'done' : i === at ? 'now' : 'todo';
  };
  const preparing = (
    <Box sx={[cardSx, { overflow: 'hidden' }]}>
      <BandHead right={<Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</Box>}>{tr(`Preparando ${name}`, `Preparing ${name}`)}</BandHead>
      <Box sx={{ px: 2, py: 2.25, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} sx={{ height: 10, borderRadius: 999, bgcolor: parchment.sunken, overflow: 'hidden' }}>
          <Box sx={{ height: 1, width: `${pct}%`, bgcolor: greenInk.mid, borderRadius: 999 }} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
          {stepRow(stepState(0), tr('Regras compiladas', 'Rules compiled'))}
          {stepRow(stepState(1), tr('Ficha montada pelo servidor', 'Sheet built by the server'))}
          {stepRow(stepState(2), <><b>{tr('Descrições', 'Descriptions')}</b>{progress?.total ? <Box component="span" sx={{ color: ink.secondary, fontVariantNumeric: 'tabular-nums' }}>{tr(` · ${progress.done.toLocaleString(locale)} de ${progress.total.toLocaleString(locale)}`, ` · ${progress.done.toLocaleString(locale)} of ${progress.total.toLocaleString(locale)}`)}</Box> : null}</>)}
          {stepRow(stepState(3), tr('Publicar na mesa', 'Publish to the table'))}
        </Box>
        {prep?.phase === 'waiting' && <Box sx={{ fontSize: 13, color: ink.secondary }}>{tr('Esperando a tradução ou a AON; tenta de novo sozinho.', 'Waiting for translation or AON; retries on its own.')}</Box>}
        <Box sx={{ fontSize: 13, color: ink.secondary }}>{tr('O personagem continua salvo enquanto isso. Pode fechar: o preparo continua.', 'The character stays saved meanwhile. You can close this: preparation continues.')}</Box>
      </Box>
    </Box>
  );

  const center = (children: React.ReactNode) => (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.25, p: 3, textAlign: 'center' }}>{children}</Box>
  );

  const ready = center(
    <>
      <Box sx={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${gold.main}` }} />
        <Medallion name={name} src={src} size={112} />
        <Box component="span" sx={{ position: 'absolute', right: 6, bottom: 6, width: 40, height: 40, borderRadius: '50%', bgcolor: status.success, color: parchment.paper, border: `3px solid ${parchment.page}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DoneIcon />
        </Box>
      </Box>
      <Box component="h3" sx={{ m: 0, font: `700 26px ${displayFont}` }}>{tr(`${name} está na mesa`, `${name} is at the table`)}</Box>
      <Box sx={{ fontSize: 15, color: ink.secondary }}>{tr(`Nível ${lvl}. A mesa já vê os números novos.`, `Level ${lvl}. The table already sees the new numbers.`)}</Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: 1, maxWidth: 300 }}>
        <Button variant="contained" component={RouterLink} to={`/ficha-virtual?ficha=${encodeURIComponent(slug ?? buildSlug)}`}>{tr('Abrir na Ficha Virtual', 'Open in the Virtual Sheet')}</Button>
        <Button variant="outlined" onClick={onClose}>{tr('Voltar ao Criador', 'Back to the Builder')}</Button>
        {onVersions && <Button onClick={() => { onClose(); onVersions(); }}>{tr('Ver versões aplicadas', 'See applied versions')}</Button>}
      </Box>
    </>,
  );

  const failed = center(
    <>
      <Box component="span" sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: tint.error, color: status.error, display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 36 } }}><ErrorIcon /></Box>
      <Box component="h3" sx={{ m: 0, font: `700 22px ${displayFont}` }}>{tr('Não deu para aplicar', 'Could not apply')}</Box>
      <Box sx={{ fontSize: 15, color: ink.secondary, maxWidth: 420 }}>
        {tr(`Nada se perdeu: ${name} continua salvo e a mesa segue com a ficha de antes.`, `Nothing was lost: ${name} is still saved and the table keeps the previous sheet.`)}
      </Box>
      {error && <Box sx={{ width: 1, maxWidth: 420 }}><Notice tone="error" icon={<ErrorIcon />}>{error}</Notice></Box>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: 1, maxWidth: 280 }}>
        <Button variant="contained" startIcon={<RetryIcon />} onClick={() => void apply()}>{tr('Tentar de novo', 'Try again')}</Button>
        <Button onClick={() => { setStage('review'); setError(null); }}>{tr('Voltar à revisão', 'Back to the review')}</Button>
      </Box>
    </>,
  );

  const reviewing = stage === 'review' || busy;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={!wide} fullWidth maxWidth="lg"
      slotProps={{ paper: { sx: { bgcolor: parchment.page, borderRadius: { md: '10px' }, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: { md: '90vh' } } } }}>
      {appbar(stage === 'ready' || stage === 'error' ? tr('Aplicar na mesa', 'Apply to the table') : tr('Revisar e aplicar na mesa', 'Review and apply to the table'), reviewing)}
      {reviewing && (
        <>
          <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 3 } }}>
            {appliedLevel != null && (
              <Box sx={{ fontSize: 14, color: ink.secondary, mb: 1.5 }}>
                {tr('Na mesa hoje: ', 'At the table today: ')}<Box component="b" sx={{ color: ink.primary }}>{tr(`nível ${appliedLevel}`, `level ${appliedLevel}`)}</Box>
              </Box>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.25fr) minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
              <Box sx={{ order: { xs: 2, md: 1 } }}>{compact}</Box>
              <Box sx={{ order: { xs: 1, md: 2 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {busy ? preparing : <>{changes}{before}</>}
                {wide && !busy && (
                  <Button variant="contained" size="large" startIcon={<DoneIcon />} disabled={needsAnyway && !anyway} onClick={() => void apply()}>
                    {tr('Aplicar na mesa', 'Apply to the table')}</Button>
                )}
                {wide && busy && <Button variant="outlined" onClick={onClose}>{tr('Fechar (o preparo continua)', 'Close (preparation continues)')}</Button>}
                {!needsAnyway && !busy && <ContentBadge kind="trait">{tr('Tudo pronto para a mesa', 'Ready for the table')}</ContentBadge>}
              </Box>
            </Box>
          </Box>
          {!wide && (
            <Box sx={{ flex: 'none', px: 2, py: 1.25, pb: 'calc(10px + env(safe-area-inset-bottom))', bgcolor: parchment.paper, borderTop: `1px solid ${rule}` }}>
              {busy
                ? <Button fullWidth variant="outlined" onClick={onClose}>{tr('Fechar (o preparo continua)', 'Close (preparation continues)')}</Button>
                : <Button fullWidth variant="contained" startIcon={<DoneIcon />} disabled={needsAnyway && !anyway} onClick={() => void apply()}>{tr('Aplicar na mesa', 'Apply to the table')}</Button>}
            </Box>
          )}
        </>
      )}
      {stage === 'ready' && ready}
      {stage === 'error' && failed}
    </Dialog>
  );
}
