# Mapa de Combate (`/mapa/:id?`, `src/modules/battle-map/`)

VTT. Sem id na URL abre o mapa ativo da mesa (`mesas.active_map_id`). **Só desktop** (decisão do usuário): a regra dos 320px
não vale aqui; o toque que existe (pinça, alvos maiores) fica, mas não é requisito.

## Desempenho (molda o `MapCanvas` inteiro — não troque por estado React "porque é mais simples")

- Um "mundo" com uma `transform` CSS. Pan, zoom e pinça escrevem **direto no DOM num `requestAnimationFrame`**; nenhum render
  React durante o gesto (o rótulo do zoom só atualiza ao parar). Token arrastado move pelo ref; só o soltar vira escrita.
- Grid = **um `<svg>` com `<pattern>`**, nunca um elemento por quadrado.
- `will-change: transform` **só durante o gesto** (ligado sempre, o mapa fica borrado ao aproximar).
- A limpeza do efeito **zera** `frame`/`settle` além de cancelar (no StrictMode, um `frame` não zerado travava o `schedule`).
- Rótulos (régua) ficam fora do mundo; linhas dentro, com `vector-effect: non-scaling-stroke`. Alças, × e alvos em px de
  TELA via `--inv-zoom`.
- `Token` recebe números soltos (`fitX/fitY/fitZ`, `online`), nunca objetos, para o `memo` não repintar todos.
- **Token posicionado por `left/top`**, não `transform`, e a opacidade do derrotado vai nas peças: os dois criariam contexto
  de empilhamento e o token de baixo cobriria a barra de PV do de cima. Barra acima de todo token, depois nome, depois círculo.
- `ResizeObserver`: câmera intocada reenquadra; mexida mantém o centro.

## Geometria (`geometry.ts`)

- Mundo em quadrados, pixel só no desenho (`CELL_PX = 70`). Quadrado = 5 ft; régua com diagonais alternadas (5-10-5,
  `squaresBetween`). Token N×N (`sizeSquares`; Minúsculo ocupa 1 mas é desenhado menor, `tiny`), encaixa pelo centro (`snapToken`).
- O grid cobre só a imagem dimensionada (quadrados inteiros, folga de ¼); na camada do mapa, a área inteira. Sem imagem, 40×30.
- Imagem supõe 70 px por quadrado; o GM ajusta por quatro alças (proporção travada) ou digitando. Entrar na camada do mapa
  reenquadra com folga (`fit(0.6)`).
- O token cresce para a direita e para baixo (posição = canto superior esquerdo); não desloque a posição só na tela.
- **Troop** (`isTroop`/`troopSegments`/`troopSide`): um token 4×4 → 3×3 → 2×2 pelo PV (`withTroopSizes`, calculado no mapa).

## Dados e sincronia (`services/maps.ts`, `map-store.js`, `map-handler.js`)

- **Uma linha por campo, campos com donos diferentes** (`map_fields`): `tok:<id>` (o que o token É — só a Iniciativa),
  `pos:<id>` (onde ESTÁ — só o mapa; leva também `flip`), `hp:<id>` (PV do monstro — os dois), `fit:<id>` (enquadramento e
  imagem própria — só o mapa), `drw:<id>`, `ping:<id>`, `meta`. `private` é coluna de `maps`, fora do `FIELD_RE` (só
  `map-visibility` mexe), porque o cliente regrava o `meta` inteiro. Campo único faria renomear um goblin desfazer o arrasto.
- **Quem grava `pos:` devolve o `flip`** (senão arrastar desvira).
- Toda escrita é função do banco (`map_write`, `map_clear_drawings`, `map_set_private`) que sobe a revisão; trigger transmite
  cada campo **mudado** em `mesa:<mesa>:map:<id>` (`field`, com valor e revisão). Lista e mapa ativo em `mesa:<mesa>:maps`
  (`changed`). PV/token/tamanho dos PCs pelo `onStateChange` do estado da mesa. Mapa inteiro (`read_map`) só na abertura e a
  cada (re)conexão.
