# Prompt para o Claude Design — redesign do Criador de Personagem

> Cole o texto abaixo (da linha "Contexto" em diante) no Claude Design. Ele é autocontido.

---

## Contexto

Quero um **redesign completo do módulo "Criador de Personagem"** de uma plataforma web chamada **Covil de Dados**. É
uma ferramenta de fã, gratuita, para mesas de **Pathfinder 2e Remaster** (RPG de mesa), usada principalmente **no
celular, durante e entre as sessões**. A plataforma já tem identidade visual própria e madura (Ficha Virtual,
Iniciativa, Mapa, Wiki, Troféus). O Criador funciona bem, mas o visual dele está **feio e simplista**: parece um
formulário administrativo (abas, listas de chips, caixas com borda fina) e não transmite a sensação de "montar um herói".

O objetivo é que criar e evoluir um personagem seja **prazeroso, claro e com cara de livro de regras do Remaster**, sem
sair da identidade do resto da plataforma.

A referência funcional é o **Pathbuilder 2e** (o app que todo mundo da comunidade usa): ele é completo, mas denso e datado.
Quero a completude dele com uma apresentação muito melhor, mobile-first.

## O que o módulo faz

O Criador monta o personagem a partir das **escolhas** do jogador e calcula todos os números pelas regras. Ele não
pergunta números. Depois, o jogador **aplica na mesa**, e o personagem passa a existir na Ficha Virtual (a tela de jogo).

- **Escolhas**: ancestralidade, herança, background, classe e subclasse (escola arcana, instinto, doutrina,
  metodologia…), atributos (boosts), perícias, talentos de cada nível (1 a 20), magias, equipamento, companheiros e detalhes
  (retrato, idade, pronomes, background narrativo).
- **Calculado ao vivo**: PV, CA, Fortitude, Reflexos, Vontade, Percepção, CD de classe e de magia, deslocamento, ataques
  com armas, proficiências (Treinado, Perito, Mestre, Lendário), espaços de magia por dia e volume carregado.
- **Princípio "avisa, não trava"**: o app nunca impede uma escolha. Escolha fora da regra (pré-requisito não cumprido,
  livro não liberado pela mesa, raridade incomum) vira **aviso**. O que falta escolher vira **pendência**. O que o app não
  sabe calcular vira aviso "Efeito não calculado: X", nunca um número inventado.
- **Regras da mesa (GM)**: livros liberados, raridade, variantes (Free Archetype, Mítico, Ancestral Paragon, Automatic Bonus
  Progression), nível e riqueza inicial, exceções por personagem ("liberar este item incomum para o personagem X") e
  conteúdo caseiro da mesa (talentos, itens, magias criados pelo GM, com selo "Da mesa").
- **Salva sozinho** (autosave com indicador de estado), funciona sem rede com rascunho local e resolve conflito quando
  o mesmo personagem é editado em dois aparelhos.
- **Bilíngue**: toda a interface existe em português e em inglês; a pessoa escolhe na conta. Os nomes do conteúdo (talentos,
  magias) ficam em inglês canônico, como no livro. Preveja textos até ~30% mais longos em um dos idiomas.

## Quem usa

- **Jogador** (a maioria): cria o próprio personagem e sobe de nível entre sessões, quase sempre no celular. Conhece
  Pathfinder, mas não decorou as regras de cada nível. Quer saber **o que falta escolher agora** e **o que cada escolha muda**.
- **GM (mestre)**: cria personagens para outros, define as regras da mesa, libera exceções, vê os personagens de todos e
  cria conteúdo caseiro.
- **Colega de mesa**: abre o personagem de outro em **somente leitura** (tudo visível, nada editável).

## A jornada que o design precisa cobrir

Desenhe a jornada inteira. Estes são os momentos principais:

