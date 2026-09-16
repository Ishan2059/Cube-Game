// Shared moderation for new names and historical display names.
// Handles common English and romanized Nepali/Hindi profanity, not every language.
const ROOTS = ['fuck', 'bitch', 'pussy', 'asshole', 'bastard',
  'chikne', 'chikni', 'chikeko', 'machik', 'randi', 'randiko', 'madarchod',
  'madharchod', 'behenchod', 'bhenchod', 'chutiya', 'bhosdi', 'puti', 'pute'];
function normalize(value: string): string {
  const leet: Record<string, string> = { '0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '@':'a', '$':'s', '!':'i' };
  return value.normalize('NFKC').toLowerCase().replace(/[013457@$!]/g, c => leet[c])
    .replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}
export function isOffensiveName(raw: unknown): boolean {
  const value = String(raw ?? '');
  const normalized = normalize(value);
  return ROOTS.some(word => normalized.includes(normalize(word))) ||
    /^(?:lado|loda|lund|dick|cock)(?:$|pute|puti|chik)|^shit(?:$|head|face)|^cunt/.test(normalized) ||
    /(?:लाडो|लाँडो|पुती|पुति|चिक्ने|रन्डी|रंडी|मादरचोद|बहनचोद)/u.test(value);
}
export function cleanPlayerName(raw: unknown): string {
  return String(raw ?? '').normalize('NFKC').replace(/[^A-Za-z0-9_]/g, '').slice(0, 12);
}
export function playerNameError(raw: unknown): string | null {
  if (isOffensiveName(raw) || isOffensiveName(cleanPlayerName(raw))) return 'Please choose a name without offensive language.';
  if (!cleanPlayerName(raw)) return 'Enter a username using letters, numbers or underscores.';
  return null;
}
export function displayPlayerName(raw: unknown): string {
  return isOffensiveName(raw) || isOffensiveName(cleanPlayerName(raw)) ? 'Player' : cleanPlayerName(raw) || 'player';
}
