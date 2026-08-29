// GERADO por scripts/fetch-creature-tables.mjs — não editar à mão.
//
// Tabelas de construção de criaturas do GM Core (pg. 112-121), transcritas do
// índice do Archives of Nethys. Níveis -1 a 24.
//
// Coluna ausente é ausente de propósito: a tabela de Atributos não tem valor
// Extremo nos níveis baixos, e só Percepção e Salvamentos têm coluna Terrível.

/** Degrau do benchmark. O AON usa os mesmos rótulos nos campos `*_scale`. */
export type ScaleColumn = 'extreme' | 'high' | 'moderate' | 'low' | 'terrible'

/** Faixa fechada. PV e perícia Baixa vêm assim no livro. */
export interface Band { max: number; min: number }

export interface DamageBenchmark { formula: string; average: number | null }

export type ByLevel<T> = Record<number, Partial<Record<ScaleColumn, T>>>

export const AC_TABLE: ByLevel<number> = {
  "0": {
    extreme: 19,
    high: 16,
    moderate: 15,
    low: 13
  },
  "1": {
    extreme: 19,
    high: 16,
    moderate: 15,
    low: 13
  },
  "2": {
    extreme: 21,
    high: 18,
    moderate: 17,
    low: 15
  },
  "3": {
    extreme: 22,
    high: 19,
    moderate: 18,
    low: 16
  },
  "4": {
    extreme: 24,
    high: 21,
    moderate: 20,
    low: 18
  },
  "5": {
    extreme: 25,
    high: 22,
    moderate: 21,
    low: 19
  },
  "6": {
    extreme: 27,
    high: 24,
    moderate: 23,
    low: 21
  },
  "7": {
    extreme: 28,
    high: 25,
    moderate: 24,
    low: 22
  },
  "8": {
    extreme: 30,
    high: 27,
    moderate: 26,
    low: 24
  },
  "9": {
    extreme: 31,
    high: 28,
    moderate: 27,
    low: 25
  },
  "10": {
    extreme: 33,
    high: 30,
    moderate: 29,
    low: 27
  },
  "11": {
    extreme: 34,
    high: 31,
    moderate: 30,
    low: 28
  },
  "12": {
    extreme: 36,
    high: 33,
    moderate: 32,
    low: 30
  },
  "13": {
    extreme: 37,
    high: 34,
    moderate: 33,
    low: 31
  },
  "14": {
    extreme: 39,
    high: 36,
    moderate: 35,
    low: 33
  },
  "15": {
    extreme: 40,
    high: 37,
    moderate: 36,
    low: 34
  },
  "16": {
    extreme: 42,
    high: 39,
    moderate: 38,
    low: 36
  },
  "17": {
    extreme: 43,
    high: 40,
    moderate: 39,
    low: 37
  },
  "18": {
    extreme: 45,
    high: 42,
    moderate: 41,
    low: 39
  },
  "19": {
    extreme: 46,
    high: 43,
    moderate: 42,
    low: 40
  },
  "20": {
    extreme: 48,
    high: 45,
    moderate: 44,
    low: 42
  },
  "21": {
    extreme: 49,
    high: 46,
    moderate: 45,
    low: 43
  },
  "22": {
    extreme: 51,
    high: 48,
    moderate: 47,
    low: 45
  },
  "23": {
    extreme: 52,
    high: 49,
    moderate: 48,
    low: 46
  },
  "24": {
    extreme: 54,
    high: 51,
    moderate: 50,
    low: 48
  },
  "-1": {
    extreme: 18,
    high: 15,
    moderate: 14,
    low: 12
  }
}

