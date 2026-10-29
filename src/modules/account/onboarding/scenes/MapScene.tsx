import { keyframes } from '@emotion/react';
import { Box } from '@mui/material';
import { DRAW_COLORS, HP_COLOR, MAGUS_COLOR, MAP_BACKDROP, TOKEN_NPC, TOKEN_PC, chrome, gold, mapChrome, status } from '../../../../theme';
import { useSceneClock } from '../useSceneClock';

// Tudo em quadrados (1 unidade = 5 ft), como o mapa de verdade.
const COLS = 12;
const ROWS = 7;
const FIRE = DRAW_COLORS.find((c) => c.id === 'fire')!.hex;
// Parado → a Seraphine mede o caminho → o token anda 3 quadrados → explosão de 10 ft → ping no goblin.
const STEPS = [800, 1500, 900, 1700, 1500] as const;

// Explosão de 10 ft num cruzamento do grid: 4×4 sem os cantos (12 quadrados, o molde do livro).
const BURST = Array.from({ length: 16 }, (_, i) => ({ x: 7 + (i % 4), y: 1 + Math.floor(i / 4) }))
  .filter(({ x, y }) => !((x === 7 || x === 10) && (y === 1 || y === 4)));

const ping = keyframes`
  0% { transform: scale(0.2); opacity: 1; }
  100% { transform: scale(1.8); opacity: 0; }
`;
const fadeIn = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`;

const Token = ({ x, y, color, text, hp = 1, glide = false }: { x: number; y: number; color: string; text: string; hp?: number; glide?: boolean }) => (
  <g style={{ transform: `translate(${x}px, ${y}px)`, transition: glide ? 'transform 600ms cubic-bezier(.3,.7,.2,1)' : undefined }}>
    <rect x={0.1} y={-0.12} width={0.8} height={0.1} rx={0.05} fill={mapChrome.track} />
    <rect
      x={0.1}
      y={-0.12}
      width={0.8 * hp}
      height={0.1}
      rx={0.05}
      fill={hp < 0.5 ? HP_COLOR : status.success}
      style={{ transition: 'width 500ms ease-out' }}
    />
    <circle cx={0.5} cy={0.5} r={0.4} fill={color} stroke={mapChrome.outline} strokeWidth={0.05} />
    <text x={0.5} y={0.62} textAnchor="middle" fontSize={0.32} fontWeight={700} fill={chrome.onAccent}>{text}</text>
  </g>
);

export const MapScene = () => {
  const step = useSceneClock(STEPS);
  const moved = step >= 2;
  const measuring = step === 1;

  return (
    <Box sx={{ position: 'absolute', inset: 0, backgroundColor: MAP_BACKDROP }}>
      <svg viewBox={`0 0 ${COLS} ${ROWS}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id="covil-onboarding-grid" width={1} height={1} patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke={gold.bright} strokeOpacity={0.18} strokeWidth={0.03} />
          </pattern>
        </defs>
        {/* Piso e uma parede, para parecer um mapa e não uma planilha. */}
        <rect x={1} y={0.5} width={10.5} height={6} rx={0.3} fill={chrome.raised} />
        <rect x={4} y={0.5} width={0.4} height={1.6} fill={chrome.lineStrong} />
        <rect width={COLS} height={ROWS} fill="url(#covil-onboarding-grid)" />

        {step === 3 && (
          <g style={{ animation: `${fadeIn} 300ms ease-out` }}>
            {BURST.map(({ x, y }) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={FIRE} fillOpacity={0.35} stroke={FIRE} strokeOpacity={0.6} strokeWidth={0.03} />
            ))}
            <circle cx={9} cy={3} r={0.09} fill={FIRE} />
          </g>
        )}

        {measuring && (
          <g style={{ animation: `${fadeIn} 200ms ease-out` }}>
            <line x1={2.5} y1={3.5} x2={5.5} y2={3.5} stroke={gold.bright} strokeWidth={0.07} strokeDasharray="0.18 0.12" />
            <circle cx={5.5} cy={3.5} r={0.4} fill="none" stroke={gold.bright} strokeWidth={0.05} strokeDasharray="0.15 0.1" />
          </g>
        )}

        <Token x={8} y={2} color={TOKEN_NPC} text="GG" hp={step >= 4 ? 0.3 : 0.7} />
        <Token x={9} y={3} color={TOKEN_NPC} text="GA" hp={0.9} />
        <Token x={2} y={5} color={MAGUS_COLOR} text="BR" />
        <Token x={moved ? 5 : 2} y={3} color={TOKEN_PC} text="SE" glide />

        {step === 4 && (
          <circle
            cx={8.5}
            cy={2.5}
            r={0.7}
            fill="none"
            stroke={gold.bright}
            strokeWidth={0.08}
            style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `${ping} 700ms ease-out 2` }}
          />
        )}
      </svg>

      {(measuring || step === 3) && (
        <Box
          key={step}
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            px: 1.25,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            color: mapChrome.text,
            backgroundColor: mapChrome.label,
            border: `1px solid ${step === 3 ? FIRE : gold.main}`,
            animation: `${fadeIn} 200ms ease-out`,
          }}
        >
          {measuring ? 'Seraphine · 15 ft · 1 ação' : 'Explosão 10 ft · 2 criaturas'}
        </Box>
      )}
    </Box>
  );
};
