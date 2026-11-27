# Regras opcionais e variantes

Levantamento feito na AON em 2026-11-24 (índice `aon`, categoria `rules`, mais as opções do Pathbuilder). O Remaster
reduziu muito as variantes: **o GM Core só tem quatro** (pg. 82–85). As outras são do *Gamemastery Guide* (legado,
sem versão Remaster na AON) ou de livros específicos (War of Immortals, Dark Archive). O mapa abaixo diz o que cada uma
muda no Criador e na Ficha, e em que fase entra.

Legenda de fase: **MVP** = até o lançamento (F8); **F9** = expansões; **—** = fora de escopo, com o motivo.

## 1. Mítico (War of Immortals) — usado pelos 10 personagens

Regras base (War of Immortals pg. 76–79, conferidas na AON):

| Regra | O que o Criador faz | Ficha | Fase |
| --- | --- | --- | --- |
| **Chamado** (*Calling*) ao ganhar o poder mítico (nível 1 ou depois), com éditos e anátemas; um só | Slot `mythic-calling` (escolha entre os chamados, ex. Artisan's, Handler's, Sage's Calling) | Já mostra em Habilidades | MVP |
| **Rewrite Fate** junto com o chamado | Concessão automática | Já existe (`mythicUse.ts`) | MVP |
| **Talento mítico** no 2º e em todo nível par | Slot `mythic-feat-N`, só talentos com traço Mythic | Já lê "Mythic Feat" | MVP |
| **Destino mítico** obrigatório no 12º (o talento de destino do 12º); do 14º em diante, talentos do destino ou míticos de nível menor; um destino só | Slot `mythic-feat-12` restrito a dedicações de destino; depois, filtro por destino | Mostrar o destino | MVP |
| Chamado recebido depois do 1º: ganha os talentos míticos dos níveis anteriores (de uma vez ou aos poucos, a critério do GM) | Campo `mythic.startLevel`; os slots anteriores aparecem como pendências que o GM pode liberar aos poucos | — | MVP |
| Retreinar o chamado (com o GM) | Retreino com histórico (RF-068) | — | F8 |
| **Proficiência mítica** = 10 + nível, só quando uma habilidade manda | Nada a compilar (é de combate) | Já existe | — |
| **Pontos Míticos**: 3 por sessão, máximo 3; quem tem não ganha Pontos de Heroísmo | Nada a compilar | Já existe (pool de 3) | — |
| **Runas míticas** (pg. 148) | Catálogo de runas (as que existirem como item) | Avisar se não calculado | F9 |
| Mythic Magic (conjurador mítico) | Conjurador próprio (MOTOR §8) | Já existe | MVP |

**Regras míticas alternativas** (*War of Immortals Alternate Mythic Rules*, pg. 2–4):

| Variante | O que muda | Criador | Fase |
| --- | --- | --- | --- |
| *Mixed Play* (parte do grupo mítica) | Por personagem, não por mesa; os não míticos podem receber Free Archetype e mais Pontos de Heroísmo | `mythic` por personagem (exceção da mesa) | MVP |
| *Free Archetype* com Mítico | O livro recomenda **não** somar os dois (os níveis dos talentos extras coincidem) — **as duas mesas somam por regra da casa** | Permitir os dois juntos, sem aviso, quando a mesa liga ambos | MVP |
| *Alternate Mythic Progression* / *Mythic Trials* | Poder mítico desacoplado do nível: avança por provações (feitos míticos, monstros míticos) | `mythic.rank` independente do nível; o GM concede cada degrau; os slots míticos seguem o rank, não o nível | F9 |
| *Mythic Late Start* | Mítico começa tarde, sobe por provações | Mesmo mecanismo do rank | F9 |
| *High Mythic, Low Level* | Rank mítico acima do nível | Mesmo mecanismo do rank | F9 |
| Opção do Pathbuilder "Mythic Destinies as high level archetypes" | Destinos como arquétipos de nível alto (regra da casa) | Regra da mesa | F9 |
| Opção do Pathbuilder "Apply Mythic via custom feat choices only" | Mítico só por slot manual | Coberto por "slot extra do GM" | — |

## 2. GM Core (Remaster) — as quatro variantes oficiais

| Variante | O que muda | Criador | Ficha | Fase |
| --- | --- | --- | --- | --- |
| **Free Archetype** (pg. 84) | Talento de arquétipo extra nos níveis pares, só de arquétipo | Slot `archetype-feat-N` | Já lê "Archetype Feat" | MVP |
| **Automatic Bonus Progression** (pg. 83) | Tira o bônus de item de runas/itens (menos o da armadura) e dá **potência** pelo nível: ataque, perícia, defesa, percepção, salvaguarda, *devastating attacks* (dados extras), *attribute apex* | Compila potências pelo nível e remove runas fundamentais do preço/slots | Precisa saber da variante (aviso até lá) | F8 |
| **Proficiency without Level** (pg. 85) | Bônus de proficiência sem nível (+2/+4/+6/+8; destreinado −2) e ajustes de encontro/tesouro | Compila sem nível | **Precisa** de ajuste na Ficha, Iniciativa e Escalar Monstro | F9 |
| **Level 0 Characters** (pg. 84) | Personagens nível 0 (proficiências iniciais, PV, dinheiro, opção de aprendiz) | Nível 0 permitido | Nível 0 em toda a plataforma | — (pedido raro; reavaliar) |

## 3. Opções do Player Core (fazem parte da regra, não são variantes)

| Regra | Criador | Fase |
| --- | --- | --- |
| Boosts alternativos da ancestralidade (dois livres) | Opção na Origem | MVP |
| Flaws voluntários | Opção na Origem | MVP |
| Raridade e acesso (incomum/raro só com acesso) | Regras da mesa (`rarity`) + exceções | MVP |
| Retreinar | Retreino com histórico | F8 |
| Pontos de Heroísmo | Ficha (quem é mítico não tem) | — |
| Riqueza inicial em nível > 1 (GM Core, *Character Wealth*) | Referência + aviso (D6) | MVP |

## 4. Gamemastery Guide (legado, sem versão Remaster)

A mesa pode adotar essas variantes como **regras da casa**. Após o MVP, implemente na F9 as variantes solicitadas por uma mesa (D8).

| Variante | O que muda | Uso atual | Criador | Fase |
| --- | --- | --- | --- | --- |
| **Ancestry Paragon** (GMG pg. 194) | Talentos de ancestralidade extras | **Ceros, Hearts Folly, Thalos e Woyd** | Slots extras de ancestralidade (níveis a conferir na AON; o export mostra o slot no 3º) | MVP |
| Dual-Class PCs (pg. 192) | Duas classes completas | — | Segunda classe: slots, proficiências, magias das duas; `dualClass` no export | F9 |
| Gradual Ability Boosts (pg. 182) | Os 4 boosts de 5/10/15/20 espalhados pelos níveis | — | Slots de boost por nível | F9 |
| Point Buy / Alternative Scores (pg. 182–183) | Atributos por pontos ou por rolagem | — | Pontuação 3–18 legada; não combina com o Remaster | — |
| Skill Points (pg. 199) | Perícias por pontos | — | — | — |
| Stamina (pg. 200) | Pontos de Vigor e de Determinação, ações de Vigor | — | Compilar Vigor/Determinação e ajustar o dano na Ficha, na Iniciativa e no Mapa | F9 sob pedido |
| Simplified Ancestries / Simplified Skill Feats (pg. 194) | Menos escolhas | — | — | — |
| Deep Backgrounds (pg. 186) | Tabelas narrativas | — | Poderia virar gerador de história nas Anotações | — |
| High-Quality items (pg. 197) | Itens de qualidade | — | — | — |
| Alignment Variants (pg. 184) | Tendência | — | O Remaster tirou a tendência | — |
| Level 0 (pg. 195) | Ver GM Core | — | — | — |

## 5. Outros subsistemas que tocam a criação

| Subsistema | Fonte | Uso atual | Criador | Fase |
| --- | --- | --- | --- | --- |
| **Relíquias** | GM Core | **Todos os personagens** têm relíquia (catálogo `RELICS` na Ficha) | Semente no item da mochila, aspectos, despertar de cada dádiva e opção de runa no mesmo espaço de escolha | F9.12 |
| Habilidades desviantes (*Deviant Abilities*) e talentos *Aftermath* | Dark Archive (Remastered) | — | Talentos raros, liberados pela mesa | F9 |
| Arquétipos de classe (*Class Archetypes*) | Vários | — | Substituição de características | F9 |
| Livros e Adventure Paths liberados | Pathbuilder: Rulebooks/Setting/Adventures | — | Regras da mesa (`sources`) | MVP |
| Conteúdo de terceiros (Battlezoo) | Pathbuilder | — | — | — |

### Relíquias escolhidas pelo jogador

A relíquia acompanha o nível do dono. Os marcos típicos são duas dádivas menores (níveis 1 e 5), duas maiores (9 e 13) e uma grandiosa (17). O jogador pode planejar as escolhas futuras e registrar o nível de despertar combinado com o GM. A semente costuma ter dois aspectos. [GM Core, pp. 308–309](https://2e.aonprd.com/Rules.aspx?ID=3248)

A plataforma permite escolher uma runa no lugar do poder, por decisão da mesa. O GM Core recomenda omitir essa combinação na variante conduzida pelo jogador. Use a lista de runas por aspecto, grau e item. Para ajustar o tesouro, use o preço e nível próprios da runa. As dádivas ocupam espaços de propriedade quando o GM permite gravar propriedades na relíquia. As armas, armaduras e escudos seguem aceitando runas fundamentais normalmente. [GM Core, Runes as Gifts](https://2e.aonprd.com/Rules.aspx?ID=3248)

Os personagens novos começam com as escolhas do jogador. As concessões caseiras do elenco continuam vinculadas às relíquias antigas. Ao editar uma delas, cada dádiva herdada fica disponível até o jogador escolher uma substituta.

## 6. Como fica na configuração da mesa

```ts
interface MesaVariants {
  freeArchetype: boolean;
  mythic: { enabled: boolean; progression: 'level' | 'trials'; destinyAsArchetype?: boolean };
  ancestralParagon: boolean;
  abp: boolean;
  pwl: boolean;
  dualClass: boolean;
  gradualBoosts: boolean;
}
```

Valor por personagem (no `BuildState`), quando a mesa permite exceção: `mythic.enabled`, `mythic.startLevel`,
`mythic.rank` (progressão por provações).
