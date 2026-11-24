import { useEffect, useState } from 'react';
import { Alert, Box, Link, Paper, Skeleton, Typography } from '@mui/material';
import { sources, type RuleSource } from '../modules/character-builder/rules';
import { displayFont } from '../theme';
import { locale, tr } from '../i18n';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5 }}>
    <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>{title}</Typography>
    {children}
  </Paper>
);

/** Texto legal citado como a licença exige: fica em inglês nos dois idiomas. */
const Notice = ({ children }: { children: React.ReactNode }) => (
  <Box component="blockquote" lang="en" sx={{ m: 0, mt: 1, pl: 1.5, borderLeft: 3, borderColor: 'divider', fontStyle: 'italic', overflowWrap: 'anywhere' }}>
    <Typography variant="body2">{children}</Typography>
  </Box>
);

const External = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} target="_blank" rel="noopener noreferrer" sx={{ overflowWrap: 'anywhere' }}>{children}</Link>
);

/**
 * Créditos e licenças (RNF-13): o aviso da Community Use Policy da Paizo, o aviso ORC dos livros Remaster cujas
 * regras estão na base do Criador, e as fontes de dados (Archives of Nethys e o sistema PF2e do Foundry).
 */
export const CreditsPage = () => {
  const [books, setBooks] = useState<RuleSource[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    sources()
      .then((list) => alive && setBooks([...list].sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '') || a.name.localeCompare(b.name, locale))))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Typography component="h1" variant="h4" sx={{ mb: 0.5 }}>{tr('Créditos e licenças', 'Credits and licenses')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2.5 }}>
        {tr('O Covil de Dados é uma ferramenta de fã, gratuita e não oficial.', 'Covil de Dados is a free, unofficial fan tool.')}
      </Typography>

      <Section title={tr('Paizo Community Use Policy', 'Paizo Community Use Policy')}>
        <Typography variant="body2">
          {tr('Pathfinder é marca registrada da Paizo Inc. Este site segue a política de uso comunitário da Paizo:', 'Pathfinder is a registered trademark of Paizo Inc. This site follows Paizo\'s Community Use Policy:')}
        </Typography>
        <Notice>
          {/* i18n-ok: aviso legal exigido, citado literalmente */}
          Covil de Dados uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo&apos;s Community Use Policy (paizo.com/licenses/communityuse). We are expressly prohibited from charging you to use or access this content. Covil de Dados is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit paizo.com.
        </Notice>
      </Section>

      <Section title={tr('ORC License', 'ORC License')}>
        <Typography variant="body2">
          {tr('As regras dos livros Remaster que o Criador de Personagem usa são publicadas pela Paizo sob a ORC License.', 'The rules from the Remaster books used by the Character Builder are published by Paizo under the ORC License.')}
        </Typography>
        <Notice>
          {/* i18n-ok: aviso ORC exigido pela licença (seção a), citado literalmente */}
          This product is licensed under the ORC License located at the Library of Congress at TX 9-307-067 and available online at various locations. All warranties are disclaimed as set forth therein.
        </Notice>
        <Typography variant="body2" sx={{ mt: 1.5, mb: 1 }}>
          {tr('Material licenciado usado, todos © Paizo Inc.:', 'Licensed Material used, all © Paizo Inc.:')}
        </Typography>
        {failed && <Alert severity="warning">{tr('Não foi possível carregar a lista de livros agora.', 'Could not load the book list right now.')}</Alert>}
        {!books && !failed && <Skeleton variant="rounded" height={96} />}
        {books && (
          <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 2 }}>
            {books.map((book) => (
              <Typography component="li" variant="body2" key={book.id}>
                {book.name}{book.releaseDate ? ` (${book.releaseDate.slice(0, 4)})` : ''}
              </Typography>
            ))}
          </Box>
        )}
      </Section>

      <Section title={tr('Fontes de dados', 'Data sources')}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {tr('Textos e catálogo de regras: ', 'Rules text and catalog: ')}
          <External href="https://2e.aonprd.com">Archives of Nethys</External>
          {tr(', parceira oficial da Paizo. As descrições em português são traduções automáticas, revisadas pela mesa.', ', Paizo\'s official partner. The Portuguese descriptions are machine translations, reviewed by the table.')}
        </Typography>
        <Typography variant="body2">
          {tr('Mecânica estruturada (efeitos de talentos e progressão das classes): ', 'Structured mechanics (feat effects and class progression): ')}
          <External href="https://github.com/foundryvtt/pf2e">{tr('sistema PF2e do Foundry VTT', 'Foundry VTT PF2e system')}</External>
          {tr(' (código sob Apache 2.0; regras de jogo sob ORC/OGL). Nenhum texto descritivo ou arte é copiado dele.', ' (code under Apache 2.0; game rules under ORC/OGL). No descriptive text or art is copied from it.')}
        </Typography>
      </Section>
    </Box>
  );
};
