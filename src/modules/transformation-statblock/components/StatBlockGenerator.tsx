import React from 'react';
import {
  Box,
  Card,
  Typography,
  Alert
} from '@mui/material';
import type { TransformationSpell, TransformationForm, PlayerCharacter, Attack, Ability } from '../../../types';
import {
  LABELS,
  translateSize,
  translateDamageString,
  translateDamageType,
  translateTrait,
  translateAttackName,
  translateImmunity,
  translateSense,
  translateSpeedType,
  translateName,
} from '../i18n';

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
    const speeds: string[] = [];
    if (speed.land) speeds.push(`${speed.land} pés`);
    if (speed.climb) speeds.push(`${translateSpeedType('climb')} ${speed.climb} pés`);
    if (speed.swim) speeds.push(`${translateSpeedType('swim')} ${speed.swim} pés`);
    if (speed.fly) speeds.push(`${translateSpeedType('fly')} ${speed.fly} pés`);
    if (speed.burrow) speeds.push(`${translateSpeedType('burrow')} ${speed.burrow} pés`);
    return speeds.join(', ') || 'nenhum';
  };

  const formatSenses = (senses: TransformationForm['senses']) => {
    const senseList: string[] = [];
    if (senses?.lowLightVision) senseList.push(translateSense('lowLightVision'));
    if (senses?.darkvision) senseList.push(`${translateSense('darkvision')} ${senses.darkvision} pés`);
    if (senses?.scent) senseList.push(`${translateSense('scent')} (impreciso) ${senses.scent} pés`);
    if (senses?.tremorsense) senseList.push(`${translateSense('tremorsense')} (impreciso) ${senses.tremorsense} pés`);
    return senseList.join(', ');
  };

  const formatModifier = (value: number) => {
    return value >= 0 ? `+${value}` : `${value}`;
  };

  const formatResistances = (resistances?: Record<string, number>) => {
    if (!resistances || Object.keys(resistances).length === 0) return null;
    return Object.entries(resistances).map(([type, value]) => `${translateDamageType(type)} ${value}`).join(', ');
  };

  const formatImmunities = (immunities?: string[]) => {
    if (!immunities || immunities.length === 0) return null;
    return immunities.map(translateImmunity).join(', ');
  };

  const formatWeaknesses = (weaknesses?: Record<string, number>) => {
    if (!weaknesses || Object.keys(weaknesses).length === 0) return null;
    return Object.entries(weaknesses).map(([type, value]) => `${translateDamageType(type)} ${value}`).join(', ');
  };

  const sensesText = formatSenses(form.senses);

  // Traços exibidos na faixa de traits (raridade omitida = Comum)
  const traitTags = [translateSize(stats.size), ...(form.traits ?? []).map(translateTrait)];

  // Paleta oficial (pergaminho + vinho + laranja)
  const MAROON = '#5c1f1b';
  const ORANGE = '#c0521f';
  const PARCHMENT = '#f7f2e7';
  const INK = '#1a1a1a';

  const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <strong style={{ color: MAROON }}>{children}</strong>
  );

  const Rule = () => (
    <Box sx={{ height: '3px', bgcolor: ORANGE, my: 1, borderRadius: '2px' }} />
  );

  return (
    <Card sx={{ mt: 2, bgcolor: PARCHMENT, color: INK, border: `1px solid ${MAROON}`, borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
      {/* Header bar */}
      <Box sx={{ bgcolor: MAROON, color: '#f7f2e7', px: 2, py: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1.35rem', letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.1 }}>
          {character.name} <Box component="span" sx={{ fontWeight: 400, textTransform: 'none', fontSize: '0.9rem', opacity: 0.9 }}>({translateName(form.name)})</Box>
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {LABELS.creature} {effectiveLevel}
        </Typography>
      </Box>

      {/* Trait tags */}
      <Box sx={{ px: 2, py: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', bgcolor: '#efe7d4' }}>
        {traitTags.map((t, i) => (
          <Box key={i} sx={{ bgcolor: MAROON, color: '#f7f2e7', border: '1px solid #d9c58a', px: 1, py: 0.25, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {t}
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 2, py: 1.5 }}>
        {/* Spell line */}
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#5a5044', mb: 1 }}>
          {translateName(spell.name)} ({LABELS.level} {effectiveLevel})
        </Typography>

        {/* Perception / Senses */}
        <Typography variant="body2">
          <Label>{LABELS.perception}</Label> {formatModifier(stats.perception)}{sensesText ? `; ${sensesText}` : ''}
        </Typography>
        {/* Skills */}
        <Typography variant="body2">
          <Label>{LABELS.skills}</Label> {LABELS.athletics} {formatModifier(stats.athletics)}
        </Typography>

        <Rule />

        {/* Defense */}
        <Typography variant="body2">
          <Label>{LABELS.ac}</Label> {stats.ac}; <Label>{LABELS.fort}</Label> {formatModifier(stats.fortitude)}, <Label>{LABELS.ref}</Label> {formatModifier(stats.reflex)}, <Label>{LABELS.will}</Label> {formatModifier(stats.will)}
        </Typography>
        <Typography variant="body2">
          <Label>{LABELS.hp}</Label> {stats.hp}; <Label>{LABELS.tempHp}</Label> {stats.tempHP}
          {formatImmunities(form.immunities) && <> ; <Label>{LABELS.immunities}</Label> {formatImmunities(form.immunities)}</>}
          {formatResistances(form.resistances) && <> ; <Label>{LABELS.resistances}</Label> {formatResistances(form.resistances)}</>}
          {formatWeaknesses(form.weaknesses) && <> ; <Label>{LABELS.weaknesses}</Label> {formatWeaknesses(form.weaknesses)}</>}
        </Typography>

        <Rule />

        {/* Speed */}
        <Typography variant="body2">
          <Label>{LABELS.speed}</Label> {formatSpeed(form.speed)}
        </Typography>

        {/* Attacks */}
        {form.attacks.map((attack: Attack, index: number) => {
          const formatDamageWithBonus = (damage: string, bonus: number) => {
            if (damage.includes('+') || damage.includes('-') || bonus === 0) {
              return translateDamageString(damage);
            }
            return translateDamageString(`${damage}${bonus > 0 ? '+' + bonus : ''}`);
          };

          const attackType = attack.type === 'melee' ? LABELS.melee : LABELS.ranged;
          const reach = attack.range ?? (stats.reach > 5 && attack.type === 'melee' ? stats.reach : 0);
          const reachInfo = reach ? ` (${translateTrait('reach')} ${reach} pés)` : '';

          return (
            <Typography key={index} variant="body2" sx={{ mt: 0.5 }}>
              <Label>{attackType}</Label> <Box component="span" sx={{ color: ORANGE, fontWeight: 700 }}>◆</Box> {translateAttackName(attack.name)} {formatModifier(stats.attackBonus)}{reachInfo}
              {attack.traits && attack.traits.length > 0 && (
                <Box component="span" sx={{ color: '#6b6152' }}> ({attack.traits.map(translateTrait).join(', ')})</Box>
              )}
              , <Label>{LABELS.damage}</Label> {formatDamageWithBonus(attack.damage, stats.damageBonus)}
            </Typography>
          );
        })}

        {/* Special abilities */}
        {form.abilities && form.abilities.length > 0 && (
          <>
            <Rule />
            {form.abilities.map((ability: Ability, index: number) => (
              <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                <Label>{ability.name}</Label>
                {ability.traits && ability.traits.length > 0 && (
                  <Box component="span" sx={{ color: '#6b6152' }}> ({ability.traits.map(translateTrait).join(', ')})</Box>
                )}{' '}
                {ability.description}
              </Typography>
            ))}
          </>
        )}

        <Rule />

        {/* Footer note */}
        <Typography variant="caption" sx={{ color: '#6b6152', display: 'block' }}>
          {LABELS.duration}: {spell.duration} • {LABELS.traditions}: {spell.traditions.map(translateTrait).join(', ')} • {LABELS.level} {character.level} {character.class}
        </Typography>
      </Box>
    </Card>
  );
};

export default StatBlockGenerator;
