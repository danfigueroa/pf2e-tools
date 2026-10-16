/** Silhueta de cada dado, em `clip-path`. O d6 é um quadrado arredondado. */
export const DICE_SHAPE: Record<number, string | undefined> = {
    4: 'polygon(50% 2%, 100% 96%, 0% 96%)',
    8: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    10: 'polygon(50% 0%, 100% 42%, 50% 100%, 0% 42%)',
    12: 'polygon(50% 0%, 100% 36%, 82% 100%, 18% 100%, 0% 36%)',
    20: 'polygon(25% 2%, 75% 2%, 100% 50%, 75% 98%, 25% 98%, 0% 50%)',
    // d100: o dezena do d10, só que com cantos cortados — lê-se como "o outro d10".
    100: 'polygon(50% 0%, 90% 20%, 100% 62%, 50% 100%, 0% 62%, 10% 20%)',
}

/** Cor do número sobre o corpo do dado: preto nos claros, branco nos escuros (YIQ). */
export function inkOn(hex: string): string {
    const n = parseInt(hex.slice(1), 16)
    const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000
    return yiq >= 150 ? '#1A1A1A' : '#FFFFFF'
}
