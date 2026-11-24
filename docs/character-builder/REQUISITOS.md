# Requisitos do Criador de Personagem

Convenção: **RF** = requisito funcional, **RN** = regra de negócio, **RNF** = requisito não funcional, **CA** = critério de
aceite. Prioridade: **P0** (MVP, sem ele não substitui o Pathbuilder), **P1** (logo depois), **P2** (desejável).
A coluna "Fase" aponta o [ROADMAP](ROADMAP.md).

---

## 1. Personas e permissões

| Persona | Pode |
| --- | --- |
| Jogador (membro `player` da mesa) | Criar personagens próprios, editar e subir de nível os seus, aplicá-los na mesa, ver (somente leitura) os builds publicados dos colegas |
| GM (membro `gm`) | Tudo do jogador, em qualquer personagem da mesa; definir as **Regras da mesa** (livros, variantes, raridade); criar personagem e atribuir dono; aprovar liberações |
| Visitante sem login | Nada no Criador (a rota pede login, mesmo com `AUTH_REQUIRED` desligado — como Diário e Wiki) |

**RN-01** — Só o servidor escreve no banco; toda autorização mora no servidor (regra global 6). A UI só esconde botões.
**RN-02** — O dono de um build é quem o criou (ou quem o GM atribuiu). O dono do build e o dono da ficha publicada
(`sheets.owner_id`) são a mesma pessoa; aplicar um build sobre ficha de outro dono = 403 (GM passa).
**RN-03** — Build de outra pessoa abre **somente leitura** (mesmo padrão da Ficha: ver tudo, não mudar nada).

---

## 2. Requisitos funcionais

### 2.1 Gestão de personagens

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-001 | Listar "Meus personagens" da mesa (nome, classe, nível, retrato, estado: rascunho / publicado / publicado com alterações não publicadas) | P0 | 2 |
| RF-002 | Criar personagem novo (nome provisório, nível inicial 1 por padrão, opção de começar em nível N) | P0 | 2 |
| RF-003 | Salvar automaticamente a cada mudança (debounce ≤ 1,5 s), com rascunho local de segurança e aviso de conflito (409 por `rev`) | P0 | 2 |
| RF-004 | Duplicar personagem | P1 | 8 |
| RF-005 | Apagar rascunho (lixeira de 30 dias; personagem publicado não some da Ficha) | P1 | 8 |
| RF-006 | GM: criar personagem e atribuir a um jogador | P1 | 8 |
| RF-007 | Histórico de versões do build (cada publicação guarda o `BuildState`) e restaurar | P1 | 7 |
| RF-008 | Importar JSON do Pathbuilder → `BuildState` editável (migração dos personagens atuais) | P0 | 7 |
| RF-009 | Baixar o retrato em JSON compatível com o Pathbuilder (backup; nunca necessário no fluxo) | P2 | 7 |
| RF-010 | Copiar personagem para outra mesa da qual a conta é membro | P2 | 9 |

### 2.2 Origem (ancestralidade, herança, background)

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-020 | Escolher ancestralidade com abas de raridade, busca, detalhe (PV, tamanho, velocidade, boosts/flaws, idiomas, traços, sentidos, fonte) | P0 | 3 |
| RF-021 | Escolher herança da ancestralidade ou **herança versátil** | P0 | 3 |
| RF-022 | Boosts alternativos da ancestralidade (dois livres) e flaws voluntários | P0 | 3 |
| RF-023 | Escolher background com boosts (1 de 2 + 1 livre), perícia, Lore e talento concedidos | P0 | 3 |
| RF-024 | Idiomas: os da ancestralidade + adicionais = INT (se positivo) + concedidos por talento; lista de comuns e incomuns liberados | P0 | 3 |
| RF-025 | Mostrar os sentidos (visão no escuro, faro…) e velocidades extra | P1 | 3 |

