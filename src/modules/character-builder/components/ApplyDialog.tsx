import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Stack, Typography,
} from '@mui/material';
import { tr } from '../../../i18n';
import { applyBuild } from '../../../services/builds';
import { CACHE_VERSION } from '../../../services/descriptions';
import { startPreparation, usePreparation } from '../../../services/sheetPreparation';
import { parseCharacterJson } from '../../../pathbuilder/types';
import { characterDescriptionNames, companionAnimalNames } from '../../character-viewer/descriptionNames';
import { diffSheets, type SheetDiff } from '../../character-viewer/sheetDiff';
import { fetchPublished } from '../../../services/sheets';
import type { Compiled } from '../engine/types';

/**
 * "Aplicar na mesa" (UX §1.5, D7): o retrato do Criador vira a ficha que a mesa usa, pelo mesmo preparo da publicação
 * (descrições pt/en e guia ficam prontos antes de valer). Mostra os avisos antes; aplicar com aviso é permitido.
 */
export function ApplyDialog({ open, onClose, buildId, slug: buildSlug, compiled, sheet, saveNow }: {
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
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const prep = usePreparation(slug);
  // O que muda em relação à ficha que a mesa usa hoje (o mesmo diff do Publicar da Ficha).
  const [diff, setDiff] = useState<SheetDiff | null | 'new'>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setDiff(null);
    fetchPublished(buildSlug).then((current) => {
      if (!alive) return;
      if (!current) { setDiff('new'); return; }
      try { setDiff(diffSheets(parseCharacterJson(current.json), parseCharacterJson(sheet()))); } catch { setDiff(null); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [open, buildSlug, sheet]);
  const warnings = compiled.warnings.filter((w) => w.level !== 'info');
  const pending = compiled.pending.length;

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const rev = await saveNow();
      if (rev === null) {
        setError(tr('Não foi possível salvar as últimas mudanças. Resolva o salvamento e tente de novo.', 'Could not save the latest changes. Fix the save and try again.'));
        return;
      }
      const json = sheet();
      const build = parseCharacterJson(json);
      const names = characterDescriptionNames(build);
      const out = await applyBuild(buildId, json, names, CACHE_VERSION, companionAnimalNames(build), rev);
      if (!out.ok) {
        setError(out.error);
        return;
      }
      startPreparation(out.value.slug, out.value);
      setSlug(out.value.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Não foi possível aplicar.', 'Could not apply.'));
    } finally {
      setBusy(false);
    }
  };

  const done = prep?.phase === 'ready';
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{tr('Aplicar na mesa', 'Apply to the table')}</DialogTitle>
      <DialogContent>
        {!slug && (
          <>
            <DialogContentText sx={{ mb: 1.5 }}>
              {tr('A ficha que a mesa usa passa a ser esta versão. O estado de jogo (PV, magias gastas, condições) não muda.', 'The sheet the table uses becomes this version. Play state (HP, spent spells, conditions) does not change.')}
            </DialogContentText>
            {diff === 'new' && <Alert severity="info" sx={{ mb: 1 }}>{tr('Personagem novo na mesa.', 'New character at the table.')}</Alert>}
            {diff && diff !== 'new' && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {diff.levelFrom !== diff.levelTo ? tr(`Nível ${diff.levelFrom} → ${diff.levelTo}`, `Level ${diff.levelFrom} → ${diff.levelTo}`) : tr(`Nível ${diff.levelTo}`, `Level ${diff.levelTo}`)}
                  {diff.identical ? tr(' · sem mudança visível em talentos, magias e itens', ' · no visible change in feats, spells and items') : ''}
                </Typography>
                {diff.changes.map((c) => (
                  <Typography key={c.label} variant="body2" color="text.secondary">
                    {c.label}: {[...c.added.map((x) => `+ ${x}`), ...c.removed.map((x) => `− ${x}`)].join(', ')}
                  </Typography>
                ))}
              </Box>
            )}
            {pending > 0 && <Alert severity="warning" sx={{ mb: 1 }}>{tr(`${pending} escolha(s) pendente(s): a ficha vai sem elas.`, `${pending} pending choice(s): the sheet goes without them.`)}</Alert>}
            {warnings.length > 0 && (
              <Alert severity="info" sx={{ mb: 1 }}>
                {tr(`${warnings.length} aviso(s) do Criador:`, `${warnings.length} Builder warning(s):`)}
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {warnings.slice(0, 8).map((w, i) => <li key={i}><Typography variant="body2">{w.message}</Typography></li>)}
                </Box>
              </Alert>
            )}
          </>
        )}
        {slug && prep && (
          <Stack spacing={1.5}>
            {prep.phase === 'error' || prep.phase === 'gone'
              ? <Alert severity="error">{prep.error ?? tr('O preparo parou.', 'Preparation stopped.')}</Alert>
              : done
                ? <Alert severity="success">{tr('Ficha aplicada na mesa.', 'Sheet applied to the table.')}</Alert>
                : (
                  <>
                    <Typography>{tr('Preparando a ficha (descrições e guia)…', 'Preparing the sheet (descriptions and guide)…')}</Typography>
                    <LinearProgress />
                    {prep.phase === 'waiting' && (
                      <Typography variant="body2" color="text.secondary">{tr('Esperando a tradução ou a AON; tenta de novo sozinho.', 'Waiting for translation or AON; retries on its own.')}</Typography>
                    )}
                  </>
                )}
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        {done ? (
          <>
            <Button onClick={onClose}>{tr('Continuar editando', 'Keep editing')}</Button>
            <Button variant="contained" component={RouterLink} to={`/ficha-virtual?ficha=${encodeURIComponent(slug ?? '')}`}>{tr('Abrir na Ficha', 'Open in the Sheet')}</Button>
          </>
        ) : slug ? (
          <Button onClick={onClose}>{tr('Fechar (o preparo continua)', 'Close (preparation continues)')}</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={busy}>{tr('Cancelar', 'Cancel')}</Button>
            <Button variant="contained" onClick={() => void apply()} disabled={busy}>{tr('Aplicar', 'Apply')}</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
