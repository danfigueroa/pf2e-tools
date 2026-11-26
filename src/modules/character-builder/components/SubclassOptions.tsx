import { lazy, Suspense, useEffect, useState } from 'react';
import { Box, Button, ButtonBase } from '@mui/material';
import { greenInk, ink, rule } from '../../../theme';
import { lang, tr } from '../../../i18n';
import { fetchSpecialDescription, getCachedSpecial, prefetchStoredDescriptions, useDescriptionCacheVersion } from '../../../services/descriptions';
import type { RuleEntry } from '../rules/types';
import { ContentBadge } from './ui';
import { cardSx, tint } from './uiTokens';

const DescriptionContent = lazy(() =>
  import('../../character-viewer/components/DescriptionContent').then((m) => ({ default: m.DescriptionContent })));

/** O texto corrido da descrição, sem a marcação (a prévia é texto simples). */
const plain = (md: string) => md.replace(/<[^>]+>/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();

function Preview({ entry }: { entry: RuleEntry }) {
  useDescriptionCacheVersion();
  const cached = getCachedSpecial(entry.name);
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (cached?.description) return;
    let alive = true;
    void fetchSpecialDescription(entry.name).then((d) => { if (alive && d?.description) setLoaded(d.description); });
    return () => { alive = false; };
  }, [entry.name, cached?.description]);
  const text = cached?.description ?? loaded;
  // Sem a descrição (ainda), o resumo do catálogo (em inglês, a língua da AON).
  const shown = text ? plain(text) : entry.summary ?? '';
  return (
    <Box component="span" lang={text ? lang : 'en'} sx={{
      fontSize: 14, color: ink.secondary, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
    }}>{shown || tr('Carregando a descrição…', 'Loading the description…')}</Box>
  );
}

/**
 * Opções de subclasse (doutrina, instinto, ordem…) com a descrição de cada uma, não só da escolhida: a pessoa compara
 * antes de escolher. Prévia de três linhas em todas; "Ler tudo" abre o texto completo (o mesmo da Ficha) na própria
 * lista, e a escolhida já vem aberta. As descrições vêm do banco de uma vez (`prefetchStoredDescriptions`).
 */
export function SubclassOptions({ label, options, chosen, disabled, onChoose }: {
  label: string;
  options: RuleEntry[];
  chosen?: string;
  disabled?: boolean;
  onChoose: (id: string | null) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { void prefetchStoredDescriptions('special', options.map((o) => o.name)); }, [options]);
  const expanded = open ?? chosen ?? null;

  return (
    <Box role="radiogroup" aria-label={label} sx={[cardSx, { display: 'flex', flexDirection: 'column', overflow: 'hidden' }]}>
      {options.map((o, i) => {
        const on = o.id === chosen;
        const isOpen = expanded === o.id;
        return (
          <Box key={o.id} sx={{ borderBottom: i === options.length - 1 ? 0 : `1px solid ${rule}`, bgcolor: on ? tint.green : 'transparent' }}>
            <ButtonBase role="radio" aria-checked={on} disabled={disabled} data-view="" onClick={() => onChoose(on ? null : o.id)} sx={{
              display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 1.75, pt: 1.5, pb: 0.75, width: 1, justifyContent: 'flex-start', textAlign: 'left',
              font: 'inherit', color: 'inherit',
              '&.Mui-disabled': { opacity: 1 },
            }}>
              <Box component="span" aria-hidden sx={{ mt: '2px', width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? greenInk.mid : ink.disabled}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                {on && <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: greenInk.mid }} />}
              </Box>
              <Box component="span" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box component="span" sx={{ fontWeight: 700, fontSize: 15 }}>{o.name}</Box>
                  {!o.remaster && <ContentBadge kind="legacy" />}
                  {o.rarity && o.rarity !== 'common' && <ContentBadge kind={o.rarity === 'uncommon' ? 'uncommon' : o.rarity === 'rare' ? 'rare' : 'unique'} />}
                </Box>
                {!isOpen && <Preview entry={o} />}
              </Box>
            </ButtonBase>
            {isOpen && (
              <Box sx={{ px: 1.75, pl: { xs: 1.75, sm: 6 }, pb: 1 }}>
                <Suspense fallback={<Preview entry={o} />}>
                  <DescriptionContent key={o.id} embedded request={{ type: 'special', name: o.name }} onClose={() => setOpen(null)} />
                </Suspense>
              </Box>
            )}
            <Box sx={{ px: 1.75, pl: { xs: 1.75, sm: 6 }, pb: 1 }}>
              <Button size="small" sx={{ px: 0.5, minWidth: 0 }} aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? '' : o.id)}>
                {isOpen ? tr('Mostrar menos', 'Show less') : tr('Ler tudo', 'Read all')}</Button>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
