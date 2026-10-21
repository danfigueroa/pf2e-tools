# Integrar a marca Covil de Dados no app

Instruções para o Claude Code. O kit está em `brand/covil-de-dados/` (veja o `LEIA-ME.md` para cores, fontes e qual arquivo usar). O app se chamava "PF2e Toolkit" e passa a se chamar **Covil de Dados**.

## Tarefas

1. **Ícones e manifest:** copie para `public/` os arquivos de `brand/covil-de-dados/web/`: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` e `og-image.png`.
2. **`index.html`:** troque o `<link rel="icon" ... /pf2e-mark.svg>`, o `<title>` e a `description` pelas linhas de `brand/covil-de-dados/web/head.html`. Mantenha o `viewport`, o `theme-color` e o carregamento das fontes que já existem. A `og:image` precisa de URL absoluta: use o domínio de produção atual (`https://pathfinder.danielfigueroa.dev`) até o domínio mudar.
3. **Cabeçalho do app:** use `brand/covil-de-dados/svg/covil-logo-horizontal-fundo-escuro.svg` no cabeçalho verde (copie para `src/assets/` ou `public/`). Em telas estreitas, mostre só o símbolo (`covil-simbolo.svg`) + "COVIL" em Cinzel 700. Logo com `alt="Covil de Dados"` e altura de uns 36–44px no desktop.
4. **Nome visível:** troque "PF2e Toolkit" por "Covil de Dados" nos textos que o usuário vê, incluindo o rodapé do PDF em `src/modules/character-sheet/pdf.ts`. Não mexa em nomes de pacote, rotas, chaves de storage nem nomes de tabelas do Supabase sem perguntar.
5. **Rodapé:** adicione o aviso "Ferramenta de fã, gratuita e não oficial. Pathfinder é marca registrada da Paizo Inc."
6. **Limpeza:** remova `public/pf2e-mark.svg` só se nada mais o referenciar.
7. **Conferir:** rode o build e confira no navegador a aba (favicon), o cabeçalho no desktop e em 390px de largura, e o `site.webmanifest` sendo servido.

## Não fazer

- Não redesenhar, recolorir nem esticar os SVGs; eles já estão finais, com o texto em curvas.
- Não usar o logo colorido sobre foto ou textura; nesses casos, use as versões `-1cor-`.
