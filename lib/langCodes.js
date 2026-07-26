export const LANG_CODES = {
  Espagnol: 'es-ES',
  Anglais: 'en-US',
  Italien: 'it-IT',
  Allemand: 'de-DE',
  Portugais: 'pt-PT',
  Japonais: 'ja-JP',
};

export function toLangCode(langueCible) {
  return LANG_CODES[langueCible] || 'en-US';
}
