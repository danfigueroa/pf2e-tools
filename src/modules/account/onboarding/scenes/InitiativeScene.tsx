import { Box } from '@mui/material';
import { HP_COLOR, TOKEN_NPC, TOKEN_PC, gold, ink, parchment, rule, status } from '../../../../theme';
import { pop, pulseAnimation } from '../../../../motion/motion';
import { useSceneClock } from '../useSceneClock';
import { Initials } from '../SceneFrame';

const ROW = 40;
const COMBATANTS = [
  { name: 'Seraphine', initials: 'SE', init: 24, pc: true },
  { name: 'Goblin Guerreiro', initials: 'GG', init: 21, pc: false },
  { name: 'Bruma', initials: 'BR', init: 18, pc: true },
  { name: 'Goblin Arqueiro', initials: 'GA', init: 12, pc: false },
] as const;
// Um passo por turno, duas rodadas. Na vez da Bruma o guerreiro toma o golpe; no começo da
// rodada seguinte a Seraphine o derruba, e o turno dele passa direto.
const TURNS = [0, 1, 2, 3, 0, 2, 3] as const;
const STEPS = [1300, 1300, 1500, 1300, 1600, 1300, 1300] as const;

const goblinHp = (step: number) => (step < 2 ? 1 : step < 4 ? 0.35 : 0);

export const InitiativeScene = () => {
  const step = useSceneClock(STEPS);
  const round = step < 4 ? 2 : 3;
  const defeated = step >= 4;
  const active = TURNS[step];

  return (
    <Box sx={{ p: 2, color: ink.primary }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
        <Box sx={{ fontFamily: '"Cinzel", Georgia, serif', fontWeight: 700, fontSize: '0.9rem' }}>Emboscada na ponte</Box>
        <Box
          key={round}
          sx={{
            px: 1.25,
            py: 0.25,
            borderRadius: 5,
            fontSize: '0.72rem',
            fontWeight: 700,
            backgroundColor: gold.deep,
            color: parchment.paper,
            animation: `${pop} 380ms ease-out`,
          }}
        >
          Rodada {round}
        </Box>
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: ROW - 4,
            borderRadius: 1.5,
            border: `2px solid ${gold.main}`,
            backgroundColor: `${gold.bright}22`,
            transform: `translateY(${active * ROW}px)`,
            transition: 'transform 420ms cubic-bezier(.2,.8,.2,1)',
            animation: pulseAnimation({ kind: 'turn', id: step }),
          }}
        />
        {COMBATANTS.map((c, i) => {
          const gone = i === 1 && defeated;
          const hp = c.pc ? 1 : i === 1 ? goblinHp(step) : 0.8;
          return (
            <Box
              key={c.name}
              sx={{
                position: 'relative',
                height: ROW - 4,
                mb: '4px',
                px: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderRadius: 1.5,
                backgroundColor: parchment.page,
                border: `1px solid ${rule}`,
                opacity: gone ? 0.55 : 1,
                transition: 'opacity 400ms',
                animation: i === 1 && step === 2 ? pulseAnimation({ kind: 'hurt', id: 1 }) : undefined,
              }}
            >
              <Box sx={{ width: 22, textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', color: ink.secondary, fontVariantNumeric: 'tabular-nums' }}>
                {c.init}
              </Box>
              <Initials text={c.initials} color={c.pc ? TOKEN_PC : TOKEN_NPC} size={24} />
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textDecoration: gone ? 'line-through' : 'none',
                }}
              >
                {c.name}
              </Box>
              {gone ? (
                <Box sx={{ fontSize: '0.68rem', fontWeight: 700, color: HP_COLOR, animation: `${pop} 380ms ease-out` }}>Derrotado</Box>
              ) : (
                <Box sx={{ width: 64, height: 6, borderRadius: 3, backgroundColor: parchment.sunken, overflow: 'hidden', flex: '0 0 auto' }}>
                  <Box
                    sx={{
                      height: '100%',
                      transformOrigin: 'left',
                      transform: `scaleX(${hp})`,
                      backgroundColor: hp < 0.5 ? HP_COLOR : status.success,
                      transition: 'transform 500ms ease-out, background-color 300ms',
                    }}
                  />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box key={step} sx={{ mt: 1, fontSize: '0.75rem', color: ink.secondary, animation: `${pop} 300ms ease-out` }}>
        Vez de <Box component="span" sx={{ fontWeight: 700, color: ink.primary }}>{COMBATANTS[active].name}</Box>
      </Box>
    </Box>
  );
};
