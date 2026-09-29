import { fetchPublished, type PublishedSheet } from '../../services/sheets'
import { charSlugFromName } from './charId'

export interface CharacterPreset {
    /** Rótulo curto dos cards e botões — e o nome do combatente na Iniciativa. */
    name: string
    /**
     * O nome como o Pathbuilder exporta (`build.name`). É dele que sai o slug
     * do estado da mesa (`charSlugFromName`), então é por ele que a Iniciativa
     * sabe quem já está no combate — o `name` curto daria outro slug.
     */
    sheetName: string
    class: string
    level: number
    filename: string
}

export const CAMPAIGN_PRESETS: CharacterPreset[] = [
    { name: 'Brukuthur', sheetName: 'Brukuthur, The Barbarian Android', class: 'Bárbaro',     level: 10, filename: 'brukuthur10.json'           },
    { name: 'Ceros',     sheetName: 'Cerosqualhanthallas',              class: 'Patrulheiro', level: 10, filename: 'cerosqualhanthallas10.json' },
    { name: 'Eldarion',  sheetName: 'Eldarion',                         class: 'Ladino',      level: 10, filename: 'eldarion10.json'            },
    { name: 'Ghan Buri', sheetName: 'Ghan Buri',                        class: 'Guerreiro',   level: 10, filename: 'ghanburi10.json'            },
    { name: 'Nathaniel', sheetName: 'Nathaniel o Magus',                class: 'Magus',       level: 10, filename: 'nathaniel10.json'           },
]

/**
 * O JSON do personagem da campanha: a versão PUBLICADA pela mesa, se alguém já
 * publicou (level-up, item novo), senão o arquivo fixo de `public/characters/`.
 * Os três módulos que listam os presets carregam por aqui, para nenhum deles
 * ficar mostrando o personagem do nível anterior.
 */
export async function loadPresetJson(preset: CharacterPreset): Promise<{ json: unknown; published: PublishedSheet | null }> {
    const published = await fetchPublished(charSlugFromName(preset.sheetName))
    if (published) return { json: published.json, published }
    const res = await fetch(`/characters/${preset.filename}`)
    if (!res.ok) throw new Error(`Falha ao carregar ${preset.filename}`)
    return { json: await res.json(), published: null }
}
