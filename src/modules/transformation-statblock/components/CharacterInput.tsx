import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Stack,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip
} from '@mui/material';
import type { PlayerCharacter, TransformationSpell } from '../../../types';
import { transformationSpells } from '../data/spells';

interface CharacterInputProps {
  onCharacterInput: (character: PlayerCharacter, spell: TransformationSpell) => void;
  character?: PlayerCharacter;
  selectedSpell?: TransformationSpell | null;
}

const CharacterInput: React.FC<CharacterInputProps> = ({ onCharacterInput, character, selectedSpell }) => {
  const [formData, setFormData] = useState<Partial<PlayerCharacter>>({
    name: character?.name || 'Aventureiro',
    level: character?.level || 5,
    class: character?.class || 'Druida',
    abilityScores: character?.abilityScores || {
      strength: 12,
      dexterity: 14,
      constitution: 14,
      intelligence: 12,
      wisdom: 18,
      charisma: 10
    },
    skills: character?.skills || {},
    proficiencyBonus: character?.proficiencyBonus || 3,
    classFeatures: character?.classFeatures || ['Wild Shape', 'Druidcraft'],
    equipment: character?.equipment || ['Leather Armor', 'Scimitar', 'Shield']
  });

  const [currentSpell, setCurrentSpell] = useState<TransformationSpell | null>(selectedSpell || null);

  const [errors, setErrors] = useState<string[]>([]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.push('Nome é obrigatório');
    }
    
    if (!formData.level || formData.level < 1 || formData.level > 20) {
      newErrors.push('Nível deve estar entre 1 e 20');
    }

    if (!currentSpell) {
      newErrors.push('Selecione uma magia de transformação');
    }
    
    if (!formData.abilityScores) {
      newErrors.push('Atributos são obrigatórios');
    } else {
      Object.entries(formData.abilityScores).forEach(([attr, value]) => {
        if (value < 8 || value > 20) {
          newErrors.push(`${attr} deve estar entre 8 e 20`);
        }
      });
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = () => {
    if (validateForm() && currentSpell) {
      onCharacterInput(formData as PlayerCharacter, currentSpell);
    }
  };

  const handleSpellChange = (spellId: string) => {
    const spell = transformationSpells.find(s => s.id === spellId) || null;
    setCurrentSpell(spell);
  };

  const handleAbilityChange = (ability: keyof PlayerCharacter['abilityScores'], value: number) => {
    setFormData(prev => ({
      ...prev,
      abilityScores: {
        ...prev.abilityScores!,
        [ability]: value
      }
    }));
  };

  const getModifier = (score: number) => {
    return Math.floor((score - 10) / 2);
  };

  const formatModifier = (modifier: number) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Dados do Personagem
      </Typography>
      
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Configure os dados básicos do seu personagem para calcular o stat block da transformação.
      </Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Stack spacing={3}>
            {/* Basic Info */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Nome"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                sx={{ flex: 1, minWidth: 200 }}
              />
              
              <TextField
                label="Nível"
                type="number"
                value={formData.level || 1}
                onChange={(e) => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                inputProps={{ min: 1, max: 20 }}
                sx={{ flex: 1, minWidth: 120 }}
              />
              
              <TextField
                label="HP Base"
                type="number"
                value={formData.baseHP || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, baseHP: parseInt(e.target.value) || undefined }))}
                inputProps={{ min: 1 }}
                sx={{ flex: 1, minWidth: 120 }}
                helperText="Pontos de vida base do personagem"
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ flex: 1, minWidth: 150 }}>
                <InputLabel>Classe</InputLabel>
                <Select
                  value={formData.class || ''}
                  label="Classe"
                  onChange={(e) => setFormData(prev => ({ ...prev, class: e.target.value }))}
                >
                  <MenuItem value="Druida">Druida</MenuItem>
                  <MenuItem value="Ranger">Ranger</MenuItem>
                  <MenuItem value="Mago">Mago</MenuItem>
                  <MenuItem value="Feiticeiro">Feiticeiro</MenuItem>
                  <MenuItem value="Outro">Outro</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Spell Selection */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Magia de Transformação
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Selecionar Magia</InputLabel>
                <Select
                  value={currentSpell?.id || ''}
                  label="Selecionar Magia"
                  onChange={(e) => handleSpellChange(e.target.value)}
                >
                  {transformationSpells.map((spell) => (
                    <MenuItem key={spell.id} value={spell.id}>
                      {spell.name} (Nível {spell.level})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {currentSpell && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {currentSpell.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {currentSpell.traditions.map((tradition) => (
                      <Chip key={tradition} label={tradition} size="small" variant="outlined" />
                    ))}
                    <Chip label={`Nível ${currentSpell.level}`} size="small" color="secondary" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Conjuração:</strong> {currentSpell.cast} | 
                    <strong> Alcance:</strong> {currentSpell.range} | 
                    <strong> Duração:</strong> {currentSpell.duration}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Formas Disponíveis:</strong> {currentSpell.forms.length} opções
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Ability Scores */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Atributos
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {formData.abilityScores && Object.entries(formData.abilityScores).map(([ability, score]) => (
                  <TextField
                    key={ability}
                    label={ability.charAt(0).toUpperCase() + ability.slice(1)}
                    type="number"
                    value={score}
                    onChange={(e) => handleAbilityChange(
                      ability as keyof PlayerCharacter['abilityScores'], 
                      parseInt(e.target.value) || 10
                    )}
                    inputProps={{ min: 8, max: 20 }}
                    helperText={formatModifier(getModifier(score))}
                    sx={{ width: 120 }}
                  />
                ))}
              </Box>
            </Box>

            {/* Submit Button */}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button 
                variant="contained" 
                size="large"
                onClick={handleSubmit}
              >
Continuar
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CharacterInput;