### 2.3 Classe

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-030 | Escolher classe (abas Core/Expandidas/Todas), detalhe com atributo-chave, PV, proficiências iniciais, perícias | P0 | 3 |
| RF-031 | Atributo-chave quando há opção (Guerreiro FOR/DES) | P0 | 3 |
| RF-032 | Escolhas de classe por nível (subclasse e afins): escola, tese, doutrina, causa, instinto, racket, metodologia, consciência, ordem, mistério, patrono, estudo híbrido, grupo de Weapon Mastery etc., com sub-escolhas encadeadas | P0 | 4 |
| RF-033 | Características automáticas por nível listadas no plano, com descrição da AON | P0 | 4 |
| RF-034 | Class Archetypes | P2 | 9 |
| RF-035 | Dual Class (variante) | P2 | 9 |

### 2.4 Atributos

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-040 | Boosts de nível 1 por origem (ancestralidade, background, classe, 4 livres) com modificador ao vivo | P0 | 3 |
| RF-041 | Boosts nos níveis 5, 10, 15, 20 (4 cada, distintos) com boost parcial acima de +4 | P0 | 4 |
| RF-042 | Override manual dos modificadores com aviso | P1 | 3 |
| RF-043 | Boosts extras por nível ("Custom Ability Increases") | P1 | 8 |

### 2.5 Perícias

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-050 | Treino inicial: perícias fixas da classe + N + INT; duplicidade vira escolha livre | P0 | 3 |
| RF-051 | Aumentos de perícia nos níveis da classe (ímpares a partir do 3 na maioria; Ladino/Investigador têm mais) com teto por nível | P0 | 4 |
| RF-052 | Lores: concedidas (background, talento) e livres, com nome digitado | P0 | 3 |
| RF-053 | Aumentos extras por nível (custom) | P1 | 8 |
| RF-054 | Mostrar a conta de cada perícia (atributo, proficiência, item, armadura) | P0 | 4 |

### 2.6 Talentos

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-060 | Slots por nível conforme a classe: ancestralidade, classe, perícia, geral, + variantes (Free Archetype, Mítico, Ancestral Paragon) | P0 | 4 |
| RF-061 | Seletor com abas (Classe / Dedicações / Arquétipo / Todos), ordenação (alfabética / nível), busca por nome/traço/texto, filtros de raridade, fonte e ações | P0 | 4 |
| RF-062 | Elegibilidade calculada (nível, pré-requisitos, raridade liberada) com **motivo**; inelegível pode ser escolhido com aviso | P0 | 4 |
| RF-063 | Talentos com qualificador (Assurance (Atletismo), Additional Lore (X), Skill Training (X)) | P0 | 4 |
| RF-064 | Talentos que concedem escolhas (talento → talento de outra lista, perícia, magia, idioma) — encadeados | P0 | 4 |
| RF-065 | Regra de dedicação (não pegar outra dedicação antes de 2 talentos do arquétipo) como aviso | P0 | 4 |
| RF-066 | Talentos concedidos fora de slot (classe, background, herança) listados como "Concedido" | P0 | 4 |
| RF-067 | Slot extra concedido pelo GM ("Custom Feat Choice") | P1 | 8 |
| RF-068 | Retreinar: trocar uma escolha de nível passado registrando o motivo | P2 | 8 |
| RF-069 | Navegador de talentos (consulta fora de slot) | P2 | 9 |

### 2.7 Magias

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-070 | Conjurador da classe: preparado (grimório + preparadas por dia), espontâneo (repertório + assinatura), com slots por nível | P0 | 5 |
| RF-071 | Magias de foco (da classe, de talentos) e pool pelo Remaster (nº de magias de foco, até 3) | P0 | 5 |
| RF-072 | Conjuradores de arquétipo (Basic/Expert/Master Spellcasting) e inatos (ancestralidade, talento, item) | P0 | 5 |
| RF-073 | Seletor de magias por tradição, rank, ações, traços, raridade | P0 | 5 |
| RF-074 | Truques e magias concedidos (escola, domínio, fonte divina, mistério) | P0 | 5 |
| RF-075 | Rituais | P1 | 5 |
| RF-076 | Slots extras manuais ("Bonus Spells") | P1 | 5 |
| RF-077 | Mythic Magic e conjuradores de itens (Pinch Time, Advanced Targeting System) | P0 | 5 |

