# Criador de Personagem

- Consulte `docs/character-builder/ROADMAP.md` e `PROGRESSO.md` antes de editar para respeitar as dependências entre fases.
- Use o catálogo importado da AON para conteúdo e descrições para que o Criador funcione sem consultar a AON durante a edição.
- Complemente a mecânica e a progressão com dados estruturados de licença compatível do sistema PF2e do Foundry, em commit fixo, para cobrir efeitos ausentes na AON.
- Leia somente os JSONs do pacote do Foundry em diretório isolado para manter a ingestão reproduzível e evitar executar código externo.
- Confira cada regra marcada com 🔎 na AON Remaster e cite livro e página no código para tornar os cálculos verificáveis.
- Salve escolhas em `BuildState` e compile um retrato compatível com `BuildInfo` para preservar a Ficha, o estado da mesa e os uploads do Pathbuilder.
- Converta pré-requisitos não cumpridos e efeitos sem suporte em avisos para permitir escolhas sem inventar números.
