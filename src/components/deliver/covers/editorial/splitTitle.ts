export function splitTitle(text: string) {
  const raw = text.trim();
  if (!raw) return { line1: '', line2: '' };

  // 1. Check for connectors: & | E | +
  const connectorRegex = /\s+(&|e|\+)\s+/i;
  const match = raw.match(connectorRegex);

  if (match) {
    const connector = match[1].toUpperCase() === 'E' ? '&' : match[1].toUpperCase();
    const index = match.index!;
    const line1 = raw.substring(0, index).trim().toUpperCase();
    const line2 = (connector + ' ' + raw.substring(index + match[0].length).trim()).toUpperCase();
    return { line1, line2 };
  }

  // 2. Simple two words split
  const words = raw.split(/\s+/);
  if (words.length === 2) {
    return { line1: words[0].toUpperCase(), line2: words[1].toUpperCase() };
  }

  // 3. Balanced split for 3+ words
  if (words.length >= 3) {
    const mid = Math.ceil(words.length / 2);
    return {
      line1: words.slice(0, mid).join(' ').toUpperCase(),
      line2: words.slice(mid).join(' ').toUpperCase(),
    };
  }

  // 4. Single word
  return { line1: raw.toUpperCase(), line2: '' };
}