1. **Lista de personagens** (`/personagens`): meus personagens e os da mesa, em cartões. Cada cartão traz retrato, nome,
   "Magus 7 · Humano", estado (**Rascunho** / **Aplicado na mesa** / **Alterações não aplicadas**), número de pendências e
   dono. Ações: **Novo personagem**, **Importar ficha do Pathbuilder** (migração), **Catálogo** (navegar em talentos,
   magias e itens sem estar escolhendo nada), lixeira, e para o GM: filtrar por dono e "Regras de criação".
   Estado vazio convidativo ("Crie seu primeiro personagem").
2. **Criar do zero (fluxo guiado)**: nome e nível inicial, Origem (ancestralidade, herança, background), Classe e
   subclasse, Atributos, Perícias e idiomas, Talentos do nível 1, Magias (se conjurador), Equipamento (com o ouro inicial),
   Detalhes, Revisão e **Aplicar na mesa**. A pessoa pode pular passos e voltar; o resumo atualiza a cada escolha.
3. **Editar e subir de nível**: o personagem já existe. Subir para o nível N+1 destaca **só o que o novo nível pede** (boosts
   nos níveis 5/10/15/20, aumento de perícia, talentos novos, magias novas, características automáticas). Na revisão, mostra a
   diferença ("Nível 7 → 8: +1 talento de classe, +1 espaço de 4º rank, PV 98 → 112").
4. **Escolher conteúdo (o seletor)**: é o componente mais usado e precisa ser excelente. Busca, filtros (nível, raridade,
   só o liberado na mesa), lista e detalhe. Cada linha traz ícone de ações (◆ ◆◆ ◆◆◆ ↺ ◇), nome, nível com a cor da
   raridade, selos ("Da mesa", "Legado", "Fora das regras da mesa") e o **motivo de inelegibilidade na própria linha**
   ("Requer: Perito em Atletismo"). A linha inelegível continua tocável. O detalhe mostra traços, pré-requisitos com ✓ / ✗ / ?
   por parte, resumo, página do livro, a descrição completa sob demanda e **Escolher**. As listas chegam a 1.700 itens.
5. **Pendências e avisos**: um painel sempre à mão, com contadores. Tocar numa pendência leva direto à aba e ao slot.
   Para o GM, um aviso de "livro não liberado" tem o botão "Liberar para este personagem".
6. **Revisão e Aplicar na mesa**: ficha compacta, diferenças em relação ao que a mesa usa hoje, avisos agrupados
   ("Aplicar mesmo assim"), e o preparo com barra de progresso (o servidor monta a ficha e as descrições). No fim, o
   personagem está na mesa.
7. **Somente leitura**: o mesmo editor para quem não é dono, com o selo "Somente leitura — personagem de <dono>".
8. **Integração com a Ficha Virtual**: a Ficha tem "Editar no Criador", "Subir de nível" (abre o Criador no nível seguinte)
   e, no detalhe de um talento, "Trocar talento no Criador" (abre o seletor daquele slot). Desenhe esses pontos de entrada.
9. **Regras da mesa e conteúdo caseiro (GM)**: na página da mesa, a seção "Criação de personagem" (livros por edição,
   raridade, variantes, nível e riqueza inicial) e "Conteúdo da mesa" (criar e editar talento, item, runa, background,
   herança ou magia caseiros).

### As seções do editor (o que existe hoje)

| Seção | Conteúdo |
| --- | --- |
| Origem | Ancestralidade, herança, background, idiomas, divindade e santificação, boosts alternativos e flaw voluntário |
| Classe | Classe, atributo-chave, arquétipo de classe (opcional) e as subclasses do nível 1 |
| Atributos | Blocos de boosts (ancestralidade, background, classe, quatro livres), o modificador ao vivo e os boosts dos níveis 5/10/15/20 |
| Perícias | As 16 perícias e Lores com os pips T/E/M/L, o bônus total, os treinos escolhidos e os aumentos por nível; potência de perícia da ABP |
| Progressão | Níveis 1 a 20 (o atual aberto e os futuros como "planejado"), com slots de talento por tipo (classe, ancestralidade, geral, perícia, arquétipo, mítico), características automáticas, escolhas de classe e escolhas filhas |
| Magias | Um bloco por conjurador (classe e arquétipo): tradição, CD e ataque, espaços por rank, preparadas ou repertório, grimório, foco e rituais |
| Equipamento | Dinheiro e riqueza inicial, inventário com runas, investidos, volume e carga, os golpes que saem das armas e as fórmulas |
| Companheiros | Companheiro animal e familiar |
| Detalhes | Retrato, idade, gênero, pronomes, etnia, nacionalidade, background narrativo, retreinos, ajustes manuais com motivo, duplicar, copiar para outra mesa, criar página na Wiki, versões aplicadas, lixeira |

