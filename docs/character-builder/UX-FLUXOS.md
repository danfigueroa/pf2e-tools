# UX e fluxos do Criador

Princípios da plataforma que valem aqui: **celular primeiro** (320px), tema verde/pergaminho/ouro (`palette.ts`), alvo de
toque ≥ 40px, `tr()` em todo texto, "avisa, não trava", animação só apresenta.

## 1. Telas

### 1.1 Lista — `/personagens`

- Cabeçalho "Criador de Personagem" + botão **Novo personagem**.
- Cartões (grid `repeat(auto-fit, minmax(260px, 1fr))`): retrato (`useImageUrl`), nome, "Magus 7 · Humano",
  selo de estado — **Rascunho** / **Publicado** / **Alterações não publicadas** — e nº de pendências.
- Seção "Da mesa" (colegas): só cabeçalho, abre somente leitura.
- GM: filtro por dono, "Criar para…" (atribuir), atalho "Regras de criação da mesa".
- Vazio: ilustração + "Crie seu primeiro personagem" + "Importar do Pathbuilder".

### 1.2 Modo editar — `/ficha-virtual?ficha=<slug>&modo=editar`

Não é uma página separada: é o modo editar da própria Ficha. O cabeçalho da Ficha ganha o par **Jogar | Editar** (dono e
GM). Personagem novo, ainda sem ficha aplicada, abre direto no modo editar.

**Desktop (≥ md, 900px)** — três áreas, como o Pathbuilder, dentro da moldura do app:

```
┌───────────── Resumo fixo: nome · nível [−][+] · PV · CA · FORT/REF/VON · Percepção · CD · [Aplicar na mesa] [Jogar] ┐
├── Plano (1–20) ─────────┬── Conteúdo da etapa/aba ─────────────────────────────┬── Pendências e avisos ──┤
│ Origem                  │ (Origem | Classe | Atributos | Perícias | Talentos |   │ 3 pendências           │
│  Ancestralidade Humano  │  Magias | Equipamento | Companheiros | Detalhes |    │  • Talento de classe 2 │
│  Herança  —             │  Revisão)                                            │ 1 aviso                │
│ Nível 1 ✓               │                                                      │  • Pré-req. não…       │
│ Nível 2 ● 2 pendências  │                                                      │                        │
│ …                       │                                                      │                        │
└─────────────────────────┴──────────────────────────────────────────────────────┴────────────────────────┘
```

- O **plano** mostra cada nível com seus slots (cartões "Escolher…" e as características automáticas em texto). Nível
  acima do atual aparece esmaecido com o selo "planejado".
- O painel direito recolhe num ícone com contador quando a tela é estreita.

**Celular (< sm)** — fluxo em passos com a mesma informação:

1. Barra superior fixa compacta: nome, nível, PV, CA (toque abre o resumo completo numa folha).
2. Abas roláveis horizontalmente (ou passo a passo na criação): **Origem → Classe → Atributos → Perícias → Talentos →
   Magias → Equipamento → Companheiros → Detalhes → Revisão**.
3. "Talentos" no celular = acordeão por nível (só o aberto monta; `unmountOnExit`).
4. Botão flutuante **Pendências (3)** acima da barra de abas do app (soma `var(--tabbar-h)`).
5. Seletores abrem em tela cheia (`EmbedDialog`/folha), com lista e detalhe em duas camadas (toca na linha → detalhe;
   "Escolher" no rodapé).

### 1.3 Seletor de conteúdo (`ContentPicker`)

O componente que mais aparece. Comportamento:

- Abas do contexto (Talentos: Classe / Dedicações / Arquétipo / Todos; Armas: Simples / Marciais / Avançadas /
  Desarmadas / Proficientes; Itens: Equipamento / Consumíveis / Mágicos; Magias: por tradição ou só a do conjurador).
- Busca (nome, traço, texto do resumo) + filtros recolhíveis (nível, raridade, ações, fonte, traços) + ordenação
  (nível / alfabética). Preferência "abrir com filtros" é do aparelho.
- Linha: ícone de ações (◆ ◆◆ ◆◆◆ ↺ ◇), nome, selo de nível colorido pela raridade, selo "Da mesa" para homebrew.
  **Inelegível**: esmaecido + motivo curto na própria linha ("Requer: Perito em Atletismo"). Continua tocável.
- Detalhe: traços (chips da Ficha, `TraitChips`), pré-requisitos com ✓/✗/? por parte, descrição (`DescriptionContent`,
  pt/en, "Corrigir tradução"), fonte, "Ver na AON".
- Rodapé: **Escolher** (ou **Comprar** / **Dar** no inventário), **Limpar**, **Cancelar**.
- Lista virtualizada; teclado: ↑/↓, Enter escolhe, Esc fecha.

### 1.4 Diálogos específicos

| Diálogo | Conteúdo |
| --- | --- |
| Atributos (nível 1) | Blocos Ancestralidade / Background / Classe / Livres com chips dos seis atributos, modificador ao vivo, "boosts alternativos" e "flaw voluntário"; nível 5/10/15/20: 4 chips |
| Perícias | Lista das 16 + Lores com pílulas T E M L, a conta (atributo + prof + item), contador "Restam N", "Adicionar Lore" |
| Opções da arma | Runas (potência, striking, propriedade com slots), material, atributo de ataque, nome, traços extras, dano extra, overrides (com aviso) — o mesmo leque do Pathbuilder |
| Runas | Lista por nível com slots restantes, comprar/dar |
| Divindade | Busca, santificação, fonte divina, arma favorita, perícia, domínios |
| Companheiro | Tipo, maduro/incrível/especialização, armadura de montaria, equipamento |

