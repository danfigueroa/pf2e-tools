export interface CharacterPreset {
    name: string
    class: string
    level: number
    filename: string
}

export const CAMPAIGN_PRESETS: CharacterPreset[] = [
    { name: 'Ardagar',   class: 'Druida',    level: 10, filename: 'ardagar10.json'  },
    { name: 'Eldarion',  class: 'Ladino',    level: 10, filename: 'eldarion10.json' },
    { name: 'Ghan Buri', class: 'Guerreiro', level: 10, filename: 'ghanburi10.json' },
]
