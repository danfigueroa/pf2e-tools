import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { tr } from '../../../i18n';
import type { Compiled, Pending, Warning } from '../engine/types';
import { tabOf, type BuilderTab } from '../tabs';

const SEVERITY: Record<Warning['level'], 'info' | 'warning' | 'error'> = { info: 'info', warn: 'warning', error: 'error' };

/**
 * Pendências (escolhas que faltam até o nível atual) e avisos do motor. Avisos não travam nada (regra global 8): mostram
 * o que conferir. "Escolha sem lugar" pode ser descartada.
 */
export function PendingPanel({ compiled, onGo, onDiscard, canEdit }: {
  compiled: Compiled;
  onGo: (tab: BuilderTab) => void;
  onDiscard: (choiceKey: string) => void;
  canEdit: boolean;
}) {
  const { pending, warnings } = compiled;
  const label = (p: Pending) => (p.missing > 1 ? `${p.label} (${p.missing})` : p.label);
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography sx={{ fontWeight: 700, mb: 1 }}>
        {pending.length
          ? tr(`${pending.length} pendência${pending.length > 1 ? 's' : ''}`, `${pending.length} to do`)
          : tr('Nada pendente', 'Nothing to do')}
      </Typography>
      <Stack spacing={0.5} sx={{ mb: warnings.length ? 1.5 : 0 }}>
        {pending.map((p) => (
          <Button key={p.key} size="small" onClick={() => onGo(tabOf(p.key))} sx={{ justifyContent: 'flex-start', textAlign: 'left' }} data-view="">
            {tr(`Nível ${p.level}: `, `Level ${p.level}: `)}{label(p)}
          </Button>
        ))}
      </Stack>
      {warnings.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>
            {tr(`${warnings.length} aviso${warnings.length > 1 ? 's' : ''}`, `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`)}
          </Typography>
          <Stack spacing={1}>
            {warnings.map((w, i) => (
              <Alert key={`${w.code}-${w.ref ?? ''}-${i}`} severity={SEVERITY[w.level]} sx={{ py: 0, '& .MuiAlert-message': { overflowWrap: 'anywhere' } }}
                action={w.code === 'ORPHAN_CHOICE' && w.ref && canEdit
                  ? <Button color="inherit" size="small" onClick={() => onDiscard(w.ref as string)}>{tr('Descartar', 'Discard')}</Button>
                  : undefined}>
                <Box component="span" onClick={() => onGo(tabOf(w.ref))} sx={{ cursor: 'pointer' }}>{w.message}</Box>
              </Alert>
            ))}
          </Stack>
        </>
      )}
    </Paper>
  );
}
