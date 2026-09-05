import { GalleryPhoto } from '@/types/gallery';

export type CodeFormat = 'windows' | 'lightroom' | 'mac' | 'txt';
export type LightboxSource = 'all' | 'selection' | 'filtered';

export const codeFormatLabels: Record<CodeFormat, string> = {
  windows: 'Windows Explorer',
  lightroom: 'Adobe Lightroom',
  mac: 'Finder (Mac)',
  txt: 'Lista simples (TXT)',
};

export const codeFormatDescriptions: Record<CodeFormat, string> = {
  windows: 'Cole o código na barra de pesquisa do Windows Explorer para filtrar as fotos selecionadas.',
  lightroom: 'Cole o código no filtro de texto da Biblioteca do Lightroom (Filtro da Grade > Texto > Contém).',
  mac: 'Cole o código na barra de pesquisa do Finder no macOS para filtrar as fotos do ensaio.',
  txt: 'Lista simples com quebra de linha por foto, ideal para planilhas ou blocos de notas.',
};

export const codeFormatHints: Record<CodeFormat, string> = {
  windows: 'Dica: Cole este código na barra de pesquisa do Windows Explorer para mostrar apenas as fotos selecionadas.',
  lightroom: 'Dica: No Lightroom, abra a pasta, pressione "\\" para abrir o filtro da grade, escolha "Texto" > "Contém" e cole o código.',
  mac: 'Dica: No Finder, acesse a pasta do ensaio e cole o código no campo de busca.',
  txt: 'Dica: Lista limpa com os nomes dos arquivos (sem extensões) para fácil conferência.',
};

// Helper to remove extension from filename
export function removeExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

// Generate formatted search code
export function generateSearchCode(photos: GalleryPhoto[], format: CodeFormat): string {
  if (photos.length === 0) return '';
  const filenames = photos.map(p => removeExtension(p.originalFilename || p.filename));
  switch (format) {
    case 'windows':
      return filenames.map(f => `"${f}"`).join(' OR ');
    case 'lightroom':
      return filenames.join(', ');
    case 'mac':
      return filenames.join(' OR ');
    case 'txt':
      return filenames.join('\n');
    default:
      return filenames.join(' OR ');
  }
}

// Polling interval for pending payments (30 seconds)
export const PAYMENT_POLL_INTERVAL = 30000;
