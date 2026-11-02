import type { TransformationSpell, TransformationForm } from '../../../types';
import { tr } from '../../../i18n';

// Avatar - rank 10 divine battle form. You become an embodiment of your deity.
// Common statistics (verified): AC 25 + level, 30 temporary HP, Huge, darkvision,
// attack modifier +33 (unless your own is higher), Athletics +35.
// The per-deity abilities below are modeled on each deity's theme and favored
// weapon; the exact avatar abilities are defined on each deity's entry, so verify
// signature attacks/speeds against your specific deity.
export const avatarForms: TransformationForm[] = [
  {
    id: 'generic',
    name: 'Generic Avatar',
    size: 'Huge',
    speed: {
      land: 40
    },
    attacks: [
      {
        name: 'Deific Weapon',
        type: 'melee',
        bonus: 33,
        damage: '4d8 (favored weapon damage type)',
        traits: ['reach 10']
      }
    ],
    abilities: [
      {
        name: tr('Aspecto Divino', 'Divine Aspect'),
        description: tr('Use esta forma genérica quando sua divindade não estiver listada; substitua pela arma favorecida, deslocamento e habilidade característica da sua divindade, conforme a entrada de avatar dela.', 'Use this generic form when your deity isn\'t listed; replace it with your deity\'s favored weapon, Speed and signature ability, as given in their avatar entry.'),
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    traits: ['divine'],
    description: 'Speed 40 feet; darkvision; Melee deific weapon (reach 10), Damage 4d8 of the favored weapon\'s type.'
  },
  {
    id: 'iomedae',
    name: 'Avatar of Iomedae',
    size: 'Huge',
    speed: {
      land: 40,
      fly: 40
    },
    attacks: [
      {
        name: 'Sword',
        type: 'melee',
        bonus: 33,
        damage: '4d8 slashing plus 2d6 fire',
        traits: ['reach 10', 'versatile P']
      }
    ],
    abilities: [
      {
        name: tr('Golpe Retributivo', 'Retributive Strike'),
        description: tr('Quando um aliado perto de você é atingido, você pode retaliar contra o atacante com força radiante.', 'When an ally near you is hit, you can retaliate against the attacker with radiant force.'),
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    traits: ['divine'],
    description: 'Speed 40 feet, fly 40 feet; darkvision; Melee sword (reach 10, versatile P), Damage 4d8 slashing plus 2d6 fire; Retributive Strike.'
  },
  {
    id: 'gorum',
    name: 'Avatar of Gorum',
    size: 'Huge',
    speed: {
      land: 40
    },
    attacks: [
      {
        name: 'Greatsword',
        type: 'melee',
        bonus: 33,
        damage: '4d12 slashing',
        traits: ['reach 10']
      }
    ],
    abilities: [
      {
        name: tr('Sede de Sangue', 'Bloodthirst'),
        description: tr('Seus ataques causam dano adicional contra criaturas que já sofreram dano neste combate.', 'Your attacks deal extra damage against creatures that have already taken damage this combat.'),
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    traits: ['divine'],
    description: 'Speed 40 feet; darkvision; Melee greatsword (reach 10), Damage 4d12 slashing; Bloodthirsty.'
  },
  {
    id: 'sarenrae',
    name: 'Avatar of Sarenrae',
    size: 'Huge',
    speed: {
      land: 40,
      fly: 60
    },
    attacks: [
      {
        name: 'Scimitar',
        type: 'melee',
        bonus: 33,
        damage: '4d6 slashing plus 2d6 fire',
        traits: ['reach 10', 'forceful']
      },
      {
        name: 'Sunbeam',
        type: 'ranged',
        bonus: 33,
        damage: '4d6 fire',
        traits: ['range 60']
      }
    ],
    abilities: [
      {
        name: tr('Luz Curativa', 'Healing Light'),
        description: tr('Você irradia luz restauradora, e seus ataques de fogo podem ferir mortos-vivos com energia positiva.', 'You radiate restoring light, and your fire attacks can harm undead with vital energy.'),
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    traits: ['divine'],
    description: 'Speed 40 feet, fly 60 feet; darkvision; Melee scimitar (reach 10, forceful), Damage 4d6 slashing plus 2d6 fire; Ranged sunbeam, Damage 4d6 fire; Healing Light.'
  },
  {
    id: 'rovagug',
    name: 'Avatar of Rovagug',
    size: 'Huge',
    speed: {
      land: 50,
      burrow: 30
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 33,
        damage: '4d10 piercing plus 2d6 acid',
        traits: ['reach 10']
      }
    ],
    abilities: [
      {
        name: tr('Devastação', 'Devastation'),
        description: tr('Você pode Escavar, e seus ataques destroem objetos sem dono e terreno com facilidade.', 'You can Burrow, and your attacks easily destroy unattended objects and terrain.'),
        traits: []
      }
    ],
    senses: {
      darkvision: 60,
      tremorsense: 60
    },
    traits: ['divine'],
    description: 'Speed 50 feet, burrow 30 feet; darkvision; tremorsense 60 feet; Melee jaws (reach 10), Damage 4d10 piercing plus 2d6 acid; Devastation.'
  },
  {
    id: 'pharasma',
    name: 'Avatar of Pharasma',
    size: 'Huge',
    speed: {
      land: 40,
      fly: 40
    },
    attacks: [
      {
        name: 'Dagger',
        type: 'melee',
        bonus: 33,
        damage: '4d4 piercing plus 2d6 void',
        traits: ['agile', 'finesse', 'reach 10']
      }
    ],
    abilities: [
      {
        name: tr('Julgamento Final', 'Final Judgment'),
        description: tr('Seus ataques são especialmente eficazes contra mortos-vivos e criaturas que enganaram a morte.', 'Your attacks are especially effective against undead and creatures that have cheated death.'),
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    traits: ['divine'],
    description: 'Speed 40 feet, fly 40 feet; darkvision; Melee dagger (agile, finesse, reach 10), Damage 4d4 piercing plus 2d6 void; Final Judgment.'
  }
];

export const avatarSpell: TransformationSpell = {
  id: 'avatar',
  name: 'Avatar',
  level: 10,
  school: 'transmutation',
  traditions: ['divine'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into a towering avatar of your deity. You gain the divine trait and the following statistics regardless of deity: AC = 25 + your level; 30 temporary HP; Huge size; darkvision; attack modifier +33 (unless your own is higher); Athletics +35 (unless your own is higher). Your deity grants additional movement, immunities, and signature attacks described in their avatar entry.',
  forms: avatarForms
};