export const HP_TABLE: ByLevel<Band> = {
  "0": {
    high: {
      max: 20,
      min: 17
    },
    moderate: {
      max: 16,
      min: 14
    },
    low: {
      max: 13,
      min: 11
    }
  },
  "1": {
    high: {
      max: 26,
      min: 24
    },
    moderate: {
      max: 21,
      min: 19
    },
    low: {
      max: 16,
      min: 14
    }
  },
  "2": {
    high: {
      max: 40,
      min: 36
    },
    moderate: {
      max: 32,
      min: 28
    },
    low: {
      max: 25,
      min: 21
    }
  },
  "3": {
    high: {
      max: 59,
      min: 53
    },
    moderate: {
      max: 48,
      min: 42
    },
    low: {
      max: 37,
      min: 31
    }
  },
  "4": {
    high: {
      max: 78,
      min: 72
    },
    moderate: {
      max: 63,
      min: 57
    },
    low: {
      max: 48,
      min: 42
    }
  },
  "5": {
    high: {
      max: 97,
      min: 91
    },
    moderate: {
      max: 78,
      min: 72
    },
    low: {
      max: 59,
      min: 53
    }
  },
  "6": {
    high: {
      max: 123,
      min: 115
    },
    moderate: {
      max: 99,
      min: 91
    },
    low: {
      max: 75,
      min: 67
    }
  },
  "7": {
    high: {
      max: 148,
      min: 140
    },
    moderate: {
      max: 119,
      min: 111
    },
    low: {
      max: 90,
      min: 82
    }
  },
  "8": {
    high: {
      max: 173,
      min: 165
    },
    moderate: {
      max: 139,
      min: 131
    },
    low: {
      max: 105,
      min: 97
    }
  },
  "9": {
    high: {
      max: 198,
      min: 190
    },
    moderate: {
      max: 159,
      min: 151
    },
    low: {
      max: 120,
      min: 112
    }
  },
  "10": {
    high: {
      max: 223,
      min: 215
    },
    moderate: {
      max: 179,
      min: 171
    },
    low: {
      max: 135,
      min: 127
    }
  },
  "11": {
    high: {
      max: 248,
      min: 240
    },
    moderate: {
      max: 199,
      min: 191
    },
    low: {
      max: 150,
      min: 142
    }
  },
  "12": {
    high: {
      max: 273,
      min: 265
    },
    moderate: {
      max: 219,
      min: 211
    },
    low: {
      max: 165,
      min: 157
    }
  },
  "13": {
    high: {
      max: 298,
      min: 290
    },
    moderate: {
      max: 239,
      min: 231
    },
    low: {
      max: 180,
      min: 172
    }
  },
  "14": {
    high: {
      max: 323,
      min: 315
    },
    moderate: {
      max: 259,
      min: 251
    },
    low: {
      max: 195,
      min: 187
    }
  },
  "15": {
    high: {
      max: 348,
      min: 340
    },
    moderate: {
      max: 279,
      min: 271
    },
    low: {
      max: 210,
      min: 202
    }
  },
  "16": {
    high: {
      max: 373,
      min: 365
    },
    moderate: {
      max: 299,
      min: 291
    },
    low: {
      max: 225,
      min: 217
    }
  },
  "17": {
    high: {
      max: 398,
      min: 390
    },
    moderate: {
      max: 319,
      min: 311
    },
    low: {
      max: 240,
      min: 232
    }
  },
  "18": {
    high: {
      max: 423,
      min: 415
    },
    moderate: {
      max: 339,
      min: 331
    },
    low: {
      max: 255,
      min: 247
    }
  },
  "19": {
    high: {
      max: 448,
      min: 440
    },
    moderate: {
      max: 359,
      min: 351
    },
    low: {
      max: 270,
      min: 262
    }
  },
  "20": {
    high: {
      max: 473,
      min: 465
    },
    moderate: {
      max: 379,
      min: 371
    },
    low: {
      max: 285,
      min: 277
    }
  },
  "21": {
    high: {
      max: 505,
      min: 495
    },
    moderate: {
      max: 405,
      min: 395
    },
    low: {
      max: 305,
      min: 295
    }
  },
  "22": {
    high: {
      max: 544,
      min: 532
    },
    moderate: {
      max: 436,
      min: 424
    },
    low: {
      max: 329,
      min: 317
    }
  },
  "23": {
    high: {
      max: 581,
      min: 569
    },
    moderate: {
      max: 466,
      min: 454
    },
    low: {
      max: 351,
      min: 339
    }
  },
  "24": {
    high: {
      max: 633,
      min: 617
    },
    moderate: {
      max: 508,
      min: 492
    },
    low: {
      max: 383,
      min: 367
    }
  },
  "-1": {
    high: {
      max: 9,
      min: 9
    },
    moderate: {
      max: 8,
      min: 7
    },
    low: {
      max: 6,
      min: 5
    }
  }
}

export const PERCEPTION_TABLE: ByLevel<number> = {
  "0": {
    extreme: 10,
    high: 9,
    moderate: 6,
    low: 3,
    terrible: 1
  },
  "1": {
    extreme: 11,
    high: 10,
    moderate: 7,
    low: 4,
    terrible: 2
  },
  "2": {
    extreme: 12,
    high: 11,
    moderate: 8,
    low: 5,
    terrible: 3
  },
  "3": {
    extreme: 14,
    high: 12,
    moderate: 9,
    low: 6,
    terrible: 4
  },
  "4": {
    extreme: 15,
    high: 14,
    moderate: 11,
    low: 8,
    terrible: 6
  },
  "5": {
    extreme: 17,
    high: 15,
    moderate: 12,
    low: 9,
    terrible: 7
  },
  "6": {
    extreme: 18,
    high: 17,
    moderate: 14,
    low: 11,
    terrible: 8
  },
  "7": {
    extreme: 20,
    high: 18,
    moderate: 15,
    low: 12,
    terrible: 10
  },
  "8": {
    extreme: 21,
    high: 19,
    moderate: 16,
    low: 13,
    terrible: 11
  },
  "9": {
    extreme: 23,
    high: 21,
    moderate: 18,
    low: 15,
    terrible: 12
  },
  "10": {
    extreme: 24,
    high: 22,
    moderate: 19,
    low: 16,
    terrible: 14
  },
  "11": {
    extreme: 26,
    high: 24,
    moderate: 21,
    low: 18,
    terrible: 15
  },
  "12": {
    extreme: 27,
    high: 25,
    moderate: 22,
    low: 19,
    terrible: 16
  },
  "13": {
    extreme: 29,
    high: 26,
    moderate: 23,
    low: 20,
    terrible: 18
  },
  "14": {
    extreme: 30,
    high: 28,
    moderate: 25,
    low: 22,
    terrible: 19
  },
  "15": {
    extreme: 32,
    high: 29,
    moderate: 26,
    low: 23,
    terrible: 20
  },
  "16": {
    extreme: 33,
    high: 30,
    moderate: 28,
    low: 25,
    terrible: 22
  },
  "17": {
    extreme: 35,
    high: 32,
    moderate: 29,
    low: 26,
    terrible: 23
  },
  "18": {
    extreme: 36,
    high: 33,
    moderate: 30,
    low: 27,
    terrible: 24
  },
  "19": {
    extreme: 38,
    high: 35,
    moderate: 32,
    low: 29,
    terrible: 26
  },
  "20": {
    extreme: 39,
    high: 36,
    moderate: 33,
    low: 30,
    terrible: 27
  },
  "21": {
    extreme: 41,
    high: 38,
    moderate: 35,
    low: 32,
    terrible: 28
  },
  "22": {
    extreme: 43,
    high: 39,
    moderate: 36,
    low: 33,
    terrible: 30
  },
  "23": {
    extreme: 44,
    high: 40,
    moderate: 37,
    low: 34,
    terrible: 31
  },
  "24": {
    extreme: 46,
    high: 42,
    moderate: 38,
    low: 36,
    terrible: 32
  },
  "-1": {
    extreme: 9,
    high: 8,
    moderate: 5,
    low: 2,
    terrible: 0
  }
}

