# Covil de Dados 🎲

**Ferramentas para jogadores e mestres de Pathfinder 2e Remaster**

Uma plataforma web para a mesa de jogo: ficha virtual que rola e gasta recursos, iniciativa, mapa de combate, diário
de campanha, wiki e estatísticas — tudo compartilhado em tempo real entre o mestre e os jogadores, no celular ou no
computador.

No ar em **https://pathfinder.danielfigueroa.dev**. Ferramenta de fã, não oficial.

---

## 📖 Índice

-   [Sobre o Projeto](#-sobre-o-projeto)
-   [Funcionalidades](#-funcionalidades)
-   [Personagens da Campanha](#-personagens-da-campanha)
-   [Stack Tecnológica](#️-stack-tecnológica)
-   [Instalação e Execução](#-instalação-e-execução)
-   [Deploy](#-deploy-vercel--supabase)
-   [Arquitetura](#️-arquitetura)
-   [API](#-api)
-   [Formato de Dados](#-formato-de-dados)
-   [Testes e Conferências](#-testes-e-conferências)
-   [Roadmap](#-roadmap)
-   [Contribuindo](#-contribuindo)

---

## 🎯 Sobre o Projeto

O **Covil de Dados** (antes PF2e Toolkit; o repositório e o pacote seguem `pf2e-tools`) nasceu para tirar da mesa o
trabalho repetitivo de **Pathfinder 2nd Edition (Remaster)**: somar modificadores, lembrar condições, contar ações e
slots, aplicar dano em área, procurar regra no meio do turno.

Princípios:

1. **A mesa é uma só**: PV, condições, slots, mapa e rolagens são os mesmos em todos os aparelhos, na hora.
2. **Regra conferida, nunca inventada**: os números vêm da ficha do Pathbuilder e da
   [Archives of Nethys](https://2e.aonprd.com/) (AON). O que o app não sabe calcular com segurança vira aviso, não número.
3. **O app conta e avisa, não trava**: gastar uma ação a mais é permitido — a mesa decide.
4. **Feito para o celular** (menos o mapa, que é de desktop).

---

## ✨ Funcionalidades

| Ferramenta                       | Rota                    | O que faz                                                                          |
| -------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| **Início**                       | `/`                     | A mesa viva: próxima sessão, seu personagem, combate em andamento, grupo e última sessão |
| **Ficha Virtual**                | `/ficha-virtual`        | Ficha interativa do Pathbuilder que rola, gasta recursos e mostra as regras da AON |
| **Iniciativa**                   | `/iniciativa`           | Ordem de turnos, dano em área, condições, aflições, dano persistente e escudos     |
| **Mapa de Combate**              | `/mapa/:id?`            | VTT com grid de 5 ft, tokens com PV, régua, áreas de efeito, desenhos e dados      |
| **Estatísticas da Mesa**         | `/historico`            | As rolagens de cada sessão: média do d20, destaques, ranking e "o d20 é justo?"   |
| **Diário de Campanha** (GM)      | `/diario-campanha/:id?` | Preparação das sessões, catálogo, ganchos, encontros com XP e "Mostrar à mesa"    |
| **Wiki da Mesa**                 | `/wiki/:id?`            | O mundo escrito por todos, com histórico, autoria e trechos que só o GM vê        |
| **Troféus do Covil**             | `/trofeus/:user?`       | Troféus por conta (bronze a platina), perfil com nível e ranking da mesa          |
| **Transformação**                | `/transformation`       | Stat block de qualquer _battle form_ do Remaster, exportável                      |
| **Escalar Monstro**              | `/escalar-monstro`      | Adapta uma criatura da AON para outro nível pelas tabelas do GM Core               |
| **Membros** e **Mesa** (GM)      | `/membros`, `/mesa`     | Convites, papéis, senhas provisórias e donos das fichas; nome e sessão da mesa    |

### 🧭 Plataforma

-   **Contas e papéis**: entra-se com **usuário e senha** (sem e-mail). Cada mesa tem **jogadores** e **GM**; entra-se
    por um **convite** que o GM gera em `/membros` (link `/convite/<código>`). Esqueceu a senha: o GM gera uma
    provisória. Cada **ficha tem dono** — só ele e o GM a publicam e mexem nos PV, slots e condições dela; a ficha de
    outra pessoa abre **somente leitura** (tudo visível, nada clicável).
-   **Mesas**: o site atende mais de uma mesa (hoje **Casa do Gordo Online** e **Arton 1515**), cada uma vendo só o que é
    dela. Troca-se pelo cartão da mesa na barra lateral; "Copiar link da mesa" gera um link que já entra nela.
-   **Português ou inglês, por conta**: em inglês a plataforma inteira fica em inglês e as descrições vêm direto da AON,
    sem tradução. O guia "Como Jogar" é gerado nos dois idiomas.
-   **Tema claro, escuro ou do sistema**, por aparelho (o escuro é o "pergaminho à luz de vela").
-   **Tempo real**: o que alguém muda aparece na tela dos outros em menos de um segundo (Realtime do Supabase).
-   **Quem está na mesa**: avatares no cartão da mesa (tocando: o aparelho, a ficha aberta e a página); no mapa, o token
    de quem está com a ficha aberta ganha um ponto verde.
-   **Notificações** (o sino): ficha publicada ou atribuída a você, item recebido, mapa ativado ou revelado, combate
    começando, regra compartilhada, trecho mostrado pelo GM, página nova na Wiki, troféus. O lido vale em todos os aparelhos.
-   **Busca ⌘K / Ctrl+K** para ir a qualquer página ou ferramenta.
-   **Celular**: barra de abas embaixo (Início, Ficha, Iniciativa, Mapa, Mais); no desktop, barra lateral em seções que
    recolhe para um trilho de ícones.
-   **Início por papel**: o GM vê a próxima sessão (Começar combate, Editar data) e "Preparar a sessão" (encontro, mapa,
    Diário); o jogador vê o cartão do seu personagem. Durante o combate, a Início mostra a rodada e de quem é a vez.

### 📜 Ficha Virtual

Ficha do **Pathbuilder 2e** (JSON) pensada para a mesa: **abas** no desktop, **acordeão** no celular.

**Publicação**

-   Enviar o JSON mostra **o que mudou** (nível, talentos, magias, itens) contra a versão da mesa. Ao publicar, a ficha é
    **preparada antes de valer**: consultas da AON, companheiros, descrições em **português e inglês** e o guia nas duas
    línguas, tudo no banco. Uma barra mostra cada passo, e a ficha só abre — para quem publicou e para a mesa — completa.
    Se a IA estiver no limite, o preparo espera e tenta de novo sozinho; fechar a aba não perde nada ("Em preparo" →
    **Continuar**). Num level-up a mesa segue na versão anterior até o fim.
-   Quem está com a ficha aberta vê **"Nova versão publicada"** e escolhe quando trocar. A versão anterior fica no
    histórico e pode ser restaurada.

**Leitura e regras**

-   Áreas: Visão Geral, Combate, Perícias, Talentos, Habilidades, Magias, Companheiros, Inventário e **Anotações**
    (as vazias somem). Talentos e habilidades vêm agrupados por origem.
-   **Descrição da AON a um toque**, traduzida para pt-BR e já pronta desde a publicação (sem esperar). Toda descrição pode
    ser **compartilhada com a mesa** (aparece na tela de todos para decidir uma regra) e **corrigida** ("Corrigir
    tradução", vale para todos os aparelhos e mesas).
-   **Traços das armas** em chips (Ágil, Letal d10, Arremesso 3 m…), com a regra a um toque.
-   **Guia "Como Jogar"** na Visão Geral (papel em combate, rotina de turno, recursos, erros comuns): gerado por IA para a
    versão publicada, a partir do guia anterior; o dono pode **editá-lo** e acrescentar **trechos próprios**.
-   **Anotações**: background do personagem e notas com etiqueta (NPC, item, local, evento), busca e fixar, em Markdown.

**Rolagens** (todas aparecem para a mesa inteira)

-   Tocar numa salvaguarda, Percepção, perícia, Saber, arma, desarmado ou magia abre o diálogo com a **conta parcela por
    parcela** ("Mestre +16 · CON +4 · Item +1 · Amedrontado 1 −1").
-   **Golpe**: ataque e dano juntos, com acerto e crítico (deadly, fatal, runas e **especialização crítica** pela ficha),
    MAP do 1º/2º/3º ataque, chips de dano extra, **dados extras** digitados ("2d6") e ajuste livre.
-   **Magia** no rank conjurado (heightening calculado), com os quatro graus da salvaguarda básica. **Ação variável**
    (Heal, Blazing Bolt, Force Barrage…): escolha quantas ações e o efeito acompanha; o Blazing Bolt rola um ataque por raio.
-   **✦ Mítico**: proficiência mítica (nível + 10, substitui a normal) e o pool de 3 Pontos Míticos, gasto no mesmo clique —
    só onde um talento da ficha permite.
-   **Fortuna**: Sure Strike e Wish for Luck rolam 2d20 e ficam com o maior.
-   **Usar como iniciativa** (Percepção, Furtividade, Atletismo, Acrobacia) manda o total para a Iniciativa do GM, com os
    bônus de iniciativa da ficha.
-   **Tratar Ferimentos e Battle Medicine** no diálogo de Medicina: teste e cura juntos, aplicada ao PV.

**Recursos do turno e do dia**

-   **Ações do turno**: 3 pips, reação, a ação extra do Acelerado; Lento e Atordoado tiram ações. Golpe, magia, atividades
    e itens descontam sozinhos; a Iniciativa devolve as ações quando o turno do personagem começa.
-   **Conjurar paga tudo de uma vez**: ações (ou a reação) e o slot, o ponto de foco ou o Ponto Mítico — sem cobrar em
    dobro se o jogador também marcar o slot.
-   **Atividades com custo** ("Usar" nos talentos e habilidades), com o custo lido da AON; "uma vez por dia" marcado até o
    **Novo dia**.
-   **Slots de magia, foco, Pontos Míticos, condições, aflições e dano persistente**, todos da mesa. Condições do Remaster
    com o efeito nos números (penalidade do mesmo tipo não empilha; "testes e CDs" inclui a CA).

**Inventário**

-   Armas, armaduras e equipamento numa lista, com **imagem** de cada item.
-   **Consumíveis**: Usar/Beber, com a cura rolada e aplicada ao PV (e Desfazer); **Passar** poção, elixir ou pergaminho para
    um colega, que vê "Fulano te enviou 2× X".
-   **Escudo** com PV em barra própria, Dureza, limiar de quebra, Erguer, Bloquear e Consertar.
-   **Relíquias** com as dádivas e o botão de usar; **apelido** para cada arma ("Fenrir"); **companheiros de combate** da
    AON (a Animated Armor do Nathaniel) que entram sozinhos na Iniciativa.

**Classes e talentos** (descobertos pela ficha)

-   **Bárbaro**: Fúria (dano, PV temporários, Raging Resistance, Titan Mauler).
-   **Magus**: Arcane Cascade, Laughing Shadow e **Spellstrike num clique** (Golpe + magia de qualquer bloco).
-   **Psíquico**: Unleash Psyche, psi cantrips amplificados, Conservation of Energy.
-   **Patrulheiro**: Hunt Prey, Gravity Weapon, Hunter's Aim.
-   **Investigador**: Devise a Stratagem (o d20 primeiro, a escolha depois), investigações, Assurance.
-   **Monge**: Flurry of Blows, Ki Strike, Perfect Strike, postura do arqueiro monástico.
-   **Ladino**: Poison Weapon (veneno simples ou do inventário) aplicado no Golpe, Debilitating Strike.
-   **Guerreiro**: Fearsome Brute, Exacting Strike, Reflexive Shield, Destructive Block.
-   **Clérigo**: Healing Hands, Sacred Ground, Banishing Touch.
-   **Míticos**: Summon Mythic Power, Divert Destiny, Fiery Rebirth, Godspeed e outros.

### ⚔️ Iniciativa

-   Importa os personagens da mesa e **busca monstros na AON** por nome e/ou faixa de nível, já com PV, CA, salvaguardas,
    resistências, fraquezas e imunidades.
-   **PV e condições dos personagens são os da Ficha Virtual**: o dano do GM aparece no celular do jogador e vice-versa.
-   **Dano em área** com o resultado da salvaguarda de cada alvo, resistência, fraqueza, escudo e PV temporários, e o
    memorial antes de aplicar.
-   Condições com duração em rodadas; **aflições** (venenos e doenças da AON) com estágios e o dano do estágio aplicado
    sozinho; **dano persistente** no fim do turno com o teste plano. Toda aplicação automática tem Desfazer.
-   Ordem de turnos com o desempate oficial, ajuste manual, Adiar e Derrotado; sugestão de Morrendo a 0 PV.
-   **Ficha completa do monstro dentro do cartão**, já no nível em que ele está.
-   **Encontro na nuvem**, um por mapa de combate: o GM monta no computador e abre no tablet.

### 🗺️ Mapa de Combate (desktop)

-   Grid de 5 ft sobre a imagem do mapa (o GM ajusta a escala em quadrados), zoom e pan fluidos.
-   **Tokens vêm da Iniciativa**, com barra de PV (números só para personagens; o GM vê os dos monstros), tamanho da
    criatura (Troops encolhem com o PV) e **imagem enquadrada** (centro e ampliação). **F** vira o token.
-   **Régua** 5-10-5, **áreas de efeito** (explosão, emanação, cone, linha) com a contagem de criaturas, **alcance de
    movimento** em ações ao arrastar, **desenhos** com 12 cores de efeito, **ping** com clique duplo e **dados**.
-   **Ao vivo**: a régua, a área e o arrasto de cada um aparecem na tela de todos, com o nome de quem mede.
-   **Vários mapas por sessão**, que nascem **privados** até o GM revelar; "Levar a mesa" para outro mapa.
-   **Ficha ao lado**: painel com a Ficha Virtual do seu personagem, com rolagens; ordem de turnos no canto.

### 📊 Estatísticas da Mesa

As rolagens feitas **com a sessão iniciada** pelo GM (fora dela, ninguém suja a média testando a ficha), por noite de jogo
(das 6h às 6h): média do d20, 20 e 1 naturais, maior teste, maior dano, destaques da sessão e da mesa, ranking por
métrica e **"O d20 é justo?"** — em textos para quem joga, não para quem programa.

### 📓 Diário de Campanha (só o GM)

-   **Uma página por sessão**: Preparação (com modelo), Cenas, Encontros, Elenco, Registro e Resumo.
-   **Catálogo da campanha** (NPCs, locais, itens, facções) ligado por `[[Nome]]`, e **ganchos** (aberto → revelado → resolvido).
-   **Planejador de encontros** com o orçamento de XP do GM Core e "Enviar para a Iniciativa".
-   **Mostrar à mesa**: um trecho `:::jogadores … :::` ou imagem aparece na tela de todos, com prévia de confirmação.
-   Salvamento automático, rascunho sem rede e aviso de edição em outro aparelho.

### 📚 Wiki da Mesa

-   Páginas por tipo (NPC, local, item, criatura, facção, divindade, evento…), com capa, apelidos e **ficha rápida**.
-   `[[Nome]]` liga as páginas; **Mencionada em**, trilha "Fica em", busca e mudanças recentes.
-   **Todos editam**; cada "Salvar" é uma versão com autor, com histórico e Restaurar. O GM **trava**, **esconde** páginas e
    escreve **trechos do mestre** (`:::mestre … :::`) que o servidor nunca entrega ao jogador.
-   Ligada ao Diário: o Elenco aceita páginas da Wiki e o Resumo da sessão vira **crônica**.

### 🏆 Troféus do Covil

92 troféus (76 de jogador, 16 de GM) por feitos na plataforma: escrever o background, anotar em sessões seguidas, tirar
20 natural, o maior dano da noite… Todo troféu ainda não ganho é **secreto**. Perfil com nível e pontos, coleção, ranking
da mesa e o cartão "Troféu desbloqueado" para todos.

### 🐉 Transformação

Stat block de qualquer _battle form_ do Remaster (Animal, Dinosaur, Dragon, Elemental, Ooze, Avatar…) com os números reais
do personagem — "use o valor da magia, a menos que o seu seja maior" —, no padrão oficial de bloco de criatura, em
português, exportável em PNG/PDF.

### 📈 Escalar Monstro

-   Pega uma criatura da AON e adapta para outro nível pelas **tabelas de construção do GM Core** (pg. 112-121, níveis -1 a 24).
-   **Preserva a personalidade do monstro**: desloca cada número junto com o benchmark, em vez de trocá-lo pelo da tabela —
    reescalar para o próprio nível devolve a ficha original.
-   **Ajuste fino** do degrau (Extremo/Alto/Moderado/Baixo) por estatística; CDs e dano escritos na prosa acompanham o nível.
-   **Conjuradores ganham ranks e slots**, com editor de magias pela tradição; o que o nível abriu fica vazio, marcado.
-   Diz o que não ajustou; regra de cada termo numa caixinha; exportação em PNG e "Enviar para a Iniciativa".

---

## 👥 Personagens da Campanha

Os presets (`public/characters/*.json`, registrados em `src/modules/character-viewer/campaignPresets.ts`) alimentam a
Ficha Virtual, a Iniciativa e a Transformação. O dia a dia, porém, é cada jogador **publicar** a própria ficha.

**Casa do Gordo Online** (nível 10)

| Preset    | Classe                               | Nome na ficha                      | Observações                                                              |
| --------- | ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------ |
| Brukuthur | Bárbaro (Gigante), Android           | `Brukuthur, The Barbarian Android` | Titan Mauler; runa de tamanho caseira (Enlarge/Shrink).                  |
| Ceros     | Patrulheiro (Precisão), Aiuvarin     | `Cerosqualhanthallas`              | Druid Dedication (Tempestade), arco longo, Mythic Magic.                 |
| Eldarion  | Ladino (Thief) + Swashbuckler        | `Eldarion`                         | Venenos (o Pathbuilder os exporta como "Invested"); Gloom Blade.        |
| Ghan Buri | Guerreiro (Bastion), Jotunborn       | `Ghan Buri`                        | Escudo com Destructive Block; Hero's Plate (anda 25 ft no mapa).         |
| Nathaniel | Magus (Sparkling Targe), Aiuvarin    | `Nathaniel o Magus`                | Animated Armor como companheiro de combate; **anel corrigido à mão** (abaixo). |
| Thalos    | Psíquico (Oscillating Wave), Humano  | `Thalos Alba`                      | Chronoskimmer; magias de assinatura; o slug segue `thalos`.              |

**Arton 1515** (nível 7)

| Preset       | Classe                                        | Nome na ficha        | Observações                                                              |
| ------------ | --------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| Loki         | Magus (Laughing Shadow), Fleshwarp            | `Loki`               | Arquétipo de Psíquico (The Tangible Dream); relíquia **Loki's Heart**.   |
| Miranda      | Investigadora (Empiricism), Humana            | `Miranda Stormblade` | Arquétipo de Inventor; relíquia **Miranda's Arm** (o Braço Sônico).      |
| Hearts Folly | Monge (Student of Perfection), Humana Dromaar | `Hearts folly`       | Relíquias Redenção Pelas Cinzas e Afinco do Artista; desarmado caseiro.  |
| Woyd         | Clérigo (Enclausurado, Void), Humano Versátil | `Woyd`               | Relíquia Brasão da Família (emoção Pride); Heal em d10 (Healing Hands).  |

-   **O JSON do Nathaniel tem uma edição à mão**: o *Winder's Ring* foi marcado por engano; o certo é o **Ring of Wizardry
    (Type I)** ([AON 462](https://2e.aonprd.com/Equipment.aspx?ID=462)), com o +1 de Arcanismo em `mods`. Os dois slots de
    1º rank do anel não estão em `perDay` (são preparados no dia). **Um export novo desfaz a troca** se o anel não for
    corrigido no Pathbuilder.
-   **Mythic Magic gasta Ponto Mítico, não slot**: o Pathbuilder o exporta como conjurador com 5 slots de 5º rank que não existem.
-   O que o Pathbuilder não exporta (desarmados, magias de assinatura, relíquias, runas caseiras, traços de arma caseira)
    vem de catálogos escritos à mão no código, casados pelo nome — o JSON nunca é editado pelo app.
-   O Ardagar saiu da campanha; o guia e o ataque animal dele continuam no código para quem carregar o JSON à mão.

---

## 🛠️ Stack Tecnológica

| Camada      | Tecnologia                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------- |
| Frontend    | React 19, TypeScript 5.8, Vite 5, MUI 7, React Router 7, Emotion                             |
| Conteúdo    | react-markdown + remark-gfm (Diário, Wiki, Anotações); html2canvas e jsPDF (exportações)    |
| Backend     | Node.js — funções serverless da Vercel (`api/*.js`) e o mesmo núcleo em dev (`server/index.mjs`) |
| Dados       | Supabase: Postgres, Realtime, Storage e Auth (região São Paulo)                              |
| Regras      | Elasticsearch da Archives of Nethys                                                          |
| Tradução    | Gemini (`gemini-3.1-flash-lite`) → Groq (`gpt-oss-120b`, `gpt-oss-20b`), com cache no banco  |
| Qualidade   | ESLint, `check-i18n` e os scripts de conferência em `scripts/`                               |

---

## 🚀 Instalação e Execução

### Pré-requisitos

-   **Node.js** 20+ e **npm**

### Instalação

```bash
git clone <repository-url>
cd pf2e-tools
npm install
cp .env.example .env   # e preencha as chaves (ver abaixo)
```

### Execução

```bash
npm run dev        # frontend (Vite, http://localhost:5173)
npm run dev:api    # backend local (http://localhost:3001)
npm run dev:full   # os dois juntos
npm run build      # tsc -b && vite build
npm run lint       # eslint + check-i18n
npm run preview    # serve o build
```

### Variáveis de ambiente (`.env.example`)

| Variável                                          | Para quê                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `GEMINI_API_KEY`, `GROQ_API_KEY`                  | Tradução das descrições (gratuitas, opcionais; sem elas, inglês)     |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`             | Banco no servidor (a chave secreta nunca vai ao frontend)            |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Login e Realtime no navegador                                     |
| `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`         | Scripts de migration e o backup semanal (pooler em modo sessão)      |
| `BACKUP_PASSPHRASE`                               | Criptografia do backup (o repositório é público)                     |
| `AUTH_REQUIRED=1`                                 | Liga a cobrança de login e papel no servidor                         |

-   **Sem Supabase o app funciona** em modo local: sem login, com todas as permissões, e tudo fica no aparelho.
    Para abrir assim mesmo com o `.env` preenchido: `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npx vite`.
-   **Atenção**: com as chaves do projeto de produção, o `dev:api` lê e grava no banco de verdade. Teste numa mesa de
    teste, com nomes `teste-*`, e apague no fim.

---

## 🚀 Deploy (Vercel + Supabase)

1. **Supabase**: crie um projeto (o nosso é São Paulo, `sa-east-1`), ligue-o (`npx supabase link --project-ref <ref>`) e
   aplique as migrations (`npx supabase db push`). Cada migration já cria as tabelas, as permissões, os triggers do
   tempo real e o bucket de imagens.
2. **Vercel**: importe o repositório (o Vite é detectado), cadastre as variáveis acima e faça o deploy. As funções rodam
   em `gru1` (`vercel.json`), perto do banco. O cron diário do `vercel.json` chama `/api/health`, que impede o plano
   gratuito do Supabase de pausar por inatividade.
3. **Primeiro GM**: `node --env-file=.env scripts/grant-gm.mjs <mesa>` imprime um convite de GM; o GM cria a conta por ele
   e, em `/membros`, convida os jogadores e atribui as fichas.
4. **Backup**: `.github/workflows/backup-supabase.yml` faz o dump semanal criptografado (segredos `SUPABASE_DB_URL` e
   `BACKUP_PASSPHRASE`).

> O plano Hobby da Vercel permite **12 funções serverless por deploy**, e `api/` já tem 12. Endpoint novo entra em
> `api/search.js` ou `api/state.js` — um 13º arquivo passa no build e derruba o deploy.

---

## 🏗️ Arquitetura

```
pf2e-tools/
├── api/                    # 12 funções serverless (Vercel)
│   ├── search.js           #   consultas estruturadas à AON (criaturas, aflições, itens, armas, regras…)
│   ├── state.js            #   tudo que tem estado: mesa, fichas, rolagens, mapas, diário, wiki, conta…
│   ├── feat(s).js, spell(s).js, search(es).js, companion(s).js, creature.js, health.js, clear-cache.js
│   └── _lib/               # núcleo: AON, tradução, parsers, stores do banco, autorização (state-router, access)
├── server/index.mjs        # o mesmo backend para desenvolvimento local
├── supabase/migrations/    # o esquema do banco, uma migration por mudança
├── public/
│   ├── characters/         # fichas dos presets (JSON do Pathbuilder)
│   └── descriptions/       # descrições pré-traduzidas por personagem (pt e en/)
├── scripts/                # conferências e manutenção, rodados à mão (ver Testes)
├── brand/covil-de-dados/   # logo, símbolo e o guia da marca
└── src/
    ├── App.tsx             # rotas (todo módulo é carregado sob demanda)
    ├── layouts/            # moldura: sidebar, barra de abas do celular, navegação
    ├── pages/              # Início
    ├── modules/            # um módulo por ferramenta (account, character-viewer, initiative-tracker,
    │                       #   battle-map, session-diary, campaign-journal, wiki, trophies,
    │                       #   transformation-statblock, monster-scaler)
    ├── services/           # clientes: estado da mesa, rolagens, descrições, auth, Realtime, mapas…
    ├── components/         # componentes globais e o editor Markdown
    ├── pathbuilder/        # tipos e normalização do JSON do Pathbuilder
    ├── dice/, motion/      # rolagem e animações (sem biblioteca)
    ├── i18n/               # tr(pt, en), idioma da conta
    └── theme/              # paleta verde/pergaminho/ouro, tema claro e escuro
```

**Documentação para quem desenvolve**: o `CLAUDE.md` da raiz tem as regras que valem para o repositório inteiro, e cada
área tem o seu (`api/CLAUDE.md`, `supabase/CLAUDE.md`, `src/services/CLAUDE.md`, `src/theme/CLAUDE.md`,
`src/modules/<módulo>/CLAUDE.md`…), com as decisões, armadilhas e invariantes daquela parte. Leia antes de mexer nela.

---

## 🌐 API

| Rota                                   | O que devolve                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/feat`, `/spell`, `/search`, `/companion` (`?name=`) | Descrição de talento, magia, item/habilidade ou companheiro, traduzida (ou em inglês com `lang=en`) |
| `/api/feats`, `/spells`, `/searches`, `/companions` | As mesmas, em lote                                                       |
| `GET /api/creature?q=&minLevel=&maxLevel=` | Busca de criaturas por nome e/ou faixa, paginada por cursor (`nextOffset`, `hasMore`) |
| `GET /api/creature?name=`              | Ficha completa da criatura, com o degrau de benchmark de cada número                   |
| `GET /api/search?affliction=` · `?spells=1` · `?rule=` · `?items=` · `?shields=` · `?gear=` · `?traitRules=` | Dados estruturados da AON: aflições, lista de magias, regra de um termo, traços de itens, escudos, armas e armaduras, regras de traço |
| `GET/POST /api/state`                  | Estado da mesa, fichas publicadas e preparo, rolagens, mapas, encontros, diário, wiki, anotações, troféus, notificações e conta |
| `GET /api/health`, `POST /api/clear-cache` | Saúde (e o ping que mantém o banco acordado); limpar o cache em memória            |

Toda chamada leva `?mesa=` (exceto a mesa padrão) e, em inglês, `lang=en`. A autorização é do servidor; o catálogo
completo das rotas do `state` está em `api/CLAUDE.md`.

---

## 📋 Formato de Dados

O app aceita o JSON exportado pelo **Pathbuilder 2e**:

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
        "abilities": { "str": 10, "dex": 14, "con": 14, "int": 16, "wis": 19, "cha": 12 },
        "proficiencies": { "fortitude": 4, "reflex": 2, "will": 4, "perception": 4, "...": "..." },
        "mods": { "Fortitude": { "Item Bonus": 1 } },
        "feats": [["Feat Name", null, "Class Feat", 1]],
        "specials": ["Special Ability 1"],
        "lores": [["Ancient Regional", 4]],
        "weapons": [
            { "name": "Longsword", "display": "+2 Striking Longsword", "die": "d8", "pot": 2,
              "str": "striking", "damageType": "S", "attack": 14, "damageBonus": 3 }
        ],
        "spellCasters": [
            { "name": "Cleric", "magicTradition": "divine", "spellcastingType": "prepared", "ability": "wis",
              "proficiency": 4, "perDay": [5, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
              "spells": [{ "spellLevel": 1, "list": ["Bless", "Heal"] }] }
        ]
    }
}
```

-   **O nome (`build.name`) é a identidade do personagem na mesa**: o PV, os slots e a ficha publicada são guardados por
    ele (sem o nível — subir de nível não perde nada).
-   Campos opcionais `featDescriptions`, `specialDescriptions` e `spellDescriptions` são aceitos; sem eles, as descrições
    vêm da AON.
-   O app corrige o que o Pathbuilder exporta errado (grimório vazio, pool de foco a mais, tamanho listado como
    habilidade…) ao ler a ficha, sem alterar o arquivo.

---

## 🧪 Testes e Conferências

Não há framework de teste; a validação é `npm run build` + `npm run lint` e os scripts abaixo, que saem com código
diferente de zero quando algo quebra.

| Script                                             | Confere                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `node scripts/check-rolls.mjs`                     | Matemática das rolagens contra as fichas do grupo, regras de classe, e que cliente e servidor recusam a mesma rolagem inválida |
| `node scripts/check-scaling.mjs 200`               | Motor do Escalar Monstro contra 200 criaturas reais: identidade, monotonia, ida e volta, ajuste fino |
| `node scripts/check-heightening.mjs`               | Heightening das magias contra o índice inteiro da AON                      |
| `node scripts/check-economy.mjs`                   | Todo talento/item do elenco que custa ação, reação ou Ponto Mítico tem caminho no app |
| `node scripts/check-trophies.mjs`                  | Regras e catálogo dos troféus (inclusive em inglês)                        |
| `node scripts/check-contrast.mjs`                  | Contraste das cores, nos temas claro e escuro                              |
| `node scripts/check-i18n.mjs`                      | Texto de tela em português fora de `tr()` (roda no `npm run lint`)         |
| `node --env-file=.env scripts/check-auth.mjs`      | Matriz de acesso contra o banco real (cria e apaga usuários de teste)      |
| `node --env-file=.env scripts/check-diary.mjs`     | O resumo do histórico em SQL contra a conta do cliente, dia a dia          |
| `node --env-file=.env scripts/check-migrations.mjs`| As migrations pendentes, em produção, dentro de `BEGIN … ROLLBACK`         |

Manutenção: `fetch-creature-tables.mjs` (tabelas do GM Core), `fetch-shared-class-features.mjs`,
`build-description-bundle.mjs` (pacotes de descrição), `prepare-sheets.mjs` (completa descrições e guias das fichas
publicadas), `seed-presets.mjs`, `grant-gm.mjs`.

---

## 🎯 Roadmap

### ✅ Feito

-   Ficha Virtual com publicação preparada, rolagens, ações, recursos, inventário, relíquias, anotações e as mecânicas
    das classes do elenco
-   Iniciativa com dano em área, aflições, dano persistente, escudos e encontros na nuvem
-   Mapa de Combate com tempo real, gestos ao vivo, áreas de efeito, mapas privados e a ficha ao lado
-   Estatísticas da Mesa, Diário de Campanha, Wiki da Mesa e Troféus do Covil
-   Transformação e Escalar Monstro
-   Contas com usuário e senha, convites, papéis e donos de ficha; várias mesas
-   Plataforma em português e inglês; tema escuro; Início por papel; notificações; busca ⌘K

### 🚧 Em andamento

-   **Fechar o login de vez** (`AUTH_REQUIRED=1`, fim das sessões anônimas antigas) e exigir login também nos endpoints da AON

### 📅 Planejado

-   Calculadora de Magias
-   Gerador de encontros aleatórios (hoje o planejador do Diário monta à mão)
-   PWA (instalar no celular, funcionar offline)

---

## 🤝 Contribuindo

-   TypeScript com tipagem forte, um módulo por ferramenta em `src/modules/`, lógica em arquivos próprios.
-   Interface em português **e** inglês (`tr('…', '…')`), código em inglês.
-   Leia o `CLAUDE.md` da raiz e o da área antes de mexer; rode `npm run build`, `npm run lint` e o script de conferência
    da área.
-   Commits pequenos, mensagens em português.

---

## 📄 Licença

MIT.

## 🙏 Agradecimentos

-   Comunidade Pathfinder 2e
-   [Archives of Nethys](https://2e.aonprd.com/) pela referência de regras
-   [Pathbuilder 2e](https://pathbuilder2e.com/) pelo formato de ficha
-   [monster.pf2.tools](https://monster.pf2.tools) pela inspiração

Pathfinder é marca da Paizo Inc. Este é um projeto de fã, não oficial.
