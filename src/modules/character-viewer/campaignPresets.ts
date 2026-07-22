export interface CharacterPreset {
    name: string
    class: string
    level: number
    filename: string
}

export const CAMPAIGN_PRESETS: CharacterPreset[] = [
    { name: 'Ardagar',  class: 'Druida',    level: 9,  filename: 'ardagar9.json'  },
    { name: 'Eldarion', class: 'Ladino',    level: 9,  filename: 'eldarion9.json' },
    { name: 'Zayto',    class: 'Clérigo',   level: 9,  filename: 'zayto9.json'    },
    { name: 'Ghan Buri', class: 'Guerreiro', level: 10, filename: 'ghanburi10.json' },
]
