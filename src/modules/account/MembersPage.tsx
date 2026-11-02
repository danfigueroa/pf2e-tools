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
import { locale, tr } from '../../i18n';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
    <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Paper>
);

const label = (m: { displayName: string | null; username: string | null; email: string | null }) =>
  m.displayName ?? m.username ?? m.email ?? tr('Sem nome', 'Unnamed');

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

  if (!isGm) return <Alert severity="info">{tr('Só o GM da mesa vê esta página.', 'Only the table\'s GM sees this page.')}</Alert>;

  // Roda uma ação e relê a lista; o erro do servidor vira o aviso da página.
  const act = async (run: () => Promise<{ ok: boolean } & Record<string, unknown>>) => {
    setError(null);
    const result = await run();
    if (!result.ok) setError(String(result.error ?? tr('Não deu certo', 'That didn\'t work')));
    await load();
  };

  const copy = async (code: string) => {
    const link = inviteLink(code);
    try { await navigator.clipboard.writeText(link); } catch { window.prompt(tr('Link do convite', 'Invite link'), link); }
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
      <Typography component="h1" variant="h4" sx={{ mb: 0.5 }}>{tr('Membros', 'Members')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>{tr('Mesa ', 'Table ')}{mesa.name}</Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {newPassword && (
        <Alert severity="success" onClose={() => setNewPassword(null)} sx={{ mb: 2 }}>
          {tr('Senha nova de ', 'New password for ')}<strong>{newPassword.who}</strong>:{' '}
          <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700 }}>{newPassword.password}</Box>
          {' '}{tr('— passe para a pessoa. Ela pode trocar depois, no menu da conta. Esta senha não aparece de novo.', '— hand it to the person. They can change it later, in the account menu. This password won\'t be shown again.')}</Alert>
      )}

      <Section title={tr("Convidar", 'Invite')}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
          <Select size="small" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
            <MenuItem value="player">{tr('Jogador', 'Player')}</MenuItem>
            <MenuItem value="gm">GM</MenuItem>
          </Select>
          <TextField
            size="small" type="number" label={tr("Usos", 'Uses')} value={uses} sx={{ width: 100 }}
            onChange={(e) => setUses(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
          />
          <TextField
            size="small" type="number" label={tr("Validade (dias)", 'Valid for (days)')} value={days} sx={{ width: 140 }}
            onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
          />
          <Button variant="contained" onClick={() => void act(() => createInvite(inviteRole, uses, days))}>
            {tr('Gerar convite', 'Generate invite')}</Button>
        </Stack>

        {activeInvites.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{tr('Nenhum convite ativo.', 'No active invite.')}</Typography>
        ) : (
          <Stack spacing={1}>
            {activeInvites.map((invite) => (
              <Box key={invite.code} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{invite.code}</Typography>
                <Chip size="small" label={invite.role === 'gm' ? 'GM' : tr('Jogador', 'Player')} />
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 120 }}>
                  {invite.uses}/{invite.maxUses} {tr(' usos · até ', ' uses · until ')}{new Date(invite.expiresAt).toLocaleDateString(locale)}
                </Typography>
                <Button size="small" startIcon={<CopyIcon />} onClick={() => void copy(invite.code)}>
                  {copied === invite.code ? tr('Copiado!', 'Copied!') : 'Copiar link'}
                </Button>
                <Button size="small" color="error" onClick={() => void act(() => revokeInvite(invite.code))}>{tr('Revogar', 'Revoke')}</Button>
              </Box>
            ))}
          </Stack>
        )}
      </Section>

      <Section title={tr("Quem está na mesa", 'Who is at the table')}>
        {!data ? <Typography color="text.secondary">{tr('Carregando…', 'Loading…')}</Typography> : (
          <Stack spacing={1.25} divider={<Box sx={{ borderTop: `1px solid ${ink.disabled}33` }} />}>
            {accounts.map((m) => (
              <Box key={m.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>{label(m)}{m.userId === userId ? tr(' (você)', ' (you)') : ''}</Typography>
                  {m.displayName && (m.username || m.email) && (
                    <Typography variant="caption" color="text.secondary" noWrap>{m.username ?? m.email}</Typography>
                  )}
                </Box>
                <Tooltip title={tr("Nome exibido na mesa", 'Name shown at the table')}>
                  <Button
                    size="small"
                    onClick={() => {
                      const name = window.prompt(tr('Nome na mesa', 'Name at the table'), m.displayName ?? '');
                      if (name?.trim()) void act(() => setMemberName(name.trim(), m.userId));
                    }}
                  >
                    {tr('Renomear', 'Rename')}</Button>
                </Tooltip>
                <Tooltip title={tr("Para quem esqueceu a senha", 'For whoever forgot their password')}>
                  <Button
                    size="small"
                    onClick={async () => {
                      if (!window.confirm(tr(`Gerar uma senha nova para ${label(m)}? A atual deixa de valer.`, `Generate a new password for ${label(m)}? The current one stops working.`))) return;
                      setError(null);
                      const result = await resetPassword(m.userId);
                      if (result.ok) setNewPassword({ who: label(m), password: result.data.password });
                      else setError(result.error);
                    }}
                  >
                    {tr('Nova senha', 'New password')}</Button>
                </Tooltip>
                <Select
                  size="small" value={m.role}
                  onChange={(e) => void act(() => setMemberRole(m.userId, e.target.value as Role))}
                >
                  <MenuItem value="player">{tr('Jogador', 'Player')}</MenuItem>
                  <MenuItem value="gm">GM</MenuItem>
                </Select>
                <Tooltip title={tr("Tirar da mesa", 'Remove from the table')}>
                  <IconButton
                    aria-label={tr(`Tirar ${label(m)} da mesa`, `Remove ${label(m)} from the table`)}
                    onClick={() => { if (window.confirm(tr(`Tirar ${label(m)} da mesa?`, `Remove ${label(m)} from the table?`))) void act(() => removeMember(m.userId)); }}
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
            {tr('Mais ', 'Plus ')}{legacyDevices} {tr('aparelho', 'device')}{legacyDevices === 1 ? '' : 's'} {tr(' do app de antes do login, sem conta. Não entram em nada e somem quando o login passar a ser obrigatório.', ' from the app before sign-in, without an account. They don\'t get into anything and disappear once sign-in becomes mandatory.')}</Typography>
        )}
      </Section>

      <Section title={tr("Dono de cada ficha", 'Owner of each sheet')}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {tr('Só o dono e o GM alteram uma ficha. As publicadas antes do login estão sem dono até você atribuí-las.', 'Only the owner and the GM change a sheet. Those published before sign-in have no owner until you assign them.')}</Typography>
        {!data ? null : data.sheets.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{tr('Nenhuma ficha publicada.', 'No published sheet.')}</Typography>
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
                  <MenuItem value=""><em>{tr('Sem dono (só o GM)', 'No owner (GM only)')}</em></MenuItem>
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
