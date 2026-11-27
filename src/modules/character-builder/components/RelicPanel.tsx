import { Box } from '@mui/material';
import { displayFont, gold, ink, parchment, rule } from '../../../theme';
import { tr } from '../../../i18n';
import { ContentBadge, Label } from './ui';
import { tint } from './uiTokens';
import { Gem } from './equipUi';
import { relicRuneLabel, type RelicView } from './relicView';

const TIER: Record<string, string> = { minor: tr('menor', 'minor'), major: tr('maior', 'major'), grand: tr('grandiosa', 'grand') };

/**
 * A relíquia como a Ficha mostra: nível (o do dono), aspectos, a regra da mesa e as dádivas, com o nível em que cada uma
 * libera. Só leitura no Criador: o catálogo das relíquias é o da Ficha (`character-viewer/relics.ts`).
 */
export function RelicPanel({ view, compact }: { view: RelicView; compact?: boolean }) {
  const { relic, level, gifts, house } = view;
  return (
    <Box sx={{ border: `1px solid ${gold.main}`, bgcolor: tint.gold, borderRadius: '8px', p: compact ? 1.25 : 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Label sx={{ color: gold.deep }}>{tr(`Relíquia · nível ${level}`, `Relic · level ${level}`)}</Label>
        {!compact && <Box component="b" sx={{ font: `700 16px ${displayFont}` }}>{relic.name}</Box>}
      </Box>
      {(relic.aspects?.length || relic.on?.kind === 'armor') && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {relic.on?.kind === 'armor' && relic.on.clothing && <ContentBadge kind="trait">{tr('Roupa (conta como armadura)', 'Clothing (counts as armor)')}</ContentBadge>}
          {relic.aspects?.map((a) => <ContentBadge key={a} kind="trait">{a}</ContentBadge>)}
        </Box>
      )}
      {house && (
        <Box sx={{ fontSize: 13, color: ink.secondary }}>
          {tr(`Concessão da mesa para esta arma: ${relicRuneLabel(house)}. Não sai do dinheiro.`, `Table grant for this weapon: ${relicRuneLabel(house)}. Not paid for.`)}
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${rule}` }}>
        {gifts.map(({ gift, unlocked, minLevel }) => (
          <Box key={gift.id} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', py: 0.875, borderBottom: `1px solid ${rule}`, opacity: unlocked ? 1 : 0.6 }}>
            <Box sx={{ pt: '5px', width: 16, display: 'flex', justifyContent: 'center' }}><Gem look={gift.kind === 'rune' ? 'f' : unlocked ? 'p' : 'e'} size={10} /></Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                <Box component="b" sx={{ fontSize: 14 }}>{gift.name}</Box>
                <Box component="span" sx={{ fontSize: 12, color: ink.secondary }}>
                  {[tr(`dádiva ${TIER[gift.tier] ?? gift.tier}`, `${TIER[gift.tier] ?? gift.tier} gift`), gift.kind === 'rune' ? tr('runa', 'rune') : tr('poder', 'power'),
                    unlocked ? null : tr(`libera no nível ${minLevel}`, `unlocks at level ${minLevel}`)].filter(Boolean).join(' · ')}
                </Box>
              </Box>
              {gift.rune && <Box sx={{ fontSize: 13, color: ink.secondary }}>{relicRuneLabel(gift.rune)}</Box>}
              {gift.activation?.frequency && <Box sx={{ fontSize: 13, color: ink.secondary }}>{gift.activation.frequency}</Box>}
              {unlocked && gift.facts && <Box sx={{ fontSize: 13, fontWeight: 600 }}>{gift.facts(level)}</Box>}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ fontSize: 12, color: ink.secondary, bgcolor: parchment.paper, borderRadius: '6px', p: 1 }}>
        {tr('As ativações desta relíquia ficam na Ficha Virtual.',
          "Use this relic’s activations on the Virtual Sheet.")}
      </Box>
    </Box>
  );
}
