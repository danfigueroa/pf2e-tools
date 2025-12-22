import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Container,
  useTheme,
} from '@mui/material';
import {
  Description as SheetIcon,
  Transform as TransformIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface ToolCard {
  title: string;
  description: string;
  icon: React.ReactElement;
  path: string;
  features: string[];
}

const tools: ToolCard[] = [
  {
    title: 'Ficha de Personagem',
    description: 'Importe um JSON de personagem (Pathbuilder/Wanderer\'s Guide) e gere uma ficha completa em PDF com todos os detalhes do seu personagem.',
    icon: <SheetIcon sx={{ fontSize: 32 }} />,
    path: '/character-sheet',
    features: [
      'Atributos e perícias',
      'Ataques e armadura',
      'Talentos com descrições',
      'Magias detalhadas',
    ],
  },
  {
    title: 'Stat Block de Transformação',
    description: 'Gere stat blocks para magias de transformação como Forma Animal, Forma Elemental e outras do Pathfinder 2e Remaster.',
    icon: <TransformIcon sx={{ fontSize: 32 }} />,
    path: '/transformation',
    features: [
      'Múltiplas formas',
      'Cálculos automáticos',
      'Exportação PDF/PNG',
      'Fácil de usar',
    ],
  },
];

export const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Container maxWidth="md">
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6, pt: 2 }}>
        <Typography
          variant="h1"
          component="h1"
          sx={{
            color: theme.palette.primary.main,
            fontWeight: 700,
            mb: 1.5,
          }}
        >
          PF2e Tools
        </Typography>
        
        <Typography
          variant="h4"
          component="p"
          sx={{ 
            color: 'text.secondary',
            fontWeight: 400,
            maxWidth: 500,
            mx: 'auto',
          }}
        >
          Ferramentas para Pathfinder 2e Remaster
        </Typography>
      </Box>

      {/* Tools Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 3,
        }}
      >
        {tools.map((tool) => (
          <Card
            key={tool.path}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: theme.palette.primary.light,
              },
            }}
            onClick={() => navigate(tool.path)}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              {/* Icon + Title */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1.5 }}>
                <Box
                  sx={{
                    color: theme.palette.primary.main,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {tool.icon}
                </Box>
                <Typography variant="h3" component="h2">
                  {tool.title}
                </Typography>
              </Box>
              
              {/* Description */}
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 2.5, lineHeight: 1.6 }}
              >
                {tool.description}
              </Typography>
              
              {/* Features */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {tool.features.map((feature) => (
                  <Typography
                    key={feature}
                    variant="body2"
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      bgcolor: 'rgba(20, 184, 166, 0.1)',
                      border: '1px solid rgba(20, 184, 166, 0.2)',
                      borderRadius: 1,
                      color: 'primary.light',
                      fontSize: '0.8rem',
                    }}
                  >
                    {feature}
                  </Typography>
                ))}
              </Box>
            </CardContent>
            
            <CardActions sx={{ p: 3, pt: 0 }}>
              <Button
                variant="contained"
                fullWidth
                endIcon={<ArrowIcon />}
                sx={{ py: 1.25 }}
              >
                Acessar
              </Button>
            </CardActions>
          </Card>
        ))}
      </Box>
      
      {/* Footer */}
      <Box sx={{ mt: 6, textAlign: 'center', pb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Feito para a comunidade Pathfinder 2e
        </Typography>
      </Box>
    </Container>
  );
};
