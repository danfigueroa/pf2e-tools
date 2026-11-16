import { useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useRole } from '../../services/auth';
import { removeMyAvatar, uploadMyAvatar } from '../../services/avatars';
import { imageErrorText } from '../../services/images';
import { UserAvatar } from '../../components/UserAvatar';
import { chrome, green } from '../../theme';
import { tr } from '../../i18n';

/** Foto da própria conta. Sem foto, vale o token da ficha da pessoa; sem ficha, as iniciais. */
export const ProfilePhotoDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const role = useRole();
  const name = role.displayName ?? role.username ?? tr('Sua conta', 'Your account');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error && e.message !== 'avatar' ? imageErrorText(e) : tr('Não foi possível salvar a foto.', 'Could not save the photo.'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{tr('Foto da conta', 'Account photo')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ alignItems: 'center', pt: 1 }}>
          <UserAvatar userId={role.userId} name={name} size={112} bg={green.deepest} color={chrome.text} />
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            {tr(
              'Aparece no ranking, na lista da mesa e no menu. Sem foto, usamos o token da sua ficha.',
              'Shown in the ranking, the table list and the menu. Without a photo, we use your sheet\'s token.',
            )}
          </Typography>
          {error && <Alert severity="error" sx={{ width: 1 }}>{error}</Alert>}
          <Box component="input" ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) void run(() => uploadMyAvatar(f)); }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={busy}>{tr('Fechar', 'Close')}</Button>
        <Button onClick={() => void run(removeMyAvatar)} disabled={busy}>{tr('Usar o padrão', 'Use the default')}</Button>
        <Button variant="contained" onClick={() => input.current?.click()} disabled={busy}>{busy ? tr('Enviando…', 'Uploading…') : tr('Enviar foto', 'Upload photo')}</Button>
      </DialogActions>
    </Dialog>
  );
};
