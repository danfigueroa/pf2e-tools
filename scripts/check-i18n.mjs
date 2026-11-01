// Acusa texto em PORTUGUÊS na interface que não passa pelo `tr(pt, en)` de `src/i18n`.
//
//   node scripts/check-i18n.mjs            # src/ inteiro (sai com 1 se achar algo)
//   node scripts/check-i18n.mjs src/pages  # só uma pasta ou arquivo
//   node scripts/check-i18n.mjs --count    # só a contagem por arquivo
//
// Lê o código com o compilador do TypeScript (comentários não contam) e olha cada string,
// template e texto de JSX. Parece português quando tem acento ou uma palavra da lista
// abaixo. Fica de fora: o 1º argumento de `tr()` (é o português, de propósito), chave de
// objeto, import/export, tipos, `console.*`, `new RegExp(...)` e comparação com dado.
//
// Falso positivo (um dado que só parece texto — id de troféu, nome de personagem) se cala
// com `// i18n-ok` na linha (ou na linha de cima), ou `/* i18n-ignore-file */` no arquivo.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = new URL('..', import.meta.url).pathname
const args = process.argv.slice(2)
const countOnly = args.includes('--count')
// `--strict`: também acusa texto com uma palavra que não está no dicionário de inglês do sistema
// (/usr/share/dict/words) — pega o português sem acento que a lista acima não tem. Barulhento
// (nome de talento, de personagem): é para revisão, não para o lint.
const strict = args.includes('--strict')
let english = null
if (strict) {
    try { english = new Set(readFileSync('/usr/share/dict/words', 'utf8').toLowerCase().split('\n')) } catch { english = null }
}
const targets = args.filter((a) => !a.startsWith('--'))
const roots = targets.length ? targets.map((t) => join(ROOT, t)) : [join(ROOT, 'src')]

const ACCENT = /[áéíóúâêôãõçàÁÉÍÓÚÂÊÔÃÕÇÀ]/
// Palavras que não existem em inglês (ou quase nunca aparecem num texto em inglês).
const WORDS = new Set(`
de da do das dos não com para uma um sem você voce ao aos na nas nos pelo pela pelos pelas que ou os
seu sua seus suas mais menos muito pouco este esta isto esse essa isso aqui ali agora depois antes
ficha fichas rolar rolagem rolagens salvar cancelar fechar abrir sessão sessao nível nivel
ações ação acao turno rodada dano cura magia magias talento talentos habilidade habilidades itens
personagem personagens jogador jogadores mestre mapa mapas criatura criaturas teste testes perícia
perícias carregando carregar gerar gerando apagar excluir remover adicionar editar trocar escolher
enviar compartilhar mostrar esconder ver todos todas nenhum nenhuma novo nova novos novas outro
outra outros outras erro falha tentar quando então já ainda também só sempre nunca
condição condições aflição aflições escudo armadura arma armas ataque ataques golpe golpes
iniciativa combate encontro encontros monstro monstros grupo diário histórico troféu troféus
anotações nota notas busca buscar entrar sair conta senha usuário convite membros configurações
vida pontos ponto foco espaço espaços truque truques nome próximo próxima anterior lista
desde sobre entre cada onde como porque quem qual quais tudo nada bem pode podem fazer feito ficar
fica ficam vai está estão são foi ser tem dar deu usar use usa usada usado gastar gasta gastou ganha
ganhar perde perder alvo alvos aliado aliados inimigo inimigos contra dia dias hora horas minuto
minutos segundo segundos vez vezes hoje ontem amanhã livre bônus penalidade salvaguarda
salvaguardas reflexos vontade percepção atletismo acrobacia furtividade medicina deslocamento
tamanho pequeno médio grande enorme imenso miúdo desarmado ágil letal carregado gasto pronto
prontas pronta aberto aberta fechado ligado desligado ativo ativa marcar marcado desfazer voltar
continuar confirmar sim jogar joga procurar escreva digite toque clique arraste solte imagem
imagens envio baixar publicar publicada publicado versão guia dica aviso atenção cuidado pendente
sucesso crítico falhou acerto errou rolou resultado soma média maior menor melhor pior primeiro
primeira segunda terceira último última seguinte rodadas turnos combatente combatentes derrotado
adiar ordem lento atordoado acelerado cego caído morrendo ferido condenado inconsciente amedrontado
desajeitado enfraquecido drenado fatigado estupefato desprevenido imobilizado agarrado contido
oculto escondido invisível confuso fascinado paralisado enjoado surdo quebrado destruído consertar
erguer bloquear dureza mão mãos corpo distância alcance área cone linha explosão emanação metros
quadrado quadrados régua desenhar desenho desenhos limpar camada privado revelar levar ativar
mesa mesas tirar pôr põe sobe desce vem vêm volta entra sai fim início meio parte partes faltam falta
precisa preciso deve devem cria criar criado salvo salva gravado gravar lido ler lê escolha escolhido
quantos quantas quanto quanta mudou muda mudar tipo tipos geral automático automática manual
persistente persistentes veneno venenos simples contundente perfurante cortante tratar ferimentos dobrado dobrada fogo frio eletricidade sônico vazio vitalidade espírito cenas cena elenco conjurada conjurado ganhou ganhei regra regras compartilhada compartilhado copiado copiada enviou envie forma formas te lhe
`.trim().split(/\s+/).filter((w) => !['mesa', 'mesas'].includes(w)))

