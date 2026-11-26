import { useState, type ReactNode } from 'react';
import { Box, ButtonBase, Popover } from '@mui/material';
import {
  CheckRounded as SavedIcon, CloudOffOutlined as OfflineIcon, SyncRounded as SavingIcon, SyncProblemOutlined as ConflictIcon,
} from '@mui/icons-material';
import { chrome, displayFont, gold, green } from '../../../theme';
import { tr } from '../../../i18n';
import { useImageUrl } from '../../../services/images';
import { attributeLabel } from '../engine/attributes';
import { ATTRIBUTES, type AttributeKey, type Compiled, type Stat } from '../engine/types';
import type { SaveStatus } from '../hooks/useBuild';
import { Medallion } from './ui';
import { signed } from './uiTokens';
import { SAVE_LABEL } from './heroText';

type StatKey = keyof Compiled['stats'];

const STATS: { key: StatKey; label: string; long: string; flat?: boolean }[] = [
  { key: 'hp', label: tr('PV', 'HP'), long: tr('Pontos de vida', 'Hit points'), flat: true },
  { key: 'ac', label: tr('CA', 'AC'), long: tr('Classe de armadura', 'Armor class'), flat: true },
  { key: 'perception', label: tr('Perc', 'Perc'), long: tr('Percepção', 'Perception') },
  { key: 'classDC', label: tr('CD', 'DC'), long: tr('CD de classe', 'Class DC'), flat: true },
  { key: 'speed', label: tr('Desl', 'Speed'), long: tr('Deslocamento', 'Speed'), flat: true },
];

const statValue = (key: StatKey, stat: Stat | null) =>
  !stat ? '—' : key === 'speed' ? (stat.total ? tr(`${stat.total} pés`, `${stat.total} ft`) : '—') : STATS.find((s) => s.key === key)?.flat ? String(stat.total) : signed(stat.total);


/** O estado do salvamento, nos tons da moldura (sem rede em claro, conflito em ouro). */
export function SaveIndicator({ status, conflict }: { status: SaveStatus; conflict?: boolean }) {
  if (!conflict && status === 'idle') return null;
  const icon = conflict ? <ConflictIcon /> : status === 'saved' ? <SavedIcon /> : status === 'offline' || status === 'error' ? <OfflineIcon /> : <SavingIcon />;
  const color = conflict ? gold.bright : status === 'offline' || status === 'error' ? chrome.text : chrome.textSoft;
  return (
    <Box component="span" role="status" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.625, fontSize: 12, color, whiteSpace: 'nowrap', '& svg': { fontSize: 14 } }}>
      {icon}{conflict ? tr('Conflito', 'Conflict') : SAVE_LABEL[status]}
    </Box>
  );
}

