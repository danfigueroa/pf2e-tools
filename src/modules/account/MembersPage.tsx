import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, MenuItem, Paper, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { ContentCopy as CopyIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useMesaInfo, useRole, type Role } from '../../services/auth';
import {
  assignSheet, createInvite, fetchMembers, inviteLink, removeMember, resetPassword, revokeInvite, setMemberName, setMemberRole,
  type MembersData,
} from '../../services/members';
import { displayFont, ink } from '../../theme';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
    <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Paper>
);

const label = (m: { displayName: string | null; username: string | null; email: string | null }) =>
  m.displayName ?? m.username ?? m.email ?? 'Sem nome';

/**
 * A tela do GM: quem está na mesa, convites e a quem pertence cada ficha. As fichas que já
 * estavam publicadas antes do login nascem SEM dono — só o GM mexe nelas até ele atribuir.
 */
export const MembersPage = () => {
  const { isGm, userId } = useRole();
  const mesa = useMesaInfo();
  const [data, setData] = useState<MembersData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<Role>('player');
  const [uses, setUses] = useState(1);
  const [days, setDays] = useState(7);
  // A senha provisória gerada agora: aparece uma vez, para o GM passar à pessoa.
  const [newPassword, setNewPassword] = useState<{ who: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const result = await fetchMembers();
    if (result.ok) setData(result.data);
    else setError(result.error);
  }, []);

  useEffect(() => { if (isGm) void load(); }, [isGm, load]);

  if (!isGm) return <Alert severity="info">Só o GM da mesa vê esta página.</Alert>;

  // Roda uma ação e relê a lista; o erro do servidor vira o aviso da página.
  const act = async (run: () => Promise<{ ok: boolean } & Record<string, unknown>>) => {
    setError(null);
    const result = await run();
    if (!result.ok) setError(String(result.error ?? 'Não deu certo'));
    await load();
  };

  const copy = async (code: string) => {
    const link = inviteLink(code);
    try { await navigator.clipboard.writeText(link); } catch { window.prompt('Link do convite', link); }
    setCopied(code);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const activeInvites = data?.invites.filter((i) => !i.revoked && new Date(i.expiresAt) > new Date() && i.uses < i.maxUses) ?? [];
  // Os aparelhos do app antigo (sessão anônima) ainda estão em `mesa_members` até o cutover: sem
  // nome nem conta, eram ~100 linhas em branco na lista e no seletor de dono, acima das contas.
  const accounts = data?.members.filter((m) => !m.anonymous) ?? [];
  const legacyDevices = (data?.members.length ?? 0) - accounts.length;

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 0.5 }}>Membros</Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>Mesa {mesa.name}</Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {newPassword && (
        <Alert severity="success" onClose={() => setNewPassword(null)} sx={{ mb: 2 }}>
          Senha nova de <strong>{newPassword.who}</strong>:{' '}
          <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700 }}>{newPassword.password}</Box>
          {' '}— passe para a pessoa. Ela pode trocar depois, no menu da conta. Esta senha não aparece de novo.
        </Alert>
      )}

      <Section title="Convidar">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
          <Select size="small" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
            <MenuItem value="player">Jogador</MenuItem>
            <MenuItem value="gm">GM</MenuItem>
          </Select>
          <TextField
            size="small" type="number" label="Usos" value={uses} sx={{ width: 100 }}
            onChange={(e) => setUses(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
          />
          <TextField
            size="small" type="number" label="Validade (dias)" value={days} sx={{ width: 140 }}
            onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
          />
          <Button variant="contained" onClick={() => void act(() => createInvite(inviteRole, uses, days))}>
            Gerar convite
          </Button>
        </Stack>

        {activeInvites.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Nenhum convite ativo.</Typography>
        ) : (
          <Stack spacing={1}>
            {activeInvites.map((invite) => (
              <Box key={invite.code} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{invite.code}</Typography>
                <Chip size="small" label={invite.role === 'gm' ? 'GM' : 'Jogador'} />
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 120 }}>
                  {invite.uses}/{invite.maxUses} usos · até {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
                </Typography>
                <Button size="small" startIcon={<CopyIcon />} onClick={() => void copy(invite.code)}>
                  {copied === invite.code ? 'Copiado!' : 'Copiar link'}
                </Button>
                <Button size="small" color="error" onClick={() => void act(() => revokeInvite(invite.code))}>Revogar</Button>
              </Box>
            ))}
          </Stack>
        )}
      </Section>

      <Section title="Quem está na mesa">
        {!data ? <Typography color="text.secondary">Carregando…</Typography> : (
          <Stack spacing={1.25} divider={<Box sx={{ borderTop: `1px solid ${ink.disabled}33` }} />}>
            {accounts.map((m) => (
              <Box key={m.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>{label(m)}{m.userId === userId ? ' (você)' : ''}</Typography>
                  {m.displayName && (m.username || m.email) && (
                    <Typography variant="caption" color="text.secondary" noWrap>{m.username ?? m.email}</Typography>
                  )}
                </Box>
                <Tooltip title="Nome exibido na mesa">
                  <Button
                    size="small"
                    onClick={() => {
                      const name = window.prompt('Nome na mesa', m.displayName ?? '');
                      if (name?.trim()) void act(() => setMemberName(name.trim(), m.userId));
                    }}
                  >
                    Renomear
                  </Button>
                </Tooltip>
                <Tooltip title="Para quem esqueceu a senha">
                  <Button
                    size="small"
                    onClick={async () => {
                      if (!window.confirm(`Gerar uma senha nova para ${label(m)}? A atual deixa de valer.`)) return;
                      setError(null);
                      const result = await resetPassword(m.userId);
                      if (result.ok) setNewPassword({ who: label(m), password: result.data.password });
                      else setError(result.error);
                    }}
                  >
                    Nova senha
                  </Button>
                </Tooltip>
                <Select
                  size="small" value={m.role}
                  onChange={(e) => void act(() => setMemberRole(m.userId, e.target.value as Role))}
                >
                  <MenuItem value="player">Jogador</MenuItem>
                  <MenuItem value="gm">GM</MenuItem>
                </Select>
                <Tooltip title="Tirar da mesa">
                  <IconButton
                    aria-label={`Tirar ${label(m)} da mesa`}
                    onClick={() => { if (window.confirm(`Tirar ${label(m)} da mesa?`)) void act(() => removeMember(m.userId)); }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Stack>
        )}
        {legacyDevices > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Mais {legacyDevices} aparelho{legacyDevices === 1 ? '' : 's'} do app de antes do login, sem conta. Não entram
            em nada e somem quando o login passar a ser obrigatório.
          </Typography>
        )}
      </Section>

      <Section title="Dono de cada ficha">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Só o dono e o GM alteram uma ficha. As publicadas antes do login estão sem dono até você atribuí-las.
        </Typography>
        {!data ? null : data.sheets.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Nenhuma ficha publicada.</Typography>
        ) : (
          <Stack spacing={1}>
            {data.sheets.map((sheet) => (
              <Box key={sheet.slug} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography sx={{ flex: 1, minWidth: 140, fontWeight: 600 }} noWrap>{sheet.name}</Typography>
                <Select
                  size="small" displayEmpty sx={{ minWidth: 200 }}
                  value={sheet.ownerId ?? ''}
                  onChange={(e) => void act(() => assignSheet(sheet.slug, e.target.value || null))}
                >
                  <MenuItem value=""><em>Sem dono (só o GM)</em></MenuItem>
                  {accounts.map((m) => (
                    <MenuItem key={m.userId} value={m.userId}>
                      {label(m)}
                      {m.displayName && m.username && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{m.username}</Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            ))}
          </Stack>
        )}
      </Section>
    </Box>
  );
};