export const SAVE_TABLE: ByLevel<number> = {
  "0": {
    extreme: 10,
    high: 9,
    moderate: 6,
    low: 3,
    terrible: 1
  },
  "1": {
    extreme: 11,
    high: 10,
    moderate: 7,
    low: 4,
    terrible: 2
  },
  "2": {
    extreme: 12,
    high: 11,
    moderate: 8,
    low: 5,
    terrible: 3
  },
  "3": {
    extreme: 14,
    high: 12,
    moderate: 9,
    low: 6,
    terrible: 4
  },
  "4": {
    extreme: 15,
    high: 14,
    moderate: 11,
    low: 8,
    terrible: 6
  },
  "5": {
    extreme: 17,
    high: 15,
    moderate: 12,
    low: 9,
    terrible: 7
  },
  "6": {
    extreme: 18,
    high: 17,
    moderate: 14,
    low: 11,
    terrible: 8
  },
  "7": {
    extreme: 20,
    high: 18,
    moderate: 15,
    low: 12,
    terrible: 10
  },
  "8": {
    extreme: 21,
    high: 19,
    moderate: 16,
    low: 13,
    terrible: 11
  },
  "9": {
    extreme: 23,
    high: 21,
    moderate: 18,
    low: 15,
    terrible: 12
  },
  "10": {
    extreme: 24,
    high: 22,
    moderate: 19,
    low: 16,
    terrible: 14
  },
  "11": {
    extreme: 26,
    high: 24,
    moderate: 21,
    low: 18,
    terrible: 15
  },
  "12": {
    extreme: 27,
    high: 25,
    moderate: 22,
    low: 19,
    terrible: 16
  },
  "13": {
    extreme: 29,
    high: 26,
    moderate: 23,
    low: 20,
    terrible: 18
  },
  "14": {
    extreme: 30,
    high: 28,
    moderate: 25,
    low: 22,
    terrible: 19
  },
  "15": {
    extreme: 32,
    high: 29,
    moderate: 26,
    low: 23,
    terrible: 20
  },
  "16": {
    extreme: 33,
    high: 30,
    moderate: 28,
    low: 25,
    terrible: 22
  },
  "17": {
    extreme: 35,
    high: 32,
    moderate: 29,
    low: 26,
    terrible: 23
  },
  "18": {
    extreme: 36,
    high: 33,
    moderate: 30,
    low: 27,
    terrible: 24
  },
  "19": {
    extreme: 38,
    high: 35,
    moderate: 32,
    low: 29,
    terrible: 26
  },
  "20": {
    extreme: 39,
    high: 36,
    moderate: 33,
    low: 30,
    terrible: 27
  },
  "21": {
    extreme: 41,
    high: 38,
    moderate: 35,
    low: 32,
    terrible: 28
  },
  "22": {
    extreme: 43,
    high: 39,
    moderate: 36,
    low: 33,
    terrible: 30
  },
  "23": {
    extreme: 44,
    high: 40,
    moderate: 37,
    low: 34,
    terrible: 31
  },
  "24": {
    extreme: 46,
    high: 42,
    moderate: 38,
    low: 36,
    terrible: 32
  },
  "-1": {
    extreme: 9,
    high: 8,
    moderate: 5,
    low: 2,
    terrible: 0
  }
}