### 2.8 Equipamento

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-080 | Catálogo de armas (Simples/Marciais/Avançadas/Desarmadas/Proficientes; Comum/Mágica/Personalizada) com comprar/dar | P0 | 6 |
| RF-081 | Runas de arma: potência, striking, propriedade (slots = potência), material | P0 | 6 |
| RF-082 | Opções de arma: atributo de ataque, quantidade, nome personalizado, traços extras, dano extra, overrides com aviso | P0 | 6 |
| RF-083 | Armaduras e escudos com runas (potência, resiliente, propriedade, reforço), material | P0 | 6 |
| RF-084 | Itens (aventura, consumíveis, mágicos vestidos/empunhados, bastões, varinhas, pergaminhos) com quantidade e investido | P0 | 6 |
| RF-085 | Contêineres e volume (carga, sobrecarregado, máximo) | P1 | 6 |
| RF-086 | Dinheiro (pp/po/pe/pc), riqueza inicial do nível como referência | P0 | 6 |
| RF-087 | Livro de fórmulas | P1 | 6 |
| RF-088 | Ataques desarmados derivados (punho + os da ancestralidade/talento/classe) | P0 | 6 |
| RF-089 | Item personalizado (nome, preço, volume, traços) | P1 | 8 |

### 2.9 Companheiros

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-090 | Companheiro animal (tipo, maduro, incrível + especialização, armadura de montaria) | P1 | 6 |
| RF-091 | Familiar (habilidades por número permitido) | P1 | 6 |
| RF-092 | Eidolon, construto do Inventor | P2 | 9 |

### 2.10 Variantes e regras da mesa

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-100 | GM define em `/mesa` (ou na aba "Regras da mesa" do Criador): livros liberados, raridade liberada, variantes ligadas | P0 | 2 |
| RF-101 | Free Archetype | P0 | 4 |
| RF-102 | Mítico (War of Immortals): chamado (no 1º ou ao ganhar o poder) com Rewrite Fate, talento mítico em todo nível par, destino mítico obrigatório no 12º e talentos do destino do 14º em diante, Mythic Magic | P0 | 4 |
| RF-102a | Mítico por personagem (*Mixed Play*) e chamado tardio (talentos míticos anteriores como pendência que o GM libera) | P0 | 4 |
| RF-102b | Progressão mítica por provações (rank mítico separado do nível: *Mythic Trials*, *Late Start*, *High Mythic Low Level*) | P2 | 9 |
| RF-103 | Ancestral Paragon | P0 | 4 |
| RF-104 | Automatic Bonus Progression | P1 | 8 |
| RF-105 | Proficiency Without Level | P2 | 9 |
| RF-106 | Exceção por personagem (o GM libera um item incomum para um build) | P1 | 8 |

### 2.11 Revisão, aplicar na mesa e integração com a Ficha

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-110 | Painel "Pendências" (o que falta escolher até o nível atual) e "Avisos" (pré-requisito, boost, ouro negativo, override) | P0 | 4 |
| RF-111 | Resumo ao vivo: PV, CA, salvaguardas, Percepção, CD de classe, velocidade, ataques principais | P0 | 3 |
| RF-112 | **Aplicar na mesa** = compilar o retrato e gravá-lo direto em `sheets` pelo fluxo de preparo existente (diff, preparo, "Nova versão"), sem arquivo nem upload | P0 | 7 |
| RF-113 | **Subir de nível**: aumentar o nível atual e cumprir as pendências do novo nível; depois aplicar | P0 | 7 |
| RF-114 | **Modo editar dentro da Ficha**: botão Editar/Jogar (dono/GM), `?modo=editar`, "Subir de nível" abre o modo editar no nível novo; atalhos contextuais ("Trocar talento" no drawer) | P0 | 7 |
| RF-114a | A Ficha lê as extensões do retrato (desarmados, memória de cálculo, ids, efeitos, regras opcionais) com fallback para fichas antigas | P1 | 7–10 |
| RF-115 | Início: cartão "Criar meu personagem" para quem não tem ficha na mesa; "Subir de nível" quando o GM sobe o nível da mesa (se houver) | P1 | 8 |
| RF-116 | Notificação ao GM quando um jogador aplica personagem novo (já existe via `mesa_events`) | ♻️ | 7 |
| RF-117 | Diff legível antes de aplicar (nível, talentos, magias, itens — `sheetDiff.ts`) | P0 | 7 |
| RF-118 | Ficha publicada a partir do Criador mostra selo "Criado no Covil" e a versão das regras | P2 | 7 |

