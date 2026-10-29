import { useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { PlayArrow as StartIcon, Stop as StopIcon } from '@mui/icons-material';
import { useMesaInfo, useRole } from '../../services/auth';
import { saveMesaSettings } from '../../services/members';
import { sessionDate, sessionSince } from '../../layouts/format';
import { displayFont } from '../../theme';

const Section = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
    <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 0.5 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{hint}</Typography>
    {children}
  </Paper>
);

/** ISO → o valor do `<input type="datetime-local">` (hora local, sem fuso). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Configurações da mesa (só o GM): o nome, a sessão em andamento e a próxima sessão. Tudo aparece
 * na sidebar e na Início de todo mundo na hora (o banco avisa pelo canal de eventos).
 */
export const MesaSettingsPage = () => {
  const { isGm } = useRole();
  const mesa = useMesaInfo();
  const [name, setName] = useState(mesa.name);
  const [next, setNext] = useState(toLocalInput(mesa.nextSessionAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (!isGm) return <Alert severity="info">Só o GM da mesa vê esta página.</Alert>;

  const run = async (patch: Parameters<typeof saveMesaSettings>[0], done: string) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    const result = await saveMesaSettings(patch);
    setBusy(false);
    if (result.ok) setSaved(done);
    else setError(result.error);
  };

  const trimmed = name.trim();
  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 0.5 }}>Configurações da mesa</Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>{mesa.name}</Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" onClose={() => setSaved(null)} sx={{ mb: 2 }}>{saved}</Alert>}

      <Section title="Sessão" hint="Só as rolagens feitas com a sessão iniciada contam no Histórico de Rolagens (estatísticas e troféus); as de fora — testes da ficha — aparecem para a mesa, mas não entram. Com a sessão em andamento, a sidebar de todos mostra o selo verde.">
        {mesa.sessionStartedAt ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <Typography sx={{ flex: 1, fontWeight: 600 }}>Sessão em andamento, {sessionSince(mesa.sessionStartedAt)}</Typography>
            <Button variant="outlined" color="error" startIcon={<StopIcon />} disabled={busy}
              onClick={() => void run({ session: 'end' }, 'Sessão encerrada.')}>
              Encerrar sessão
            </Button>
          </Stack>
        ) : (
          <Button variant="contained" startIcon={<StartIcon />} disabled={busy}
            onClick={() => void run({ session: 'start' }, 'Sessão iniciada.')}>
            Iniciar sessão
          </Button>
        )}
      </Section>

      <Section title="Próxima sessão" hint="Aparece para todos na Início e na sidebar enquanto não chega.">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <TextField
            type="datetime-local"
            label="Data e hora"
            size="small"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 0, flex: { sm: 1 } }}
          />
          <Button variant="contained" disabled={busy || !next}
            onClick={() => void run({ nextSessionAt: new Date(next).toISOString() }, `Próxima sessão: ${sessionDate(new Date(next).toISOString())}.`)}>
            Salvar
          </Button>
          <Button disabled={busy || !mesa.nextSessionAt}
            onClick={() => { setNext(''); void run({ nextSessionAt: null }, 'Próxima sessão desmarcada.'); }}>
            Desmarcar
          </Button>
        </Stack>
      </Section>

      <Section title="Nome da mesa" hint="Como a mesa aparece para todos: na sidebar, no seletor de mesas e na Início.">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
          <TextField
            size="small"
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            error={trimmed.length > 0 && trimmed.length < 2}
            helperText="De 2 a 40 caracteres"
            sx={{ flex: 1 }}
          />
          <Button variant="contained" disabled={busy || trimmed.length < 2 || trimmed === mesa.name}
            onClick={() => void run({ name: trimmed }, 'Nome da mesa salvo.')}>
            Salvar nome
          </Button>
        </Stack>
      </Section>
    </Box>
  );
};
