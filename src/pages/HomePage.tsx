import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Container,
} from '@mui/material';
import {
  // Description as SheetIcon, // desativado junto com a Ficha em PDF
  PhoneIphone as ViewerIcon,
  FormatListNumbered as InitiativeIcon,
  Transform as TransformIcon,
  Whatshot as ScalerIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { green, gold, parchment } from '../theme';

interface ToolCard {
  title: string;
  description: string;
  icon: React.ReactElement;
  path: string;
  features: string[];
}

const tools: ToolCard[] = [
  {
    title: 'Ficha Virtual',
    description: 'Visualização interativa da ficha em qualquer dispositivo. Toque em talentos, magias e habilidades para ver as descrições completas em português, traduzidas do Archives of Nethys.',
    icon: <ViewerIcon sx={{ fontSize: 32 }} />,
    path: '/ficha-virtual',
    features: [
      'Mobile, tablet e desktop',
      'Descrições sob demanda',
      'Magias e talentos clicáveis',
      'Cache local',
    ],
  },
  {
    title: 'Iniciativa',
    description: 'Gerencie o combate na mesa: monte o encontro com os personagens da campanha e monstros da AON, siga a ordem de turnos e aplique dano, cura e condições em vários alvos de uma vez.',
    icon: <InitiativeIcon sx={{ fontSize: 32 }} />,
    path: '/iniciativa',
    features: [
      'Ordem de iniciativa',
      'Dano em área com salvaguarda',
      'Condições com duração',
      'Monstros da AON',
    ],
  },
  // Desativado — Ficha em PDF (ver App.tsx).
  // {
  //   title: 'Ficha em PDF',
  //   description: 'Importe um JSON de personagem (Pathbuilder/Wanderer\'s Guide) e gere uma ficha completa em PDF com todos os detalhes do seu personagem.',
  //   icon: <SheetIcon sx={{ fontSize: 32 }} />,
  //   path: '/character-sheet',
  //   features: [
  //     'Atributos e perícias',
  //     'Ataques e armadura',
  //     'Talentos com descrições',
  //     'Magias detalhadas',
  //   ],
  // },
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
  {
    title: 'Escalar Monstro',
    description: 'Pegue a ficha de qualquer criatura do Archives of Nethys e adapte para o nível que a sua mesa precisa, pelas tabelas do GM Core.',
    icon: <ScalerIcon sx={{ fontSize: 32 }} />,
    path: '/escalar-monstro',
    features: [
      'Busca no Archives of Nethys',
      'Tabelas do GM Core',
      'Ajuste fino por estatística',
      'Exportação PNG',
    ],
  },
];

export const HomePage = () => {
  const navigate = useNavigate();

  // Sem gutters: o MainLayout já dá a margem, e no celular a soma das duas
  // comia 32px de cada lado.
  return (
    <Container maxWidth="md" disableGutters>
      {/* Cabeçalho */}
      <Box sx={{ textAlign: 'center', mb: { xs: 4, sm: 6 }, pt: 2 }}>
        <Typography
          variant="h1"
          component="h1"
          sx={{ color: green.main, mb: 1.5 }}
        >
          PF2e Tools
        </Typography>

        {/* Filete dourado, como os cabeçalhos dos livros */}
        <Box
          sx={{
            width: { xs: 120, sm: 180 },
            height: 2,
            mx: 'auto',
            mb: 2,
            backgroundColor: gold.main,
          }}
        />

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

      {/* Grade de ferramentas */}
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
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
              },
            }}
            onClick={() => navigate(tool.path)}
          >
            {/* Cabeçalho em barra verde com filete ouro */}
            <Box
              sx={{
                backgroundColor: green.main,
                borderBottom: `2px solid ${gold.main}`,
                color: parchment.page,
                px: 2.5,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Box sx={{ color: gold.bright, display: 'flex', alignItems: 'center' }}>
                {tool.icon}
              </Box>
              <Typography variant="h3" component="h2" sx={{ fontSize: '1.15rem' }}>
                {tool.title}
              </Typography>
            </Box>

            <CardContent sx={{ flexGrow: 1, p: { xs: 2.5, sm: 3 } }}>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 2.5, lineHeight: 1.6 }}
              >
                {tool.description}
              </Typography>

              {/* Etiquetas de recurso */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {tool.features.map((feature) => (
                  <Typography
                    key={feature}
                    variant="body2"
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      bgcolor: 'rgba(27, 59, 42, 0.07)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      color: green.main,
                      fontWeight: 600,
                      fontSize: '0.8rem',
                    }}
                  >
                    {feature}
                  </Typography>
                ))}
              </Box>
            </CardContent>

            <CardActions sx={{ p: { xs: 2.5, sm: 3 }, pt: 0 }}>
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

      {/* Rodapé */}
      <Box sx={{ mt: { xs: 4, sm: 6 }, textAlign: 'center', pb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Feito para a comunidade Pathfinder 2e
        </Typography>
      </Box>
    </Container>
  );
};