const IGNORE_CALLEES = new Set(['console', 'RegExp', 'require', 'import', 'mesaKey', 'localStorage', 'sessionStorage', 'getItem', 'setItem', 'removeItem', 'matchMedia', 'querySelector', 'addEventListener', 'removeEventListener', 'dispatchEvent', 'CustomEvent', 'Event'])

// Nomes próprios e textos que são o mesmo nos dois idiomas.
const ALLOW = new Set(['Covil de Dados', 'Casa do Gordo Online', 'Português', 'Braço Sônico', 'Redenção Pelas Cinzas', 'Afinco do Artista', 'Brasão da Família'])

function looksPortuguese(text) {
    const t = text.trim()
    if (ALLOW.has(t)) return false
    if (t.length < 2 || !/[a-zA-ZÀ-ú]/.test(t)) return false
    // Rota, caminho, chave ou id ("/mapa", "casa-do-gordo", "pf2e:mesa"): dado, não texto.
    const bare = t.replace(/\s*…\s*/g, '').trim()
    if (!/\s/.test(bare) && (/\//.test(bare) || /^[a-z0-9]+(?:[-_.:][a-z0-9]+)+$/.test(bare))) return false
    if (ACCENT.test(t)) return true
    const words = t.toLowerCase().match(/[a-zà-ú]+/g) ?? []
    if (words.some((w) => WORDS.has(w))) return true
    if (!english || !/\s/.test(t)) return false
    if (/^url\(|^"[\w-]+(?: [\w-]+)*"(?: "[\w -]+")*$/.test(t)) return false
    if (/\b(?:calc|repeat|minmax|min|max|rgba?|cubic-bezier|var|env|translate\w*|scale\w*)\(/.test(t)) return false
    // Palavra fora do dicionário, minúscula no texto (nome próprio vem com maiúscula).
    const lower = t.match(/(?<![A-Za-z])[a-z]{4,}(?![A-Za-z])/g) ?? []
    return lower.some((w) => !english.has(w) && !english.has(w.replace(/s$/, '')) && !english.has(w.replace(/(ed|ing|es)$/, '')))
}

function files(path) {
    const st = statSync(path)
    if (st.isFile()) return /\.(ts|tsx)$/.test(path) && !/\.d\.ts$/.test(path) ? [path] : []
    return readdirSync(path).flatMap((f) => files(join(path, f)))
}

const calleeName = (expr) => {
    if (ts.isIdentifier(expr)) return expr.text
    if (ts.isPropertyAccessExpression(expr)) return calleeName(expr.expression) === 'console' ? 'console' : expr.name.text
    return ''
}

/** O nó está num lugar onde a string é dado, não texto? */
function exempt(node) {
    let child = node
    for (let p = node.parent; p; child = p, p = p.parent) {
        if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isTypeNode(p)) return true
        if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p)) && p.name === child) return true
        // Valor de campo que é identificador (`id: 'ficha'`, `kind: 'magia'`): dado.
        if (ts.isPropertyAssignment(p) && p.initializer === child && ['id', 'key', 'slug', 'kind', 'path', 'to', 'section', 'field', 'route'].includes(p.name.getText())) return true
        if (ts.isElementAccessExpression(p) && p.argumentExpression === child) return true
        if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
            const name = calleeName(p.expression)
            if (name === 'tr') return p.arguments?.[0] === child || p.arguments?.[1] === child
            if (IGNORE_CALLEES.has(name)) return true
            if (ts.isPropertyAccessExpression(p.expression) && calleeName(p.expression.expression) === 'console') return true
            // Outra chamada: segue subindo (a string pode estar dentro do português de um `tr()`).
            continue
        }
        if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true
        if (ts.isCaseClause(p) && p.expression === child) return true
        if (ts.isJsxAttribute(p)) {
            const attr = p.name.getText()
            return ['key', 'id', 'className', 'href', 'to', 'src', 'component', 'variant', 'color', 'size', 'data-view', 'role', 'type', 'name', 'lang'].includes(attr)
        }
        // Parou numa instrução/declaração: daqui para cima não muda nada.
        if (ts.isStatement(p) && !ts.isBlock(p)) return false
    }
    return false
}