### 1.5 Revisão e aplicar na mesa

- **Revisão**: ficha compacta (o mesmo layout da Visão Geral da Ficha, só leitura) + lista de avisos agrupados + diff
  contra a versão publicada (nível, talentos, magias, itens — `sheetDiff.ts`).
- **Aplicar na mesa** abre o resumo do que muda e, ao confirmar, o `PreparingDialog` atual (preparo com barra de passos). Ao fim, o modo jogar já mostra o retrato novo.
- Avisos não impedem aplicar; o diálogo os lista ("Aplicar mesmo assim").
- Edição não aplicada fica marcada no cabeçalho ("Alterações não aplicadas"); o modo jogar continua no retrato anterior.

## 2. Fluxos

### 2.1 Criar personagem (jogador, celular)

1. Início → cartão "Criar meu personagem" (ou menu → Criador → Novo).
2. Nome + nível inicial (padrão: o da mesa, se houver `startingLevel`).
3. Origem: ancestralidade → herança → background (seletores com detalhe).
4. Classe → escolhas de classe do nível 1 (escola, doutrina…).
5. Atributos (diálogo) → Perícias (diálogo) → Idiomas.
6. Talentos do nível 1 (ancestralidade, classe se houver, os concedidos aparecem prontos).
7. Magias (se conjurador).
8. Equipamento (15 po no nível 1; nível N: referência da tabela de riqueza).
9. Detalhes (retrato, idade, pronomes).
10. Revisão → Aplicar na mesa → o personagem passa ao modo jogar e entra na mesa.

Em cada passo o resumo atualiza na hora; "Pendências" mostra o que falta; pode-se pular passos e voltar.

### 2.2 Subir de nível

1. Ficha Virtual → "Subir de nível" (dono/GM; só quando a ficha tem build) **ou** Criador → personagem → nível [+].
2. O plano destaca o nível novo com as pendências (boosts, perícia, talentos, magias novas, características).
3. Ao cumprir: Revisão mostra o diff ("Nível 7 → 8: +1 talento de classe Spirit Sheath, +1 slot de 4º, PV 98 → 112").
4. Aplicar na mesa. Os outros aparelhos veem "Nova versão" (a ficha não troca sozinha embaixo do dedo).

### 2.3 Importar do Pathbuilder (transição)

1. Criador → "Importar do Pathbuilder" → enviar o JSON (ou "Importar a ficha publicada" para personagens da mesa).
2. Relatório: "Reconhecido: 52 itens · Sem correspondência: 2 (Zarroc Sheilvean → Longsword?) · Números que mudaram: CA
   24 → 24, Ataque 18 → 19 (o export estava 1 abaixo)".
3. Ajustar o que faltou → salvar como build com o **mesmo slug** da ficha publicada.

### 2.4 Regras da mesa (GM)

`/mesa` → seção "Criação de personagem": livros liberados (grupos Remaster / Lost Omens / Aventuras / Legado), raridade
(permitir / perguntar / negar), variantes (Free Archetype, Mítico, Ancestral Paragon, ABP, PwL, Dual Class), nível e
riqueza inicial; exceções por personagem ("liberar Incomum X para o build Y").

### 2.5 Ver o personagem de um colega

Lista → cartão do colega → editor em **somente leitura** (o padrão da Ficha: tudo visível, nada clicável — `ReadOnlyTheme`;
botão novo nasce travado; botões de ver levam `VIEW_OK`).

## 3. Estados e erros

| Estado | Comportamento |
| --- | --- |
| Carregando regras | Esqueleto do plano; seletor mostra "Carregando talentos de Magus…" só na lista que falta |
| Sem rede | Edição continua (rascunho local); faixa "Sem conexão — salvo neste aparelho"; reenvia ao voltar |
| Conflito (409) | "Este personagem mudou em outro aparelho" → Recarregar / Ver diferenças |
| Catálogo novo | Faixa "Regras atualizadas: 3 números mudaram" → Ver / Aplicar (RN-13) |
| Somente leitura | Selo "Somente leitura — personagem de <dono>" |
| Erro do servidor | Mensagem traduzida (`api/_lib/i18n.js`) |

## 4. Textos (amostra de `tr()`)

| pt | en |
| --- | --- |
| Criador de Personagem | Character Builder |
| Novo personagem | New character |
| Pendências | To do |
| Escolher… | Choose… |
| Requer: Perito em Atletismo | Requires: Expert in Athletics |
| Pré-requisito não reconhecido — confira | Prerequisite not recognized — please check |
| Efeito não calculado: {talento} | Effect not calculated: {feat} |
| Subir de nível | Level up |
| Aplicar na mesa | Apply to the table |
| Editar / Jogar | Edit / Play |
| Alterações não aplicadas | Unapplied changes |
| Alterações não publicadas | Unpublished changes |
| Importar do Pathbuilder | Import from Pathbuilder |

## 5. Acessibilidade

Seletores com `role="listbox"`/`option`, foco visível, rótulos nos pips T/E/M/L ("Treinado em Atletismo"), contraste
pelo `check-contrast`, nenhuma informação só por cor (inelegível tem texto, raridade tem rótulo), `prefers-reduced-motion`
sem animação.