export const ATTRIBUTE_TABLE: ByLevel<number> = {
  "0": {
    high: 3,
    moderate: 2,
    low: 0
  },
  "1": {
    extreme: 5,
    high: 4,
    moderate: 3,
    low: 1
  },
  "2": {
    extreme: 5,
    high: 4,
    moderate: 3,
    low: 1
  },
  "3": {
    extreme: 5,
    high: 4,
    moderate: 3,
    low: 1
  },
  "4": {
    extreme: 6,
    high: 5,
    moderate: 3,
    low: 2
  },
  "5": {
    extreme: 6,
    high: 5,
    moderate: 4,
    low: 2
  },
  "6": {
    extreme: 7,
    high: 5,
    moderate: 4,
    low: 2
  },
  "7": {
    extreme: 7,
    high: 6,
    moderate: 4,
    low: 2
  },
  "8": {
    extreme: 7,
    high: 6,
    moderate: 4,
    low: 3
  },
  "9": {
    extreme: 7,
    high: 6,
    moderate: 4,
    low: 3
  },
  "10": {
    extreme: 8,
    high: 7,
    moderate: 5,
    low: 3
  },
  "11": {
    extreme: 8,
    high: 7,
    moderate: 5,
    low: 3
  },
  "12": {
    extreme: 8,
    high: 7,
    moderate: 5,
    low: 4
  },
  "13": {
    extreme: 9,
    high: 8,
    moderate: 5,
    low: 4
  },
  "14": {
    extreme: 9,
    high: 8,
    moderate: 5,
    low: 4
  },
  "15": {
    extreme: 9,
    high: 8,
    moderate: 6,
    low: 4
  },
  "16": {
    extreme: 10,
    high: 9,
    moderate: 6,
    low: 5
  },
  "17": {
    extreme: 10,
    high: 9,
    moderate: 6,
    low: 5
  },
  "18": {
    extreme: 10,
    high: 9,
    moderate: 6,
    low: 5
  },
  "19": {
    extreme: 11,
    high: 10,
    moderate: 6,
    low: 5
  },
  "20": {
    extreme: 11,
    high: 10,
    moderate: 7,
    low: 6
  },
  "21": {
    extreme: 11,
    high: 10,
    moderate: 7,
    low: 6
  },
  "22": {
    extreme: 11,
    high: 10,
    moderate: 8,
    low: 6
  },
  "23": {
    extreme: 11,
    high: 10,
    moderate: 8,
    low: 6
  },
  "24": {
    extreme: 13,
    high: 12,
    moderate: 9,
    low: 7
  },
  "-1": {
    high: 3,
    moderate: 2,
    low: 0
  }
}

