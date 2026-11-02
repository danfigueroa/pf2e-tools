import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  TextField
} from '@mui/material';
import type { TransformationSpell } from '../../../types';
import { transformationSpells } from '../data/spells';
import { tr } from '../../../i18n';

interface SpellSelectorProps {
  selectedSpell: TransformationSpell | null;
  casterLevel: number;
  onSpellChange: (spell: TransformationSpell | null) => void;
  onCasterLevelChange: (level: number) => void;
}

export const SpellSelector: React.FC<SpellSelectorProps> = ({
  selectedSpell,
  casterLevel,
  onSpellChange,
  onCasterLevelChange
}) => {
  const handleSpellChange = (spellId: string) => {
    const spell = transformationSpells.find(s => s.id === spellId) || null;
    onSpellChange(spell);
  };

  const getAvailableHeightenedLevels = (spell: TransformationSpell) => {
    const levels = [spell.level];
    if (spell.heightened) {
      Object.keys(spell.heightened).forEach(level => {
        const levelNum = parseInt(level);
        if (levelNum <= 10) {
          levels.push(levelNum);
        }
      });
    }
    return levels.sort((a, b) => a - b);
  };

  const getEffectiveSpellLevel = () => {
    if (!selectedSpell) return 1;
    const availableLevels = getAvailableHeightenedLevels(selectedSpell);
    return availableLevels.filter(level => level <= casterLevel).pop() || selectedSpell.level;
  };

  const getSpellDescription = () => {
    if (!selectedSpell) return '';
    
    const effectiveLevel = getEffectiveSpellLevel();
    let description = selectedSpell.description;
    
    if (selectedSpell.heightened && selectedSpell.heightened[effectiveLevel]) {
      description += `\n\nHeightened (${effectiveLevel}th): ${selectedSpell.heightened[effectiveLevel]}`;
    }
    
    return description;
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {tr('Seleção de Magia', 'Spell Selection')}</Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>{tr('Magia de Transformação', 'Transformation Spell')}</InputLabel>
            <Select
              value={selectedSpell?.id || ''}
              label={tr("Magia de Transformação", 'Transformation Spell')}
              onChange={(e) => handleSpellChange(e.target.value)}
            >
              <MenuItem value="">
                <em>{tr('Selecione uma magia', 'Select a spell')}</em>
              </MenuItem>
              {transformationSpells.map((spell) => (
                <MenuItem key={spell.id} value={spell.id}>
                  {spell.name} {tr('(Nível ', '(Rank ')}{spell.level})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            label={tr("Nível do Conjurador", 'Caster Level')}
            type="number"
            value={casterLevel}
            onChange={(e) => onCasterLevelChange(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            inputProps={{ min: 1, max: 20 }}
            sx={{ minWidth: 150 }}
          />
        </Box>

        {selectedSpell && (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip label={tr(`Nível ${selectedSpell.level}`, `Rank ${selectedSpell.level}`)} size="small" />
              <Chip label={selectedSpell.school} size="small" color="primary" />
              {selectedSpell.traditions.map((tradition) => (
                <Chip key={tradition} label={tradition} size="small" variant="outlined" />
              ))}
              <Chip label={tr(`Nível Efetivo: ${getEffectiveSpellLevel()}`, `Effective rank: ${getEffectiveSpellLevel()}`)} size="small" color="secondary" />
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>{tr('Conjuração:', 'Casting:')}</strong> {selectedSpell.cast} | 
              <strong> {tr('Alcance:', 'Range:')}</strong> {selectedSpell.range} | 
              <strong> {tr('Duração:', 'Duration:')}</strong> {selectedSpell.duration}
            </Typography>
            
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {getSpellDescription()}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              <strong>{tr('Formas Disponíveis:', 'Available Forms:')}</strong> {selectedSpell.forms.length} {tr('opções', 'options')}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};