---

### 2.12 Base de regras (admin da plataforma)

| ID | Requisito | Prio | Fase |
| --- | --- | --- | --- |
| RF-130 | Todo o conteúdo de jogador do Remaster da AON importado para o banco (carga inicial por script) | P0 | 1 |
| RF-131 | O Criador lê o catálogo do banco (pacotes por lista em cache) e **nunca** consulta a AON | P0 | 1 |
| RF-132 | Tela `/plataforma/regras` (só admin): lista de livros da AON com estado — NOVO, ERRATA NOVA, Importado, Legado | P0 | 1B |
| RF-133 | Importar só os livros selecionados, em passos retomáveis, com progresso e relatório (novas, alteradas, removidas, sem mecânica) | P0 | 1B |
| RF-134 | Reimportar sem mudança não altera nada (diferença por `hash`); entrada que sumiu da AON é marcada, nunca apagada | P0 | 1B |
| RF-135 | Correção manual da mecânica de uma entrada, com referência AON | P1 | 1B |
| RF-136 | Verificação semanal automática que avisa o admin de livros novos (nunca importa sozinha) | P2 | 1B |
| RF-137 | Pré-traduzir para pt as descrições de um livro importado | P2 | 1B |
| RF-138 | A Ficha e o servidor consultam a base local antes da AON | P2 | 10 |

## 3. Regras de negócio

- **RN-10 (avisa, não trava)**: nenhuma escolha é bloqueada por regra. Cada violação gera um aviso com código, nível,
  texto e "como resolver". Aplicar com avisos é permitido; o diálogo de aplicar lista os avisos.
- **RN-11 (sem número inventado)**: efeito que o motor não sabe aplicar (rule element sem suporte, texto livre) vira
  aviso "efeito não calculado: <talento>" — nunca um número aproximado.
- **RN-12 (slug estável)**: o slug do personagem nasce na criação do build e **não muda** quando o nome muda. O servidor
  deriva o slug da linha do build, nunca do cliente (regra atual: "o slug sai do `build.name` do JSON" — o Criador passa a
  ter fonte confiável própria, ver ARQUITETURA §6).
- **RN-13 (regras versionadas)**: cada build guarda `rulesVersion`. Abrir um build com dados mais novos recompila e
  mostra o que mudou nos números antes de aplicar.
- **RN-14 (Remaster)**: conteúdo legado só aparece se a mesa liberar o livro; com `remaster_id` na AON, o seletor mostra
  a versão Remaster e esconde a antiga.
- **RN-20 (base global)**: a base de regras é da plataforma, não da mesa; só admin importa. Importar um livro não o
  libera para nenhuma mesa — liberar continua com o GM (`mesa_rules.sources`).
- **RN-15 (mesa)**: build, regras da mesa e homebrew são por mesa (`mesa` como primeiro parâmetro de todo store). O
  catálogo de regras (conteúdo oficial) é global, como traduções e descrições.
- **RN-16 (nível)**: nível atual 1–20; o plano aceita escolhas até o 20; o compilado só aplica até o atual.
- **RN-17 (idioma)**: nomes mecânicos e chaves ficam em inglês (são a chave da AON e do JSON); a tela mostra
  `tr('português', 'English')` e as descrições pelo pipeline atual. Conteúdo do usuário (nome, notas) nunca é traduzido.