export const SKILL_TABLE: ByLevel<Band> = {
  "0": {
    extreme: {
      max: 9,
      min: 9
    },
    high: {
      max: 6,
      min: 6
    },
    moderate: {
      max: 5,
      min: 5
    },
    low: {
      max: 3,
      min: 2
    }
  },
  "1": {
    extreme: {
      max: 10,
      min: 10
    },
    high: {
      max: 7,
      min: 7
    },
    moderate: {
      max: 6,
      min: 6
    },
    low: {
      max: 4,
      min: 3
    }
  },
  "2": {
    extreme: {
      max: 11,
      min: 11
    },
    high: {
      max: 8,
      min: 8
    },
    moderate: {
      max: 7,
      min: 7
    },
    low: {
      max: 5,
      min: 4
    }
  },
  "3": {
    extreme: {
      max: 13,
      min: 13
    },
    high: {
      max: 10,
      min: 10
    },
    moderate: {
      max: 9,
      min: 9
    },
    low: {
      max: 7,
      min: 5
    }
  },
  "4": {
    extreme: {
      max: 15,
      min: 15
    },
    high: {
      max: 12,
      min: 12
    },
    moderate: {
      max: 10,
      min: 10
    },
    low: {
      max: 8,
      min: 7
    }
  },
  "5": {
    extreme: {
      max: 16,
      min: 16
    },
    high: {
      max: 13,
      min: 13
    },
    moderate: {
      max: 12,
      min: 12
    },
    low: {
      max: 10,
      min: 8
    }
  },
  "6": {
    extreme: {
      max: 18,
      min: 18
    },
    high: {
      max: 15,
      min: 15
    },
    moderate: {
      max: 13,
      min: 13
    },
    low: {
      max: 11,
      min: 9
    }
  },
  "7": {
    extreme: {
      max: 20,
      min: 20
    },
    high: {
      max: 17,
      min: 17
    },
    moderate: {
      max: 15,
      min: 15
    },
    low: {
      max: 13,
      min: 11
    }
  },
  "8": {
    extreme: {
      max: 21,
      min: 21
    },
    high: {
      max: 18,
      min: 18
    },
    moderate: {
      max: 16,
      min: 16
    },
    low: {
      max: 14,
      min: 12
    }
  },
  "9": {
    extreme: {
      max: 23,
      min: 23
    },
    high: {
      max: 20,
      min: 20
    },
    moderate: {
      max: 18,
      min: 18
    },
    low: {
      max: 16,
      min: 13
    }
  },
  "10": {
    extreme: {
      max: 25,
      min: 25
    },
    high: {
      max: 22,
      min: 22
    },
    moderate: {
      max: 19,
      min: 19
    },
    low: {
      max: 17,
      min: 15
    }
  },
  "11": {
    extreme: {
      max: 26,
      min: 26
    },
    high: {
      max: 23,
      min: 23
    },
    moderate: {
      max: 21,
      min: 21
    },
    low: {
      max: 19,
      min: 16
    }
  },
  "12": {
    extreme: {
      max: 28,
      min: 28
    },
    high: {
      max: 25,
      min: 25
    },
    moderate: {
      max: 22,
      min: 22
    },
    low: {
      max: 20,
      min: 17
    }
  },
  "13": {
    extreme: {
      max: 30,
      min: 30
    },
    high: {
      max: 27,
      min: 27
    },
    moderate: {
      max: 24,
      min: 24
    },
    low: {
      max: 22,
      min: 19
    }
  },
  "14": {
    extreme: {
      max: 31,
      min: 31
    },
    high: {
      max: 28,
      min: 28
    },
    moderate: {
      max: 25,
      min: 25
    },
    low: {
      max: 23,
      min: 20
    }
  },
  "15": {
    extreme: {
      max: 33,
      min: 33
    },
    high: {
      max: 30,
      min: 30
    },
    moderate: {
      max: 27,
      min: 27
    },
    low: {
      max: 25,
      min: 21
    }
  },
  "16": {
    extreme: {
      max: 35,
      min: 35
    },
    high: {
      max: 32,
      min: 32
    },
    moderate: {
      max: 28,
      min: 28
    },
    low: {
      max: 26,
      min: 23
    }
  },
  "17": {
    extreme: {
      max: 36,
      min: 36
    },
    high: {
      max: 33,
      min: 33
    },
    moderate: {
      max: 30,
      min: 30
    },
    low: {
      max: 28,
      min: 24
    }
  },
  "18": {
    extreme: {
      max: 38,
      min: 38
    },
    high: {
      max: 35,
      min: 35
    },
    moderate: {
      max: 31,
      min: 31
    },
    low: {
      max: 29,
      min: 25
    }
  },
  "19": {
    extreme: {
      max: 40,
      min: 40
    },
    high: {
      max: 37,
      min: 37
    },
    moderate: {
      max: 33,
      min: 33
    },
    low: {
      max: 31,
      min: 27
    }
  },
  "20": {
    extreme: {
      max: 41,
      min: 41
    },
    high: {
      max: 38,
      min: 38
    },
    moderate: {
      max: 34,
      min: 34
    },
    low: {
      max: 32,
      min: 28
    }
  },
  "21": {
    extreme: {
      max: 43,
      min: 43
    },
    high: {
      max: 40,
      min: 40
    },
    moderate: {
      max: 36,
      min: 36
    },
    low: {
      max: 34,
      min: 29
    }
  },
  "22": {
    extreme: {
      max: 45,
      min: 45
    },
    high: {
      max: 42,
      min: 42
    },
    moderate: {
      max: 37,
      min: 37
    },
    low: {
      max: 35,
      min: 31
    }
  },
  "23": {
    extreme: {
      max: 46,
      min: 46
    },
    high: {
      max: 43,
      min: 43
    },
    moderate: {
      max: 38,
      min: 38
    },
    low: {
      max: 36,
      min: 32
    }
  },
  "24": {
    extreme: {
      max: 48,
      min: 48
    },
    high: {
      max: 45,
      min: 45
    },
    moderate: {
      max: 40,
      min: 40
    },
    low: {
      max: 38,
      min: 33
    }
  },
  "-1": {
    extreme: {
      max: 8,
      min: 8
    },
    high: {
      max: 5,
      min: 5
    },
    moderate: {
      max: 4,
      min: 4
    },
    low: {
      max: 2,
      min: 1
    }
  }
}

export const STRIKE_ATTACK_TABLE: ByLevel<number> = {
  "0": {
    extreme: 10,
    high: 8,
    moderate: 6,
    low: 4
  },
  "1": {
    extreme: 11,
    high: 9,
    moderate: 7,
    low: 5
  },
  "2": {
    extreme: 13,
    high: 11,
    moderate: 9,
    low: 7
  },
  "3": {
    extreme: 14,
    high: 12,
    moderate: 10,
    low: 8
  },
  "4": {
    extreme: 16,
    high: 14,
    moderate: 12,
    low: 9
  },
  "5": {
    extreme: 17,
    high: 15,
    moderate: 13,
    low: 11
  },
  "6": {
    extreme: 19,
    high: 17,
    moderate: 15,
    low: 12
  },
  "7": {
    extreme: 20,
    high: 18,
    moderate: 16,
    low: 13
  },
  "8": {
    extreme: 22,
    high: 20,
    moderate: 18,
    low: 15
  },
  "9": {
    extreme: 23,
    high: 21,
    moderate: 19,
    low: 16
  },
  "10": {
    extreme: 25,
    high: 23,
    moderate: 21,
    low: 17
  },
  "11": {
    extreme: 27,
    high: 24,
    moderate: 22,
    low: 19
  },
  "12": {
    extreme: 28,
    high: 26,
    moderate: 24,
    low: 20
  },
  "13": {
    extreme: 29,
    high: 27,
    moderate: 25,
    low: 21
  },
  "14": {
    extreme: 31,
    high: 29,
    moderate: 27,
    low: 23
  },
  "15": {
    extreme: 32,
    high: 30,
    moderate: 28,
    low: 24
  },
  "16": {
    extreme: 34,
    high: 32,
    moderate: 30,
    low: 25
  },
  "17": {
    extreme: 35,
    high: 33,
    moderate: 31,
    low: 27
  },
  "18": {
    extreme: 37,
    high: 35,
    moderate: 33,
    low: 28
  },
  "19": {
    extreme: 38,
    high: 36,
    moderate: 34,
    low: 29
  },
  "20": {
    extreme: 40,
    high: 38,
    moderate: 36,
    low: 31
  },
  "21": {
    extreme: 41,
    high: 39,
    moderate: 37,
    low: 32
  },
  "22": {
    extreme: 43,
    high: 41,
    moderate: 39,
    low: 33
  },
  "23": {
    extreme: 44,
    high: 42,
    moderate: 40,
    low: 35
  },
  "24": {
    extreme: 46,
    high: 44,
    moderate: 42,
    low: 36
  },
  "-1": {
    extreme: 10,
    high: 8,
    moderate: 6,
    low: 4
  }
}

