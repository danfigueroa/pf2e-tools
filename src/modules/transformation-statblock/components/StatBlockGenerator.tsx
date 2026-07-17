import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  Stack,
  Alert
} from '@mui/material';
import type { TransformationSpell, TransformationForm, PlayerCharacter, Attack, Ability } from '../../../types';

interface StatBlockGeneratorProps {
  spell: TransformationSpell | null;
  form: TransformationForm | null;
  casterLevel: number;
  character: PlayerCharacter | null;
}

interface CalculatedStats {
  ac: number;
  hp: number;
  tempHP: number;
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  athletics: number;
  attackBonus: number;
  damageBonus: number;
  size: string;
  reach: number;
}

// Spell-specific stat calculations based on spell level and heightening
interface SpellLevelStats {
  acBase: number;
  tempHP: number;
  attackMod: number;
  damageMod: number;
  athleticsMod: number;
  size: string;
  reach: number;
}

// Get stats for a specific spell at a specific heightened level
const getSpellStats = (spellId: string, effectiveLevel: number): SpellLevelStats => {
  // Default stats structure
  const baseStats: SpellLevelStats = {
    acBase: 16,
    tempHP: 5,
    attackMod: 9,
    damageMod: 1,
    athleticsMod: 9,
    size: 'Medium',
    reach: 5
  };

  // Spell-specific stat progressions
  const spellProgression: Record<string, Record<number, Partial<SpellLevelStats>>> = {
    'animal-form': {
      2: { acBase: 16, tempHP: 5, attackMod: 9, damageMod: 1, athleticsMod: 9, size: 'Medium', reach: 5 },
      3: { acBase: 17, tempHP: 10, attackMod: 14, damageMod: 5, athleticsMod: 14, size: 'Medium', reach: 5 },
      4: { acBase: 18, tempHP: 15, attackMod: 16, damageMod: 9, athleticsMod: 16, size: 'Large', reach: 10 },
      5: { acBase: 18, tempHP: 20, attackMod: 18, damageMod: 7, athleticsMod: 20, size: 'Huge', reach: 15 }
    },
    'insect-form': {
      3: { acBase: 18, tempHP: 10, attackMod: 13, damageMod: 0, athleticsMod: 13, size: 'Medium', reach: 5 },
      4: { acBase: 18, tempHP: 15, attackMod: 16, damageMod: 6, athleticsMod: 16, size: 'Large', reach: 10 },
      5: { acBase: 18, tempHP: 20, attackMod: 18, damageMod: 6, athleticsMod: 20, size: 'Huge', reach: 15 }
    },
    'aerial-form': {
      4: { acBase: 18, tempHP: 5, attackMod: 16, damageMod: 5, athleticsMod: 16, size: 'Large', reach: 10 },
      5: { acBase: 18, tempHP: 10, attackMod: 18, damageMod: 8, athleticsMod: 20, size: 'Huge', reach: 10 },
      6: { acBase: 21, tempHP: 15, attackMod: 21, damageMod: 10, athleticsMod: 23, size: 'Huge', reach: 10 }
    },
    'dinosaur-form': {
      4: { acBase: 18, tempHP: 15, attackMod: 16, damageMod: 9, athleticsMod: 18, size: 'Large', reach: 10 },
      5: { acBase: 18, tempHP: 20, attackMod: 18, damageMod: 6, athleticsMod: 21, size: 'Huge', reach: 15 },
      7: { acBase: 21, tempHP: 25, attackMod: 25, damageMod: 15, athleticsMod: 25, size: 'Gargantuan', reach: 20 }
    },
    'fey-form': {
      4: { acBase: 19, tempHP: 15, attackMod: 16, damageMod: 4, athleticsMod: 16, size: 'Medium', reach: 5 },
      5: { acBase: 19, tempHP: 20, attackMod: 18, damageMod: 6, athleticsMod: 20, size: 'Large', reach: 10 },
      6: { acBase: 22, tempHP: 25, attackMod: 21, damageMod: 11, athleticsMod: 23, size: 'Huge', reach: 15 }
    },
    'elemental-form': {
      5: { acBase: 19, tempHP: 10, attackMod: 18, damageMod: 5, athleticsMod: 18, size: 'Medium', reach: 5 },
      6: { acBase: 22, tempHP: 15, attackMod: 20, damageMod: 9, athleticsMod: 22, size: 'Large', reach: 10 },
      7: { acBase: 22, tempHP: 20, attackMod: 23, damageMod: 13, athleticsMod: 25, size: 'Huge', reach: 15 }
    },
    'plant-form': {
      5: { acBase: 19, tempHP: 12, attackMod: 17, damageMod: 5, athleticsMod: 17, size: 'Large', reach: 10 },
      6: { acBase: 22, tempHP: 24, attackMod: 21, damageMod: 8, athleticsMod: 22, size: 'Huge', reach: 15 }
    },
    'dragon-form': {
      6: { acBase: 18, tempHP: 10, attackMod: 22, damageMod: 9, athleticsMod: 22, size: 'Large', reach: 10 },
      8: { acBase: 21, tempHP: 20, attackMod: 28, damageMod: 12, athleticsMod: 28, size: 'Huge', reach: 15 }
    },
    'fiend-form': {
      6: { acBase: 20, tempHP: 15, attackMod: 22, damageMod: 6, athleticsMod: 22, size: 'Medium', reach: 5 },
      7: { acBase: 22, tempHP: 20, attackMod: 25, damageMod: 10, athleticsMod: 25, size: 'Large', reach: 10 },
      8: { acBase: 22, tempHP: 25, attackMod: 28, damageMod: 14, athleticsMod: 28, size: 'Huge', reach: 15 }
    },
    'angel-form': {
      7: { acBase: 22, tempHP: 15, attackMod: 23, damageMod: 8, athleticsMod: 23, size: 'Medium', reach: 5 },
      9: { acBase: 25, tempHP: 25, attackMod: 28, damageMod: 12, athleticsMod: 30, size: 'Large', reach: 10 }
    },
    'monstrosity-form': {
      8: { acBase: 20, tempHP: 20, attackMod: 28, damageMod: 12, athleticsMod: 30, size: 'Gargantuan', reach: 20 },
      9: { acBase: 22, tempHP: 25, attackMod: 30, damageMod: 17, athleticsMod: 32, size: 'Gargantuan', reach: 20 }
    },
    'nature-incarnate': {
      10: { acBase: 25, tempHP: 30, attackMod: 34, damageMod: 18, athleticsMod: 36, size: 'Gargantuan', reach: 25 }
    },
    'ooze-form': {
      // Ooze Form deliberately has very low AC (7 + level) but is immune to
      // crits/precision. Heightening only changes size and reach (per AoN).
      3: { acBase: 7, tempHP: 20, attackMod: 14, damageMod: 5, athleticsMod: 14, size: 'Medium', reach: 5 },
      4: { acBase: 7, tempHP: 20, attackMod: 14, damageMod: 5, athleticsMod: 14, size: 'Large', reach: 10 },
      5: { acBase: 7, tempHP: 20, attackMod: 14, damageMod: 5, athleticsMod: 14, size: 'Huge', reach: 15 },
      8: { acBase: 7, tempHP: 20, attackMod: 14, damageMod: 5, athleticsMod: 14, size: 'Gargantuan', reach: 20 }
    },
    'element-embodied': {
      // Damage dice are carried on each form's attacks; no separate flat bonus.
      10: { acBase: 25, tempHP: 30, attackMod: 34, damageMod: 0, athleticsMod: 34, size: 'Gargantuan', reach: 20 }
    },
    'avatar': {
      // Deity-specific; damage dice carried on each form's attacks.
      10: { acBase: 25, tempHP: 30, attackMod: 33, damageMod: 0, athleticsMod: 35, size: 'Huge', reach: 10 }
    }
  };

  // Get the spell's progression table
  const progression = spellProgression[spellId] || {};
  
  // Find the highest level stats that apply to our effective level
  let selectedStats = { ...baseStats };
  const levels = Object.keys(progression).map(Number).sort((a, b) => a - b);
  
  for (const level of levels) {
    if (effectiveLevel >= level) {
      selectedStats = { ...selectedStats, ...progression[level] };
    }
  }

  return selectedStats;
};

