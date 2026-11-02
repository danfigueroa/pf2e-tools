import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  Alert
} from '@mui/material';
import type { TransformationSpell, TransformationForm } from '../../../types';
import { translateName, translateSize, translateAttackName, translateDamageString, translateTrait } from '../i18n';
import { tr } from '../../../i18n';

interface FormSelectorProps {
  selectedSpell: TransformationSpell | null;
  selectedForm: TransformationForm | null;
  onFormChange: (form: TransformationForm | null) => void;
}

export const FormSelector: React.FC<FormSelectorProps> = ({
  selectedSpell,
  selectedForm,
  onFormChange
}) => {
  if (!selectedSpell) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {tr('Seleção de Forma', 'Form Selection')}</Typography>
          <Alert severity="info">
            {tr('Selecione uma magia primeiro para ver as formas disponíveis.', 'Select a spell first to see the available forms.')}</Alert>
        </CardContent>
      </Card>
    );
  }

  const formatSpeed = (speed: TransformationForm['speed']) => {
    const speeds = [];
    if (speed.land) speeds.push(tr(`${speed.land} pés`, `${speed.land} feet`));
    if (speed.fly) speeds.push(tr(`voo ${speed.fly} pés`, `fly ${speed.fly} feet`));
    if (speed.swim) speeds.push(tr(`natação ${speed.swim} pés`, `swim ${speed.swim} feet`));
    if (speed.climb) speeds.push(tr(`escalada ${speed.climb} pés`, `climb ${speed.climb} feet`));
    if (speed.burrow) speeds.push(tr(`escavação ${speed.burrow} pés`, `burrow ${speed.burrow} feet`));
    return speeds.join(', ');
  };

  const formatAttacks = (attacks: TransformationForm['attacks']) => {
    return attacks.map(attack => {
      const traits = attack.traits && attack.traits.length > 0
        ? ` (${attack.traits.map(translateTrait).join(', ')})`
        : '';
      return `${translateAttackName(attack.name)}${traits}: ${translateDamageString(attack.damage)}`;
    }).join('; ');
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {tr('Seleção de Forma', 'Form Selection')}</Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {tr('Escolha uma das formas disponíveis para a magia ', 'Choose one of the available forms for the spell ')}{translateName(selectedSpell.name)}:
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {selectedSpell.forms.map((form) => (
            <Box key={form.id}>
              <Card 
                variant={selectedForm?.id === form.id ? "elevation" : "outlined"}
                sx={{ 
                  cursor: 'pointer',
                  border: selectedForm?.id === form.id ? 2 : 1,
                  borderColor: selectedForm?.id === form.id ? 'primary.main' : 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    elevation: 2
                  }
                }}
                onClick={() => onFormChange(form)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6">
                      {translateName(form.name)}
                    </Typography>
                    <Chip label={translateSize(form.size)} size="small" />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>{tr('Velocidade:', 'Speed:')}</strong> {formatSpeed(form.speed)}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>{tr('Ataques:', 'Attacks:')}</strong> {formatAttacks(form.attacks)}
                  </Typography>
                  
                  {form.senses && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>{tr('Sentidos:', 'Senses:')}</strong>
                      {form.senses.lowLightVision && tr(' visão na penumbra', ' low-light vision')}
                      {form.senses.scent && tr(` olfato ${form.senses.scent} pés (impreciso)`, ` scent ${form.senses.scent} feet (imprecise)`)}
                      {form.senses.darkvision && tr(` visão no escuro ${form.senses.darkvision} pés`, ` darkvision ${form.senses.darkvision} feet`)}
                      {form.senses.tremorsense && tr(` sentido sísmico ${form.senses.tremorsense} pés`, ` tremorsense ${form.senses.tremorsense} feet`)}
                    </Typography>
                  )}

                  {selectedForm?.id === form.id && (
                    <Box sx={{ mt: 2 }}>
                      <Chip label={tr("Selecionado", 'Selected')} color="primary" size="small" />
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
        
        {selectedForm && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom>
              {tr('Forma Selecionada: ', 'Selected Form: ')}{translateName(selectedForm.name)}
            </Typography>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={() => onFormChange(null)}
            >
              {tr('Limpar Seleção', 'Clear Selection')}</Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};