export const STRIKE_DAMAGE_TABLE: ByLevel<DamageBenchmark> = {
  "0": {
    extreme: {
      formula: "1d6+3",
      average: 6
    },
    high: {
      formula: "1d6+2",
      average: 5
    },
    moderate: {
      formula: "1d4+2",
      average: 4
    },
    low: {
      formula: "1d4+1",
      average: 3
    }
  },
  "1": {
    extreme: {
      formula: "1d8+4",
      average: 8
    },
    high: {
      formula: "1d6+3",
      average: 6
    },
    moderate: {
      formula: "1d6+2",
      average: 5
    },
    low: {
      formula: "1d4+2",
      average: 4
    }
  },
  "2": {
    extreme: {
      formula: "1d12+4",
      average: 11
    },
    high: {
      formula: "1d10+4",
      average: 9
    },
    moderate: {
      formula: "1d8+4",
      average: 8
    },
    low: {
      formula: "1d6+3",
      average: 6
    }
  },
  "3": {
    extreme: {
      formula: "1d12+8",
      average: 15
    },
    high: {
      formula: "1d10+6",
      average: 12
    },
    moderate: {
      formula: "1d8+6",
      average: 10
    },
    low: {
      formula: "1d6+5",
      average: 8
    }
  },
  "4": {
    extreme: {
      formula: "2d10+7",
      average: 18
    },
    high: {
      formula: "2d8+5",
      average: 14
    },
    moderate: {
      formula: "2d6+5",
      average: 12
    },
    low: {
      formula: "2d4+4",
      average: 9
    }
  },
  "5": {
    extreme: {
      formula: "2d12+7",
      average: 20
    },
    high: {
      formula: "2d8+7",
      average: 16
    },
    moderate: {
      formula: "2d6+6",
      average: 13
    },
    low: {
      formula: "2d4+6",
      average: 11
    }
  },
  "6": {
    extreme: {
      formula: "2d12+10",
      average: 23
    },
    high: {
      formula: "2d8+9",
      average: 18
    },
    moderate: {
      formula: "2d6+8",
      average: 15
    },
    low: {
      formula: "2d4+7",
      average: 12
    }
  },
  "7": {
    extreme: {
      formula: "2d12+12",
      average: 25
    },
    high: {
      formula: "2d10+9",
      average: 20
    },
    moderate: {
      formula: "2d8+8",
      average: 17
    },
    low: {
      formula: "2d6+6",
      average: 13
    }
  },
  "8": {
    extreme: {
      formula: "2d12+15",
      average: 28
    },
    high: {
      formula: "2d10+11",
      average: 22
    },
    moderate: {
      formula: "2d8+9",
      average: 18
    },
    low: {
      formula: "2d6+8",
      average: 15
    }
  },
  "9": {
    extreme: {
      formula: "2d12+17",
      average: 30
    },
    high: {
      formula: "2d10+13",
      average: 24
    },
    moderate: {
      formula: "2d8+11",
      average: 20
    },
    low: {
      formula: "2d6+9",
      average: 16
    }
  },
  "10": {
    extreme: {
      formula: "2d12+20",
      average: 33
    },
    high: {
      formula: "2d12+13",
      average: 26
    },
    moderate: {
      formula: "2d10+11",
      average: 22
    },
    low: {
      formula: "2d6+10",
      average: 17
    }
  },
  "11": {
    extreme: {
      formula: "2d12+22",
      average: 35
    },
    high: {
      formula: "2d12+15",
      average: 28
    },
    moderate: {
      formula: "2d10+12",
      average: 23
    },
    low: {
      formula: "2d8+10",
      average: 19
    }
  },
  "12": {
    extreme: {
      formula: "3d12+19",
      average: 38
    },
    high: {
      formula: "3d10+14",
      average: 30
    },
    moderate: {
      formula: "3d8+12",
      average: 25
    },
    low: {
      formula: "3d6+10",
      average: 20
    }
  },
  "13": {
    extreme: {
      formula: "3d12+21",
      average: 40
    },
    high: {
      formula: "3d10+16",
      average: 32
    },
    moderate: {
      formula: "3d8+14",
      average: 27
    },
    low: {
      formula: "3d6+11",
      average: 21
    }
  },
  "14": {
    extreme: {
      formula: "3d12+24",
      average: 43
    },
    high: {
      formula: "3d10+18",
      average: 34
    },
    moderate: {
      formula: "3d8+15",
      average: 28
    },
    low: {
      formula: "3d6+13",
      average: 23
    }
  },
  "15": {
    extreme: {
      formula: "3d12+26",
      average: 45
    },
    high: {
      formula: "3d12+17",
      average: 36
    },
    moderate: {
      formula: "3d10+14",
      average: 30
    },
    low: {
      formula: "3d6+14",
      average: 24
    }
  },
  "16": {
    extreme: {
      formula: "3d12+29",
      average: 48
    },
    high: {
      formula: "3d12+18",
      average: 37
    },
    moderate: {
      formula: "3d10+15",
      average: 31
    },
    low: {
      formula: "3d6+15",
      average: 25
    }
  },
  "17": {
    extreme: {
      formula: "3d12+31",
      average: 50
    },
    high: {
      formula: "3d12+19",
      average: 38
    },
    moderate: {
      formula: "3d10+16",
      average: 32
    },
    low: {
      formula: "3d6+16",
      average: 26
    }
  },
  "18": {
    extreme: {
      formula: "3d12+34",
      average: 53
    },
    high: {
      formula: "3d12+20",
      average: 40
    },
    moderate: {
      formula: "3d10+17",
      average: 33
    },
    low: {
      formula: "3d6+17",
      average: 27
    }
  },
  "19": {
    extreme: {
      formula: "4d12+29",
      average: 55
    },
    high: {
      formula: "4d10+20",
      average: 42
    },
    moderate: {
      formula: "4d8+17",
      average: 35
    },
    low: {
      formula: "4d6+14",
      average: 28
    }
  },
  "20": {
    extreme: {
      formula: "4d12+32",
      average: 58
    },
    high: {
      formula: "4d10+22",
      average: 44
    },
    moderate: {
      formula: "4d8+19",
      average: 37
    },
    low: {
      formula: "4d6+15",
      average: 29
    }
  },
  "21": {
    extreme: {
      formula: "4d12+34",
      average: 60
    },
    high: {
      formula: "4d10+24",
      average: 46
    },
    moderate: {
      formula: "4d8+20",
      average: 38
    },
    low: {
      formula: "4d6+17",
      average: 31
    }
  },
  "22": {
    extreme: {
      formula: "4d12+37",
      average: 63
    },
    high: {
      formula: "4d10+26",
      average: 48
    },
    moderate: {
      formula: "4d8+22",
      average: 40
    },
    low: {
      formula: "4d6+18",
      average: 32
    }
  },
  "23": {
    extreme: {
      formula: "4d12+39",
      average: 65
    },
    high: {
      formula: "4d12+24",
      average: 50
    },
    moderate: {
      formula: "4d10+20",
      average: 42
    },
    low: {
      formula: "4d6+19",
      average: 33
    }
  },
  "24": {
    extreme: {
      formula: "4d12+42",
      average: 68
    },
    high: {
      formula: "4d12+26",
      average: 52
    },
    moderate: {
      formula: "4d10+22",
      average: 44
    },
    low: {
      formula: "4d6+21",
      average: 35
    }
  },
  "-1": {
    extreme: {
      formula: "1d6+1",
      average: 4
    },
    high: {
      formula: "1d4+1",
      average: 3
    },
    moderate: {
      formula: "1d4",
      average: 3
    },
    low: {
      formula: "1d4",
      average: 2
    }
  }
}

