export function splitTitle(rawTitle: string): { line1: string; line2: string } {
  const text = rawTitle.trim();
  if (!text) return { line1: 'EDITORIAL', line2: '' };

  // Se contém conector ('&', 'e', '+'), divide no conector
  const connectorMatch = text.match(/^(.*?)(?:\s+(&|e|\+)\s+)(.*)$/i);
  if (connectorMatch) {
    const p1 = connectorMatch[1].trim().toUpperCase();
    const conn = connectorMatch[2].trim().toUpperCase() === 'E' ? '&' : connectorMatch[2].trim().toUpperCase();
    const p2 = connectorMatch[3].trim().toUpperCase();
    return { line1: p1, line2: `${conn} ${p2}` };
  }

  // Se tem 2 palavras, divide em linha 1 e linha 2
  const parts = text.split(/\s+/);
  if (parts.length === 2) {
    return { line1: parts[0].toUpperCase(), line2: parts[1].toUpperCase() };
  }

  // Se tem 3 ou mais palavras, divide equilibradamente
  if (parts.length >= 3) {
    const mid = Math.ceil(parts.length / 2);
    return {
      line1: parts.slice(0, mid).join(' ').toUpperCase(),
      line2: parts.slice(mid).join(' ').toUpperCase(),
    };
  }

  // Palavra única
  return { line1: text.toUpperCase(), line2: '' };
}
