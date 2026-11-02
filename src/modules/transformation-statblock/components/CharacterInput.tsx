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
import { playerCharacterFromJson } from '../data/from-pathbuilder';
import { CAMPAIGN_PRESETS, loadPresetJson, type CharacterPreset } from '../../character-viewer/campaignPresets';
import { usePublishedSheets } from '../../character-viewer/usePublishedSheets';
import { translateName, translateSpellMeta, translateTrait } from '../i18n';
import { tr } from '../../../i18n';

/** Colunas que se dobram sozinhas: uma no celular, quantas couberem depois. */
const FIELD_GRID = { xs: '1fr', sm: 'repeat(auto-fit, minmax(180px, 1fr))' };

interface CharacterInputProps {
  onCharacterInput: (character: PlayerCharacter, spell: TransformationSpell) => void;
  character?: PlayerCharacter;
  selectedSpell?: TransformationSpell | null;
}

const CharacterInput: React.FC<CharacterInputProps> = ({ onCharacterInput, character, selectedSpell }) => {
  const { levelOf } = usePublishedSheets();
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
  const [imported, setImported] = useState(false);

  const applyImportedCharacter = (json: unknown) => {
    try {
      const pc = playerCharacterFromJson(json);
      setFormData(pc);
      setImported(true);
      setErrors([]);
    } catch (e) {
      setImported(false);
      setErrors([e instanceof Error ? e.message : tr('Falha ao importar JSON', 'Failed to import JSON')]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyImportedCharacter(JSON.parse(String(reader.result)));
      } catch {
        setImported(false);
        setErrors([tr('Arquivo JSON inválido', 'Invalid JSON file')]);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePreset = async (preset: CharacterPreset) => {
    try {
      // A versão publicada pela mesa, se houver (ver `loadPresetJson`).
      const { json } = await loadPresetJson(preset);
      applyImportedCharacter(json);
    } catch {
      setImported(false);
      setErrors([tr('Não foi possível carregar o personagem da campanha', 'Couldn\'t load the campaign character')]);
    }
  };

  const clearImport = () => {
    setFormData({
      name: tr('Aventureiro', 'Adventurer'),
      level: 5,
      class: 'Druida',
      abilityScores: { strength: 12, dexterity: 14, constitution: 14, intelligence: 12, wisdom: 18, charisma: 10 },
      skills: {},
      proficiencyBonus: 3,
      classFeatures: [],
      equipment: [],
    });
    setImported(false);
    setErrors([]);
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.push(tr('Nome é obrigatório', 'Name is required'));
    }
    
    if (!formData.level || formData.level < 1 || formData.level > 20) {
      newErrors.push(tr('Nível deve estar entre 1 e 20', 'Level must be between 1 and 20'));
    }

    if (!currentSpell) {
      newErrors.push(tr('Selecione uma magia de transformação', 'Select a transformation spell'));
    }
    
    // Ability-score bounds only apply to manual entry; imported sheets carry
    // real scores that can exceed 20 at high levels.
    if (!imported) {
      if (!formData.abilityScores) {
        newErrors.push(tr('Atributos são obrigatórios', 'Attributes are required'));
      } else {
        Object.entries(formData.abilityScores).forEach(([attr, value]) => {
          if (value < 8 || value > 20) {
            newErrors.push(tr(`${attr} deve estar entre 8 e 20`, `${attr} must be between 8 and 20`));
          }
        });
      }
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
        {tr('Dados do Personagem', 'Character Data')}</Typography>
      
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {tr('Importe a ficha do personagem e escolha a magia de transformação. Sem import, preencha os dados manualmente (usa aproximações).', 'Import the character\'s sheet and choose the transformation spell. Without importing, fill in the data by hand (uses approximations).')}</Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      {/* Import from character sheet (Pathbuilder JSON) — fills real modifiers */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {tr('Importar Ficha', 'Import Sheet')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tr('Carregue um JSON do Pathbuilder 2e para usar HP, salvamentos, percepção, atletismo e ataque reais. Depois de importar, basta escolher a magia — os campos manuais somem. Qualquer personagem da campanha pode se transformar, não só conjuradores: a forma pode vir de pergaminho, varinha ou poção.', 'Load a Pathbuilder 2e JSON to use the real HP, saves, Perception, Athletics and attack. After importing, just pick the spell — the manual fields go away. Any campaign character can transform, not only casters: the form can come from a scroll, wand or potion.')}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {CAMPAIGN_PRESETS.map((preset) => (
              <Button
                key={preset.filename}
                variant="outlined"
                size="small"
                onClick={() => handlePreset(preset)}
              >
                {preset.name} (Nv {levelOf(preset)})
              </Button>
            ))}
            <Button variant="contained" size="small" component="label">
              {tr('Carregar JSON', 'Load JSON')}<input type="file" hidden accept="application/json,.json" onChange={handleFileUpload} />
            </Button>
            {imported && (
              <>
                <Chip label={tr("Ficha importada ✓", 'Sheet imported ✓')} color="success" size="small" />
                <Button variant="text" size="small" color="inherit" onClick={clearImport}>
                  {tr('Limpar', 'Clear')}</Button>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Stack spacing={3}>
            {/* Imported character summary (read-only) */}
            {imported && (
              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" gutterBottom>
                  {formData.name} — {formData.class} Nv {formData.level}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {formData.maxHP != null && <Chip size="small" label={`HP ${formData.maxHP}`} />}
                  {formData.perception != null && <Chip size="small" label={tr(`Perc ${formatModifier(formData.perception)}`, `Perc ${formatModifier(formData.perception)}`)} />}
                  {formData.saves && <Chip size="small" label={`Fort ${formatModifier(formData.saves.fortitude)}`} />}
                  {formData.saves && <Chip size="small" label={`Ref ${formatModifier(formData.saves.reflex)}`} />}
                  {formData.saves && <Chip size="small" label={`Will ${formatModifier(formData.saves.will)}`} />}
                  {formData.athletics != null && <Chip size="small" label={tr(`Atletismo ${formatModifier(formData.athletics)}`, `Athletics ${formatModifier(formData.athletics)}`)} />}
                  {formData.attackBonus != null && <Chip size="small" label={tr(`Ataque ${formatModifier(formData.attackBonus)}`, `Attack ${formatModifier(formData.attackBonus)}`)} />}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {tr('Valores reais da ficha. Para preencher à mão, use "Limpar" acima.', 'Real values from the sheet. To fill in by hand, use "Clear" above.')}</Typography>
              </Box>
            )}

            {/* Manual entry (fallback when no sheet is imported) */}
            {!imported && (
              <>
                {/* `minWidth` fixo estourava a caixa num celular; a grade
                    empilha sozinha quando não cabe mais uma coluna. */}
                <Box sx={{ display: 'grid', gridTemplateColumns: FIELD_GRID, gap: 2 }}>
                  <TextField
                    label={tr("Nome", 'Name')}
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />

                  <TextField
                    label={tr("Nível", 'Level')}
                    type="number"
                    value={formData.level || 1}
                    onChange={(e) => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                    inputProps={{ min: 1, max: 20 }}
                  />

                  <TextField
                    label="HP Base"
                    type="number"
                    value={formData.baseHP || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, baseHP: parseInt(e.target.value) || undefined }))}
                    inputProps={{ min: 1 }}
                    helperText={tr("Pontos de vida base do personagem", 'Character\'s base Hit Points')}
                  />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: FIELD_GRID, gap: 2 }}>
                  <FormControl>
                    <InputLabel>{tr('Classe', 'Class')}</InputLabel>
                    <Select
                      value={formData.class || ''}
                      label={tr("Classe", 'Class')}
                      onChange={(e) => setFormData(prev => ({ ...prev, class: e.target.value }))}
                    >
                      <MenuItem value="Druida">{tr('Druida', 'Druid')}</MenuItem>
                      <MenuItem value="Ranger">Ranger</MenuItem>
                      <MenuItem value="Mago">{tr('Mago', 'Wizard')}</MenuItem>
                      <MenuItem value="Feiticeiro">{tr('Feiticeiro', 'Sorcerer')}</MenuItem>
                      <MenuItem value={tr("Outro", 'Other')}>{tr('Outro', 'Other')}</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </>
            )}

            {/* Spell Selection */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {tr('Magia de Transformação', 'Transformation Spell')}</Typography>
              <FormControl fullWidth>
                <InputLabel>{tr('Selecionar Magia', 'Select Spell')}</InputLabel>
                <Select
                  value={currentSpell?.id || ''}
                  label={tr("Selecionar Magia", 'Select Spell')}
                  onChange={(e) => handleSpellChange(e.target.value)}
                >
                  {transformationSpells.map((spell) => (
                    <MenuItem key={spell.id} value={spell.id}>
                      {translateName(spell.name)} {tr('(Nível ', '(Rank ')}{spell.level})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {currentSpell && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {translateName(currentSpell.name)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {currentSpell.traditions.map((tradition) => (
                      <Chip key={tradition} label={translateTrait(tradition)} size="small" variant="outlined" />
                    ))}
                    <Chip label={tr(`Nível ${currentSpell.level}`, `Rank ${currentSpell.level}`)} size="small" color="secondary" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>{tr('Conjuração:', 'Casting:')}</strong> {translateSpellMeta(currentSpell.cast)} |
                    <strong> {tr('Alcance:', 'Range:')}</strong> {translateSpellMeta(currentSpell.range)} |
                    <strong> {tr('Duração:', 'Duration:')}</strong> {translateSpellMeta(currentSpell.duration)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>{tr('Formas Disponíveis:', 'Available Forms:')}</strong> {currentSpell.forms.length} {tr('opções', 'options')}</Typography>
                </Box>
              )}
            </Box>

            {/* Ability Scores (manual entry only) */}
            {!imported && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  {tr('Atributos', 'Attributes')}</Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                    gap: 2,
                  }}
                >
                  {formData.abilityScores && Object.entries(formData.abilityScores)
                    .filter(([ability]) => ability !== 'breakdown')
                    .map(([ability, score]) => (
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
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Submit Button */}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 200 } }}
              >
                {tr('Continuar', 'Continue')}</Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CharacterInput;