O resumo fixo de hoje mostra PV, CA, FORT, REF, VON, Percepção, CD e deslocamento, e cada número tem a conta no tooltip.

## Identidade visual: obrigatória, não reinvente

O módulo precisa parecer **parte da mesma plataforma**. A identidade é a da linha **Remaster** do Pathfinder (o trade
dress do Player Core e do GM Core): **verde profundo, pergaminho e ouro/latão**. Não é o vermelho do Pathfinder antigo.

**Estrutura de cor**: a **moldura** é verde (sidebar, cabeçalho do celular, barras, cabeçalhos de seção e blocos de
destaque, com filete dourado). O **conteúdo** é pergaminho, com tinta escura. O ouro aparece em filetes, bordas,
rótulos e destaques, nunca como texto pequeno sobre pergaminho.

### Tokens (use exatamente estes, em hex de 6 dígitos)

**Tema claro**
- Verde (moldura, igual nos dois temas): `deepest #14281D`, `main #1B3B2A`, `mid #2A5540`, `light #3D7357`
- Verde como tinta sobre o conteúdo (texto, ícone, borda): `#1B3B2A` / `#2A5540` / `#3D7357`
- Pergaminho: `page #EDE3CC` (fundo da página), `paper #F7F1E1` (cartões), `sunken #E3D7BC` (afundado)
- Ouro: `deep #7E611D` (ouro de TEXTO), `main #A8842C` (só filete e borda), `bright #C8A951`
- Tinta: `primary #23201A`, `secondary #5A5044`, `disabled #8A8072`
- Filete/divisória: `#CDBE9E`
- Estados: erro `#A62A21`, aviso `#B0761A`, sucesso `#2F7D46`, info `#2B5FA8`

**Tema escuro** ("pergaminho à luz de vela": a mesma moldura verde, conteúdo marrom quente)
- Verde como tinta: `#7DBB93` / `#6FAE86` / `#95CCA8`
- Pergaminho: `page #15130F`, `paper #1E1B15`, `sunken #29251D`
- Ouro de texto: `#D4B565` (main e bright iguais ao claro)
- Tinta: `#EDE3CC`, `#B8AC95`, `#8F8576`; filete `#3D372C`
- Estados: erro `#F07A6E`, aviso `#E8A84A`, sucesso `#6FC587`, info `#7FAEEA`

**Moldura verde (chrome, igual nos dois temas)**
- Bloco destacado `#16291F`, cartão sobre a moldura `#1A3027`, item ativo `#23402F`, linhas `#2C4A3B` / `#3A5A49`
- Texto sobre a moldura: título `#F3E6C4`, suave `#C9D2CB`, apagado `#A9B5AD`, rótulo de seção `#8FA096`
- Texto sobre a moldura usa sempre esses tons, **nunca os do pergaminho**, que somem no tema escuro.

**Cores semânticas do PF2e (já usadas na Ficha; reaproveite)**
- Tradições de magia (claro / escuro): arcana `#2B5FA8` / `#7FAEEA`, divina `#9A6B12` / `#E0B252`, oculta
  `#6B3FA0` / `#B993E6`, primal `#3E7A33` (verde).
- Proficiência: destreinado = tinta apagada, treinado = verde, perito = azul (arcana), mestre = roxo (oculta),
  lendário = âmbar (divina).
- Raridade (claro / escuro): comum = tinta secundária, incomum `#A84800` / `#F09A5A`, raro `#0C1466` / `#8F9DF5`,
  único `#800080` / `#E08AE0`.

