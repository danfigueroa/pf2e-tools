import { keyframes } from '@emotion/react';
import { Box } from '@mui/material';
import { Visibility as RevealIcon } from '@mui/icons-material';
import { chrome, gold, green, ink, parchment, rule } from '../../../../theme';
import { pulseAnimation } from '../../../../motion/motion';
import { useSceneClock } from '../useSceneClock';

// As linhas "sendo escritas" são barras, não texto: a cena mostra o gesto, não um conteúdo.
const LINES = [0.92, 0.7, 0.84, 0.55] as const;
// Escrevendo → o trecho para a mesa → "Mostrar à mesa" → o cartão aparece na tela dos jogadores.
const STEPS = [400, 1800, 1400, 2600] as const;

const rise = keyframes`
  0% { opacity: 0; transform: translateY(16px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

export const JournalScene = () => {
  const step = useSceneClock(STEPS);
  const written = step >= 1;

  return (
    <Box sx={{ p: 2, color: ink.primary }}>
      <Box sx={{ display: 'flex', gap: 0.75, mb: 1.25, flexWrap: 'wrap' }} aria-hidden>
        {['Preparação', 'Cenas', 'Encontros', 'Elenco'].map((t, i) => (
          <Box
            key={t}
            sx={{
              fontSize: '0.7rem',
              pb: 0.25,
              borderBottom: `2px solid ${i === 0 ? gold.main : 'transparent'}`,
              color: i === 0 ? ink.primary : ink.secondary,
              fontWeight: i === 0 ? 700 : 400,
            }}
          >
            {t}
          </Box>
        ))}
      </Box>

      <Box sx={{ fontFamily: '"Cinzel", Georgia, serif', fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>Sessão 12 — A Torre Afogada</Box>

      <Box sx={{ display: 'grid', gap: 0.75, mb: 1.25 }}>
        {LINES.map((w, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: 10 }}>
            <Box
              sx={{
                height: 7,
                width: `${w * (i === 1 ? 55 : 100)}%`,
                borderRadius: 4,
                backgroundColor: `${ink.secondary}40`,
                transformOrigin: 'left',
                transform: `scaleX(${written ? 1 : 0})`,
                transition: written ? `transform 380ms ease-out ${i * 320}ms` : 'transform 150ms',
              }}
            />
            {i === 1 && (
              <Box
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: gold.deep,
                  borderBottom: `1px dashed ${gold.main}`,
                  whiteSpace: 'nowrap',
                  opacity: written ? 1 : 0,
                  transition: 'opacity 300ms ease-out 450ms',
                }}
              >
                Capitã Mirela
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          p: 1,
          borderRadius: 1.5,
          border: `1px dashed ${gold.main}`,
          backgroundColor: parchment.page,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          opacity: step >= 2 ? 1 : 0.35,
          transition: 'opacity 300ms',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, fontSize: '0.72rem', color: ink.secondary }}>
          <Box sx={{ fontWeight: 700, color: ink.primary }}>Para os jogadores</Box>
          A carta encharcada na mesa do capitão…
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.7rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            color: parchment.paper,
            backgroundColor: green.main,
            animation: step === 2 ? pulseAnimation({ kind: 'turn', id: 1 }) : undefined,
          }}
        >
          <RevealIcon sx={{ fontSize: 14 }} /> Mostrar à mesa
        </Box>
      </Box>

      {step === 3 && (
        <Box
          sx={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            width: 190,
            p: 1.25,
            borderRadius: 1.5,
            backgroundColor: chrome.hero,
            color: chrome.text,
            border: `1px solid ${gold.main}`,
            boxShadow: '0 12px 28px -10px #000000AA',
            animation: `${rise} 420ms cubic-bezier(.2,.8,.2,1)`,
          }}
        >
          <Box sx={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: gold.bright, fontWeight: 700 }}>NA TELA DE TODOS</Box>
          <Box sx={{ fontSize: '0.78rem', mt: 0.25 }}>A carta encharcada na mesa do capitão…</Box>
          <Box sx={{ mt: 0.75, height: 1, backgroundColor: rule, opacity: 0.3 }} />
        </Box>
      )}
    </Box>
  );
};
