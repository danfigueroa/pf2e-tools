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

O toolkit expõe as ferramentas abaixo (rotas em `src/App.tsx`), listadas na página inicial:

| Ferramenta                    | Rota              | Módulo                                | O que faz                                                              |
| ----------------------------- | ----------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| **Ficha Virtual**             | `/ficha-virtual`  | `src/modules/character-viewer/`       | Visualizador interativo da ficha, com descrições da AON traduzidas     |
| **Iniciativa**                | `/iniciativa`     | `src/modules/initiative-tracker/`     | Ordem de turnos, dano em área, condições e aflições                    |
| **Mapa de Combate**           | `/mapa`           | `src/modules/battle-map/`             | Grid de 5 ft com imagem, tokens com barra de PV e régua                |
| **Stat Block de Transformação** | `/transformation` | `src/modules/transformation-statblock/` | Gera o stat block de qualquer _battle form_ do Remaster              |
| **Escalar Monstro**           | `/escalar-monstro` | `src/modules/monster-scaler/`        | Adapta uma criatura da AON para outro nível                            |

> ⏸️ **Ficha em PDF (`/character-sheet`) está desativada.** O código continua em
> `src/modules/character-sheet/` — e o `types.ts` dele ainda é usado pelos outros módulos —, mas a
> ferramenta está fora da rota, do menu e da página inicial. `/character-sheet` redireciona para a
> Início. Para reativar, veja os pontos marcados com `Desativado` no `CLAUDE.md`.

### 🪑 Mesas

O site atende mais de uma mesa de jogo. Cada mesa vê só o que é dela: fichas, presets, PV e condições,
mapas, encontro da Iniciativa, rolagens e regras compartilhadas. A mesa é escolhida no seletor **Mesa** da
barra lateral (fica lembrada no aparelho), ou por um link que já entra nela — `https://<app>/?mesa=<id>`,
copiado pelo item "Copiar link da mesa" do próprio seletor. Hoje são duas: **Casa do Gordo Online** e **Arton 1515**.
Quem nunca escolheu uma mesa fica na Casa do Gordo Online, como antes.

### ✅ Ficha Virtual (Implementado)

Visualizador interativo da ficha (formato **JSON Pathbuilder 2e**), pensado para uso na mesa em
qualquer dispositivo — no desktop as áreas viram **abas**; no mobile viram **acordeões**.

**Características:**

-   📂 **Carregamento**: upload de JSON, colar texto, ou **presets de campanha** prontos
    (`public/characters/*.json`, registrados em `campaignPresets.ts`). A última ficha fica salva na
    sessão (`sessionStorage`) e é restaurada ao recarregar.
-   🗂️ **Áreas**: Visão Geral, Combate, Perícias, Talentos, Habilidades, Magias, Companheiros e
    Inventário — as áreas sem conteúdo (magias, companheiros…) somem automaticamente.
-   📖 **Guia de Uso "Como Jogar"** na Visão Geral: um resumo tático por personagem (papel em
    combate, rotina de turno, recursos, erros comuns). É **escrito à mão** por ficha em
    `combatGuides.ts`; fichas ainda não catalogadas caem num **gerador heurístico** a partir dos
    dados da build (marcado como automático).
