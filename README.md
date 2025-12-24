# PF2e Toolkit 🎲

**Ferramentas essenciais para jogadores e mestres de Pathfinder 2e Remaster**

Um sistema web moderno e modular que oferece diversas ferramentas para automatizar e melhorar a qualidade de vida nas mesas de RPG Pathfinder 2e.

---

## 📖 Índice

-   [Sobre o Projeto](#-sobre-o-projeto)
-   [Funcionalidades](#-funcionalidades)
-   [Stack Tecnológica](#-stack-tecnológica)
-   [Instalação e Execução](#-instalação-e-execução)
-   [Arquitetura do Projeto](#-arquitetura-do-projeto)
-   [Módulos Detalhados](#-módulos-detalhados)
-   [API do Servidor](#-api-do-servidor)
-   [Formato de Dados](#-formato-de-dados)
-   [Roadmap](#-roadmap)
-   [Contribuindo](#-contribuindo)
-   [Contexto para IA](#-contexto-para-ia)

---

## 🎯 Sobre o Projeto

O **PF2e Toolkit** é uma aplicação web projetada para auxiliar jogadores e mestres de **Pathfinder 2nd Edition (Remaster)**. O sistema oferece ferramentas que automatizam cálculos, geram documentos e facilitam a gestão de personagens e encontros.

### Principais Objetivos

1. **Automatização**: Eliminar cálculos manuais repetitivos
2. **Qualidade de Vida**: Fornecer documentos prontos para impressão
3. **Referência Rápida**: Integração com Archives of Nethys (AON)
4. **Modularidade**: Arquitetura que permite fácil adição de novas ferramentas

---

## ✨ Funcionalidades

### ✅ Ficha de Personagem em PDF (Implementado)

Gera uma ficha de personagem completa, profissional e pronta para impressão.

**Características:**

-   📄 Layout moderno, limpo e **print-friendly** (preto, cinza e branco)
-   🔗 Links clicáveis para a Archives of Nethys em cada item
-   📊 Exibição de bônus finais + bônus míticos para perícias e salvamentos
-   ⚔️ Seção detalhada de ataques com armas (nome completo, bônus, dano, traits)
-   🧙 Seção completa de magias com:
    -   Número de ações (1 ação, 2 ações, reação, etc.)
    -   Traits da magia
    -   Alcance, área, alvos, duração, defesa
    -   Dano base e tipo
    -   Informações de Heightened
    -   Descrição resumida
-   📚 Talentos (Feats) com nome e descrição
-   ⭐ Habilidades Especiais com nome e descrição
-   🎒 Equipamentos, armaduras e dinheiro
-   📖 Conhecimentos (Lores) com bônus calculados

### ✅ Gerador de Stat Block de Transformação (Parcialmente Implementado)

Cria stat blocks para magias de transformação como _Animal Form_, _Elemental Form_, etc.

**Características:**

-   Interface step-by-step
-   Suporte a múltiplas formas
-   Exportação em PDF/PNG

### 🚧 Em Desenvolvimento

-   Calculadora de Magias
-   Gerador de Encontros
-   Calculadora de Iniciativa

---

## 🛠️ Stack Tecnológica

### Frontend

| Tecnologia        | Versão | Uso                     |
| ----------------- | ------ | ----------------------- |
| React             | 18.x   | Framework UI            |
| TypeScript        | 5.x    | Tipagem estática        |
| Vite              | 5.x    | Build tool e dev server |
| Material-UI (MUI) | 5.x    | Componentes de UI       |
| jsPDF             | 2.x    | Geração de PDFs         |
| React Router      | 6.x    | Roteamento SPA          |

### Backend (Servidor de Scraping)

| Tecnologia  | Uso                 |
| ----------- | ------------------- |
| Node.js     | Runtime             |
| Cheerio     | Web scraping da AON |
| HTTP nativo | Servidor de API     |

### Ferramentas de Desenvolvimento

-   ESLint (linting)
-   Prettier (formatação)
-   Yarn/npm (gerenciamento de pacotes)

---

## 🚀 Instalação e Execução

### Pré-requisitos

-   **Node.js** 18+
-   **Yarn** ou **npm**

### Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd pf2e-tools

# Instale as dependências
yarn install
# ou
npm install
```

### Modos de Execução

#### Desenvolvimento (Frontend apenas)

```bash
yarn dev
# ou
npm run dev
```

-   Acesse: `http://localhost:5173`
-   Usa dados pré-carregados no JSON de exemplo

#### Desenvolvimento Completo (Frontend + API)

```bash
yarn dev:full
# ou
npm run dev:full
```

-   Frontend: `http://localhost:5173`
-   API: `http://localhost:3001`
-   Busca descrições automaticamente da Archives of Nethys

#### Build de Produção

```bash
yarn build
yarn preview
```

### 🚀 Deploy na Vercel (Gratuito)

O projeto está configurado para deploy automático na Vercel.

#### Passo a Passo

1. **Crie uma conta na Vercel**

    - Acesse [vercel.com](https://vercel.com) e faça login com GitHub

2. **Importe o repositório**

    - Clique em "New Project"
    - Selecione o repositório `pf2e-tools`
    - A Vercel detectará automaticamente as configurações do Vite

3. **Configure as variáveis de ambiente**

    - Vá em "Settings" > "Environment Variables"
    - Adicione: `GROQ_API_KEY` = `sua_chave_groq`
    - Obtenha a chave gratuitamente em: [console.groq.com/keys](https://console.groq.com/keys)

4. **Deploy**
    - Clique em "Deploy"
    - Aguarde o build finalizar
    - Seu app estará disponível em `https://seu-projeto.vercel.app`

#### Estrutura de API Serverless

```
api/
├── _lib/
│   └── aon.js          # Funções compartilhadas (busca AON, tradução)
├── health.js           # GET /api/health
├── feat.js             # GET /api/feat?name=...
├── search.js           # GET /api/search?name=...&category=...
├── spell.js            # GET /api/spell?name=...
└── clear-cache.js      # POST /api/clear-cache
```

---

## 🏗️ Arquitetura do Projeto

```
pf2e-tools/
├── api/                          # Serverless Functions (Vercel)
│   ├── _lib/aon.js               # Funções compartilhadas
│   ├── health.js                 # Health check
│   ├── feat.js                   # Busca talentos
│   ├── search.js                 # Busca genérica
│   ├── spell.js                  # Busca magias
│   └── clear-cache.js            # Limpa cache
├── public/
│   └── character-example.json    # Exemplo de personagem para testes
├── server/
│   └── index.mjs                 # Servidor de API local (desenvolvimento)
├── src/
│   ├── components/               # Componentes reutilizáveis
│   ├── hooks/                    # Custom React hooks
│   ├── layouts/
│   │   └── MainLayout.tsx        # Layout principal com navegação
│   ├── modules/
│   │   ├── character-sheet/      # Módulo de Ficha de Personagem
│   │   │   ├── CharacterSheetPage.tsx  # Página principal
│   │   │   ├── pdf.ts                  # Geração do PDF
│   │   │   └── types.ts                # Interfaces TypeScript
│   │   └── transformation-statblock/   # Módulo de Stat Blocks
│   │       ├── TransformationPage.tsx
│   │       ├── components/
│   │       └── data/
│   ├── pages/
│   │   └── HomePage.tsx          # Página inicial
│   ├── services/                 # Serviços e integrações
│   ├── types/
│   │   └── index.ts              # Tipos globais
│   ├── utils/                    # Funções utilitárias
│   ├── App.tsx                   # Componente raiz
│   ├── main.tsx                  # Entry point
│   └── theme.ts                  # Configuração do tema MUI
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Padrões de Projeto

1. **Arquitetura Modular**: Cada funcionalidade é um módulo independente em `src/modules/`
2. **Separação de Responsabilidades**:
    - `*Page.tsx` = UI e estado
    - `pdf.ts` = lógica de geração
    - `types.ts` = definições de tipos
3. **Componentes Reutilizáveis**: Em `src/components/`
4. **Tipagem Forte**: TypeScript em todo o projeto

---

## 📦 Módulos Detalhados

### Módulo: Character Sheet (Ficha de Personagem)

**Localização:** `src/modules/character-sheet/`

#### Arquivos

| Arquivo                  | Responsabilidade                                                             |
| ------------------------ | ---------------------------------------------------------------------------- |
| `CharacterSheetPage.tsx` | UI, upload de JSON, enriquecimento de dados, preview                         |
| `pdf.ts`                 | Geração completa do PDF usando jsPDF                                         |
| `types.ts`               | Interfaces `BuildInfo`, `Weapon`, `Armor`, `SpellCaster`, `SpellDescription` |

#### Fluxo de Dados

```
1. Usuário faz upload do JSON
   ↓
2. parseCharacterJson() converte para BuildInfo
   ↓
3. enrichDescriptions() busca descrições da API:
   - enrichFeatDescriptions() → /api/feat
   - enrichSpecialDescriptions() → /api/search
   - enrichSpellDescriptions() → /api/spell
   ↓
4. generateCharacterPdf() cria o PDF:
   - Cabeçalho (nome, classe, nível)
   - Atributos (grid 3x2)
   - Defesas (CA, Salvamentos)
   - Percepção
   - Ataques (armas)
   - Perícias (4 colunas)
   - Habilidades Especiais
   - Talentos (Feats)
   - Conhecimentos (Lores)
   - Armadura e Equipamentos
   - Magias (por spellcaster)
   - Magias de Foco
   ↓
5. PDF baixado automaticamente
```

#### Interfaces Principais

```typescript
interface BuildInfo {
    name: string
    class: string
    level: number
    ancestry: string
    heritage: string
    background: string
    alignment?: string
    deity?: string
    sizeName: string
    keyability: string
    languages: string[]
    abilities: {
        str: number
        dex: number
        con: number
        int: number
        wis: number
        cha: number
    }
    proficiencies: { [key: string]: number }
    feats: any[]
    featDescriptions?: Record<string, string>
    specials: string[]
    specialDescriptions?: Record<string, string>
    spellDescriptions?: Record<string, SpellDescription>
    lores: [string, number][]
    equipment: [string, number, string?][]
    weapons: Weapon[]
    armor: Armor[]
    money: { pp: number; gp: number; sp: number; cp: number }
    spellCasters: SpellCaster[]
    focus?: Record<string, any>
    focusPoints?: number
    acTotal?: {
        acProfBonus: number
        acAbilityBonus: number
        acItemBonus: number
        acTotal: number
        shieldBonus?: number
    }
}

interface SpellDescription {
    name: string
    actions?: string // "1", "2", "3", "reaction", "free", "1 to 3"
    traits?: string[] // ["divine", "healing", "vitality"]
    range?: string // "30 feet", "touch"
    area?: string // "15-foot emanation"
    targets?: string // "1 creature"
    duration?: string // "1 minute"
    defense?: string // "basic Fortitude"
    description: string
    damage?: string // "1d8"
    damageType?: string // "vitality", "fire"
    heightened?: Record<string, string>
}
```

---

## 🌐 API do Servidor

O servidor (`server/index.mjs`) fornece endpoints para buscar dados da Archives of Nethys.

### Endpoints

| Método | Rota          | Parâmetros | Descrição                                    |
| ------ | ------------- | ---------- | -------------------------------------------- |
| GET    | `/api/feat`   | `name`     | Busca descrição de um Feat                   |
| GET    | `/api/search` | `name`     | Busca descrição genérica (Special Abilities) |
| GET    | `/api/spell`  | `name`     | Busca informações detalhadas de uma magia    |

### Exemplo de Resposta `/api/spell`

```json
{
    "name": "Heal",
    "actions": "1 to 3",
    "traits": ["concentrate", "divine", "healing", "manipulate", "vitality"],
    "range": "varies",
    "targets": "1 willing living creature or 1 undead",
    "damage": "1d8",
    "damageType": "vitality",
    "description": "Você canaliza energia positiva para curar os vivos...",
    "heightened": {
        "+1": "A quantidade curada aumenta em 1d8"
    }
}
```

### Cache

O servidor mantém um cache em memória para evitar requisições repetidas à AON.

---

## 📋 Formato de Dados

### JSON de Personagem

O sistema aceita JSONs no formato **Pathbuilder 2e** ou similar. Estrutura esperada:

```json
{
    "success": true,
    "build": {
        "name": "Nome do Personagem",
        "class": "Cleric",
        "level": 8,
        "ancestry": "Android",
        "heritage": "Polyglot Android",
        "background": "Detective",
        "abilities": {
            "str": 10,
            "dex": 14,
            "con": 14,
            "int": 16,
            "wis": 19,
            "cha": 12
        },
        "proficiencies": {
            "fortitude": 4,
            "reflex": 2,
            "will": 4,
            "perception": 4,
            "acrobatics": 0,
            "...": "..."
        },
        "feats": [["Feat Name", null, "Class", 1], "..."],
        "specials": ["Special Ability 1", "Special Ability 2"],
        "lores": [["Ancient Regional", 4]],
        "weapons": [
            {
                "name": "Longsword",
                "display": "+2 Striking Longsword",
                "die": "d8",
                "pot": 2,
                "str": "striking",
                "damageType": "S",
                "attack": 14,
                "damageBonus": 3
            }
        ],
        "spellCasters": [
            {
                "name": "Cleric",
                "magicTradition": "divine",
                "spellcastingType": "prepared",
                "ability": "wis",
                "proficiency": 4,
                "perDay": [5, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
                "spells": [
                    {
                        "spellLevel": 0,
                        "list": ["Detect Magic", "Guidance", "Shield"]
                    },
                    { "spellLevel": 1, "list": ["Bless", "Fear", "Heal"] }
                ]
            }
        ],
        "featDescriptions": { "Feat Name": "Descrição do feat..." },
        "specialDescriptions": { "Special Ability": "Descrição..." },
        "spellDescriptions": { "Heal": { "...": "..." } }
    }
}
```

### Campos Opcionais Pré-preenchidos

Os campos `featDescriptions`, `specialDescriptions` e `spellDescriptions` são opcionais. Se não existirem no JSON:

1. **Com servidor rodando** (`npm run dev:full`): Busca automaticamente da AON
2. **Sem servidor**: Exibe apenas o nome com link para AON

---

## 🎯 Roadmap

### ✅ Concluído

-   [x] Estrutura base do projeto
-   [x] Sistema de navegação e layout
-   [x] **Módulo de Ficha de Personagem**
    -   [x] Upload e parsing de JSON
    -   [x] Geração de PDF completo
    -   [x] Layout profissional print-friendly
    -   [x] Seção de Ataques detalhada
    -   [x] Seção de Magias com informações completas
    -   [x] Bônus míticos em perícias e salvamentos
    -   [x] Integração com AON (feats, specials, spells)
    -   [x] Links clicáveis para referência
-   [x] Servidor de scraping da AON

### 🚧 Em Progresso

-   [ ] **Módulo de Stat Block de Transformação**
    -   [x] Interface step-by-step
    -   [ ] Seletor de magias com dados completos
    -   [ ] Cálculos automáticos de atributos
    -   [ ] Exportação PDF/PNG

### 📅 Planejado

-   [ ] Calculadora de Magias
-   [ ] Gerador de Encontros
-   [ ] Calculadora de Iniciativa
-   [ ] Suporte a múltiplos idiomas
-   [ ] Temas customizáveis para PDF
-   [ ] PWA (Progressive Web App)

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

### Como Contribuir

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

### Padrões de Código

-   Use TypeScript com tipagem forte
-   Siga a estrutura modular existente
-   Mantenha componentes pequenos e focados
-   Documente funções complexas
-   Use nomes descritivos em português para UI, inglês para código

---

## 🤖 Contexto para IA

Esta seção fornece contexto importante para assistentes de IA trabalhando neste projeto.

### Sobre o Sistema de RPG

**Pathfinder 2nd Edition (Remaster)** é um sistema de RPG de mesa da Paizo. Conceitos importantes:

-   **Atributos**: STR, DEX, CON, INT, WIS, CHA (valores 10-20+, modificador = (valor-10)/2)
-   **Proficiência**: Untrained (0), Trained (+2), Expert (+4), Master (+6), Legendary (+8)
-   **Bônus Total**: Proficiência + Nível + Modificador de Atributo + Bônus de Item
-   **Bônus Mítico**: 10 + Nível + Modificador de Atributo (regra homebrew)
-   **CD de Magia**: 10 + Proficiência + Nível + Modificador de Atributo-Chave
-   **Archives of Nethys (AON)**: https://2e.aonprd.com/ - Referência oficial online

### Referência de Cálculos

```typescript
// Modificador de atributo
const mod = Math.floor((abilityScore - 10) / 2)

// Bônus de perícia
const skillBonus = proficiencyRank + level + abilityMod + itemBonus

// Bônus mítico (homebrew)
const mythicBonus = 10 + level + abilityMod

// CD de magia
const spellDC = 10 + proficiencyRank + level + keyAbilityMod

// Ataque de magia
const spellAttack = proficiencyRank + level + keyAbilityMod
```

### Convenções do Projeto

1. **Idioma**: Interface em português, código em inglês
2. **PDF**: Sempre print-friendly (preto, cinza, branco apenas)
3. **Fontes**: Helvetica (disponível no jsPDF por padrão)
4. **Links AON**: Formato `https://2e.aonprd.com/Search.aspx?q=TERMO`
5. **Ações de Magia**: "1 ação", "2 ações", "3 ações", "reação", "livre", "1 a 3 ações"

### Arquivos Principais para Modificações

| Funcionalidade   | Arquivo                                              |
| ---------------- | ---------------------------------------------------- |
| Layout do PDF    | `src/modules/character-sheet/pdf.ts`                 |
| Tipos de dados   | `src/modules/character-sheet/types.ts`               |
| UI da página     | `src/modules/character-sheet/CharacterSheetPage.tsx` |
| API de scraping  | `server/index.mjs`                                   |
| Dados de exemplo | `public/character-example.json`                      |
| Tema global      | `src/theme.ts`                                       |

### Testes

Para testar a ficha de personagem:

1. Execute `npm run dev:full`
2. Acesse http://localhost:5173
3. Vá em "Ficha de Personagem (PDF)"
4. Clique em "Carregar Exemplo"
5. Clique em "Gerar PDF"

---

## 📄 Licença

Este projeto está sob a licença MIT.

## 🙏 Agradecimentos

-   Comunidade Pathfinder 2e
-   [Archives of Nethys](https://2e.aonprd.com/) pela referência de dados
-   [Pathbuilder 2e](https://pathbuilder2e.com/) pelo formato de JSON
-   [monster.pf2.tools](https://monster.pf2.tools) pela inspiração

---

**Desenvolvido com ❤️ para a comunidade Pathfinder 2e**
