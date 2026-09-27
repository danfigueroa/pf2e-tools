export interface CharacterPreset {
    /** Rótulo dos cards e botões. */
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
    { name: 'Cerosqualhanthallas', sheetName: 'Cerosqualhanthallas',              class: 'Patrulheiro', level: 10, filename: 'cerosqualhanthallas10.json' },
    { name: 'Eldarion',  sheetName: 'Eldarion',                         class: 'Ladino',      level: 10, filename: 'eldarion10.json'            },
    { name: 'Ghan Buri', sheetName: 'Ghan Buri',                        class: 'Guerreiro',   level: 10, filename: 'ghanburi10.json'            },
    { name: 'Nathaniel', sheetName: 'Nathaniel o Magus',                class: 'Magus',       level: 10, filename: 'nathaniel10.json'           },
]
