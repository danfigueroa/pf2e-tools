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
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  athletics: number;
  acrobatics: number;
  stealth: number;
  attackBonus: number;
  spellAttackBonus: number;
  spellDC: number;
  damageBonus: number;
  transformedAbilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

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
    const safeCasterLevel = casterLevel || 1;
    
    // Calculate ability modifiers
    const strMod = Math.floor((safeAbilityScores.strength - 10) / 2);
    const proficiencyBonus = safeLevel;
    
    let baseAC: number;
    let temporaryHP: number;
    let attackModifier: number;
    let athleticsModifier: number;
    
    // Calculate damage bonus based on spell and level
     let damageBonus: number;
     
     // Different calculations based on spell type
     if (spell.id === 'dinosaur-form') {
       // Dinosaur Form calculations
       if (safeCasterLevel >= 7) {
         baseAC = 21 + safeLevel;
         temporaryHP = 25;
         attackModifier = Math.max(25, strMod + proficiencyBonus);
         athleticsModifier = Math.max(25, strMod + proficiencyBonus);
         damageBonus = 15;
       } else if (safeCasterLevel >= 5) {
         baseAC = 18 + safeLevel;
         temporaryHP = 20;
         attackModifier = Math.max(18, strMod + proficiencyBonus);
         athleticsModifier = Math.max(21, strMod + proficiencyBonus);
         damageBonus = 6;
       } else {
         baseAC = 18 + safeLevel;
         temporaryHP = 15;
         attackModifier = Math.max(16, strMod + proficiencyBonus);
         athleticsModifier = Math.max(18, strMod + proficiencyBonus);
         damageBonus = 9;
       }
     } else {
      // Animal Form spell rules based on heightened level
       if (safeCasterLevel >= 5) {
         // 5th level: AC = 18 + level, 20 temp HP, +18 attack, Athletics +20
         baseAC = 18 + safeLevel;
         temporaryHP = 20;
         attackModifier = Math.max(18, strMod + proficiencyBonus);
         athleticsModifier = Math.max(20, strMod + proficiencyBonus);
         damageBonus = 3;
       } else if (safeCasterLevel >= 4) {
         // 4th level: AC = 18 + level, 15 temp HP, +16 attack, Athletics +16
         baseAC = 18 + safeLevel;
         temporaryHP = 15;
         attackModifier = Math.max(16, strMod + proficiencyBonus);
         athleticsModifier = Math.max(16, strMod + proficiencyBonus);
         damageBonus = 2;
       } else if (safeCasterLevel >= 3) {
         // 3rd level: AC = 17 + level, 10 temp HP, +14 attack, Athletics +14
         baseAC = 17 + safeLevel;
         temporaryHP = 10;
         attackModifier = Math.max(14, strMod + proficiencyBonus);
         athleticsModifier = Math.max(14, strMod + proficiencyBonus);
         damageBonus = 2;
       } else {
         // 2nd level (base): AC = 16 + level, 5 temp HP, +9 attack, Athletics +9
         baseAC = 16 + safeLevel;
         temporaryHP = 5;
         attackModifier = Math.max(9, strMod + proficiencyBonus);
         athleticsModifier = Math.max(9, strMod + proficiencyBonus);
         damageBonus = 1;
       }
     }
    
    // Character's saves (unchanged by transformation)
    const baseFortitude = safeLevel + 2; // Strong save
    const baseReflex = safeLevel + 2; // Strong save  
    const baseWill = safeLevel; // Weak save
    const wisdomModifier = Math.floor((safeAbilityScores.wisdom - 10) / 2);
    const basePerception = safeLevel + wisdomModifier;
    
    // Other skills (estimated based on character level)
    const acrobatics = safeLevel + 2;
    const stealth = safeLevel + 2;
    
    // Use character's own attack bonus if higher
    const characterAttackBonus = safeLevel + Math.floor((safeAbilityScores.strength - 10) / 2);
    const finalAttackBonus = Math.max(attackModifier, characterAttackBonus);
    
    // Use character's own Athletics if higher
    const characterAthletics = safeLevel + Math.floor((safeAbilityScores.strength - 10) / 2);
    const finalAthletics = Math.max(athleticsModifier, characterAthletics);
    
    // Spell stats remain the same (assuming primary casting ability)
    const spellcastingModifier = Math.max(
      Math.floor((safeAbilityScores.wisdom - 10) / 2),
      Math.floor((safeAbilityScores.charisma - 10) / 2),
      Math.floor((safeAbilityScores.intelligence - 10) / 2)
    );
    const spellAttackBonus = safeLevel + spellcastingModifier;
    const spellDC = 10 + safeLevel + spellcastingModifier;
    
    // HP calculation: character's base HP + temporary HP from spell
    const constitutionModifier = Math.floor((safeAbilityScores.constitution - 10) / 2);
    const characterBaseHP = character.baseHP || ((6 + constitutionModifier) * safeLevel);
    const hp = characterBaseHP + temporaryHP;
    
    // Calculate transformed ability scores (these are the stats while in animal form)
    // Most polymorph spells don't change mental stats, but physical stats are replaced
    const transformedAbilities = {
      strength: 18, // Most animal forms have good strength
      dexterity: spell.id === 'dinosaur-form' ? 15 : 16, // Dinosaurs are less agile
      constitution: 16, // Good constitution for animal forms
      intelligence: safeAbilityScores.intelligence, // Mental stats unchanged
      wisdom: safeAbilityScores.wisdom, // Mental stats unchanged
      charisma: safeAbilityScores.charisma // Mental stats unchanged
    };
    
    return {
      ac: baseAC,
      hp,
      fortitude: baseFortitude,
      reflex: baseReflex,
      will: baseWill,
      perception: basePerception,
      athletics: finalAthletics,
      acrobatics,
      stealth,
      attackBonus: finalAttackBonus,
      spellAttackBonus,
      spellDC,
      damageBonus,
      transformedAbilities
    };
  };

  const stats = calculateStats();

  const formatSpeed = (speed: TransformationForm['speed']) => {
    const speeds = [];
    if (speed.land) speeds.push(`${speed.land} feet`);
    if (speed.climb) speeds.push(`climb ${speed.climb} feet`);
    if (speed.swim) speeds.push(`swim ${speed.swim} feet`);
    if (speed.fly) speeds.push(`fly ${speed.fly} feet`);
    if (speed.burrow) speeds.push(`burrow ${speed.burrow} feet`);
    return speeds.join(', ');
  };

  const formatSenses = (senses: TransformationForm['senses']) => {
    const senseList = [];
    if (senses.lowLightVision) senseList.push('low-light vision');
    if (senses.darkvision) senseList.push(`darkvision ${senses.darkvision} feet`);
    if (senses.scent) senseList.push(`scent ${senses.scent} feet`);
    if (senses.tremorsense) senseList.push(`tremorsense ${senses.tremorsense} feet`);
    return senseList.join(', ');
  };

  const formatModifier = (value: number) => {
    return value >= 0 ? `+${value}` : `${value}`;
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          {character.name} ({form.name} Form)
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {form.size} animal, {spell.name}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Basic Stats */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>Defense</Typography>
          <Typography variant="body2">
            <strong>AC</strong> {stats.ac}; <strong>Fort</strong> {formatModifier(stats.fortitude)}, 
            <strong>Ref</strong> {formatModifier(stats.reflex)}, <strong>Will</strong> {formatModifier(stats.will)}
          </Typography>
          <Typography variant="body2">
            <strong>HP</strong> {stats.hp}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Speed and Senses */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>Movement & Senses</Typography>
          <Typography variant="body2">
            <strong>Speed</strong> {formatSpeed(form.speed)}
          </Typography>
          <Typography variant="body2">
            <strong>Senses</strong> {formatSenses(form.senses)}
          </Typography>
          <Typography variant="body2">
            <strong>Perception</strong> {formatModifier(stats.perception)}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Transformed Ability Scores */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>Ability Scores (Transformed)</Typography>
          <Typography variant="body2">
            <strong>Str</strong> {stats.transformedAbilities.strength} ({formatModifier(Math.floor((stats.transformedAbilities.strength - 10) / 2))}), 
            <strong>Dex</strong> {stats.transformedAbilities.dexterity} ({formatModifier(Math.floor((stats.transformedAbilities.dexterity - 10) / 2))}), 
            <strong>Con</strong> {stats.transformedAbilities.constitution} ({formatModifier(Math.floor((stats.transformedAbilities.constitution - 10) / 2))})
          </Typography>
          <Typography variant="body2">
            <strong>Int</strong> {stats.transformedAbilities.intelligence} ({formatModifier(Math.floor((stats.transformedAbilities.intelligence - 10) / 2))}), 
            <strong>Wis</strong> {stats.transformedAbilities.wisdom} ({formatModifier(Math.floor((stats.transformedAbilities.wisdom - 10) / 2))}), 
            <strong>Cha</strong> {stats.transformedAbilities.charisma} ({formatModifier(Math.floor((stats.transformedAbilities.charisma - 10) / 2))})
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Skills */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>Skills</Typography>
          <Typography variant="body2">
            <strong>Athletics</strong> {formatModifier(stats.athletics)}, 
            <strong>Acrobatics</strong> {formatModifier(stats.acrobatics)}, 
            <strong>Stealth</strong> {formatModifier(stats.stealth)}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Attacks */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>Attacks</Typography>
          {form.attacks.map((attack: Attack, index: number) => {
            // Parse damage dice and add bonus
            const formatDamageWithBonus = (damage: string, bonus: number) => {
              // Check if damage already includes a bonus (contains +)
              if (damage.includes('+')) {
                return damage; // Already has bonus, don't modify
              }
              // Add the spell's damage bonus
              return `${damage}+${bonus}`;
            };
            
            return (
              <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                <strong>{attack.name}</strong> {formatModifier(stats.attackBonus)} ({attack.type}), 
                <strong>Damage</strong> {formatDamageWithBonus(attack.damage, stats.damageBonus)}
                {attack.traits && attack.traits.length > 0 && (
                  <span> ({attack.traits.join(', ')})</span>
                )}
                {attack.range && <span>, <strong>Range</strong> {attack.range} feet</span>}
              </Typography>
            );
          })}
        </Box>

        {/* Special Abilities */}
        {form.abilities.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>Special Abilities</Typography>
              {form.abilities.map((ability: Ability, index: number) => (
                <Box key={index} sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    <strong>{ability.name}</strong> {ability.description}
                    {ability.traits && ability.traits.length > 0 && (
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        {ability.traits.map((trait: string, traitIndex: number) => (
                          <Chip key={traitIndex} label={trait} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    )}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Spellcasting (if applicable) */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>Spellcasting</Typography>
          <Typography variant="body2">
            <strong>Spell Attack</strong> {formatModifier(stats.spellAttackBonus)}, 
            <strong>Spell DC</strong> {stats.spellDC}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Note: You retain your spellcasting abilities while transformed.
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Transformation Notes */}
        <Box>
          <Typography variant="h6" gutterBottom>Transformation Notes</Typography>
          <Typography variant="body2" color="text.secondary">
            {form.description}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Duration: {spell.duration} • Traditions: {spell.traditions.join(', ')}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatBlockGenerator;