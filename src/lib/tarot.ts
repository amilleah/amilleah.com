export const SUITS = ['Cups', 'Pents', 'Swords', 'Wands'];
export const VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'P', 'N', 'Q', 'K'];

export const SYMBOLS: Record<string, string> = {
  'Cups': '♥',
  'Pents': '♣',
  'Swords': '♦',
  'Wands': '♠'
};

export const DISPLAY_SUITS: Record<string, string> = {
  'Cups': 'Cups',
  'Pents': 'Pentacles',
  'Swords': 'Swords',
  'Wands': 'Wands'
};

export const MAJOR_ARCANA: Record<number, { name: string, file: string }> = {
  0: { name: "The Fool", file: "RWS_Tarot_00_Fool.ans" },
  1: { name: "The Magician", file: "RWS_Tarot_01_Magician.ans" },
  2: { name: "The High Priestess", file: "RWS_Tarot_02_High_Priestess.ans" },
  3: { name: "The Empress", file: "RWS_Tarot_03_Empress.ans" },
  4: { name: "The Emperor", file: "RWS_Tarot_04_Emperor.ans" },
  5: { name: "The Hierophant", file: "RWS_Tarot_05_Hierophant.ans" },
  6: { name: "The Lovers", file: "RWS_Tarot_06_Lovers.ans" },
  7: { name: "The Chariot", file: "RWS_Tarot_07_Chariot.ans" },
  8: { name: "Strength", file: "RWS_Tarot_08_Strength.ans" },
  9: { name: "The Hermit", file: "RWS_Tarot_09_Hermit.ans" },
  10: { name: "Wheel of Fortune", file: "RWS_Tarot_10_Wheel_of_Fortune.ans" },
  11: { name: "Justice", file: "RWS_Tarot_11_Justice.ans" },
  12: { name: "The Hanged Man", file: "RWS_Tarot_12_Hanged_Man.ans" },
  13: { name: "Death", file: "RWS_Tarot_13_Death.ans" },
  14: { name: "Temperance", file: "RWS_Tarot_14_Temperance.ans" },
  15: { name: "The Devil", file: "RWS_Tarot_15_Devil.ans" },
  16: { name: "The Tower", file: "RWS_Tarot_16_Tower.ans" },
  17: { name: "The Star", file: "RWS_Tarot_17_Star.ans" },
  18: { name: "The Moon", file: "RWS_Tarot_18_Moon.ans" },
  19: { name: "The Sun", file: "RWS_Tarot_19_Sun.ans" },
  20: { name: "Judgement", file: "RWS_Tarot_20_Judgement.ans" },
  21: { name: "The World", file: "RWS_Tarot_21_World.ans" },
};

export interface CardData {
  name: string;
  file: string;
  shorthand: string;
}

function toRoman(num: number): string {
  if (num === 0) return "0";
  const lookup = [
    { value: 10, symbol: "X" },
    { value: 9, symbol: "IX" },
    { value: 5, symbol: "V" },
    { value: 4, symbol: "IV" },
    { value: 1, symbol: "I" }
  ];
  let roman = "";
  for (const item of lookup) {
    while (num >= item.value) {
      roman += item.symbol;
      num -= item.value;
    }
  }
  return roman;
}

export function getRandomCard(): CardData {
  const total = 78;
  const pick = Math.floor(Math.random() * total);

  if (pick < 22) {
    const card = MAJOR_ARCANA[pick];
    return {
      ...card,
      shorthand: toRoman(pick)
    };
  } else {
    const minorIndex = pick - 22;
    const suitIndex = Math.floor(minorIndex / 14);
    const valueIndex = minorIndex % 14;
    
    const suitKey = SUITS[suitIndex];
    const suitDisplay = DISPLAY_SUITS[suitKey];
    
    const valName = VALUES[valueIndex];
    const symbol = SYMBOLS[suitKey];
    
    const fileNum = (valueIndex + 1).toString().padStart(2, '0');
    
    const displayValue = valName === 'P' ? 'Page' 
      : valName === 'N' ? 'Knight' 
      : valName === 'Q' ? 'Queen' 
      : valName === 'K' ? 'King' 
      : valName;

    return {
      name: `${displayValue} of ${suitDisplay}`,
      file: `${suitKey}${fileNum}.ans`,
      shorthand: `${valName}${symbol}`
    };
  }
}