/** Um número do resumo: tocar abre a conta (cada número tem conta). */
function StatCell({ label, long, value, stat, big }: { label: string; long: string; value: string; stat: Stat | null; big?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const parts = stat?.parts ?? [];
  return (
    <>
      <ButtonBase onClick={(e) => parts.length && setAnchor(e.currentTarget)} disabled={!parts.length} data-view=""
        aria-label={`${long} ${value}${parts.length ? tr(', ver a conta', ', see the math') : ''}`}
        title={parts.map((p) => `${p.label} ${signed(p.value)}`).join(' · ') || undefined}
        sx={{ bgcolor: chrome.hero, py: big ? 1.125 : 0.875, px: 0.25, display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, color: 'inherit' }}>
        <Box component="b" sx={{ font: `700 ${big ? 22 : 18}px/1.1 "Source Sans 3", sans-serif`, color: chrome.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</Box>
        <Box component="span" sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: chrome.label, whiteSpace: 'nowrap' }}>{label}</Box>
      </ButtonBase>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { bgcolor: green.deepest, color: chrome.text, border: `1px solid ${gold.main}`, borderRadius: '6px', p: 1.5, maxWidth: 320 } } }}>
        <Box sx={{ fontWeight: 700, mb: 0.75 }}>{long} {value}</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 16px', color: chrome.textSoft, fontSize: 13 }}>
          {parts.map((p, i) => (
            <Box key={i} sx={{ display: 'contents' }}>
              <span>{p.label}</span>
              <Box component="b" sx={{ color: chrome.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{signed(p.value)}</Box>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}

function AttrCell({ attr, mod, partial, isKey, big }: { attr: AttributeKey; mod: number; partial: boolean; isKey: boolean; big?: boolean }) {
  return (
    <Box title={isKey ? tr('Atributo-chave', 'Key attribute') : undefined} sx={{
      bgcolor: isKey ? chrome.active : chrome.raised, py: big ? 1.125 : 0.75, px: 0.25, textAlign: 'center', display: 'flex',
      flexDirection: 'column', gap: '1px', position: 'relative', minWidth: 0, boxShadow: isKey ? `inset 0 -2px 0 ${gold.bright}` : 'none',
    }}>
      <Box component="span" sx={{ font: `700 ${big ? 12 : 11}px ${displayFont}`, letterSpacing: '.1em', color: isKey ? gold.bright : chrome.label }}>{attributeLabel(attr)}</Box>
      <Box component="b" sx={{ font: `700 ${big ? 24 : 19}px/1.1 "Source Sans 3", sans-serif`, color: chrome.text, fontVariantNumeric: 'tabular-nums' }}>
        {signed(mod)}{partial ? '½' : ''}
      </Box>
      {isKey && <Box component="span" aria-hidden sx={{ position: 'absolute', top: 3, right: 5, fontSize: 7, color: gold.bright }}>◆</Box>}
    </Box>
  );
}

/**
 * Resumo do personagem com presença (redesign): medalhão, nome em Cinzel, classe e nível, o estado do salvamento, os seis
 * atributos (o chave em ouro com losango) e os números principais. Tocar num número abre a conta. Moldura verde nos dois
 * temas; no celular encosta nas bordas.
 */
export function CharacterHero({ name, subtitle, portrait, compiled, save, actions, badge, back, compact }: {
  name: string;
  subtitle: string;
  portrait?: string;
  compiled: Compiled | null;
  save?: ReactNode;
  /** Botões à direita (desktop) ou o menu (celular). */
  actions?: ReactNode;
  badge?: ReactNode;
  back?: ReactNode;
  /** Só a linha do nome (revisão, painel). */
  compact?: boolean;
}) {
  const src = useImageUrl(portrait);
  const mods = compiled?.attributes.mod;
  return (
    <Box component="header" sx={{
      bgcolor: chrome.hero, color: chrome.text, borderBottom: `2px solid ${gold.main}`, mx: { xs: -1.5, sm: 0 }, mt: { xs: -2, sm: 0 },
      borderRadius: { xs: 0, sm: '8px 8px 0 0' }, overflow: 'hidden',
    }}>
      <Box sx={{ px: { xs: 2, md: 4 }, pt: { xs: 1.75, md: 2 }, pb: compact ? 1.75 : 0 }}>
        {back}
        <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2.5 }, alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}><Medallion name={name} src={src} size={84} /></Box>
          <Box sx={{ display: { xs: 'block', md: 'none' } }}><Medallion name={name} src={src} size={56} /></Box>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: { md: 0.5 } }}>
            <Box component="h1" sx={{ m: 0, font: `700 22px/1.1 ${displayFont}`, fontSize: { md: 34 }, color: chrome.text, overflowWrap: 'anywhere' }}>
              {name || tr('Sem nome', 'Unnamed')}
            </Box>
            <Box sx={{ color: chrome.textSoft, fontSize: { xs: 14, md: 15 } }}>{subtitle}</Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end', ml: 'auto' }}>
            {save}
            {badge}
            {actions}
          </Box>
        </Box>
      </Box>
      {!compact && (
        <Box sx={{
          mt: { xs: 1.5, md: 2 }, display: 'grid', gap: '1px', bgcolor: chrome.line, borderTop: `1px solid ${chrome.line}`,
          gridTemplateColumns: { xs: 'repeat(6, minmax(0, 1fr))', lg: 'repeat(11, minmax(0, 1fr))' },
        }}>
          {ATTRIBUTES.map((a) => (
            <AttrCell key={a} attr={a} mod={mods?.[a] ?? 0} partial={!!compiled?.attributes.partial[a]} isKey={compiled?.keyAttribute === a} />
          ))}
          <Box sx={{ gridColumn: { xs: '1 / -1', lg: 'span 5' }, display: 'grid', gap: '1px', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            {STATS.map((s) => {
              const stat = compiled ? compiled.stats[s.key] : null;
              return <StatCell key={s.key} label={s.label} long={s.long} value={compiled ? statValue(s.key, stat) : '—'} stat={stat} />;
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}

