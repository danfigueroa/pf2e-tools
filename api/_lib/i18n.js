// Idioma do pedido (`?lang=en`, que o cliente põe em todo /api/* quando a conta está em
// inglês — ver `installApiAuth` em src/services/auth.ts) e as mensagens de erro em inglês.
//
// As mensagens continuam escritas em português nos handlers, como sempre; a tradução é
// feita na SAÍDA (`localizeBody`), num lugar só. Mensagem sem entrada aqui sai em
// português — o `scripts/check-i18n.mjs` acusa as que faltam.

/** 'en' ou 'pt' (padrão). Aceita a query já parseada (objeto) ou um `URLSearchParams`. */
export function langOf(query) {
  const v = typeof query?.get === 'function' ? query.get('lang') : query?.lang
  return v === 'en' ? 'en' : 'pt'
}

const EXACT = new Map(Object.entries({
  'A ficha mudou enquanto o guia era gerado': 'The sheet changed while the guide was being generated',
  'A ficha foi publicada de novo enquanto você editava — reabra a ficha': 'The sheet was published again while you were editing — reopen the sheet',
  'O guia não pode ficar vazio': 'The guide can\'t be empty',
  'Guia grande demais': 'Guide too large',
  'A IA não devolveu um guia válido — tente de novo': 'The AI did not return a valid guide — try again',
  'A mesa precisa de pelo menos um GM — promova outra pessoa antes': 'The table needs at least one GM — promote someone else first',
  'A senha precisa ter pelo menos 6 caracteres': 'The password must be at least 6 characters long',
  'Ação desconhecida': 'Unknown action',
  'Anotações inválidas ou grandes demais': 'Invalid or too large notes',
  'API funcionando!': 'API is up!',
  'Body inválido': 'Invalid body',
  'Cache limpo': 'Cache cleared',
  'Campo "data" ausente': 'Missing "data" field',
  'Campo "days" inválido (1 a 30)': 'Invalid "days" field (1 to 30)',
  'Campo "fields" ausente': 'Missing "fields" field',
  'Campo "maxUses" inválido (1 a 50)': 'Invalid "maxUses" field (1 to 50)',
  'Campo "names" deve ser um array não-vazio': '"names" must be a non-empty array',
  'Campo grande demais': 'Field too large',
  'Companheiro não encontrado': 'Companion not found',
  'Compartilhamento inválido': 'Invalid share',
  'Conta inválida': 'Invalid account',
  'Convite inválido, vencido ou já usado': 'Invalid, expired or already used invite',
  'Convite inválido': 'Invalid invite',
  'Correção inválida': 'Invalid correction',
  'Criatura não encontrada': 'Creature not found',
  'Desenhos demais neste mapa — apague alguns': 'Too many drawings on this map — erase some',
  'Dia inválido': 'Invalid day',
  'Documento inválido': 'Invalid document',
  'Dono de ficha precisa ter conta': 'A sheet owner needs an account',
  'Editado em outro aparelho': 'Edited on another device',
  'Encontro inválido': 'Invalid encounter',
  'Entre na sua conta para continuar': 'Sign in to continue',
  'Erro ao buscar a ficha da criatura': 'Error fetching the creature sheet',
  'Erro ao buscar aflição': 'Error fetching affliction',
  'Erro ao buscar companheiro': 'Error fetching companion',
  'Erro ao buscar companheiros': 'Error fetching companions',
  'Erro ao buscar criatura': 'Error fetching creature',
  'Erro ao buscar equipamento': 'Error fetching gear',
  'Erro ao buscar escudos': 'Error fetching shields',
  'Erro ao buscar habilidades': 'Error fetching abilities',
  'Erro ao buscar item': 'Error fetching item',
  'Erro ao buscar itens': 'Error fetching items',
  'Erro ao buscar magia': 'Error fetching spell',
  'Erro ao buscar magias': 'Error fetching spells',
  'Erro ao buscar regra': 'Error fetching rule',
  'Erro ao buscar regras': 'Error fetching rules',
  'Erro ao buscar talento': 'Error fetching feat',
  'Erro ao buscar talentos': 'Error fetching feats',
  'Erro ao gravar o estado da mesa': 'Error saving the table state',
  'Erro ao gravar': 'Error saving',
  'Erro ao ler o campo': 'Error reading the field',
  'Erro ao ler o estado da mesa': 'Error reading the table state',
  'Erro ao ler o que me passaram': 'Error reading what was given to me',
  'Erro ao ler': 'Error reading',
  'Erro ao tratar a conta': 'Error handling the account',
  'Erro ao tratar a correção de tradução': 'Error handling the translation correction',
  'Erro ao tratar a ficha publicada': 'Error handling the published sheet',
  'Erro ao tratar as anotações': 'Error handling the notes',
  'Erro ao tratar as notificações': 'Error handling the notifications',
  'Erro ao tratar as rolagens': 'Error handling the rolls',
  'Erro ao tratar o diário de campanha': 'Error handling the campaign journal',
  'Erro ao tratar o encontro': 'Error handling the encounter',
  'Erro ao tratar o mapa': 'Error handling the map',
  'Erro ao tratar os troféus': 'Error handling the trophies',
  'Essa pessoa não está na mesa': 'This person is not at the table',
  'Essa pessoa não está nesta mesa': 'This person is not at this table',
  'Esse nome de usuário já existe — escolha outro': 'That username already exists — choose another',
  'Esta ficha é de outra pessoa — só o dono ou o GM faz isso': "This sheet belongs to someone else — only the owner or the GM can do that",
  'Esta ficha é de outra pessoa — só o dono ou o GM publica por cima': "This sheet belongs to someone else — only the owner or the GM can publish over it",
  'Esta ficha está sendo preparada por outra pessoa': 'This sheet is being prepared by someone else',
  'Igual à ficha publicada — não há o que atualizar': 'Same as the published sheet — nothing to update',
  'Outra pessoa já está preparando esta ficha': 'Someone else is already preparing this sheet',
  'Estado grande demais': 'State too large',
  'Este personagem é de outra pessoa': 'This character belongs to someone else',
  'Ficha grande demais': 'Sheet too large',
  'Ficha não publicada': 'Sheet not published',
  'Imagem inválida': 'Invalid image',
  'Informe um nome ou uma faixa de nível': 'Provide a name or a level range',
  'Item não encontrado': 'Item not found',
  'Lista de tokens inválida': 'Invalid token list',
  'Magia não encontrada': 'Spell not found',
  'Mapa inválido': 'Invalid map',
  'Mapa não encontrado': 'Map not found',
  'Mapa privado': 'Private map',
  'Mapas demais — apague os que já foram jogados': 'Too many maps — delete the ones already played',
  'Método não permitido': 'Method not allowed',
  'Nada para mostrar': 'Nothing to show',
  'Nada para mudar': 'Nothing to change',
  'Não foi possível conferir o seu acesso agora': 'Could not check your access right now',
  'Não há versão anterior': 'There is no previous version',
  'Não parece um JSON do Pathbuilder (falta build.name ou build.level)': "This doesn't look like a Pathbuilder JSON (missing build.name or build.level)",
  'Nome da magia é obrigatório': 'Spell name is required',
  'Nome do animal é obrigatório': 'Animal name is required',
  'Nome do talento é obrigatório': 'Feat name is required',
  'Nome é obrigatório': 'Name is required',
  'Nome vazio': 'Empty name',
  'O login precisa do Supabase configurado no servidor': 'Sign-in needs Supabase configured on the server',
  'O nome da mesa precisa ter de 2 a 40 caracteres': 'The table name must have 2 to 40 characters',
  'O nome precisa ter de 1 a 40 caracteres': 'The name must have 1 to 40 characters',
  'Personagem inválido': 'Invalid character',
  'PV inválido': 'Invalid HP',
  'Quantidade de campos inválida': 'Invalid number of fields',
  'Referência inválida': 'Invalid reference',
  'Regra não encontrada': 'Rule not found',
  'Rolagem inválida': 'Invalid roll',
  'Sem chave de IA configurada no servidor': 'No AI key configured on the server',
  'Sem permissão': 'Not allowed',
  'Só o dono da ficha ou o GM rola por este personagem': "Only the sheet's owner or the GM can roll for this character",
  'Só o GM abre o diário de campanha': 'Only the GM can open the campaign journal',
  'Só o GM monta o encontro': 'Only the GM can build the encounter',
  'Só o GM pode fazer isso': 'Only the GM can do that',
  'Talento não encontrado': 'Feat not found',
  'Tipo ou nome inválido': 'Invalid kind or name',
  'Token grande demais': 'Token too large',
  'Token inválido': 'Invalid token',
  'Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado':
    'Username: 3 to 30 characters, only lowercase letters, numbers, dot, hyphen or underscore',
  'Versão inválida': 'Invalid version',
  'Versão não encontrada': 'Version not found',
  'Você não faz parte desta mesa': 'You are not part of this table',
  'Você só move o seu próprio token': 'You can only move your own token',
  'Muitas tentativas seguidas — espere um minuto': 'Too many attempts in a row — wait a minute',
  // Wiki da Mesa
  'Erro ao tratar a wiki': 'Error handling the wiki',
  'Página não encontrada': 'Page not found',
  'Página inválida': 'Invalid page',
  'Página-mãe inválida': 'Invalid parent page',
  'Esta página está travada pelo GM': 'The GM locked this page',
  'Já existe uma página com esse id': 'A page with that id already exists',
  'Editada por outra pessoa': 'Edited by someone else',
  'Só quem criou a página e o GM a apagam': 'Only whoever created the page and the GM can delete it',
  'Só o GM abre a lixeira da Wiki': 'Only the GM can open the wiki trash',
  'Mande a página para a lixeira antes': 'Move the page to the trash first',
}))

