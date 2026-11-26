import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, useMediaQuery, useTheme } from '@mui/material';
import { ChevronRight as OpenIcon } from '@mui/icons-material';
import { tr } from '../../../i18n';
import { ink } from '../../../theme';
import { ActionGlyph, SectionHead, SlotCard } from '../components/ui';
import { descriptionRequest } from '../components/descriptionRequest';
import { loadRuleList } from '../rules/loader';
import type { RuleEntry } from '../rules/types';
import { characterActions, type CharacterAction } from './characterActions';
import type { SectionProps } from './types';

const DescriptionContent = lazy(() => import('../../character-viewer/components/DescriptionContent')
  .then((module) => ({ default: module.DescriptionContent })));

const GROUPS = {
  turn: tr('Ações no turno', 'Actions on your turn'),
  reaction: tr('Reações', 'Reactions'),
  free: tr('Ações livres', 'Free actions'),
  exploration: tr('Exploração', 'Exploration'),
  downtime: tr('Tempo livre', 'Downtime'),
  other: tr('Outras atividades', 'Other activities'),
};

function groupOf(entry: RuleEntry): keyof typeof GROUPS {
  if (entry.actions === 'reaction' || entry.actions === 'free') return entry.actions;
  if (entry.actions) return 'turn';
  if (entry.traits?.some((trait) => /^exploration$/i.test(trait))) return 'exploration';
  if (entry.traits?.some((trait) => /^downtime$/i.test(trait))) return 'downtime';
  return 'other';
}

const sourceText = (action: CharacterAction) => action.sources.map(({ name, level }) => tr(`${name} (nível ${level})`, `${name} (level ${level})`)).join(' · ');

export function ActionsSection(props: SectionProps) {
  const { core, state, compiled, index } = props;
  const [catalog, setCatalog] = useState<RuleEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string>();
  const titleId = useId();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  useEffect(() => {
    let active = true;
    void loadRuleList<RuleEntry[]>('core/actions', core.version).then((entries) => {
      if (active) setCatalog(entries);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [core.version, retry]);

  const actions = useMemo(() => characterActions({ state, compiled, index }, catalog ?? []), [state, compiled, index, catalog]);
  const detail = actions.find((action) => action.entry.id === selected);
  const close = () => setSelected(undefined);

  return (
    <Stack spacing={2}>
      {!catalog && !failed && <Box role="status" sx={{ color: ink.secondary }}>{tr('Carregando o catálogo de ações…', 'Loading the action catalog…')}</Box>}
      {failed && <Box role="status">
        {tr('O catálogo de ações está indisponível.', 'The action catalog is unavailable.')}{' '}
        <Button size="small" onClick={() => { setFailed(false); setRetry((value) => value + 1); }}>{tr('Tentar de novo', 'Try again')}</Button>
      </Box>}
      {catalog && actions.length === 0 && <Box sx={{ color: ink.secondary }}>{tr('Nenhuma ação específica foi identificada para este personagem.', 'No character-specific actions were found.')}</Box>}
      {(Object.entries(GROUPS) as [keyof typeof GROUPS, string][]).map(([key, label]) => {
        const rows = actions.filter(({ entry }) => groupOf(entry) === key);
        if (!rows.length) return null;
        return (
          <Box component="section" key={key} aria-label={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <SectionHead>{label}</SectionHead>
            {rows.map((action) => (
              <SlotCard key={action.entry.id} name={action.entry.name} why={sourceText(action)} onClick={() => setSelected(action.entry.id)}
                trailing={<><ActionGlyph actions={action.entry.actions} /><OpenIcon fontSize="small" sx={{ color: ink.secondary }} /></>} />
            ))}
          </Box>
        );
      })}
      {detail && (
        <Dialog open onClose={close} fullScreen={fullScreen} fullWidth maxWidth="sm" aria-labelledby={titleId}>
          <DialogTitle id={titleId} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
            <ActionGlyph actions={detail.entry.actions} size={14} />{detail.entry.name}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.5}>
              <Box sx={{ fontSize: 14, color: ink.secondary }}>{sourceText(detail)}</Box>
              {/* Bounty Hunter Dedication, Player Core 2 p. 191. Monster Hunter, Player Core p. 157. */}
              {detail.bountyHunter && <Box sx={{ fontSize: 14 }}><b>Bounty Hunter Dedication</b>{' · '}
                {tr('Você também pode designar a presa a partir de informações sobre ela, inclusive enquanto usa Gather Information. Se já identificou e marcou a presa, recebe +2 de circunstância nos testes de Gather Information sobre ela.',
                  'You can also designate prey from information about them, including while you Gather Information. After identifying and marking your prey, you get a +2 circumstance bonus to checks to Gather Information about them.')}</Box>}
              {detail.monsterHunter && <Box sx={{ fontSize: 14 }}><b>Monster Hunter</b>{' · '}
                {tr('Use Recall Knowledge como parte de Hunt Prey. Se identificar a presa com sucesso crítico, você e cada aliado avisado recebem +1 de circunstância na próxima jogada de ataque contra ela, uma vez por dia por criatura.',
                  'You can Recall Knowledge as part of Hunt Prey. On a critical success to identify the prey, you and each ally you tell get a +1 circumstance bonus to your next attack roll against it, once per day per creature.')}</Box>}
              {detail.entry.homebrew ? <Box sx={{ whiteSpace: 'pre-line' }}>{detail.entry.summary}</Box> : (
                <Suspense fallback={<Box role="status">{tr('Carregando descrição…', 'Loading description…')}</Box>}>
                  <DescriptionContent embedded request={descriptionRequest(detail.entry)} onClose={close} />
                </Suspense>
              )}
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={close}>{tr('Fechar', 'Close')}</Button></DialogActions>
        </Dialog>
      )}
    </Stack>
  );
}
