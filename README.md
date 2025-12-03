# PF2e Toolkit 🎲

**Ferramentas essenciais para jogadores e mestres de Pathfinder 2e Remaster**

Um sistema web moderno e modular que oferece diversas ferramentas para automatizar e melhorar a qualidade de vida nas mesas de RPG Pathfinder 2e.

## ✨ Características

- 🌙 **Dark Theme Moderno**: Interface elegante e minimalista
- 📱 **Responsivo**: Funciona perfeitamente em desktop e mobile
- 🧩 **Arquitetura Modular**: Fácil adição de novas funcionalidades
- ⚡ **Performance**: Construído com React 18 + TypeScript + Vite
- 🎨 **Material-UI**: Componentes modernos e acessíveis

## 🛠️ Ferramentas Disponíveis

### ✅ Gerador de Stat Block de Transformação
- Crie stat blocks detalhados para magias de transformação
- Suporte a múltiplas formas (Animal, Elemental, etc.)
- Cálculos automáticos de atributos
- Exportação em PDF/PNG
- Interface step-by-step intuitiva

### ✅ Ficha de Personagem (PDF)
- Gere uma ficha completa em PDF a partir de um arquivo JSON de personagem (formato Pathbuilder/semelhante)
- Inclui: atributos, perícias, equipamentos, armas, armaduras, dinheiro, feats, habilidades especiais, lores e magias
- Onde a descrição não existir no JSON, o PDF adiciona links clicáveis para busca na Archives of Nethys (AON)
- Como usar:
  1. Acesse o menu "Ficha de Personagem (PDF)"
  2. Clique em "Importar JSON" e selecione seu arquivo de personagem
  3. Clique em "Gerar PDF" para baixar
  4. Opcional: mova `character-example.json` para `public/` para usar o botão "Usar exemplo" durante o dev

### 🚧 Em Desenvolvimento
- Calculadora de Magias
- Gerador de Encontros
- Calculadora de Iniciativa

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ 
- Yarn ou npm

### Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd pf2e-tools

# Instale as dependências
yarn install
# ou
npm install

# Execute o servidor de desenvolvimento
yarn dev
# ou
npm run dev
```

O sistema estará disponível em `http://localhost:5173`

## 🏗️ Arquitetura

O projeto segue princípios de Clean Architecture e está organizado de forma modular:

```
src/
├── components/          # Componentes reutilizáveis
├── hooks/              # Custom hooks
├── layouts/            # Layouts da aplicação
├── modules/            # Módulos de funcionalidades
│   └── transformation-statblock/
├── pages/              # Páginas principais
├── services/           # Serviços e APIs
├── types/              # Definições TypeScript
├── utils/              # Utilitários
└── theme.ts            # Configuração do tema
```

## 🎯 Roadmap

- [ ] **Fase 1**: Gerador de Stat Block de Transformação
  - [x] Estrutura base e navegação
  - [x] Interface step-by-step
  - [ ] Seletor de magias com dados reais
  - [ ] Seletor de formas
  - [ ] Input de dados do personagem
  - [ ] Geração do stat block
  - [ ] Exportação PDF/PNG

- [ ] **Fase 1.5**: Ficha de Personagem (PDF)
  - [x] Upload de JSON e parsing
  - [x] Geração de PDF com layout simples
  - [x] Links clicáveis para descrições na AON
  - [ ] Busca e inclusão automática de descrições (quando possível)
  - [ ] Personalização de layout/estilo

- [ ] **Fase 2**: Calculadora de Magias
- [ ] **Fase 3**: Gerador de Encontros
- [ ] **Fase 4**: Calculadora de Iniciativa

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🙏 Agradecimentos

- Comunidade Pathfinder 2e
- [Archives of Nethys](https://2e.aonprd.com/) pela referência de dados
- [monster.pf2.tools](https://monster.pf2.tools) pela inspiração

---

**Desenvolvido com ❤️ para a comunidade Pathfinder 2e**
