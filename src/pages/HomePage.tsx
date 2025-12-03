import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Container,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Transform as TransformIcon,
  AutoAwesome as MagicIcon,
  Speed as SpeedIcon,
  Security as ShieldIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface ToolCard {
  title: string;
  description: string;
  icon: React.ReactElement;
  path: string;
  status: 'available' | 'coming-soon' | 'beta';
  features: string[];
}

const tools: ToolCard[] = [
  {
    title: 'Gerador de Stat Block de Transformação',
    description: 'Crie stat blocks detalhados para personagens transformados por magias como Forma Animal, Forma Elemental e outras magias de transformação do Pathfinder 2e Remaster.',
    icon: <TransformIcon sx={{ fontSize: 40 }} />,
    path: '/transformation',
    status: 'available',
    features: [
      'Suporte a múltiplas formas',
      'Cálculos automáticos de atributos',
      'Exportação em PDF/PNG',
      'Interface intuitiva',
    ],
  },
  {
    title: 'Ficha de Personagem (PDF)',
    description: 'Importe um JSON de personagem e gere uma ficha completa em PDF com atributos, perícias, equipamentos, armas, armaduras, feats, habilidades especiais e magias.',
    icon: <TransformIcon sx={{ fontSize: 40 }} />,
    path: '/character-sheet',
    status: 'available',
    features: [
      'Upload de JSON',
      'Links para descrições na AON',
      'Layout simples e intuitivo',
      'Download imediato',
    ],
  },
  {
    title: 'Calculadora de Magias',
    description: 'Ferramenta para calcular dano, duração e efeitos de magias com base no nível do conjurador e modificadores.',
    icon: <MagicIcon sx={{ fontSize: 40 }} />,
    path: '/spells',
    status: 'coming-soon',
    features: [
      'Cálculo de dano por nível',
      'Efeitos de heightening',
      'Base de dados de magias',
      'Comparação de magias',
    ],
  },
  {
    title: 'Gerador de Encontros',
    description: 'Crie encontros balanceados automaticamente com base no nível do grupo e dificuldade desejada.',
    icon: <ShieldIcon sx={{ fontSize: 40 }} />,
    path: '/encounters',
    status: 'coming-soon',
    features: [
      'Balanceamento automático',
      'Filtros por tipo de criatura',
      'Cálculo de XP',
      'Sugestões de terreno',
    ],
  },
  {
    title: 'Calculadora de Iniciativa',
    description: 'Gerencie a ordem de iniciativa em combates com recursos avançados para mestres.',
    icon: <SpeedIcon sx={{ fontSize: 40 }} />,
    path: '/initiative',
    status: 'coming-soon',
    features: [
      'Rastreamento de HP',
      'Efeitos temporários',
      'Timer de rodadas',
      'Notas de combate',
    ],
  },
];

const getStatusColor = (status: ToolCard['status']) => {
  switch (status) {
    case 'available':
      return 'success';
    case 'beta':
      return 'warning';
    case 'coming-soon':
      return 'default';
    default:
      return 'default';
  }
};

const getStatusText = (status: ToolCard['status']) => {
  switch (status) {
    case 'available':
      return 'Disponível';
    case 'beta':
      return 'Beta';
    case 'coming-soon':
      return 'Em Breve';
    default:
      return 'Desconhecido';
  }
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const handleToolClick = (path: string, status: ToolCard['status']) => {
    if (status === 'available') {
      navigate(path);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 6 }}>
        <Typography
          variant="h2"
          component="h1"
          gutterBottom
          sx={{
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700,
            textAlign: 'center',
            mb: 2,
          }}
        >
          PF2e Toolkit
        </Typography>
        
        <Typography
          variant="h5"
          component="h2"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: 4, fontWeight: 300 }}
        >
          Ferramentas essenciais para jogadores e mestres de Pathfinder 2e Remaster
        </Typography>
        
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap',
            mb: 4,
          }}
        >
          <Chip
            label="Código Aberto"
            color="primary"
            variant="outlined"
          />
          <Chip
            label="Interface Moderna"
            color="secondary"
            variant="outlined"
          />
          <Chip
            label="Sempre Atualizado"
            color="primary"
            variant="outlined"
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 3,
        }}
      >
        {tools.map((tool, index) => (
          <Box key={index}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease-in-out',
                cursor: tool.status === 'available' ? 'pointer' : 'default',
                opacity: tool.status === 'coming-soon' ? 0.7 : 1,
                '&:hover': tool.status === 'available' ? {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                } : {},
              }}
              onClick={() => handleToolClick(tool.path, tool.status)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      color: theme.palette.primary.main,
                      mr: 2,
                    }}
                  >
                    {tool.icon}
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3" gutterBottom>
                      {tool.title}
                    </Typography>
                    <Chip
                      label={getStatusText(tool.status)}
                      color={getStatusColor(tool.status)}
                      size="small"
                    />
                  </Box>
                </Box>
                
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2, lineHeight: 1.6 }}
                >
                  {tool.description}
                </Typography>
                
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Recursos:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {tool.features.map((feature, featureIndex) => (
                      <Chip
                        key={featureIndex}
                        label={feature}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              </CardContent>
              
              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  variant={tool.status === 'available' ? 'contained' : 'outlined'}
                  disabled={tool.status === 'coming-soon'}
                  fullWidth
                  sx={{ fontWeight: 500 }}
                >
                  {tool.status === 'available' ? 'Usar Ferramenta' : 'Em Desenvolvimento'}
                </Button>
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>
      
      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Desenvolvido com ❤️ para a comunidade Pathfinder 2e
        </Typography>
      </Box>
    </Container>
  );
};