/**
 * Os textos em português fora de `tr()` de um arquivo, com a posição de cada um (`start`/`end`
 * no texto do arquivo) e o tipo do nó — exportado para ferramentas que reescrevem o código.
 */
export function scanFile(file) {
    const text = readFileSync(file, 'utf8')
    if (text.includes('/* i18n-ignore-file */')) return []
    const lines = text.split('\n')
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const out = []
    const report = (node, value, kind) => {
        if (!looksPortuguese(value) || exempt(node)) return
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line
        if (/i18n-ok/.test(lines[line]) || /i18n-ok/.test(lines[line - 1] ?? '')) return
        const inAttr = !!node.parent && ts.isJsxAttribute(node.parent)
        out.push({ file: relative(ROOT, file), line: line + 1, start: node.getStart(source), end: node.getEnd(), kind: inAttr ? 'attr' : kind, value, raw: text.slice(node.getStart(source), node.getEnd()) })
    }
    const visit = (node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) report(node, node.text, ts.isStringLiteral(node) ? 'string' : 'template')
        // As partes do template com um marcador no lugar de cada `${}` (senão "veneno: ${x}" viraria "veneno:", que parece chave).
        else if (ts.isTemplateExpression(node)) report(node, [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' … '), 'template')
        else if (ts.isJsxText(node)) report(node, node.text, 'jsx')
        ts.forEachChild(node, visit)
    }
    visit(source)
    return out
}

export const listFiles = (paths) => paths.flatMap((p) => files(p))

if (import.meta.url === `file://${process.argv[1]}`) {
    const findings = roots.flatMap(files).flatMap(scanFile).map((f) => ({ ...f, value: f.value.replace(/\s+/g, ' ').trim().slice(0, 90) }))
    if (countOnly) {
        const per = new Map()
        for (const f of findings) per.set(f.file, (per.get(f.file) ?? 0) + 1)
        for (const [file, n] of [...per].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), file)
        console.log(`${findings.length} texto(s) em ${per.size} arquivo(s)`)
    } else {
        for (const f of findings) console.log(`${f.file}:${f.line}  ${f.value}`)
        console.log(findings.length ? `\n${findings.length} texto(s) em português fora de tr().` : 'Nenhum texto em português fora de tr().')
    }
    process.exit(findings.length ? 1 : 0)
}
