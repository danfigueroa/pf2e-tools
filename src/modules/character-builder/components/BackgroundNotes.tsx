import { useEffect, useRef, useState } from 'react';
import { Alert, Box, TextField, Typography } from '@mui/material';
import { tr } from '../../../i18n';
import { fetchNotes, saveNotes } from '../../../services/notes';

/**
 * O background do personagem (F8.9): é o mesmo das Anotações da Ficha (`character_notes`), sem campo novo. As anotações
 * são da ficha da mesa, então só aparecem depois de aplicar. Texto longo: campo não controlado (regra da interface).
 */
export function BackgroundNotes({ slug, canEdit }: { slug: string; canEdit: boolean }) {
  const [loaded, setLoaded] = useState<{ background: string; data: Record<string, unknown>; base: number | null } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    void fetchNotes(slug).then((raw) => {
      if (!alive || raw === undefined) return;
      const data = (raw?.data && typeof raw.data === 'object' ? raw.data : { background: '', notes: [] }) as Record<string, unknown>;
      setLoaded({ background: typeof data.background === 'string' ? data.background : '', data, base: raw?.updatedAt ?? null });
    });
    return () => { alive = false; };
  }, [slug]);

  const save = async () => {
    if (!loaded || !ref.current || ref.current.value === loaded.background) return;
    const data = { ...loaded.data, background: ref.current.value, notes: Array.isArray(loaded.data.notes) ? loaded.data.notes : [] };
    const out = await saveNotes(slug, data, loaded.base);
    if (out.ok) {
      setLoaded({ background: ref.current.value, data, base: out.updatedAt });
      setStatus(tr('Background salvo nas Anotações.', 'Background saved to Notes.'));
    } else setStatus(out.conflict ? tr('As Anotações mudaram em outro aparelho; recarregue.', 'Notes changed on another device; reload.') : out.error);
  };

  if (!loaded) return null;
  return (
    <Box>
      <Typography sx={{ fontWeight: 600, mb: 1 }}>{tr('Background (Anotações da Ficha)', 'Background (Sheet Notes)')}</Typography>
      <TextField multiline minRows={4} fullWidth defaultValue={loaded.background} inputRef={ref} disabled={!canEdit}
        onBlur={() => void save()} slotProps={{ htmlInput: { maxLength: 20000 } }} />
      {status && <Alert severity="info" sx={{ mt: 1 }} onClose={() => setStatus(null)}>{status}</Alert>}
    </Box>
  );
}