export const SPELL_TABLE: Record<number, Partial<Record<ScaleColumn, { dc?: number; attack?: number }>>> = {
  "0": {
    extreme: {
      dc: 19,
      attack: 11
    },
    high: {
      dc: 16,
      attack: 8
    },
    moderate: {
      dc: 13,
      attack: 5
    }
  },
  "1": {
    extreme: {
      dc: 20,
      attack: 12
    },
    high: {
      dc: 17,
      attack: 9
    },
    moderate: {
      dc: 14,
      attack: 6
    }
  },
  "2": {
    extreme: {
      dc: 22,
      attack: 14
    },
    high: {
      dc: 18,
      attack: 10
    },
    moderate: {
      dc: 15,
      attack: 7
    }
  },
  "3": {
    extreme: {
      dc: 23,
      attack: 15
    },
    high: {
      dc: 20,
      attack: 12
    },
    moderate: {
      dc: 17,
      attack: 9
    }
  },
  "4": {
    extreme: {
      dc: 25,
      attack: 17
    },
    high: {
      dc: 21,
      attack: 13
    },
    moderate: {
      dc: 18,
      attack: 10
    }
  },
  "5": {
    extreme: {
      dc: 26,
      attack: 18
    },
    high: {
      dc: 22,
      attack: 14
    },
    moderate: {
      dc: 19,
      attack: 11
    }
  },
  "6": {
    extreme: {
      dc: 27,
      attack: 19
    },
    high: {
      dc: 24,
      attack: 16
    },
    moderate: {
      dc: 21,
      attack: 13
    }
  },
  "7": {
    extreme: {
      dc: 29,
      attack: 21
    },
    high: {
      dc: 25,
      attack: 17
    },
    moderate: {
      dc: 22,
      attack: 14
    }
  },
  "8": {
    extreme: {
      dc: 30,
      attack: 22
    },
    high: {
      dc: 26,
      attack: 18
    },
    moderate: {
      dc: 23,
      attack: 15
    }
  },
  "9": {
    extreme: {
      dc: 32,
      attack: 24
    },
    high: {
      dc: 28,
      attack: 20
    },
    moderate: {
      dc: 25,
      attack: 17
    }
  },
  "10": {
    extreme: {
      dc: 33,
      attack: 25
    },
    high: {
      dc: 29,
      attack: 21
    },
    moderate: {
      dc: 26,
      attack: 18
    }
  },
  "11": {
    extreme: {
      dc: 34,
      attack: 26
    },
    high: {
      dc: 30,
      attack: 22
    },
    moderate: {
      dc: 27,
      attack: 19
    }
  },
  "12": {
    extreme: {
      dc: 36,
      attack: 28
    },
    high: {
      dc: 32,
      attack: 24
    },
    moderate: {
      dc: 29,
      attack: 21
    }
  },
  "13": {
    extreme: {
      dc: 37,
      attack: 29
    },
    high: {
      dc: 33,
      attack: 25
    },
    moderate: {
      dc: 30,
      attack: 22
    }
  },
  "14": {
    extreme: {
      dc: 39,
      attack: 31
    },
    high: {
      dc: 34,
      attack: 26
    },
    moderate: {
      dc: 31,
      attack: 23
    }
  },
  "15": {
    extreme: {
      dc: 40,
      attack: 32
    },
    high: {
      dc: 36,
      attack: 28
    },
    moderate: {
      dc: 33,
      attack: 25
    }
  },
  "16": {
    extreme: {
      dc: 41,
      attack: 33
    },
    high: {
      dc: 37,
      attack: 29
    },
    moderate: {
      dc: 34,
      attack: 26
    }
  },
  "17": {
    extreme: {
      dc: 43,
      attack: 35
    },
    high: {
      dc: 38,
      attack: 30
    },
    moderate: {
      dc: 35,
      attack: 27
    }
  },
  "18": {
    extreme: {
      dc: 44,
      attack: 36
    },
    high: {
      dc: 40,
      attack: 32
    },
    moderate: {
      dc: 37,
      attack: 29
    }
  },
  "19": {
    extreme: {
      dc: 46,
      attack: 38
    },
    high: {
      dc: 41,
      attack: 33
    },
    moderate: {
      dc: 38,
      attack: 30
    }
  },
  "20": {
    extreme: {
      dc: 47,
      attack: 39
    },
    high: {
      dc: 42,
      attack: 34
    },
    moderate: {
      dc: 39,
      attack: 31
    }
  },
  "21": {
    extreme: {
      dc: 48,
      attack: 40
    },
    high: {
      dc: 44,
      attack: 36
    },
    moderate: {
      dc: 41,
      attack: 33
    }
  },
  "22": {
    extreme: {
      dc: 50,
      attack: 42
    },
    high: {
      dc: 45,
      attack: 37
    },
    moderate: {
      dc: 42,
      attack: 34
    }
  },
  "23": {
    extreme: {
      dc: 51,
      attack: 43
    },
    high: {
      dc: 46,
      attack: 38
    },
    moderate: {
      dc: 43,
      attack: 35
    }
  },
  "24": {
    extreme: {
      dc: 52,
      attack: 44
    },
    high: {
      dc: 48,
      attack: 40
    },
    moderate: {
      dc: 45,
      attack: 37
    }
  },
  "-1": {
    extreme: {
      dc: 19,
      attack: 11
    },
    high: {
      dc: 16,
      attack: 8
    },
    moderate: {
      dc: 13,
      attack: 5
    }
  }
}

