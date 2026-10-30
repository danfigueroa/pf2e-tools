import type { ReactNode } from 'react';
import { keyframes } from '@emotion/react';
import { Box, Typography } from '@mui/material';
import { chrome, displayFont, gold, green, parchment } from '../../theme';
import { useReducedMotion } from '../../motion/motion';
import logoHorizontal from '../../assets/covil-logo-horizontal-fundo-escuro.svg';
import logoStacked from '../../assets/covil-logo-empilhado-fundo-claro.svg';
import { Showcase } from './onboarding/Showcase';

const rise = keyframes`
  0% { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: none; }
`;

// Pontinhos de latão bem apagados sobre o verde — textura sem imagem.
const DOTS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Ccircle cx='1.5' cy='1.5' r='1' fill='%23C8A951' fill-opacity='0.09'/%3E%3C/svg%3E")`;

const HIGHLIGHTS = ['Ao vivo para a mesa toda', 'Feito para o celular', 'Pathfinder 2e Remaster'];

/**
 * A tela de entrada: vitrine à esquerda e o formulário num painel de pergaminho à direita;
 * no celular, a apresentação, o formulário e, abaixo, "Conheça o Covil". Uma ordem só no
 * DOM — as áreas do grid é que mudam de lugar.
 */
export const LoginLayout = ({ children }: { children: ReactNode }) => {
  const reduced = useReducedMotion();
  const enter = (delay: number) => (reduced ? undefined : `${rise} 520ms cubic-bezier(.2,.8,.2,1) ${delay}ms both`);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(400px, 480px)' },
        gridTemplateRows: { md: 'auto 1fr auto' },
        gridTemplateAreas: {
          xs: '"intro" "form" "show" "foot"',
          md: '"intro form" "show form" "foot form"',
        },
        backgroundColor: green.main,
        backgroundImage: `${DOTS}, radial-gradient(900px 520px at 15% -10%, ${green.mid}AA, transparent), radial-gradient(700px 520px at 70% 110%, ${green.deepest}, transparent)`,
      }}
    >
      <Box sx={{ gridArea: 'intro', px: { xs: 2, sm: 4, lg: 8 }, pt: { xs: 4, md: 6 }, pb: { xs: 3, md: 2 }, animation: enter(0) }}>
        {/* No desktop o logo vai para o painel do formulário, que tem menos conteúdo. */}
        <Box component="img" src={logoHorizontal} alt="Covil de Dados" sx={{ display: { xs: 'block', md: 'none' }, height: 40 }} />
        <Typography
          component="h1"
          sx={{
            mt: { xs: 3, md: 2 },
            fontFamily: displayFont,
            fontWeight: 700,
            lineHeight: 1.15,
            fontSize: { xs: '1.6rem', sm: '2rem', lg: '2.4rem' },
            color: chrome.text,
            maxWidth: 640,
          }}
        >
          Sua mesa de Pathfinder,{' '}
          <Box component="span" sx={{ color: gold.bright, whiteSpace: 'nowrap' }}>ao vivo</Box>
        </Typography>
        <Typography sx={{ mt: 1.25, color: chrome.textSoft, maxWidth: 520, fontSize: { xs: '0.95rem', md: '1.05rem' } }}>
          Fichas, combate, mapa e rolagens num lugar só — sincronizados para o grupo inteiro, em qualquer aparelho.
        </Typography>
      </Box>

      <Box
        sx={{
          gridArea: 'form',
          display: 'grid',
          alignItems: { xs: 'center', md: 'stretch' },
          px: { xs: 2, md: 0 },
          animation: enter(80),
        }}
      >
        <Box
          sx={{
            height: { md: '100%' },
            display: 'grid',
            alignItems: 'center',
            backgroundColor: parchment.paper,
            borderRadius: { xs: 2.5, md: 0 },
            borderLeft: { md: `1px solid ${gold.main}66` },
            boxShadow: { xs: `0 20px 40px -20px #000000AA`, md: `-24px 0 48px -32px #00000099` },
            px: { xs: 2.5, sm: 4, md: 5 },
            py: { xs: 3, md: 6 },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 380, mx: 'auto' }}>
            <Box
              component="img"
              src={logoStacked}
              alt="Covil de Dados"
              sx={{ display: { xs: 'none', md: 'block' }, height: 120, mx: 'auto', mb: 4 }}
            />
            {children}
          </Box>
        </Box>
      </Box>

      <Box sx={{ gridArea: 'show', minWidth: 0, px: { xs: 2, sm: 4, lg: 8 }, pt: { xs: 5, md: 2 }, pb: 3, display: 'grid', alignContent: 'center', animation: enter(200) }}>
        <Typography
          sx={{ display: { md: 'none' }, mb: 2, fontSize: '0.75rem', letterSpacing: '0.14em', fontWeight: 700, color: gold.bright, textAlign: 'center' }}
        >
          CONHEÇA O COVIL
        </Typography>
        <Showcase />
      </Box>

      <Box
        component="footer"
        sx={{
          gridArea: 'foot',
          px: { xs: 2, sm: 4, lg: 8 },
          pb: 3,
          pt: 1,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: { xs: 'center', md: 'space-between' },
          animation: enter(280),
        }}
      >
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {HIGHLIGHTS.map((h) => (
            <Box
              component="li"
              key={h}
              sx={{ px: 1.25, py: 0.4, borderRadius: 5, fontSize: '0.72rem', color: chrome.textSoft, border: `1px solid ${chrome.lineStrong}` }}
            >
              {h}
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: chrome.textMuted, textAlign: 'center' }}>
          Ferramenta de fã, gratuita e não oficial. Pathfinder é marca registrada da Paizo Inc.
        </Typography>
      </Box>
    </Box>
  );
};