-   🌐 **Descrições sob demanda**: toque em um talento, habilidade, magia ou item e um _drawer_
    abre com a descrição completa buscada da **Archives of Nethys** e **traduzida para pt-BR**
    (requer o backend rodando; ver [API do Servidor](#-api-do-servidor)).
-   ✏️ **Correção de tradução pela mesa**: no pé da descrição, "Corrigir tradução" abre o texto para
    editar. A correção vale na hora para todos os aparelhos e as duas mesas, e a tradução automática
    nunca a desfaz. "Desfazer última correção" e "Voltar à tradução automática" estão a um toque.
-   🐾 **Companheiros e familiares**: stats de companheiros animais são pré-carregados do backend.
-   ✦ **Míticos**: personagens com talento mítico ganham o **pool de 3 Pontos Míticos**
    (gastar/devolver como os slots de magia, "Novo dia" para recuperar tudo) e o valor com
    **proficiência mítica** ao lado de cada salvaguarda, perícia e **ataque** — a proficiência
    mítica **substitui** a normal, não soma por cima.
-   🎲 **Rolar pela ficha**: tocar numa salvaguarda, na Percepção, numa perícia ou Saber, no
    **Rolar** de uma arma ou desarmado, no **Atq** do conjurador ou no botão da magia abre um
    diálogo com a **conta parcela por parcela** ("Mestre +16 · CON +4 · Item +1 · Amedrontado 1
    −1") e rola. O Golpe rola **ataque e dano juntos**, com o dano do **acerto e do crítico**
    (deadly e fatal incluídos); dá para escolher o 1º/2º/3º ataque (MAP, −4/−8 se ágil), ligar ou
    desligar cada dano extra (runas começam ligadas, precisão desligada) e somar um ajuste livre.
    A magia rola no **rank conjurado**, e a salvaguarda básica mostra o dano de cada grau. Cada
    rolagem pode ser **normal ou ✦ mítica** — a mítica gasta o Ponto Mítico sozinha. **Toda a mesa
    vê a rolagem** (ver [Rolagens da Mesa](#-rolagens-da-mesa-implementado)).
-   👥 **Estado compartilhado da mesa**: PV, PV de companheiros, slots de magia, pontos de foco,
    pontos míticos e condições são os **mesmos para todos os jogadores** — marcar 50 de dano no notebook aparece no
    celular de quem estiver na mesa **na hora**, pelo Realtime do Supabase (o cabeçalho mostra
    **Ao vivo**). Requer o Supabase configurado (ver [Instalação](#-instalação-e-execução)); **sem ele o
    app funciona igual**, só que o estado fica no aparelho e a sincronia volta a ser pelo botão **Atualizar**.
-   🌑 **Perfis situacionais de arma**: itens que ficam mais fortes em certas condições (a
    _Gloom Blade_ na penumbra, e mais forte ainda contra quem não te detecta) mostram ataque e dano
    de cada situação na aba de Combate — escritos à mão em `magicWeapons.ts`, calculados a partir
    dos números da própria ficha.
-   🎒 **Inventário completo**: armas e armaduras aparecem na lista junto do equipamento, com a
    descrição da AON a um toque.
-   🛡️ **Escudo**: o escudo vestido ganha um cartão na Visão Geral com **PV em barra própria** (cor
    de aço, para não confundir com o PV do personagem), **Dureza**, o limiar de quebra (BT) marcado
    na barra e o estado **Quebrado**/**Destruído**. **Erguer** soma o bônus na CA; **Bloquear**
    aplica o Bloqueio com Escudo (a Dureza segura, o resto vai para você e para o escudo);
    **Consertar** devolve PV pelo rank de Ofício (sucesso ou crítico). Os números vêm da AON, com as
    runas de reforço somadas, e o estado é da mesa.
-   💥 **Efeitos do crítico**: além do dobro, deadly e fatal, as **runas** entram no cartão (Flaming
    = 1d10 de fogo persistente, Shock repete o dano elétrico em até 2 criaturas, Corrosive; Frost e
    Thundering viram aviso com a CD) e a **especialização crítica** é lida das características da
    ficha — vale sempre para Guerreiro e Espadachim, em Fúria para o Bárbaro (Brutality), contra a
    presa para o Patrulheiro, e é um chip para Ladino e Bardo. Nada disso dobra.
-   ⚡ **Iniciativa pela ficha**: nos testes de Percepção, Furtividade, Atletismo e Acrobacia, o chip
    **Usar como iniciativa** manda o total para a Iniciativa do mestre, que o aplica ao
    personagem. O diálogo soma sozinho **Incredible Initiative**, **Elven Instincts** e
    **Battlefield Surveyor** (bônus de circunstância: não empilham, vale o maior).
-   ⏱️ **Ações do turno**: faixa fora das abas com os **3 pips de ação**, a **reação** e, com
    **Acelerado (Haste)**, a ação extra que só paga **Golpe ou Andar**. **Lento** e **Atordoado**
    tiram ações (os dois não somam). O Golpe, a magia (pelo custo da AON) e as ativações de 1 ação
    descontam sozinhos; **Andar/Interagir/Sacar** têm botão. Ao zerar, a ficha avisa **"Sem ações
    neste turno"** — e dá para rolar mesmo assim. A Iniciativa do mestre **zera as ações do
    personagem quando o turno dele começa**.
-   🔥 **Fúria do bárbaro**: um clique liga a Fúria — o dano dos Golpes corpo a corpo sobe (metade em
    arma ágil), entram os **PV temporários**, a **Raging Resistance** e, no instinto Gigante, o
    **Titan Mauler** com o Desajeitado que ele cobra.
-   🧠 **Psíquico**: **Unleash Psyche** soma 2 × o rank ao dano das magias de conjuração de Psíquico
    (com a ressaca em Estupefato 1), e os **psi cantrips** podem ser **amplificados** (1 Ponto de
    Foco) com o dano do amp. **Conservation of Energy** converte o dano para fogo ou frio.
-   🪄 **Magus**: **Arcane Cascade** (postura: dano extra de força, ou do tipo da última magia, nos
    Golpes corpo a corpo), **Spellstrike** dentro do Golpe — o jogador escolhe a magia (de qualquer
    bloco: Magus, arquétipo, inatas ou **Mythic Magic**), e **um clique** rola o Golpe e a magia,
    gasta o slot (ou o Ponto Mítico) e marca o Spellstrike como gasto —, **Summon Mythic Power**,
    **Divert Destiny** e **Fiery Rebirth**.
-   🏹 **Patrulheiro**: **Hunt Prey** (a precisão do Hunter's Edge vem ligada), **Gravity Weapon**
    (2 × os dados da arma no primeiro Golpe da rodada, gasta 1 Ponto de Foco) e **Hunter's Aim**.
-   🗡️ **Ladino**: **Poison Weapon** aplicado **na hora do Golpe** — o **veneno simples** (1d4, 2d4
    com o Improved; uma dose por nível por dia) é o padrão e os venenos do inventário são opção —,
    com a ação descontada sozinha, e **Debilitating Strike** como anotação da rolagem.
-   🛡️ **Guerreiro**: **Fearsome Brute** (o diálogo pergunta o medo do alvo), **Exacting Strike**,
    **Reflexive Shield** (o escudo erguido soma nos Reflexos) e o **Fiery Rebirth** mítico.
-   🪄 **Magias de ação variável** (Heal, Harm, Force Barrage, Blazing Bolt, Ki Blast, Disorienting
    Flash, Concordant Choir, Rebuke Death…): o jogador **escolhe quantas ações gasta** e o dano, a
    cura, os alvos, a área e os efeitos seguem a regra da magia. O **Blazing Bolt** de várias
    ações rola **um ataque e um dano por raio, num cartão só**, com o total no fim. As magias fora
    do catálogo ganham o seletor e o custo certo, sem número inventado.
-   🐾 **Companheiros de combate** (aba **Inventário**): criaturas da AON que entram **sozinhas** no
    combate junto com o personagem — a **Animated Armor** do Nathaniel. O jogador informa o nome da
    AON, envia o **token** uma vez e **enquadra** a imagem (centro e ampliação); a Iniciativa
    traz o token e o enquadramento, e o relê quando o encontro é aberto.
-   📱 **Guia de Uso no celular**: no layout de acordeão (celular e painel do mapa) o guia vira uma
    **aba que abre e fecha**, começando fechada — quem navega entre Combate, Perícias e Magias não
    rola uma página de texto a cada vez.
-   ⏩ **"Carregar todas" as magias** traduz o grupo inteiro numa chamada só (6 magias em ~3 s, eram
    ~60 s): o limite do tier gratuito é por chamada, não por magia.
-   ⚔️ Cálculos derivados (modificadores, PV, CA, salvamentos, ataques, dano de arma) via
    helpers reutilizáveis (`helpers.ts`). Salvaguardas, Percepção e perícias saem de uma fonte só
    (`checks.ts`), que soma o **bônus de item** da ficha (runa resiliente, botas, anel) e a
    **penalidade de armadura** quando a FOR não alcança a exigência. Os traços das armas (ágil,
    acuidade, deadly, fatal…) vêm da AON, já que o Pathbuilder não os exporta.

### ⏸️ Ficha de Personagem em PDF (Implementado, desativado)

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

### ✅ Gerador de Stat Block de Transformação (Implementado)

Gera o stat block de qualquer _battle form_ (magia de transformação) do Pathfinder 2e Remaster,
no **padrão oficial de bloco de criatura** e **traduzido para pt-BR**.

**Características:**

-   Interface step-by-step (Personagem → Forma → Stat Block → Exportar)
-   **Todas as battle forms**: Animal, Ooze, Insect, Aerial, Dinosaur, Fey, Elemental, Plant,
    Dragon, Fiend, Angel, Monstrosity, Nature Incarnate, Element Embodied e Avatar
-   **Importa a ficha (JSON Pathbuilder 2e)** para usar os modificadores reais do personagem
    (HP, salvamentos, percepção, atletismo, ataque) — segue a regra "use o valor da magia, a
    menos que o seu seja maior"
-   **Qualquer personagem da campanha** pode ser escolhido, não só conjuradores — a forma pode vir
    de pergaminho, varinha ou poção. Os botões são os mesmos presets da Ficha Virtual
-   Layout de bloco de criatura oficial (faixa vinho, tags de trait, corpo pergaminho,
    divisórias laranja, glyph de ação), tudo em português
-   Exportação em PDF/PNG (print-friendly)

### ✅ Escalar Monstro (Implementado)

Pega a ficha de qualquer criatura do **Archives of Nethys** e adapta para o nível que a sua mesa
precisa, pelas **tabelas de construção de criaturas do GM Core** (pg. 112-121, níveis -1 a 24).

Resolve o problema de gostar da ficha de um monstro que está no nível errado para o grupo.

**Características:**

-   Busca a criatura na AON por nome, por faixa de nível, ou pelos dois
-   **Preserva a personalidade do monstro**: em vez de trocar cada número pelo da tabela, guarda a
    diferença entre a ficha original e o benchmark dela e desloca tudo junto. Reescalar um monstro
    para o próprio nível devolve a ficha original, número por número
-   **Ajuste fino por estatística**: cada linha mostra o degrau que a AON atribuiu
    (Extremo/Alto/Moderado/Baixo) e permite trocá-lo — dá para pedir um ogro de nível 8 com CA
    extrema sem mexer no resto
-   Reescala CA, PV, percepção, salvamentos, atributos, perícias, ataques, dano e CD de magia
-   **As CDs e o dano das habilidades acompanham o nível**: a salvaguarda e a baforada que só
    existem escritas na prosa ("deals 15d6 fire damage … DC 36 basic Reflex save") são ajustadas
    junto — a CD pela tabela de CD do GM Core, o dano pela de **Dano em Área** (pg. 124) —, e as
    duas entram no ajuste fino como qualquer outra linha. O **teste plano** fica de fora: a CD dele
    é fixa pelas regras, não pelo nível do monstro; e "1d4 rounds" de recarga não é dano
-   **Monstro conjurador ganha ranks e slots ao subir de nível** e a lista de magias é sua: o
    editor busca no Archives of Nethys pela tradição do bloco e pelo rank do slot, e o que o nível
    novo abriu aparece marcado como vazio — a ferramenta nunca escolhe a magia por você. A escada
    anda preservando a forma (as magias do topo continuam no topo) e dá para pedir que os ranks
    fiquem nos originais, bloco a bloco. A mesma magia pode entrar mais de uma vez — três slots de
    3º com Fireball duas vezes e Haste uma —, com a notação do próprio Archives of Nethys. Slots seguem o GM Core pg. 122, respeitando o número que a
    ficha original já usava
-   **Diz o que não ajustou**: fora as CDs e o dano, a prosa das habilidades fica em inglês e
    intocada (alcance, duração, o efeito em si), a lista de magias não muda de rank e o dano extra
    dos golpes (`plus 2d6 fire`) fica como está — tudo listado num aviso, porque a ferramenta nunca
    inventa um número que o GM não conferiu
-   **Regra na hora, sem sair da ficha**: passe o mouse (ou segure o dedo, no celular) numa
    condição, habilidade, traço ou magia e a regra aparece numa caixinha, direto do Archives of
    Nethys e em inglês — vale também na ficha do monstro dentro do cartão de Iniciativa
-   Stat block no padrão oficial, com exportação em **PNG**
-   **"Enviar para Iniciativa"**: joga o monstro já reescalado direto no encontro

### ✅ Gerenciador de Iniciativa (Implementado)

Ferramenta de mesa para conduzir o combate: monta o encontro, mantém a ordem de turnos e aplica
dano, cura e condições em **um ou vários alvos de uma vez**.

**Características:**

-   **Importa os personagens da campanha** (presets ou JSON do Pathbuilder) e **busca monstros no
    Archives of Nethys** pelo nome **e/ou por faixa de nível** — útil para montar encontro na faixa
    do grupo —, já com PV, CA, percepção, salvamentos, resistências, fraquezas e imunidades; mais um
    formulário manual e um campo de quantidade para criar "Goblin 1..4"
-   **PV e condições dos personagens são os mesmos da Ficha Virtual**: o dano que o mestre aplica
    aqui aparece no celular do jogador, e vice-versa
-   **Dano em área do jeito que o PF2e funciona**: um valor de dano, cada alvo com o seu resultado
    de salvaguarda (falha crítica ×2, falha ×1, sucesso ÷2, sucesso crítico ×0), com resistência,
    fraqueza e PV temporários na conta — e o memorial visível antes de aplicar
-   **Condições com duração em rodadas**, que decrementa no turno do alvo e some ao vencer, sobre o
    catálogo Remaster completo (com condições impostas em cascata: Inconsciente → Cego,
    Desprevenido, Caído)
-   Ordem de turnos com o desempate oficial (o adversário age primeiro), ajuste manual, Adiar com
    reentrada e marcação de derrotado
-   Sugestão de **Morrendo** (já somando Ferido) ao um personagem chegar a 0 PV — nunca automática
-   **Levantar Escudo e Bloqueio com Escudo**: o botão escrito ergue o escudo (a CA do cartão sobe),
    e ele **abaixa sozinho no início do próximo turno** de quem ergueu. O próximo dano — no cartão
    ou no dano em lote, só físico — pode passar pelo escudo: a Dureza segura, o resto cai no PV e no
    PV do escudo, que quebra no BT. O escudo do personagem é o mesmo da Ficha Virtual; o do monstro
    vem da prosa da AON quando ela traz os números, ou é definido à mão

-   **Companheiros de combate entram junto**: ao adicionar um personagem, as criaturas que a ficha dele
    lista (a Animated Armor do Nathaniel) entram com a ficha da AON e o token — e não duplicam se o
    personagem for adicionado de novo. O **Atualizar** do cabeçalho (e abrir a página) relê o token e o
    enquadramento dos companheiros que já estão no encontro
-   **Ações do turno**: passar o turno (ou **Iniciar**) devolve as 3 ações e a reação do personagem
    que começa o turno, na ficha do jogador
-   **Fúria à vista**: o cartão mostra "Em fúria", soma a Raging Resistance à defesa e aplica o
    Desajeitado do Titan Mauler; a **iniciativa rolada pela ficha** é aplicada ao personagem (uma vez
    por rolagem, sem desfazer o ajuste manual do mestre)

O encontro fica só no aparelho do mestre — **um por mapa de combate** —; os personagens é que são
compartilhados com a mesa.

### ✅ Mapa de Combate (Implementado)

Mapa tático em `/mapa`, no espírito do Roll20. **Feito para desktop** (mouse e teclado); no celular
abre, mas não é o alvo.

**Características:**

-   **Grid de quadrados de 5 ft (1,5 m)**, com zoom pela roda do mouse (10% a 400%), botões de
    +/−/enquadrar e o botão do meio do mouse para arrastar o mapa em qualquer ferramenta
-   **Camada do mapa** (Modo GM, ferramenta **Mapa**): envia a imagem — reduzida no navegador para
    no máximo 4096 px — e define a escala digitando **largura ou altura em quadrados**, ou puxando
    uma das **quatro alças** (proporção travada). Fora dessa ferramenta o grid cobre só a imagem;
    dentro dela, aparece a área em volta, para mostrar até onde dá para crescer
-   **Tokens com barra de PV**, movidos quadrado a quadrado, mostrando a distância percorrida. A
    barra fica sempre por cima dos tokens. Personagem mostra os números; monstro mostra só a barra
    (os números ficam no Modo GM), e o jogador vê "Ferido / Muito ferido…" ao clicar
-   **Dano e cura no token**: clicar abre o painel. O PV do personagem é o mesmo da Ficha Virtual;
    o do monstro anda junto com a Iniciativa, nos dois sentidos
-   **Régua** com a regra das diagonais alternadas do Player Core (5-10-5)
-   **Desenhar** (para todos — quem conjura a Wall of Fire é o jogador): traço **livre**, **linha**
    reta que encaixa no grid e mostra o comprimento, 12 cores de efeito (Fogo, Gelo, Ácido, Arcano,
    Luz, Sombra, Elétrico, Veneno, Sangue, Sônico, Terreno difícil, Vital) e três espessuras. O
    modo **Apagar** mostra um **×** em cada desenho e apaga só aquele; "Limpar todos" fica no
    Modo GM. Os desenhos ficam sob os tokens, semitransparentes
-   **Área de efeito** (para todos): explosão, emanação, cone e linha medidos pela regra 5-10-5,
    com o tamanho em pés e a cor do efeito, e quantas criaturas a área pega
    ("Explosão 20 ft · 3 criaturas"). É uma consulta, como a régua: fica na tela de quem mediu até
    o próximo clique e não é gravada no mapa
-   **Alcance de movimento**: ao arrastar um token, três faixas (verde, âmbar, vermelha) mostram
    até onde ele chega com 1, 2 e 3 ações de Andar, e o rótulo diz quantas ações o movimento custa.
    O deslocamento do personagem é o da ficha, somando os bônus e nunca reduzido
-   **Ping**: clique duplo em qualquer ponto do mapa faz um anel dourado piscar ali, na tela de
    todos
-   **Rolador de dados** (botão **Dados**, sem trocar a ferramenta): d4 a d100, até 100 dados,
    bônus e cor. A rolagem vai para o feed da mesa, junto com as rolagens das fichas
-   **Vários mapas por sessão**: o GM cria os mapas na gaveta "Mapas da sessão" e **leva a mesa**
    de um para outro; quem estiver em outro mapa recebe o aviso "A mesa está em outro mapa — Ir"
-   **Mapas privados**: mapa novo nasce **escondido da mesa** — só quem está no Modo GM o vê na
    lista ou consegue abri-lo. O GM o prepara (imagem, encontro) e o **revela** pelo olho na lista
    ou pelo aviso no topo do mapa; levar a mesa para ele também revela. Quem estiver com o link
    aberto vê "Mapa ainda não revelado" e o mapa aparece sozinho na revelação
-   **Os tokens vêm da Iniciativa**: cada encontro é ligado a um mapa e cada combatente vira um
    token. O botão **Montar encontro** abre a Iniciativa já no encontro daquele mapa
-   **Imagem do token**: a do personagem é enviada no círculo do cabeçalho da Ficha Virtual e é
    **permanente** (vale em todos os mapas); a do monstro, no menu ⋮ do cartão da Iniciativa, e é
    **temporária** — some quando o mapa é apagado
-   **Apagar o mapa depois do jogo** leva junto a imagem, os tokens de monstro, as posições e os
    desenhos. O token dos personagens fica

-   **Ficha ao lado do mapa**: um painel de ~420 px à direita mostra a **Ficha Virtual** (no layout
    do celular) do personagem do jogador — **uma aba só** para o mapa e a ficha, com rolagens que
    funcionam. Descrições, diálogos de rolagem e de condições abrem **dentro do painel**, sem cobrir
    o mapa. O personagem se escolhe numa **grade de cartões com o token** (ou pelo seletor com
    nome, classe e nível) e fica lembrado no aparelho; o painel se recolhe pela aba da borda, e
    tocar num token de personagem oferece **Ver ficha**
-   **Menu discreto**: em `/mapa` a barra lateral some e vira uma aba na borda esquerda — o mapa
    ocupa a tela inteira, e reenquadra sozinho quando o painel abre ou fecha
-   **Enquadrar e trocar a imagem do token** (Modo GM → "Imagem e enquadramento"): arraste a imagem
    para escolher o que fica no **centro do círculo**, ajuste a **ampliação** (1–4×) e, para
    monstros, **envie outra imagem** no mesmo diálogo. A imagem inteira aparece esmaecida atrás do
    círculo; dá para aplicar às cópias com a mesma imagem e voltar à original

**Modo GM** é só um interruptor de interface, sem senha (não há login no app): mostra a camada do
mapa, os números de PV dos monstros, os mapas privados e as ações coletivas (criar, revelar,
levar a mesa, apagar, limpar desenhos).

Todos veem o mesmo mapa: os aparelhos acompanham as mudanças a cada 1,5 s enquanto a aba está
aberta, sem botão de atualizar.

### ✅ Rolagens da Mesa (Implementado)

Toda rolagem — da Ficha Virtual ou do rolador do Mapa — aparece **para todo mundo, em qualquer
página** (Ficha, Iniciativa, Mapa…), num cartão com os dados animados, o resultado e a conta.

-   Teste de d20 com **Natural 20/1** destacados; Golpe com ataque, dano e crítico no mesmo cartão;
    salvaguarda básica com o dano de sucesso, falha e falha crítica
-   **Magia de vários raios** (Blazing Bolt de 2 ou 3 ações): um cartão só, com o ataque e o dano de
    **cada raio**, o **total** dos raios e o total se todos forem críticos
-   Anotações da rolagem (veneno na arma, Debilitating Strike, Exacting Strike) aparecem no cartão
-   **Histórico** das últimas 30 rolagens em "Rolagens da mesa" (sidebar; no celular, o dado da
    barra do topo)
-   As rolagens chegam aos outros em ~3 s (~1 s no Mapa), sem botão de atualizar. Com a aba
    escondida o app não consulta nada

### 🚧 Em Desenvolvimento

-   Calculadora de Magias
-   Gerador de Encontros

---

## 🛠️ Stack Tecnológica

### Frontend

| Tecnologia        | Versão | Uso                     |
| ----------------- | ------ | ----------------------- |
| React             | 19.x   | Framework UI            |
| TypeScript        | 5.x    | Tipagem estática        |
| Vite              | 5.x    | Build tool e dev server |
| Material-UI (MUI) | 7.x    | Componentes de UI       |
| MUI X Data Grid   | 8.x    | Tabelas de dados        |
| jsPDF             | 3.x    | Geração de PDFs         |
| html2canvas       | 1.x    | Captura do stat block   |
| React Router      | 7.x    | Roteamento SPA          |

### Backend (Servidor de Scraping + Tradução)

| Tecnologia  | Uso                                             |
| ----------- | ----------------------------------------------- |
| Node.js     | Runtime                                         |
| Cheerio     | Web scraping da AON                             |
| Groq        | Tradução das descrições da AON para pt-BR       |
| HTTP nativo | Servidor de API local (`server/index.mjs`)      |

> O mesmo backend roda em dois modos: **funções serverless** em `api/*.js` (deploy Vercel) e o
> servidor local `server/index.mjs`, ambos compartilhando o núcleo `api/_lib/aon.js`. A tradução
> exige `GEMINI_API_KEY` e/ou `GROQ_API_KEY` (ver [Deploy](#-deploy-na-vercel-gratuito)).

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
-   Funciona sem o backend, mas as descrições traduzidas da AON ficam indisponíveis (use `dev:full`)

#### Desenvolvimento Completo (Frontend + API)

```bash
yarn dev:full
# ou
npm run dev:full
```

-   Frontend: `http://localhost:5173`
-   API: `http://localhost:3001`
-   Busca descrições automaticamente da Archives of Nethys
-   Para testar o **estado compartilhado da mesa** entre dois navegadores, preencha as variáveis do
    Supabase no `.env` (ver `.env.example`). Sem elas o servidor guarda só em memória — o que já serve
    para um teste local, mas não sobrevive a um restart. **Atenção:** com as chaves do projeto de
    produção, o `dev:api` local lê e grava no banco de verdade

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
    - Adicione `GEMINI_API_KEY` (tradutor primário) — chave gratuita em
      [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
    - Adicione `GROQ_API_KEY` (fallback) — chave gratuita em
      [console.groq.com/keys](https://console.groq.com/keys)
    - As duas são opcionais, mas com as duas configuradas a tradução continua funcionando quando
      um dos provedores fica indisponível ou esgota a cota diária

4. **Ligue o Supabase** (opcional — estado da mesa, fichas publicadas, feed, mapas, imagens e o
   cache de traduções)

    - Crie um projeto gratuito em [supabase.com](https://supabase.com), na região mais perto da mesa
      (a nossa é São Paulo, `sa-east-1`, com as funções da Vercel em `gru1`)
    - Em *Authentication → Sign In / Providers*, ligue **Anonymous Sign-Ins** (cada aparelho ganha
      uma sessão sem tela de login)
    - Aplique as migrations: `npx supabase link --project-ref <ref>` e `npx supabase db push`
    - Na Vercel, crie `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (só servidor), `VITE_SUPABASE_URL` e
      `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys, as chaves novas)
    - Sem isso o app funciona igual, mas PV, slots e condições ficam no aparelho de cada jogador e
      as imagens do mapa ficam no aparelho de quem as enviou

5. **Deploy**
    - Clique em "Deploy"
    - Aguarde o build finalizar
    - Seu app estará disponível em `https://seu-projeto.vercel.app`

#### Estrutura de API Serverless

```
api/
├── _lib/
│   ├── aon.js              # Núcleo: busca na AON (cheerio) + tradução (Groq)
│   ├── spell-parse.js      # Parse estrutural das magias
│   ├── spells-core.js      # Helpers de magias
│   └── metadata-i18n.js    # Dicionário de tradução de metadados
├── health.js               # GET  /api/health
├── feat.js / feats.js      # GET  /api/feat?name=...  ·  batch: /api/feats
├── search.js / searches.js # GET  /api/search?name=...  ·  batch: /api/searches
├── spell.js / spells.js    # GET  /api/spell?name=...   ·  batch: /api/spells
├── companion.js / companions.js # GET /api/companion?name=... (stats de companheiro animal)
├── state.js                # GET/POST /api/state — estado da mesa, fichas publicadas e mapas de combate
└── clear-cache.js          # POST /api/clear-cache
```

> `_lib/table-store.js`, `sheet-store.js`, `sheet-descriptions.js`, `roll-store.js` e `map-store.js`
> são os módulos com persistência (Postgres do Supabase); as imagens vão para o Supabase Storage, e
> o tempo real é o Realtime do Supabase, transmitido por triggers do banco. Todos os outros
> endpoints são stateless. O mapa mora dentro de `state.js` pelo limite de 12 funções do plano Hobby.


---

## 🏗️ Arquitetura do Projeto

```
pf2e-tools/
├── api/                          # Serverless Functions (Vercel) — ver estrutura acima
│   └── _lib/                     # Núcleo compartilhado (aon, spell-parse, metadata-i18n…)
├── public/
│   └── characters/              # Fichas de exemplo/campanha (Pathbuilder, campo `build`)
│       ├── brukuthur10.json
│       ├── cerosqualhanthallas10.json
│       ├── eldarion10.json
│       ├── ghanburi10.json
│       ├── nathaniel10.json
│       └── thalos10.json
├── scripts/                      # Rodados à mão, fora do build
│   ├── fetch-creature-tables.mjs # Gera creatureTables.ts a partir das tabelas do GM Core na AON
│   ├── check-scaling.mjs         # Confere o motor de escala contra criaturas de verdade
│   ├── check-rolls.mjs           # Confere a matemática das rolagens contra as fichas do grupo
│   └── ts-loader.mjs             # Deixa o Node importar os .ts do src/ nos scripts acima
├── server/
│   └── index.mjs                 # Servidor de API local (desenvolvimento)
├── src/
│   ├── layouts/
│   │   └── MainLayout.tsx        # Layout principal com navegação
│   ├── modules/
│   │   ├── character-viewer/     # Módulo de Ficha Virtual (visualizador interativo)
│   │   │   ├── CharacterViewerPage.tsx  # Página: abas (desktop) / acordeões (mobile)
│   │   │   ├── campaignPresets.ts       # Presets de campanha (fichas em public/characters)
│   │   │   ├── combatGuides.ts          # Guias "Como Jogar" (curados + fallback heurístico)
│   │   │   ├── helpers.ts               # abilityMod, totalHp, spellcasterStats, …
│   │   │   ├── sections/                # Overview, Combat, Skills, Feats, Specials, Spells, Pets, Inventory
│   │   │   └── components/              # UploadCard, CharacterHeader, DescriptionDrawer, GuideMarkdown
│   │   ├── initiative-tracker/   # Módulo de Iniciativa (gerenciador de combate)
│   │   │   ├── InitiativePage.tsx       # Página: turnos, seleção e ações em lote
│   │   │   ├── encounterReducer.ts      # Reducer do encontro + ordem de turnos
│   │   │   ├── encounterStorage.ts      # Persistência local do encontro
│   │   │   ├── useEncounterParty.ts     # PV/condições dos personagens no estado da mesa
│   │   │   ├── useCombatantViews.ts     # Unifica personagem e monstro numa interface só
│   │   │   ├── damage.ts / defenses.ts  # Dano RAW, resistência, fraqueza e imunidade
│   │   │   └── components/              # Cartão, barra de turno, diálogos de lote, busca AON
│   │   ├── battle-map/           # Módulo de Mapa de Combate (VTT, só desktop)
│   │   │   ├── BattleMapPage.tsx        # Página: barra de ferramentas, Modo GM, avisos
│   │   │   ├── geometry.ts              # Quadrado de 5 ft, diagonal 5-10-5, snap, tamanho do token
│   │   │   ├── drawing.ts               # Desenhos: simplificação do traço, validação
│   │   │   ├── hp.ts                    # Dano/cura no token
│   │   │   └── components/              # MapCanvas, Token, DrawingLayer, DrawPanel, ImagePanel, MapListDrawer, TokenPopover
│   │   ├── character-sheet/      # Módulo de Ficha em PDF
│   │   │   ├── CharacterSheetPage.tsx  # Página principal
│   │   │   ├── pdf.ts                  # Geração do PDF
│   │   │   └── types.ts                # Interfaces + parseCharacterJson (reusado pelos módulos)
│   │   ├── transformation-statblock/   # Módulo de Stat Blocks
│   │   │   ├── TransformationPage.tsx   # Fluxo em steps
│   │   │   ├── i18n.ts                  # Tradução pt-BR (vocabulário mecânico + nomes)
│   │   │   ├── components/              # CharacterInput, FormSelector, StatBlockGenerator, ExportOptions
│   │   │   └── data/                    # 1 arquivo por magia + spells.ts + from-pathbuilder.ts
│   │   └── monster-scaler/       # Módulo de Escalar Monstro (criatura da AON em outro nível)
│   │       ├── MonsterScalerPage.tsx    # Página: controles à esquerda, stat block à direita
│   │       ├── scaling.ts               # Motor: preserva a diferença em relação ao benchmark
│   │       ├── abilityDc.ts             # CDs escritas na prosa das habilidades
│   │       ├── abilityDamage.ts         # Dano escrito na prosa (baforada, aura, área)
│   │       ├── spellcasting.ts          # Ranks, slots e a lista de magias no nível-alvo
│   │       ├── ruleTerms.ts             # Que pedaços da ficha são termo de regra
│   │       ├── toCombatant.ts           # Monstro reescalado → combatente da Iniciativa
│   │       ├── components/              # MonsterSearch, ScaleAdjustPanel, MonsterStatBlock, MonsterExport
│   │       └── data/creatureTables.ts   # GERADO por scripts/fetch-creature-tables.mjs
│   ├── hooks/
│   │   └── useCreatureSearch.ts  # Busca de criaturas (debounce, faixa, paginação) — Iniciativa + Escalar Monstro
│   ├── pages/
│   │   └── HomePage.tsx          # Página inicial (cards das ferramentas)
│   ├── services/
│   │   ├── descriptions.ts       # Cliente do backend (busca + cache das descrições AON)
│   │   ├── creatures.ts          # Cliente da busca de criaturas na AON
│   │   ├── monster.ts            # Cliente da ficha completa de uma criatura
│   │   ├── spellList.ts          # Cliente da lista de magias (tradição + rank)
│   │   ├── rules.ts              # Cliente da regra de um termo (inglês, cacheado)
│   │   ├── supabase.ts           # Sessão anônima do aparelho e os canais do Realtime
│   │   ├── tableState.ts         # Estado compartilhado da mesa, em tempo real
│   │   ├── maps.ts               # Mapa de combate: tempo real + escrita otimista
│   │   └── images.ts             # Redução e envio de imagens (Supabase Storage, IndexedDB de reserva)
│   ├── types/
│   │   └── index.ts              # Tipos globais
│   ├── App.tsx                   # Componente raiz + rotas
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

### Módulo: Character Viewer (Ficha Virtual)

**Localização:** `src/modules/character-viewer/`

Visualizador interativo da ficha. Reaproveita `parseCharacterJson`/`BuildInfo` do módulo
`character-sheet`, então aceita o mesmo formato de JSON Pathbuilder.

#### Arquivos

| Arquivo                     | Responsabilidade                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `CharacterViewerPage.tsx`   | Estado da ficha, restauração por sessão, layout em abas (desktop) / acordeões (mobile), drawer de descrições |
| `campaignPresets.ts`        | Lista de fichas prontas (`public/characters/*.json`) exibidas no `UploadCard`        |
| `combatGuides.ts`           | Guias "Como Jogar" — curados à mão por nome + gerador heurístico de fallback         |
| `magicWeapons.ts`           | Armas cujos números mudam com a situação (Gloom Blade no escuro), casadas pelo nome |
| `helpers.ts`                | Cálculos derivados: `abilityMod`, `totalHp`, `spellcasterStats`, `isMythicCharacter`, `mythicProficiencyDelta`, … |
| `components/useMythicPoints` | Pool de 3 Pontos Míticos, compartilhado com a mesa (campo `mythic`)                 |
| `checks.ts`                 | Totais de salvaguardas, Percepção, perícias e Saberes, com a conta parcela por parcela (item, armadura, condições) |
| `strikes.ts`                | Conta do Golpe: atributo do ataque, MAP, dano, extras e crítico com deadly/fatal     |
| `rolls.ts`                  | Monta a rolagem que vai para a mesa (teste, Golpe, magia) e a identidade de quem rola |
| `components/RollDialog`     | Diálogo de rolagem: memorial, MAP, dano extra, ajuste, normal ou ✦ mítico          |
| `sections/*`                | Uma área por aba: Overview, Combat, Skills, Feats, Specials, Spells, Pets, Inventory |
| `CharacterSheetView.tsx`    | O corpo da ficha (hooks, faixas, abas/acordeão), usado pela página e pelo painel do mapa (`compact`) |
| `embedContext.ts` / `components/EmbedDialog` | Prendem gaveta e diálogos ao painel quando a ficha está embutida no mapa |
| `actions.ts` / `actionVariants.ts` | Orçamento de ações (Lento, Atordoado, Acelerado) e o catálogo das magias de ação variável |
| `rage.ts` / `psyche.ts` / `energy.ts` / `psiAmps.ts` | Fúria, Unleash Psyche, Conservation of Energy e os amps dos psi cantrips |
| `magus.ts` / `spellstrike.ts` | Arcane Cascade e poder mítico; opções e regras do Spellstrike dentro do Golpe |
| `ranger.ts` / `rogue.ts` / `fighter.ts` | Hunt Prey e Gravity Weapon; Poison Weapon; Fearsome Brute, Reflexive Shield e Fiery Rebirth |
| `initiative.ts` / `critEffects.ts` | Bônus de iniciativa da ficha; runas e especialização crítica |
| `companions.ts`             | Companheiros de combate do personagem (nome na AON, token, enquadramento)           |
| `components/*Bar.tsx`       | Faixas fora das abas: Ações, Fúria, Psique, Energia, Magus, Patrulheiro, Míticos     |
| `components/UploadCard`     | Upload / colar JSON / escolher preset                                               |
| `components/DescriptionDrawer` | Drawer que busca a descrição na AON e mostra traduzida                            |
| `components/GuideMarkdown`  | Render do markdown do guia de uso                                                    |

#### Guia de Uso "Como Jogar"

O guia tático de cada personagem fica em `combatGuides.ts`. Cada guia **casa por nome** da ficha
(`byName(...)`) e é escrito à mão (`curated: true`). Fichas sem guia catalogado caem em
`buildFallbackGuide()`, que monta um resumo automático a partir de classe, atributos, PV, CA,
saves e talentos — sinalizado na UI como guia automático.

> **Ao adicionar uma ficha nova:** copie o JSON para `public/characters/`, registre em
> `campaignPresets.ts` — com o `sheetName` **exatamente** igual ao `build.name` do JSON — e
> (recomendado) escreva um guia curado em `combatGuides.ts` casando pelo nome do personagem.

#### Fichas da campanha

Os presets de `campaignPresets.ts` aparecem em **três** lugares: na Ficha Virtual, no diálogo de
personagens da Iniciativa e no gerador de Transformação. Tirar ou pôr uma ficha ali mexe nos três.

Cada preset tem **dois nomes**: `name` é o rótulo curto dos cards e o nome do combatente na
Iniciativa ("Ceros" cabe onde "Cerosqualhanthallas" não cabe); `sheetName` é o nome como o
Pathbuilder exporta, de onde sai o slug do estado da mesa. É pelo `sheetName` que a Iniciativa sabe
quem **já está no combate** — pelo rótulo, "Ceros" e "Cerosqualhanthallas" dariam slugs diferentes e
o mesmo personagem entraria duas vezes, dividindo o mesmo PV.

| Preset                | Classe (nível 10)                   | Nome na ficha (casa o guia)          | Observações                                                        |
| --------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Brukuthur             | Bárbaro (Gigante), Android          | `Brukuthur, The Barbarian Android`   | Guia casa pelo começo do nome. Titan Wrestler trocado por Inventor. |
| Ceros                 | Patrulheiro (Precisão), Aiuvarin    | `Cerosqualhanthallas`                | Nome curto nos cards. Druid Dedication (Tempestade), arco longo.   |
| Eldarion              | Ladino (Thief) + Swashbuckler       | `Eldarion`                           | Venenos Fearweed, Toxic Effluence e Breath of the Mantis God.      |
| Ghan Buri             | Guerreiro (Bastion), Jotunborn      | `Ghan Buri`                          | —                                                                  |
| Nathaniel             | Magus (Sparkling Targe), Aiuvarin   | `Nathaniel o Magus`                  | Guia casa pelo começo do nome. **Anel corrigido à mão** (abaixo).  |
| Thalos                | Psíquico (Oscillating Wave), Humano | `Thalos Alba`                        | Chronoskimmer completo (4/6/8/10). Nome do export mudou (abaixo).  |

- **O JSON do Nathaniel tem uma edição à mão**: o jogador marcou o *Winder's Ring* por engano, e o
  anel de nível 7 certo é o **Ring of Wizardry (Type I)**
  ([AON 462](https://2e.aonprd.com/Equipment.aspx?ID=462)) — +1 de item em Arcanismo e dois slots
  arcanos de 1º rank a mais. A troca está no `equipment` e o +1 no `mods.Arcana`. Os slots extras
  **não** foram lançados em `perDay`: são preparados no dia, e a ficha não inventa magia pelo
  jogador. **Um novo export do Pathbuilder desfaz a troca** se o anel não for corrigido lá.
- **O Thalos virou `Thalos Alba` no export V3**, mas mantém o slug `thalos` (`SLUG_ALIASES` em
  `charId.ts` e `sheet-store.js`, espelhados): token, PV, slots e ficha publicada seguem valendo.
  Renomear outro personagem é uma linha nas duas tabelas. O guia casa pelo começo do nome (`startsWith('thalos')`). O arquétipo livre
  agora é **Chronoskimmer inteiro** (Dedication, Turn Back the Clock, Guide the Timeline, Reversing
  Charge, Steal Time); o Psychic Duelist foi trocado. Idiomas, Crafting treinado, Fast Recovery e
  duas poções (Annulment, Resistance) entraram. As magias de assinatura não são
  exportadas (ver abaixo). Não falta talento de classe de 1º nível: o Psíquico só ganha o primeiro no 2º.
- **Magias de assinatura do Thalos** (Breathe Fire, Blazing Bolt, Fireball, Ice Storm, Howling Blizzard) vêm de
  `signatureSpells.ts`, não do Pathbuilder: a aba de Magias as repete elevadas nos ranks acima do delas.
- **Os venenos do Eldarion vêm como "Invested"** do Pathbuilder, mas são consumíveis — o guia avisa.
- **Mythic Magic gasta Ponto Mítico, não slot** (Ceros e Nathaniel). O Pathbuilder exporta o talento
  como conjurador espontâneo com 5 slots de 5º rank, que não existem. A aba de Magias reconhece o
  bloco pelo nome (`isMythicMagicCaster`), não desenha pips, liga o botão de cada magia ao pool de
  Pontos Míticos da mesa e calcula CD e ataque com a **proficiência mítica** (nível + 10).
- **O Ardagar saiu da campanha** (setembro/2026): preset e `public/characters/ardagar10.json`
  removidos. O guia curado e a espécie do urso em `unarmed.ts` continuam no código porque casam
  pelo nome — quem carregar o JSON dele à mão ainda vê tudo certo.

#### Descrições traduzidas sob demanda

Ao tocar em um item (talento, habilidade, magia, equipamento), o `DescriptionDrawer` chama o
backend via `src/services/descriptions.ts`, que busca na AON e devolve o texto traduzido (com
cache). Sem o backend rodando, um _alert_ avisa e a ficha continua utilizável sem as descrições.

A **correção de tradução** feita pela mesa (`services/translationFixes.ts`, tabela `description_fixes`)
é uma camada por cima, aplicada na leitura: vale para a descrição venha ela do pacote pré-traduzido,
da API ou do cache do aparelho.

---

### Módulo: Initiative Tracker (Iniciativa)

**Localização:** `src/modules/initiative-tracker/` · **Rota:** `/iniciativa`

Gerenciador de turnos e combate. A decisão central do módulo é **onde cada fatia de estado mora**:

| Fatia                                        | Onde vive                                              |
| -------------------------------------------- | ------------------------------------------------------ |
| Combatentes, rodada, turno, durações, defesas | `useReducer` + `localStorage` + nuvem (abre em qualquer aparelho) |
| PV e condições de **personagem**              | estado da mesa — **as mesmas chaves da Ficha Virtual** |
| PV e condições de **monstro**                 | dentro do encontro                                     |
| Aflições e dano persistente de **personagem** | estado da mesa (aparecem na Ficha Virtual)             |
| Aflições e dano persistente de **monstro**    | dentro do encontro                                     |

Ou seja: o encontro é do mestre, mas o personagem é da mesa. O dano aplicado aqui aparece na Ficha
Virtual de quem estiver jogando, e o dano que o jogador marcar na ficha aparece aqui.

**Um encontro por mapa de combate.** O seletor "Mapa de combate" no topo troca o encontro: o mestre
prepara o do Mapa X e o do Mapa Y antes da sessão. Com um mapa escolhido, cada combatente vira um
token nele (`useMapSync.ts`), e o PV dos monstros anda nos dois sentidos entre o cartão e o token. O
encontro antigo, de antes dos mapas, virou o "Sem mapa".

**Encontro salvo na nuvem.** Cada encontro sobe sozinho e abre igual em qualquer aparelho da mesa: o
mestre monta no computador antes da sessão e joga no tablet. O que mudar num aparelho aparece no
outro em cerca de 1 s. O indicador ao lado do seletor de mapa diz "Na nuvem", "Salvando…" ou "Não
subiu". Se um aparelho tinha uma versão própria diferente da nuvem, abre a da nuvem e oferece
"Desfazer" para voltar à dele.

#### Arquivos

| Arquivo                       | Responsabilidade                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `InitiativePage.tsx`          | Turnos, seleção de alvos, diálogos e a sugestão de Morrendo/Derrotado             |
| `encounterReducer.ts`         | Reducer puro + ordem de turnos (`activeOrder`, `compareInitiative`, `peekNext`)   |
| `encounterStorage.ts`         | Carga e gravação do encontro no `localStorage` (um por mapa), com saneamento       |
| `useMapSync.ts`               | Combatentes → tokens do mapa ligado; PV de monstro nos dois sentidos               |
| `useEncounterParty.ts`        | PV e condições de todos os personagens do encontro, no estado compartilhado       |
| `useCombatantViews.ts`        | Unifica personagem e monstro numa interface só para o cartão                       |
| `damage.ts` / `defenses.ts`   | Dano RAW e casamento de resistência/fraqueza/imunidade por tipo                    |
| `afflictions.ts`              | Estágios de veneno/doença: salvaguarda, dano do estágio e duração máxima           |
| `persistentDamage.ts`         | Dano persistente: entrada, teste plano de recuperação e vínculo com a aflição      |
| `dice.ts`                     | Lê a fórmula de dano da prosa da AON e rola — o único ponto do módulo que rola dados |
| `importCharacter.ts`          | Ficha ou criatura da AON → combatente                                              |
| `components/CombatantCard`    | Cartão único (personagem e monstro), com PV, condições e ações do combatente       |
| `components/CombatantActions` | Os botões de condição, aflição, dano persistente e ficha, com contagem e pendência |
| `components/CombatantSheet`   | A ficha completa do monstro da AON, aberta dentro do próprio cartão                |
| `components/BulkDamageDialog` | Dano em área com resultado de salvaguarda por alvo                                 |
| `components/AonCreatureSearch`| Busca de criaturas em `/api/creature`, com quantidade                              |
| `InitiativePage.tsx` (companheiros) | `addWithCompanions` traz os companheiros de combate do personagem; `refreshCompanions` relê token e enquadramento |

#### Regras que o módulo implementa

-   **Dano** (Player Core, nesta ordem): multiplicador da salvaguarda (falha crítica ×2, falha ×1,
    sucesso ÷2, sucesso crítico ×0) → imunidade → fraqueza → resistência → PV temporários → PV.
    Resistência e fraqueza **não somam entre si**: vale a maior aplicável, e guarda-chuvas
    (`all`, `physical`, `energy`) contam. Defesa com ressalva ("physical 5 except cold iron") vira
    aviso, **nunca** número.
-   **Ordem de turnos**: em empate entre personagem e adversário, **o adversário age primeiro**.
    Entre dois personagens, as setas ↑↓ resolvem — e o ajuste sobrevive ao botão "Reordenar".
-   **Adiar**: ao voltar, a iniciativa passa a ser **permanentemente** a da nova posição.
-   **Durações** contam rodadas do próprio alvo: decrementam no início do turno dele e somem ao
    vencer.
-   **Queda a 0 PV** é sugestão, nunca automatismo: Morrendo `1 + Ferido` para personagem,
    Derrotado para monstro.
-   **Ficha do monstro no próprio cartão**: todo monstro vindo da AON ganha um botão "Ficha" que
    abre o stat block completo ali mesmo — Golpes, habilidades, magias, perícias —, sem trocar de
    aba. É buscada ao abrir e não fica guardada no encontro. Monstro adaptado pelo Escalar Monstro
    mostra a ficha **já no nível dele**, com os mesmos números do cartão.
-   **Aflições** (venenos e doenças buscados na AON): crítico ✓ −2 estágios, ✓ −1, ✗ +1,
    crítico ✗ +2; **Virulento** exige dois sucessos seguidos para melhorar um. O **dano escrito no
    estágio cai sozinho** ao entrar nele — inclusive ao melhorar, que RAW também é entrar num
    estágio. A aflição **some sozinha** quando a duração máxima vence, quando ela cabe no relógio do
    combate (rodadas e minutos; hora e dia o mestre encerra à mão).
-   **Dano persistente**: cai **ao final de cada turno** do alvo, com os dados rolados de novo, e em
    seguida vem o **teste plano de CD 15** para acabar (CD 10 com ajuda apropriada). Pode ser
    removido a qualquer momento, de personagem ou de monstro. O estágio de aflição que impõe dano
    persistente cria a entrada sozinho, e ela sai junto quando a aflição sai.

**O que o app rola e o que não rola.** Rolagem de quem está jogando continua na mesa: a iniciativa é
digitada, e salvaguarda, salvaguarda de estágio e teste plano são informados pelo mestre em botões.
O que o app rola são os dois danos que o RAW manda cair sem ninguém pedir — o do estágio de uma
aflição e o persistente do fim do turno —, porque pedir esses dois viraria um clique por turno por
combatente afligido. Cada aplicação automática mostra o memorial da rolagem e um **Desfazer**.
O que os jogadores rolam pela Ficha Virtual aparece na tela da Iniciativa, pelo feed de rolagens.

---

### Módulo: Battle Map (Mapa de Combate)

**Localização:** `src/modules/battle-map/` · **Rota:** `/mapa/:id?` · **Só desktop**

Sem id na URL, abre o mapa para onde a mesa está. O módulo é o único carregado sob demanda
(`React.lazy`), para não pesar em quem só abre a ficha.

| Fatia                          | Onde vive                                                        |
| ------------------------------ | ---------------------------------------------------------------- |
| Mapa (nome, imagem, escala)    | `map_fields`, campo `meta`                                       |
| Quem é cada token              | `map_fields`, `tok:<id>` — escrito só pela Iniciativa            |
| Onde está cada token           | `map_fields`, `pos:<id>` — escrito só pelo mapa                  |
| Como a imagem é enquadrada     | `map_fields`, `fit:<id>` — centro, ampliação e (monstro) a imagem enviada no mapa |
| PV de monstro                  | `map_fields`, `hp:<id>` — Iniciativa e mapa, nos dois sentidos   |
| PV e imagem de personagem      | estado da mesa (`hp`, `token`) — os mesmos da Ficha Virtual      |
| Cada desenho                   | `map_fields`, `drw:<id>` — uma linha por desenho                 |
| Ping                           | `map_fields`, `ping:<id>` — apagado por quem pingou em 6 s       |
| Rolagens de dados              | feed da mesa (tabela `rolls`), o mesmo das fichas                |
| Imagens                        | Supabase Storage: `tokens/` (permanente), `maps/` e `monsters/` (do mapa) |

#### Arquivos

| Arquivo                         | Responsabilidade                                                         |
| ------------------------------- | ------------------------------------------------------------------------ |
| `BattleMapPage.tsx`             | Barra de ferramentas, Modo GM, avisos, PV de cada token                   |
| `components/MapCanvas.tsx`      | Pan/zoom, grid, imagem, tokens, régua e gestos — sem render React no gesto |
| `components/Token.tsx`          | Token com imagem ou iniciais, barra de PV e nome                          |
| `components/DrawingLayer.tsx`   | Os desenhos, entre o grid e os tokens                                     |
| `components/DrawPanel.tsx`      | Modo (livre, linha, apagar), cor e espessura                              |
| `components/ImagePanel.tsx`     | Enviar a imagem do mapa e definir a escala em quadrados                   |
| `components/MapListDrawer.tsx`  | Criar, renomear, levar a mesa e apagar mapas                              |
| `components/AreaPanel.tsx`      | Forma, tamanho e cor da área de efeito                                    |
| `components/PingLayer.tsx`      | O anel do clique duplo, mostrado uma vez por aparelho                     |
| `components/DicePanel.tsx`      | Rolador de dados (quantidade, faces, bônus, cor); manda para o feed      |
| `areas.ts`                      | Quadrados de explosão, emanação, cone e linha; criaturas dentro           |
| `components/TokenPopover.tsx`   | Dano e cura no token                                                      |
| `components/SheetPanel.tsx`     | Painel da Ficha Virtual ao lado do mapa (seletor com token, grade de cartões) |
| `components/TokenBadge.tsx`     | O token do personagem, só para olhar (lê o mesmo campo da ficha)          |
| `tokenFit.ts` / `components/TokenFit*.tsx` | Enquadramento da imagem do token (centro e ampliação), com envio de imagem |
| `geometry.ts` / `drawing.ts`    | Distância PF2e, snap, tamanho do token; simplificação e validação do traço |
| `services/maps.ts`              | Tempo real (canal do mapa, com a revisão de cada escrita), poll de reserva e escrita otimista |
| `services/images.ts`            | Redução no navegador e envio direto para o Supabase Storage               |
| `api/_lib/map-store.js`         | Uma linha por campo, revisão, posição livre para token novo               |
| `api/_lib/map-handler.js`       | Rotas do mapa dentro de `/api/state`                                      |

#### Desempenho

Pan, zoom e arrasto de token escrevem direto no DOM dentro de um `requestAnimationFrame` — o React
não renderiza nada durante o gesto. O grid é um único `<svg>` com `<pattern>`. Medido com 40
tokens sobre uma imagem de 4096 px: 60 fps e nenhuma mutação de DOM nos tokens durante o gesto.

---

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

### Módulo: Transformation Statblock (Formas de Transformação)

**Localização:** `src/modules/transformation-statblock/`

Gera o stat block de uma _battle form_ do PF2e Remaster, no padrão oficial de bloco de criatura e
em português. O componente de preview é o mesmo que a exportação (PDF/PNG) captura via `html2canvas`.

#### Arquivos

| Arquivo                        | Responsabilidade                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `TransformationPage.tsx`       | Fluxo em steps: Personagem → Forma → Stat Block → Exportar                            |
| `i18n.ts`                      | Tradução pt-BR: rótulos, tipos de dano, sentidos, tamanhos, traits, imunidades e nomes de magias/formas/ataques |
| `components/CharacterInput`    | Import da ficha (JSON) ou entrada manual; seleção da magia                            |
| `components/FormSelector`      | Escolha da forma (criatura) da magia                                                 |
| `components/StatBlockGenerator`| Calcula os stats (RAW) e renderiza o bloco no layout Paizo                            |
| `components/ExportOptions`     | Exportação PDF/PNG/impressão (renderiza o StatBlockGenerator)                         |
| `data/spells.ts`               | Agrega todas as magias (`transformationSpells`) e helpers (`getFormsForSpell`, …)     |
| `data/<magia>.ts`              | 1 arquivo por magia: `<x>Spell` + `<x>Forms` (formas, ataques, habilidades)          |
| `data/from-pathbuilder.ts`     | Converte o JSON Pathbuilder em `PlayerCharacter` com modificadores reais              |

#### Regras (RAW) importantes

-   **AC** = valor da magia + nível do personagem (substitui a CA normal).
-   **Ataque / Atletismo** = `max(valor da magia, valor do personagem)` — a regra "a menos que o
    seu seja maior". Requer o modificador real (por isso o import da ficha).
-   **Salvamentos, Percepção e PV** não mudam com a transformação — usam os valores reais do
    personagem (ou aproximações treinadas quando não há import).
-   Battle forms **não** alteram atributos nem concedem ataque/DC de magia (removidos do bloco).
-   Caso especial: **Ooze Form** tem CA baixa de propósito (`7 + nível`), pois é imune a crítico.

#### Convenção de dados vs. tradução

Os arquivos `data/` mantêm valores **canônicos em inglês** para campos mecânicos (tamanho, tipos
de dano nas strings de ataque, traits, sentidos, imunidades) — o `i18n.ts` traduz no render. Já
**nomes e descrições de habilidades** são armazenados em pt-BR nos próprios `data/`. Os campos
`form.description` e `spell.description/heightened` não são exibidos no layout atual (dados de
referência) e permanecem em inglês.

---

### Módulo: Monster Scaler (Escalar Monstro)

**Localização:** `src/modules/monster-scaler/`

Pega a ficha de uma criatura do Archives of Nethys e adapta para outro nível, pelas dez tabelas de
construção de criaturas do **GM Core** (pg. 112-121, níveis -1 a 24). O bloco exibido é o mesmo que
a exportação em PNG captura via `html2canvas`.

#### Arquivos

| Arquivo                          | Responsabilidade                                                              |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `MonsterScalerPage.tsx`          | Página: controles à esquerda, stat block à direita (empilhado no celular)      |
| `scaling.ts`                     | Motor puro: ficha + nível-alvo + overrides → ficha reescalada + avisos         |
| `types.ts`                       | `MonsterDetail` (o que a API devolve) e `ScaledMonster` (o resultado)          |
| `toCombatant.ts`                 | Monstro reescalado → `NpcCombatant` da Iniciativa                             |
| `data/creatureTables.ts`         | **GERADO** por `scripts/fetch-creature-tables.mjs` — não editar à mão          |
| `components/MonsterSearch`       | Busca na AON (usa `hooks/useCreatureSearch`, compartilhado com a Iniciativa)   |
| `components/ScaleAdjustPanel`    | Uma linha por estatística, com o degrau trocável                              |
| `components/MonsterStatBlock`    | Renderiza o bloco no layout Paizo (subtree capturado pelo `html2canvas`)       |
| `components/MonsterExport`       | Exportação em PNG e botão "Enviar para Iniciativa"                            |

Backend: `api/creature.js?name=` → `api/_lib/monster-core.js` (números + degraus) e
`api/_lib/creature-parse.js` (golpes, habilidades e conjuração, do campo `markdown` da AON).

#### A regra que explica o módulo

Preserva-se a **diferença** em relação ao benchmark, nunca o benchmark cru.

Criaturas publicadas são feitas à mão e não batem com a tabela: o Bugbear Tormentor é "CA Alta" com
CA 20, enquanto a tabela diz 19 no nível 3. Trocar o número pelo da tabela apagaria a personalidade
do monstro e faria reescalar para o **próprio nível** devolver uma ficha diferente da original — a
ferramenta perderia a confiança do GM no primeiro teste.

Duas exceções à diferença: **PV usa razão** (cresce quase geometricamente, de 9 no nível -1 a ~500
no 24) e o **dano** pega os dados da tabela do nível-alvo, deixando o modificador fixo absorver o
desvio do golpe original.

No ajuste fino, a **origem** da conta usa sempre o degrau que a AON deu à ficha e só o **destino**
usa o degrau escolhido. Usar o escolhido dos dois lados faz o ajuste não fazer nada: as colunas da
tabela sobem quase em paralelo e a diferença se cancela.

#### O que **não** é reescalado

Por decisão de produto, e sempre listado num aviso na página:

-   A **prosa das habilidades** fica em inglês e intocada (dados e CDs dentro do texto ficam como
    estão).
-   A **lista de magias** não muda de rank — só a CD e o ataque de magia são ajustados.
-   O **dano extra** dos golpes (`plus 2d6 fire`) fica como está: é escolha de design da criatura e
    não segue a tabela de dano de ataque.
-   Defesas com ressalva (`"physical 5 except cold iron"`) nunca viram número.

A ferramenta **nunca inventa um número que o GM não conferiu** — mesma política do
`api/_lib/creature-core.js`.

---

## 🌐 API do Servidor

O servidor (`server/index.mjs`) fornece endpoints para buscar dados da Archives of Nethys.

### Endpoints

| Método | Rota             | Parâmetros | Descrição                                       |
| ------ | ---------------- | ---------- | ----------------------------------------------- |
| GET    | `/api/health`    | —          | Health check (verifica backend disponível)      |
| GET    | `/api/feat`      | `name`     | Busca descrição de um Feat                       |
| GET    | `/api/search`    | `name`     | Busca descrição genérica (Special Abilities/itens) |
| GET    | `/api/spell`     | `name`     | Busca informações detalhadas de uma magia        |
| GET    | `/api/companion` | `name`     | Stats de companheiro animal                      |
| GET    | `/api/creature`  | `q`, `minLevel`, `maxLevel`, `limit` | Busca criaturas por nome e/ou faixa de nível — sem tradução |
| GET    | `/api/creature`  | `name`     | Ficha completa de uma criatura, com o degrau de benchmark de cada estatística — sem tradução |
| GET    | `/api/search`    | `affliction` | Venenos e doenças com estágios, salvaguarda e duração — sem tradução |
| GET    | `/api/search`    | `gear`     | Traços das armas e penalidade das armaduras (`a\|b`), para as rolagens — sem tradução |
| POST   | `/api/clear-cache` | —        | Limpa o cache de descrições                      |
| GET    | `/api/state`     | `char`     | Estado de jogo compartilhado de um personagem    |
| POST   | `/api/state`     | body       | Grava uma fatia (`{ char, field, data }`)        |
| GET    | `/api/state`     | `char`, `field` | **Uma** fatia do estado — o poll das ações do turno quando não há tempo real |
| GET    | `/api/state`     | `rolls`, `rev` | Feed das últimas 30 rolagens (só o contador, se nada mudou) |
| POST   | `/api/state`     | `{ action: 'roll-add', roll }` | Manda uma rolagem já sorteada para a mesa |

As variantes **plurais** (`/api/feats`, `/api/searches`, `/api/spells`, `/api/companions`) aceitam
uma lista de nomes para busca em lote. Todas as descrições são **traduzidas para pt-BR** via Groq
antes de retornar.

`/api/creature` (nos dois modos) é a exceção: devolvem só os campos já estruturados do índice da
AON (números e vocabulário curto) e o stat block parseado, sem passar por nenhum modelo — traduzir
cada busca estouraria o rate limit do tier gratuito e deixaria a busca lenta demais para usar na
mesa. No modo `?name=`, a prosa das habilidades fica em inglês por decisão de produto.

> Os dois modos moram no mesmo arquivo porque o plano Hobby da Vercel permite **12 funções
> serverless por deploy**, e `api/*.js` já tinha 12. Confira a contagem antes de criar um endpoint.

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

### Estado da mesa (`/api/state`)

Único endpoint com estado. Guarda **uma linha por fatia** de cada personagem no Postgres
(`character_state`: `hp`, `slots`, `conditions`, `mythic`, `rage`, `psyche`, `energy`, `magus`, `ranger`, `rogue`, `actions`, `companions`, `shield`, `size`, `pet:…`) — assim dois jogadores editando coisas diferentes ao mesmo
tempo não se sobrescrevem. O personagem é identificado por um **slug do nome** (`Ghan Buri` →
`ghan-buri`), sem o nível, para que subir de nível não zere o estado da mesa.

```bash
curl "http://localhost:3001/api/state?char=ghan-buri"
# {"char":"ghan-buri","fields":{"hp":{"data":{"current":42,"temp":7},"updatedAt":…}},"storeReady":true}
```

Cada escrita é transmitida pelo **Realtime do Supabase** (um trigger do banco, no canal privado
`mesa:<mesa>:state`), e quem está com a ficha aberta recebe na hora — o cabeçalho mostra **Ao vivo**.
Sem o canal, a sincronia volta a ser sob demanda (ao abrir a ficha e no botão **Atualizar**).

Sem as credenciais do Supabase o servidor responde igual, mas guarda só em memória — o cliente avisa
**"Só neste aparelho"** e mantém tudo no `localStorage`.

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
-   [x] **Módulo de Ficha Virtual (visualizador interativo)**
    -   [x] Layout em abas (desktop) / acordeões (mobile)
    -   [x] Presets de campanha + upload/colar JSON + restauração por sessão
    -   [x] Guias de uso "Como Jogar" (curados à mão + fallback heurístico)
    -   [x] Descrições da AON traduzidas para pt-BR sob demanda (drawer)
    -   [x] Áreas: Combate, Perícias, Talentos, Habilidades, Magias, Companheiros, Inventário
    -   [x] Estado de jogo compartilhado entre os jogadores (PV, slots, foco, condições, pontos míticos)
    -   [x] Proficiência mítica em salvaguardas, perícias e ataques + pool de 3 Pontos Míticos
    -   [x] Rolar salvaguardas, Percepção, perícias, Golpes (ataque + dano + crítico) e magias pela
            ficha, normal ou ✦ mítico, com a conta à mostra
    -   [x] Bônus de item e penalidade de armadura nos testes
-   [x] **Módulo de Ficha de Personagem (PDF)** — _desativado na plataforma_
    -   [x] Upload e parsing de JSON
    -   [x] Geração de PDF completo
    -   [x] Layout profissional print-friendly
    -   [x] Seção de Ataques detalhada
    -   [x] Seção de Magias com informações completas
    -   [x] Bônus míticos em perícias e salvamentos
    -   [x] Integração com AON (feats, specials, spells)
    -   [x] Links clicáveis para referência
-   [x] **Módulo de Iniciativa (gerenciador de combate)**
    -   [x] Importação de personagens da campanha e busca de monstros na AON (nome e/ou nível)
    -   [x] PV e condições dos personagens compartilhados com a Ficha Virtual
    -   [x] Dano em área com resultado de salvaguarda por alvo, resistência e fraqueza
    -   [x] Condições com duração em rodadas
    -   [x] Ordem de turnos com desempate RAW, ajuste manual e Adiar
-   [x] **Módulo de Mapa de Combate (VTT, desktop)**
    -   [x] Grid de 5 ft com zoom, imagem do mapa com escala em quadrados
    -   [x] Tokens com barra de PV vindos do encontro da Iniciativa (um encontro por mapa)
    -   [x] Régua com diagonal 5-10-5
    -   [x] Desenhar (livre, linha, 12 cores, apagar um por vez)
    -   [x] Áreas de efeito PF2e (explosão, emanação, cone, linha) com contagem de criaturas
    -   [x] Alcance de movimento (1, 2 e 3 Andares) ao arrastar
    -   [x] Ping com clique duplo
    -   [x] Vários mapas por sessão, "levar a mesa" e apagar depois do jogo
    -   [x] Token do personagem permanente; o do monstro some com o mapa
    -   [x] Rolador de dados
-   [x] **Rolagens da mesa**: toda rolagem aparece para todos, em qualquer página, com histórico
-   [x] **Módulo de Escalar Monstro (criatura da AON em outro nível)**
    -   [x] Tabelas de construção de criaturas do GM Core transcritas do índice da AON (níveis -1 a 24)
    -   [x] Motor que preserva a diferença da ficha em relação ao benchmark (reescalar para o
            próprio nível devolve a ficha original)
    -   [x] Ajuste fino do degrau por estatística
    -   [x] Avisos do que não foi ajustado (prosa, lista de magias, dano extra)
    -   [x] Exportação em PNG e envio direto para a Iniciativa
-   [x] Servidor de scraping da AON

### 🚧 Em Progresso

-   [x] **Módulo de Stat Block de Transformação**
    -   [x] Interface step-by-step
    -   [x] Todas as battle forms do Remaster (inclui Ooze, Element Embodied, Avatar)
    -   [x] Importação da ficha (JSON Pathbuilder) com modificadores reais
    -   [x] Cálculos RAW (saves/percepção/ataque/atletismo reais)
    -   [x] Layout de bloco de criatura oficial, traduzido para pt-BR
    -   [x] Exportação PDF/PNG

### 📅 Planejado

-   [ ] Calculadora de Magias
-   [ ] Gerador de Encontros
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

// Bônus mítico (homebrew) — substitui a proficiência, não soma por cima
const mythicBonus = 10 + level + abilityMod

// Ataque com proficiência mítica: troca a parte de proficiência que já está no
// número do Pathbuilder (destreinado não soma o nível)
const mythicAttack = attack - (rank > 0 ? level + rank : 0) + (level + 10)

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

| Funcionalidade         | Arquivo                                                     |
| ---------------------- | ---------------------------------------------------------- |
| Ficha Virtual (viewer) | `src/modules/character-viewer/CharacterViewerPage.tsx`     |
| Guias "Como Jogar"     | `src/modules/character-viewer/combatGuides.ts`             |
| Presets de campanha    | `src/modules/character-viewer/campaignPresets.ts`          |
| Layout do PDF          | `src/modules/character-sheet/pdf.ts`                       |
| Tipos + parse do JSON  | `src/modules/character-sheet/types.ts`                     |
| Stat block (battle forms) | `src/modules/transformation-statblock/`                 |
| Motor de escala de monstro | `src/modules/monster-scaler/scaling.ts`                |
| Tabelas do GM Core (geradas) | `scripts/fetch-creature-tables.mjs` → `src/modules/monster-scaler/data/creatureTables.ts` |
| Parse do stat block da AON | `api/_lib/creature-parse.js`                           |
| Núcleo do backend AON  | `api/_lib/aon.js` (serverless) · `server/index.mjs` (local) |
| Fichas de exemplo      | `public/characters/*.json`                                 |
| Tema global            | `src/theme.ts`                                             |

### Testes

Validação obrigatória de mudanças não triviais:

```bash
npm run build   # tsc -b && vite build
npm run lint    # eslint
```

Não há framework de teste no projeto. O que existe é um script de conferência do motor de escala,
que roda contra criaturas de verdade da AON:

```bash
node scripts/check-scaling.mjs 200   # 200 criaturas; sai com código != 0 se algo falhar
```

Ele confere quatro propriedades: **identidade** (reescalar para o próprio nível devolve a ficha
original), **monotonia** (subir de nível não baixa número), **ida e volta** (+4 níveis e de volta
fecha) e **ajuste fino** (trocar o degrau move o número). Rode depois de qualquer mudança em
`scaling.ts` ou nas tabelas.

A matemática das rolagens tem o seu, que roda sem rede contra as fichas do grupo:

```bash
node scripts/check-rolls.mjs   # sai com código != 0 se algo falhar
```

Confere os totais de cada ficha (com o bônus de item), o mítico, o empilhamento de condições, o
MAP, o crítico com deadly e fatal, o piso de 1 no dano e que cliente e servidor recusam a mesma
rolagem inválida. Rode depois de mexer em `checks.ts`, `strikes.ts`, `rolls.ts` ou `src/dice/`.

Para testar a Ficha Virtual manualmente:

1. Execute `npm run dev:full` (frontend + backend de tradução)
2. Acesse http://localhost:5173 e abra **Ficha Virtual**
3. Escolha um preset de campanha (ou faça upload de um JSON Pathbuilder)
4. Navegue pelas abas e toque em talentos/magias para ver as descrições traduzidas

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
