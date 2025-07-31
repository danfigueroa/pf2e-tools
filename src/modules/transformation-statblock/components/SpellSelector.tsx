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
          Seleção de Magia
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Magia de Transformação</InputLabel>
            <Select
              value={selectedSpell?.id || ''}
              label="Magia de Transformação"
              onChange={(e) => handleSpellChange(e.target.value)}
            >
              <MenuItem value="">
                <em>Selecione uma magia</em>
              </MenuItem>
              {transformationSpells.map((spell) => (
                <MenuItem key={spell.id} value={spell.id}>
                  {spell.name} (Nível {spell.level})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            label="Nível do Conjurador"
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
              <Chip label={`Nível ${selectedSpell.level}`} size="small" />
              <Chip label={selectedSpell.school} size="small" color="primary" />
              {selectedSpell.traditions.map((tradition) => (
                <Chip key={tradition} label={tradition} size="small" variant="outlined" />
              ))}
              <Chip label={`Nível Efetivo: ${getEffectiveSpellLevel()}`} size="small" color="secondary" />
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>Conjuração:</strong> {selectedSpell.cast} | 
              <strong> Alcance:</strong> {selectedSpell.range} | 
              <strong> Duração:</strong> {selectedSpell.duration}
            </Typography>
            
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {getSpellDescription()}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              <strong>Formas Disponíveis:</strong> {selectedSpell.forms.length} opções
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};