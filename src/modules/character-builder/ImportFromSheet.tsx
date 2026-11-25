import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, LinearProgress, Paper, Typography } from '@mui/material';
import { tr } from '../../i18n';
import { createBuildFromSheet, fetchMesaRules, listBuilds } from '../../services/builds';
import { fetchPublished } from '../../services/sheets';
import { parseCharacterJson, parseFeatEntry } from '../../pathbuilder/types';
import { ancestries, backgrounds, classes, classOptions, heritages, languages, openRules, ruleTables } from './rules';
import { loadRuleList } from './rules/loader';
import type { RuleEntry } from './rules/types';
import { buildRulesIndex } from './engine/rulesIndex';
import { importPathbuilder, type ImportReport } from './engine/import';
import { featListPaths, ITEM_LISTS } from './hooks/useRules';
import { sanitizeMesaRules } from './mesaRules';
import { ruleListSlug } from './rules';

/**
 * Importar para o Criador (F7.7, CONTRATO-FICHA §9): a ficha publicada vira um build com o MESMO slug (o estado da mesa
 * continua ligado). A ficha da mesa não muda até alguém aplicar o build.
 */
export function ImportFromSheet({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(tr('Lendo a ficha publicada…', 'Reading the published sheet…'));
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Já importada (o build herda o slug): só abre.
      const existing = await listBuilds();
      const same = existing.ok ? existing.value.find((x) => x.slug === slug && !x.deletedAt) : undefined;
      if (same) {
        if (alive) navigate(`/personagens/${same.id}`, { replace: true });
        return;
      }
      const sheet = await fetchPublished(slug);
      if (!sheet) throw new Error(tr('Ficha não publicada.', 'Sheet not published.'));
      const b = parseCharacterJson(sheet.json);
      if (!alive) return;
      setStep(tr('Carregando as regras que o personagem usa…', 'Loading the rules the character uses…'));
      await openRules();
      const [a, h, bg, c, l, cf, tables, mesaOut] = await Promise.all([ancestries(), heritages(), backgrounds(), classes(), languages(), classOptions(), ruleTables().catch(() => null), fetchMesaRules()]);
      const her = h.find((x) => x.name === b.heritage);
      const dedications = b.feats.map((f) => parseFeatEntry(f).name).filter((n) => / Dedication$/.test(n)).map((n) => n.replace(/ Dedication$/, ''));
      const traditions = [...new Set(b.spellCasters.map((x) => x.magicTradition).filter((t) => ['arcane', 'divine', 'occult', 'primal'].includes(t)))];
      const paths = [
        ...featListPaths({ className: b.class, ancestryName: b.ancestry, versatileHeritage: her && !her.heritage?.ancestry ? her.name : undefined, mythic: true, archetypes: dedications.map(ruleListSlug), traditions }),
        ...ITEM_LISTS.map((x) => `items/${x}`), 'companions/animal', 'companions/familiar', 'core/deities',
      ];
      const extra = await Promise.all(paths.map((p) => loadRuleList<RuleEntry[]>(p).catch(() => [] as RuleEntry[])));
      const index = buildRulesIndex([a, h, bg, c, l, cf, ...extra], l);
      const mesaRules = mesaOut.ok ? sanitizeMesaRules(mesaOut.value) : undefined;
      const { state, report: rep } = importPathbuilder(b, { rules: index, mesaRules, classOptions: cf, tables: (tables ?? undefined) as never });
      if (!alive) return;
      setReport(rep);
      setStep(tr('Criando o personagem no Criador…', 'Creating the character in the Builder…'));
      const out = await createBuildFromSheet(slug, state, b.class);
      if (!out.ok) throw new Error(out.error);
      if (alive) navigate(`/personagens/${out.value.id}`, { replace: true, state: { importReport: rep } });
    })().catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, [slug, navigate]);

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 2 }}>{tr('Importar para o Criador', 'Import into the Builder')}</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        {error ? (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            <Button component={RouterLink} to="/personagens">{tr('Personagens', 'Characters')}</Button>
          </>
        ) : (
          <>
            <Typography sx={{ mb: 1 }}>{step}</Typography>
            <LinearProgress />
            {report && report.notFound.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {tr(`Fora do catálogo (legado ou caseiro): ${report.notFound.join(', ')}`, `Outside the catalog (legacy or homebrew): ${report.notFound.join(', ')}`)}
              </Typography>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}