export const RESISTANCE_TABLE: Record<number, Band> = {
  "0": {
    max: 3,
    min: 1
  },
  "1": {
    max: 3,
    min: 2
  },
  "2": {
    max: 5,
    min: 2
  },
  "3": {
    max: 6,
    min: 3
  },
  "4": {
    max: 7,
    min: 4
  },
  "5": {
    max: 8,
    min: 4
  },
  "6": {
    max: 9,
    min: 5
  },
  "7": {
    max: 10,
    min: 5
  },
  "8": {
    max: 11,
    min: 6
  },
  "9": {
    max: 12,
    min: 6
  },
  "10": {
    max: 13,
    min: 7
  },
  "11": {
    max: 14,
    min: 7
  },
  "12": {
    max: 15,
    min: 8
  },
  "13": {
    max: 16,
    min: 8
  },
  "14": {
    max: 17,
    min: 9
  },
  "15": {
    max: 18,
    min: 9
  },
  "16": {
    max: 19,
    min: 9
  },
  "17": {
    max: 19,
    min: 10
  },
  "18": {
    max: 20,
    min: 10
  },
  "19": {
    max: 21,
    min: 11
  },
  "20": {
    max: 22,
    min: 11
  },
  "21": {
    max: 23,
    min: 12
  },
  "22": {
    max: 24,
    min: 12
  },
  "23": {
    max: 25,
    min: 13
  },
  "24": {
    max: 26,
    min: 13
  },
  "-1": {
    max: 1,
    min: 1
  }
}

/** Menor e maior nível que as tabelas cobrem. */
export const MIN_LEVEL = -1
export const MAX_LEVEL = 24

export const TABLES_SOURCE = 'GM Core pg. 112-121'
