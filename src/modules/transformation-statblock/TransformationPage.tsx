import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  useTheme,
} from '@mui/material';
import type { TransformationConfig, PlayerCharacter, TransformationSpell } from '../../types';
import { FormSelector } from './components/FormSelector';
import StatBlockGenerator from './components/StatBlockGenerator';
import CharacterInput from './components/CharacterInput';
import ExportOptions from './components/ExportOptions';

// Temporary placeholder components for steps not yet implemented
interface StatBlockPreviewProps {
  config: TransformationConfig;
  onNext: () => void;
}

const StatBlockPreview: React.FC<StatBlockPreviewProps> = ({ config, onNext }) => (
  <Box>
    <StatBlockGenerator
      spell={config.spell}
      form={config.selectedForm!}
      casterLevel={config.casterLevel}
      character={config.character}
    />
    <Box sx={{ textAlign: 'center', mt: 3 }}>
      <Button variant="contained" onClick={onNext}>Continuar para Exportação</Button>
    </Box>
  </Box>
);



const steps = [
  'Dados do Personagem',
  'Escolher Forma',
  'Visualizar Stat Block',
  'Exportar',
];

export const TransformationPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [config, setConfig] = useState<Partial<TransformationConfig>>({});
  const theme = useTheme();

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Navigation handlers

  const handleCharacterInput = (character: PlayerCharacter, spell: TransformationSpell) => {
    setConfig((prev: Partial<TransformationConfig>) => ({ ...prev, character, spell }));
    handleNext();
  };

  const handleNextStep = () => {
    handleNext();
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!config.character && !!config.spell;
      case 1:
        return !!config.selectedForm;
      case 2:
        return true; // Preview step is always "complete"
      case 3:
        return true; // Export step is always "complete"
      default:
        return false;
    }
  };

  const canProceed = isStepComplete(activeStep);

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <CharacterInput
            onCharacterInput={handleCharacterInput}
            character={config.character}
            selectedSpell={config.spell}
          />
        );
      case 1:
        return (
          <FormSelector
            selectedSpell={config.spell!}
            selectedForm={config.selectedForm || null}
            onFormChange={(form) => setConfig((prev: Partial<TransformationConfig>) => ({ ...prev, selectedForm: form || undefined }))}
          />
        );
      case 2:
        return (
          <StatBlockPreview
            config={config as TransformationConfig}
            onNext={handleNextStep}
          />
        );
      case 3:
        return (
          <ExportOptions
            config={config as TransformationConfig}
          />
        );
      default:
        return <Typography>Passo desconhecido</Typography>;
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          Gerador de Stat Block de Transformação
        </Typography>
        
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: 4, fontWeight: 300 }}
        >
          Crie stat blocks detalhados para magias de transformação do Pathfinder 2e Remaster
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label, index) => (
            <Step key={label} completed={isStepComplete(index)}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      <Paper sx={{ p: 4, minHeight: 400 }}>
        {renderStepContent(activeStep)}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            variant="outlined"
          >
            Voltar
          </Button>
          
          {activeStep < steps.length - 1 && (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceed}
            >
              Próximo
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};