- **Travas do cliente, todas necessárias**: descarta transmissão com revisão ≤ a da última leitura inteira ou ≤ a do campo
  (`fieldRev`, alimentado também pela resposta do POST); não toca campo na fila ou sobreposto (`overrides`); leitura inteira
  que saiu antes de uma transmissão e chegou depois não a desfaz (`recent`).
- **Campo igual não é regravado nem transmitido**; `syncTokens` não sobe a revisão sem mudança (com `sameJson`).
- Escrita otimista com override até voltar; PV de PC mexido no mapa vai para o campo `hp` da mesa (override de 5 s, pelo
  debounce de 600 ms do `tableState`).
- Escritas saem **uma por vez** (`flushing`): dois arrastos em paralelo podiam chegar invertidos. Rolagem, soltar token e ping
  sobem na hora (`{ now: true }`).
- **Poll de reserva sem canal**: `?mapRev=` (`map_revs`) com `&rev=&tableRev=`; se mudou, o mapa vem junto. Rajada 700 ms
  por 5 s depois de mudança, 1,5 s com atividade no último minuto (inclui `onFeedActivity`), 2 s parado, nada com a aba oculta.
- Token de outro aparelho **desliza** (`TOKEN_GLIDE`, 240 ms); quem arrasta não (`data-dragging`); movimento reduzido não.
- **O mapa não cria token**: quem está nele é o encontro da Iniciativa ligado a ele. Token novo nasce no primeiro quadrado
  livre da faixa de cima (`freeSpot`, no servidor).

## Papéis e privacidade

- **Quem é GM vem da conta** (`useRole`), sempre GM no mapa: camada do mapa, números dos monstros, mapas privados,
  criar/apagar/ativar. Jogador vê PC com números e monstro só com a barra ("Ferido/Muito ferido…"). Não existe mais "Modo GM".
- **Mapa novo nasce privado** (decisão do usuário). O servidor não entrega privado a quem não é GM (`?maps=`, `?map=`,
  `?mapRev=`); com `AUTH_REQUIRED` decide pelo papel, antes dele pelo `gm=1`. "Levar a mesa" revela junto (`map-activate`);
  esconder o mapa ativo tira a mesa dele — `activeId` nunca aponta para privado. `setMapPrivate` não sobe revisão sem mudança.
  Quem está num privado vê "Mapa ainda não revelado" e segue no poll barato (`hiddenRevs`, `hidden: true`).
- Acesso GM por entrada do store (`useMapData(id, gm)`). **A Iniciativa sempre lê como GM.**

## Ferramentas

- **Desenhar** (todos): Livre, Linha (pontas a cada ½ quadrado), Apagar (um por vez, × em px de tela numa camada **acima** dos
  tokens, `EraseBadgeLayer`, e tokens deixam o clique passar com `[data-erasing]`). Um campo `drw:<id>` por desenho, teto 300,
  "Limpar todos" do GM. Pontos em quadrados, simplificados por Ramer–Douglas–Peucker (0,04; afrouxa em vez de cortar).
- **Área** (todos): explosão, emanação, cone, linha. **É consulta, como a régua: nunca é gravada** (decisão do usuário); fica
  fixa até o próximo clique. Distância 5-10-5 **contando o próprio quadrado** (dá os moldes do livro). Explosão e cone saem de
  cruzamento; linha de ½ em ½ com 5 ft (no empate, um lado só). Cone de 90° encaixado em 45°. A prévia conta as criaturas.
  Áreas gravadas na versão antiga ainda são desenhadas pelo `DrawingLayer` (`type: 'area'`).
- **Alcance**: anéis de 1/2/3 Andares calculados uma vez no início do arrasto. Sem terreno, paredes nem condições. Velocidade
  do PC = `attributes.speed + max(0, speedBonus)` — **nunca reduzida** (`pcSpeed`, decisão do usuário).
- **Virar (F)**: espelha um invólucro do tamanho do círculo, não a `<img>` (inverteria o `fit`). Alvo pelo ponteiro
  (`elementFromPoint` + `data-token-id`); ignorado com campo de texto ou diálogo aberto.
- **Ping**: clique duplo (não Alt+clique, que ninguém achava), menos sobre token. Apagado em 6 s; quem recebe decide se pisca
  **pelo id**, não pelo relógio.