const StatBlockGenerator: React.FC<StatBlockGeneratorProps> = ({
  spell,
  form,
  casterLevel,
  character
}) => {
  if (!spell || !form || !character) {
    return (
      <Alert severity="info">
        Selecione uma magia, forma e configure o personagem para gerar o stat block.
      </Alert>
    );
  }

  // Calculate effective spell level based on caster level
  const getEffectiveSpellLevel = (): number => {
    // In PF2e, highest spell rank = ceil(level/2)
    const maxSpellRank = Math.ceil(casterLevel / 2);
    
    // Get available heightened levels for this spell
    const heightenedLevels = spell.heightened 
      ? Object.keys(spell.heightened).map(Number)
      : [];
    
    // Include base spell level
    const allLevels = [spell.level, ...heightenedLevels].sort((a, b) => a - b);
    
    // Return the highest level we can cast
    return allLevels.filter(l => l <= maxSpellRank).pop() || spell.level;
  };

  // Calculate stats based on transformation spell rules
  const calculateStats = (): CalculatedStats => {
    // Ensure all ability scores are valid numbers
    const safeAbilityScores = {
      strength: character.abilityScores?.strength || 10,
      dexterity: character.abilityScores?.dexterity || 10,
      constitution: character.abilityScores?.constitution || 10,
      intelligence: character.abilityScores?.intelligence || 10,
      wisdom: character.abilityScores?.wisdom || 10,
      charisma: character.abilityScores?.charisma || 10
    };

    // Ensure character level is valid
    const safeLevel = character.level || 1;
    const effectiveSpellLevel = getEffectiveSpellLevel();
    
    // Get spell-specific stats
    const spellStats = getSpellStats(spell.id, effectiveSpellLevel);
    
    // Ability modifiers (used as fallback when real values weren't imported)
    const strMod = Math.floor((safeAbilityScores.strength - 10) / 2);
    const conMod = Math.floor((safeAbilityScores.constitution - 10) / 2);
    const dexMod = Math.floor((safeAbilityScores.dexterity - 10) / 2);
    const wisMod = Math.floor((safeAbilityScores.wisdom - 10) / 2);

    // AC is the spell's base + your level (battle forms replace your normal AC).
    const baseAC = spellStats.acBase + safeLevel;
    // Some forms grant extra temporary HP (e.g. earth/wood Element Embodied).
    const temporaryHP = spellStats.tempHP + (form?.hpBonus ?? 0);

    // Attack/Athletics: use the spell's value unless the character's own is
    // higher. Prefer the imported real modifier; otherwise approximate as
    // level + ability + 2 (trained).
    const ownAttack = character.attackBonus ?? (safeLevel + strMod + 2);
    const attackModifier = Math.max(spellStats.attackMod, ownAttack);

    const ownAthletics = character.athletics ?? (safeLevel + strMod + 2);
    const athleticsModifier = Math.max(spellStats.athleticsMod, ownAthletics);

    const damageBonus = spellStats.damageMod;

    // Saves and Perception are unchanged by the transformation — use the real
    // imported values, falling back to a trained approximation.
    const fortitude = character.saves?.fortitude ?? (safeLevel + conMod + 2);
    const reflex = character.saves?.reflex ?? (safeLevel + dexMod + 2);
    const will = character.saves?.will ?? (safeLevel + wisMod + 2);
    const perception = character.perception ?? (safeLevel + wisMod);

    // HP: your real maximum HP (temp HP is shown separately).
    const hp = character.maxHP ?? character.baseHP ?? ((8 + conMod) * safeLevel);

    return {
      ac: baseAC,
      hp,
      tempHP: temporaryHP,
      fortitude,
      reflex,
      will,
      perception,
      athletics: athleticsModifier,
      attackBonus: attackModifier,
      damageBonus,
      size: spellStats.size,
      reach: spellStats.reach
    };
  };

  const stats = calculateStats();
  const effectiveLevel = getEffectiveSpellLevel();

  const formatSpeed = (speed: TransformationForm['speed']) => {
    const speeds = [];
    if (speed.land) speeds.push(`${speed.land} feet`);
    if (speed.climb) speeds.push(`climb ${speed.climb} feet`);
    if (speed.swim) speeds.push(`swim ${speed.swim} feet`);
    if (speed.fly) speeds.push(`fly ${speed.fly} feet`);
    if (speed.burrow) speeds.push(`burrow ${speed.burrow} feet`);
    return speeds.join(', ') || 'none';
  };

  const formatSenses = (senses: TransformationForm['senses']) => {
    const senseList = [];
    if (senses?.lowLightVision) senseList.push('low-light vision');
    if (senses?.darkvision) senseList.push(`darkvision ${senses.darkvision} feet`);
    if (senses?.scent) senseList.push(`scent (imprecise) ${senses.scent} feet`);
    if (senses?.tremorsense) senseList.push(`tremorsense (imprecise) ${senses.tremorsense} feet`);
    return senseList.join(', ') || 'normal';
  };

  const formatModifier = (value: number) => {
    return value >= 0 ? `+${value}` : `${value}`;
  };

  const formatResistances = (resistances?: Record<string, number>) => {
    if (!resistances || Object.keys(resistances).length === 0) return null;
    return Object.entries(resistances).map(([type, value]) => `${type} ${value}`).join(', ');
  };

  const formatImmunities = (immunities?: string[]) => {
    if (!immunities || immunities.length === 0) return null;
    return immunities.join(', ');
  };

  const formatWeaknesses = (weaknesses?: Record<string, number>) => {
    if (!weaknesses || Object.keys(weaknesses).length === 0) return null;
    return Object.entries(weaknesses).map(([type, value]) => `${type} ${value}`).join(', ');
  };

  return (
    <Card sx={{ mt: 2, bgcolor: '#1a1a2e', color: '#eee', border: '2px solid #4a4a6a' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ borderBottom: '2px solid #4a4a6a', pb: 1, mb: 2 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', color: '#ffd700' }}>
            {character.name} ({form.name})
          </Typography>
          <Typography variant="body2" sx={{ color: '#aaa' }}>
            {stats.size} creature • {spell.name} (Rank {effectiveLevel})
          </Typography>
        </Box>

        {/* Perception and Senses */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong style={{ color: '#ffd700' }}>Perception</strong> {formatModifier(stats.perception)}; {formatSenses(form.senses)}
          </Typography>
        </Box>

        <Divider sx={{ bgcolor: '#4a4a6a', my: 1 }} />

        {/* Defense */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong style={{ color: '#ffd700' }}>AC</strong> {stats.ac}; <strong style={{ color: '#ffd700' }}>Fort</strong> {formatModifier(stats.fortitude)}, <strong style={{ color: '#ffd700' }}>Ref</strong> {formatModifier(stats.reflex)}, <strong style={{ color: '#ffd700' }}>Will</strong> {formatModifier(stats.will)}
          </Typography>
          <Typography variant="body2">
            <strong style={{ color: '#ffd700' }}>HP</strong> {stats.hp} (+ {stats.tempHP} temporary HP)
          </Typography>
          {formatImmunities(form.immunities) && (
            <Typography variant="body2">
              <strong style={{ color: '#ffd700' }}>Immunities</strong> {formatImmunities(form.immunities)}
            </Typography>
          )}
          {formatResistances(form.resistances) && (
            <Typography variant="body2">
              <strong style={{ color: '#ffd700' }}>Resistances</strong> {formatResistances(form.resistances)}
            </Typography>
          )}
          {formatWeaknesses(form.weaknesses) && (
            <Typography variant="body2">
              <strong style={{ color: '#ffd700' }}>Weaknesses</strong> {formatWeaknesses(form.weaknesses)}
            </Typography>
          )}
        </Box>

        <Divider sx={{ bgcolor: '#4a4a6a', my: 1 }} />

        {/* Speed */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong style={{ color: '#ffd700' }}>Speed</strong> {formatSpeed(form.speed)}
          </Typography>
        </Box>

        <Divider sx={{ bgcolor: '#4a4a6a', my: 1 }} />

        {/* Attacks */}
        <Box sx={{ mb: 2 }}>
          {form.attacks.map((attack: Attack, index: number) => {
            const formatDamageWithBonus = (damage: string, bonus: number) => {
              if (damage.includes('+') || damage.includes('-') || bonus === 0) {
                return damage;
              }
              return `${damage}${bonus > 0 ? '+' + bonus : ''}`;
            };
            
            const attackType = attack.type === 'melee' ? 'Melee' : 'Ranged';
            const reachInfo = attack.range ? ` (reach ${attack.range} ft)` : (stats.reach > 5 && attack.type === 'melee' ? ` (reach ${stats.reach} ft)` : '');
            
            return (
              <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                <strong style={{ color: '#ffd700' }}>{attackType}</strong> <span style={{ color: '#88f' }}>◆</span> {attack.name} {formatModifier(stats.attackBonus)}{reachInfo}, <strong>Damage</strong> {formatDamageWithBonus(attack.damage, stats.damageBonus)}
                {attack.traits && attack.traits.length > 0 && (
                  <span style={{ color: '#888' }}> ({attack.traits.join(', ')})</span>
                )}
              </Typography>
            );
          })}
        </Box>

        {/* Special Abilities */}
        {form.abilities && form.abilities.length > 0 && (
          <>
            <Divider sx={{ bgcolor: '#4a4a6a', my: 1 }} />
            <Box sx={{ mb: 2 }}>
              {form.abilities.map((ability: Ability, index: number) => (
                <Box key={index} sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    <strong style={{ color: '#ffd700' }}>{ability.name}</strong> {ability.description}
                  </Typography>
                  {ability.traits && ability.traits.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                      {ability.traits.map((trait: string, traitIndex: number) => (
                        <Chip 
                          key={traitIndex} 
                          label={trait} 
                          size="small" 
                          sx={{ 
                            bgcolor: '#2a2a4a', 
                            color: '#aaf',
                            fontSize: '0.7rem',
                            height: 20
                          }} 
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              ))}
            </Box>
          </>
        )}

        <Divider sx={{ bgcolor: '#4a4a6a', my: 1 }} />

        {/* Skills — battle forms grant an Athletics modifier (use your own if higher) */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong style={{ color: '#ffd700' }}>Athletics</strong> {formatModifier(stats.athletics)}
          </Typography>
        </Box>

        <Divider sx={{ bgcolor: '#4a4a6a', my: 1 }} />

        {/* Notes */}
        <Box sx={{ bgcolor: '#0a0a1a', p: 1.5, borderRadius: 1, mt: 2 }}>
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#aaa', fontSize: '0.85rem' }}>
            {form.description}
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1 }}>
            Duration: {spell.duration} • Traditions: {spell.traditions.join(', ')} • Level {character.level} {character.class}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatBlockGenerator;
