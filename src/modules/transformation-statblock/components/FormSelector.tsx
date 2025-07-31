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
            Seleção de Forma
          </Typography>
          <Alert severity="info">
            Selecione uma magia primeiro para ver as formas disponíveis.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const formatSpeed = (speed: TransformationForm['speed']) => {
    const speeds = [];
    if (speed.land) speeds.push(`${speed.land} pés`);
    if (speed.fly) speeds.push(`voo ${speed.fly} pés`);
    if (speed.swim) speeds.push(`natação ${speed.swim} pés`);
    if (speed.climb) speeds.push(`escalada ${speed.climb} pés`);
    if (speed.burrow) speeds.push(`escavação ${speed.burrow} pés`);
    return speeds.join(', ');
  };

  const formatAttacks = (attacks: TransformationForm['attacks']) => {
    return attacks.map(attack => {
      const traits = attack.traits && attack.traits.length > 0 
        ? ` (${attack.traits.join(', ')})` 
        : '';
      return `${attack.name}${traits}: ${attack.damage}`;
    }).join('; ');
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Seleção de Forma
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Escolha uma das formas disponíveis para a magia {selectedSpell.name}:
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
                      {form.name}
                    </Typography>
                    <Chip label={form.size} size="small" />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Velocidade:</strong> {formatSpeed(form.speed)}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Ataques:</strong> {formatAttacks(form.attacks)}
                  </Typography>
                  
                  {form.senses && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Sentidos:</strong> 
                      {form.senses.lowLightVision && ' Visão na penumbra'}
                      {form.senses.scent && ` Faro ${form.senses.scent} pés (impreciso)`}
                      {form.senses.darkvision && ` Visão no escuro ${form.senses.darkvision} pés`}
                    </Typography>
                  )}
                  
                  <Typography variant="caption" color="text.secondary">
                    {form.description}
                  </Typography>
                  
                  {selectedForm?.id === form.id && (
                    <Box sx={{ mt: 2 }}>
                      <Chip label="Selecionado" color="primary" size="small" />
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
              Forma Selecionada: {selectedForm.name}
            </Typography>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={() => onFormChange(null)}
            >
              Limpar Seleção
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};