- **Mapa ao vivo** (`services/mapLive.ts`, `LiveLayer.tsx`): régua, área e arrasto de cada um na tela de todos, por Broadcast
  direto em `mesa:<mesa>:live:<mapa>`. **Nada vai ao banco.** `sendLive` onde o gesto já é desenhado; repetido não sai,
  máximo a cada 100 ms, apagar na hora; batimento de 3 s, some em 8 s. Cada aba é um remetente (`tabId`). Do lado de quem vê
  é React (só a `LiveLayer` assina). Canal com contagem de uso e 3 s de folga para fechar.
- **Dados** (`dice.ts`, `DicePanel.tsx`, `motion/DiceTray.tsx`): botão fora do seletor de ferramentas. d4–d100, 1–100 dados,
  ±999, sem piso. Vai para o feed (`postRoll`); o `roll:` do mapa ficou sem escritor. `DiceTray` não reusa `DiceRoll`: giro
  por CSS e um `requestAnimationFrame` escrevendo `textContent` (só os 24 primeiros). `DiceTray` com `maxWidth: min(340px, 100%)`.
- **Enquadrar o token** (`tokenFit.ts`, `TokenFitDialog.tsx`, `TokenFitEditor.tsx`): centro + ampliação 1–4× em `fit:<id>`;
  o padrão apaga o campo. "Enviar outra imagem" (monstro) grava em `fit:<id>.url`, nunca em `tok:`. Imagem nova zera o
  enquadramento; cancelar apaga o que subiu; a própria antiga sai se ninguém a mostra. `fitStyle`/`clampFit` nunca deixam
  canto vazio. Imagem de monstro sobe inteira (`NPC_TOKEN_MAX_SIDE` 512) e é recortada só no render.
- **Ordem de turnos** (`TurnOrder.tsx`, só leitura): `order` dentro do `tok:<id>` e `turn` existente.

## Imagens (`ImageFolder` em `services/images.ts`)

- `tokens/` = token de personagem, **permanente**; `maps/` e `monsters/` são do mapa e somem com ele. `isMapOwnedImage` no
  servidor nunca apaga `tokens/`. O mapa guarda em `imgs` toda imagem de monstro que passou por ele (`syncTokens` só acrescenta).
- Imagem de monstro só com o encontro ligado a um mapa (sem dono, nunca seria apagada).
- Reduzida antes de subir (mapa ≤ 4096 px, token de PC 256 px recortado no centro).

## Tela dividida: mapa + ficha (`SheetPanel.tsx`, `sheetChoice.ts`)

- Painel de ~420px com a `CharacterSheetView` em modo `compact`; `React.lazy`. Chaves próprias (`pf2e:map:sheet-open`,
  `pf2e:map:sheet`) — as da Ficha Virtual colidiriam. Overlays presos ao painel (`EmbedContext`); a gaveta de descrição ocupa
  a largura do painel. Seletor com `TokenBadge` (grade de cartões sem escolha; `Select` com escolha).
- PC com a ficha aberta em outro aparelho ganha o ponto verde (`online`). Popover de PC tem "Ver ficha".
- A página sangra até a borda; o `MainLayout` some em `/mapa` e o botão "Menu" abre a gaveta.

## Ligação com a Iniciativa

- **Um encontro por mapa** (`encounterStorage.ts`): `pf2e:initiative:v1:map:<id>`; a chave antiga é "Sem mapa". O mapa aberto
  na Iniciativa (`pf2e:initiative:map`) é o destino do `appendCombatants`.
- **`useMapSync`** manda a lista inteira de combatentes (com `size`, `tokenImage`, `tiny`, `troop`, `order`, derrotado) e o
  turno ativo, debounce 400 ms; o servidor cria, mantém e apaga tokens. Do PV de monstro sobe só o que mudou (`lastHp`).
- **Volta do PV**: o que difere do último valor vira `npcSetVitals`. Na abertura o mapa vence. Com envio pendente ou revisão
  lida mais velha que a da última escrita (`waitRev`), nada desce.
- Tamanho do PC por `withPcSizes` (do campo `size`), aplicado só na renderização. Troca de tamanho animada
  (`useResizeAnimation`, Web Animations; borda/brilho/anel divididos pela escala; barra anima `left/right`, não `scaleX`).
