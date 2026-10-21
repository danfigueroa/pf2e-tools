# Covil de Dados — kit da marca

Conceito A, "O Tesouro do Covil": a boca de uma caverna guardando um d20 e dois d6.

## Pastas

- **web/**: tudo o que o site precisa. Copie para a raiz pública e cole o `head.html` no `<head>`.
  - `favicon.ico` (16, 32 e 48 px), `favicon.svg`, `apple-touch-icon.png` (180 px)
  - `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (ícone de app no celular)
  - `site.webmanifest` (nome, cores e ícones para "Adicionar à tela inicial")
  - `og-image.png` (1200×630, a prévia que aparece quando alguém manda o link)
- **svg/**: arquivos vetoriais, com o texto já em curvas (não depende da fonte instalada).
- **png/**: logos com nome em PNG transparente, para Discord, documentos etc.

## Qual arquivo usar

| Situação | Arquivo |
|---|---|
| Cabeçalho verde do app | `covil-logo-horizontal-fundo-escuro.svg` |
| Sobre pergaminho ou branco | `covil-logo-horizontal-fundo-claro.svg` |
| Tela de abertura, avatar do grupo | `covil-logo-empilhado-fundo-*.svg` |
| Só o símbolo, acima de 48 px | `covil-simbolo.svg` |
| Só o símbolo, 48 px ou menos | `covil-simbolo-reduzido.svg` |
| Impressão em P&B, carimbo, marca d'água | `*-1cor-preto.svg` / `*-1cor-branco.svg` |
| Uma cor nas cores da marca | `covil-simbolo-1cor-verde.svg` / `-pergaminho.svg` |

A versão em uma cor é de fato uma cor só: o que era dourado e pergaminho vira vazado (transparente).

## Regras rápidas

- **Tamanho mínimo:** símbolo completo a partir de 48 px; abaixo disso, use o reduzido. Logo horizontal a partir de 120 px de largura.
- **Respiro:** deixe em volta do logo um espaço livre de pelo menos ¼ da altura do símbolo.
- **Não faça:** esticar, girar, trocar as cores, pôr sombra ou colocar o logo colorido sobre foto. Sobre fundo complicado, use a versão em uma cor.
- O símbolo não tem fundo próprio: o arco verde é a própria forma. No cabeçalho verde, o arco se funde ao fundo e ficam a boca da caverna e o d20. Isso é proposital.

## Cores

| Nome | Hex | Uso |
|---|---|---|
| Verde floresta | `#1B3B2A` | marca, moldura, cabeçalho, theme-color |
| Verde covil | `#0E2217` | interior da caverna, sombras |
| Pergaminho | `#F3E9D2` | fundo do conteúdo, dados d6 |
| Latão | `#B8913A` | fios, d20, chão do covil (nunca texto pequeno sobre pergaminho) |
| Latão claro | `#E3C77A` | texto dourado sobre o verde |
| Latão escuro | `#7A5A1E` | "DE DADOS" e rótulos sobre pergaminho |

## Tipografia

- **Marca:** Cinzel 700 em "COVIL" (tracking 0.04em) e Cinzel 600 em "DE DADOS" (tracking 0.42em, entre dois fios de latão).
- **Interface:** Cinzel nos títulos, Source Sans 3 no texto. As duas são da Google Fonts, sob licença OFL (uso livre, inclusive comercial).

## Aviso sugerido no rodapé

> Ferramenta de fã, gratuita e não oficial. Pathfinder é marca registrada da Paizo Inc.

Antes de divulgar fora do grupo, vale ler a Community Use Policy da Paizo e a licença ORC (as regras do Remaster).