// Mensagens montadas com um valor no meio.
const PATTERNS = [
  [/^Campo "([^"]+)" inválido$/, 'Invalid "$1" field'],
  [/^Parâmetro "([^"]+)" inválido$/, 'Invalid "$1" parameter'],
  [/^Companheiro "(.+)" não encontrado no AON$/, 'Companion "$1" not found on AON'],
]

/** A mensagem em inglês, ou a original quando não há tradução. */
export function englishMessage(message) {
  if (typeof message !== 'string') return message
  const exact = EXACT.get(message)
  if (exact) return exact
  for (const [re, out] of PATTERNS) if (re.test(message)) return message.replace(re, out)
  return message
}

/** Troca o `error` (e o `message`) do corpo pela versão em inglês, quando o pedido é em inglês. */
export function localizeBody(body, lang) {
  if (lang !== 'en' || !body || typeof body !== 'object' || Array.isArray(body)) return body
  let out = body
  for (const key of ['error', 'message']) {
    if (typeof body[key] === 'string') {
      const en = englishMessage(body[key])
      if (en !== body[key]) out = { ...out, [key]: en }
    }
  }
  return out
}

/** Para mensagens que não passam por `localizeBody` (montadas em outro lugar). */
export const say = (lang, pt, en) => (lang === 'en' ? en : pt)

/**
 * Para os `api/*.js`: o idioma do pedido, e o `res.json` passa a traduzir o `error` na saída.
 * Devolve 'en' | 'pt'.
 */
export function apiLang(req, res) {
  const lang = langOf(req.query)
  if (lang === 'en' && res && typeof res.json === 'function') {
    const json = res.json.bind(res)
    res.json = (body) => json(localizeBody(body, lang))
  }
  return lang
}