### Tipografia e forma
- **Títulos em Cinzel** (serifada de inscrição, a mesma do logo), **corpo em Source Sans 3**. Ambas na Google Fonts.
- Cantos de **6 px** em cartões e botões. Sombras discretas e quentes (tinta a 5–8% de opacidade), nada de sombra
  fria ou neon.
- Cabeçalho de seção no estilo do livro: verde com filete dourado, ou título em Cinzel com filete dourado embaixo.
- Logo "Covil de Dados" (caverna com um d20 e dois d6) já existe; não precisa redesenhar a marca nem a moldura do app
  (sidebar verde no desktop, barra de abas embaixo no celular).

## Restrições técnicas (o design precisa ser implementável)

- **Celular primeiro**: todo layout funciona em **320 px** de largura, sem rolagem horizontal da página. Pontos de quebra:
  celular < 600, tablet 600–899, desktop ≥ 900 (a sidebar do app fica fixa a partir daí).
- **Alvo de toque ≥ 40 px** em tela de toque. Pips, chips e botões pequenos crescem no celular.
- Implementação em **React + MUI 7** com os tokens acima. Cor sempre em hex de 6 dígitos: nada de gradiente com
  `oklch`/`color-mix`, e transparência só por hex com alfa ou rgba sobre esses tokens.
- **Títulos sem tamanho fluido** (`clamp()`): o tema já reduz h1–h4 por media query.
- Elementos fixos no rodapé do celular ficam **acima da barra de abas do app**.
- **Movimento**: animação só apresenta (o estado muda na hora); a primeira pintura não anima; com "reduzir movimento",
  nada treme, gira ou conta.
- **Acessibilidade**: contraste ≥ 4,5:1 nos dois temas; nenhuma informação só por cor (raridade e inelegibilidade
  também têm rótulo); foco visível; navegação por teclado no seletor (↑/↓, Enter, Esc).
- Os dois temas, **claro e escuro**, são obrigatórios em toda tela.

## O que eu quero de você

1. **Uma direção de design** para o módulo, coerente com a identidade acima, que pareça "montar um herói num livro de
   regras" e não "preencher um formulário". Ideias que me interessam:
   - um **resumo do personagem com presença**: retrato, nome, classe e nível, os números principais e o estado de
     salvamento;
   - a **progressão 1–20 como uma trilha** visual, mostrando o que já está pronto, o que falta e o que está planejado;
   - **atributos e boosts** visualmente claros (de onde vem cada +1);
   - **perícias** com proficiência legível;
   - **pendências** que guiam sem assustar.
   Fique à vontade para propor uma estrutura melhor que as abas de hoje (por exemplo, passos na criação e um painel de
   plano na edição), desde que cubra todas as seções.
2. **Telas em alta fidelidade, celular (360–390 px) e desktop (1280–1440 px), nos temas claro e escuro**, para:
   - lista de personagens (com e sem personagens);
   - criação guiada (pelo menos Origem, Classe, Atributos e Perícias);
   - editor na visão de progressão e subida de nível;
   - seletor de conteúdo (lista e detalhe, com linhas elegíveis e inelegíveis);
   - magias de um conjurador;
   - equipamento;
   - painel de pendências e avisos;
   - revisão e "Aplicar na mesa";
   - somente leitura.
3. **Estados**: carregando o catálogo, sem rede ("salvo neste aparelho"), conflito ("mudou em outro aparelho"),
   personagem vazio, erro.
4. Um **pequeno inventário de componentes** que se repetem (cartão de slot, linha do seletor, bloco de atributo, pílula
   de proficiência, selo de estado, contador de pendência), já nos tokens acima, para eu implementar com MUI.

Use dados realistas de PF2e Remaster nos exemplos. Personagens de exemplo:
- **"Ghan Buri", Fighter 10, Jotunborn**: Warhammer +23, CA 29, Hero's Plate.
- **"Loki", Magus 7, Humano**: escola Laughing Shadow, com dedicação de Psychic.
- **"Woyd", Cleric 7, Humano**: Cloistered Cleric, domínio Void.

Textos em português, sabendo que existe a versão em inglês.