- **RN-18 (dinheiro)**: comprar desconta; dar não desconta; saldo negativo é permitido com aviso.
- **RN-19 (proficiência teto)**: Mestre só a partir do nível 7 e Lendário do 15 para perícias (Player Core); aviso se violado.

---

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | **Celular primeiro**: todo fluxo funciona em 320px; alvo de toque ≥ 40px; nada de `minWidth` fixo em `flex-wrap` |
| RNF-02 | **Chunk próprio** (`React.lazy`); catálogo de regras carregado sob demanda, por tipo, com cache (HTTP + IndexedDB) |
| RNF-03 | Recompilação ≤ 50 ms em celular médio para um nível-20 (o motor roda a cada escolha) |
| RNF-15 | Nenhuma chamada à AON no fluxo do Criador; a AON só é lida pela importação, uma consulta por vez e com intervalo |
| RNF-16 | Cada passo de importação ≤ 45 s (limite das funções); job retomável; base ≤ ~10% do banco gratuito |
| RNF-04 | Primeira abertura do Criador ≤ 2,5 s em 4G com o catálogo do núcleo (classes, ancestralidades, backgrounds); talentos/magias/itens sob demanda |
| RNF-05 | Bilíngue completo (`tr()`), `check-i18n` passando; datas e números com `locale` |
| RNF-06 | Cores só de `palette.ts` (hex 6 dígitos); tema claro e escuro; `check-contrast` passando |
| RNF-07 | Nenhum arquivo novo em `api/` (12 funções); rotas no `state-router.js` e `api/search.js` |
| RNF-08 | `BuildState` ≤ 64 KB; JSON compilado ≤ 64 KB (teto atual de `sheets`) |
| RNF-09 | Compilador **puro e determinístico** (mesma entrada → mesma saída), sem React, testável por script |
| RNF-10 | Acessibilidade: seletores navegáveis por teclado, foco visível, rótulos ARIA, `prefers-reduced-motion` |
| RNF-11 | Animação só apresenta (regra 12); a escolha muda o estado na hora |
| RNF-12 | Toda imagem por `useImageUrl` |
| RNF-13 | Licenças: página de créditos com o aviso ORC/OGL dos livros usados; aviso "Ferramenta de fã, não oficial" |
| RNF-14 | Sem dependência pesada nova no bundle principal; virtualização de listas longas (talentos/itens) sem biblioteca, ou com uma leve no chunk do Criador |

---

## 5. Critérios de aceite do MVP (substitui o Pathbuilder)

- **CA-01** Os 10 personagens do elenco, importados do JSON do Pathbuilder para `BuildState` e recompilados, batem com o
  export em: atributos, PV máximo, CA, salvaguardas, Percepção, perícias e Lores, CD de classe, ataques/dano das armas,
  CD/ataque de magia, slots por rank, pool de foco, idiomas, velocidade. Diferenças só nas correções conhecidas do
  `normalizeBuild` (documentadas como "o export estava errado").
- **CA-02** Um jogador cria do zero um personagem nível 1 de cada classe do Player Core no celular (320px) sem sair do
  Criador e aplica na mesa; o personagem passa ao modo jogar completo (descrições pt/en e guia), aparece na Iniciativa e no Mapa.
- **CA-03** Subir de nível um personagem do elenco (7→8 e 10→11) com Free Archetype e Mítico: pendências corretas,
  publicação com diff, a mesa recebe "Nova versão publicada".
- **CA-04** Jogador não consegue gravar no build de outro (403 no servidor); o GM consegue.
- **CA-05** `npm run build`, `npm run lint`, `check-builder.mjs`, `check-rolls.mjs`, `check-economy.mjs` passam.
- **CA-06** Inglês: conta em English vê o Criador inteiro em inglês, descrições direto da AON.
