import { gestaoR2Upload } from '@/lib/gestaoR2Upload';

// Upload de imagem para propostas: redimensiona no client (máx 1920px,
// JPEG 85%) e envia para o R2 via Edge Function do Studio.
export async function uploadProposalImage(file: File): Promise<string> {
  return uploadSingleImage(file);
}

/**
 * Upload múltiplo de imagens para propostas.
 * Processa o redimensionamento e o envio em paralelo.
 */
export async function uploadMultipleProposalImages(files: FileList | File[]): Promise<string[]> {
  const fileArray = Array.from(files);
  const promises = fileArray.map(file => uploadSingleImage(file));
  return Promise.all(promises);
}

function uploadSingleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error('Failed to convert to blob'));
          const ext = file.name.split('.').pop() || 'jpg';
          const filename = `${crypto.randomUUID()}.${ext}`;

          try {
            const resizedFile = new File([blob], filename, { type: blob.type || 'image/jpeg' });
            const response = await gestaoR2Upload({
              file: resizedFile,
              context: 'proposals'
            });
            resolve(response.url || `https://media.lunarihub.com/${response.storagePath}`);
          } catch (err) {
            reject(err);
          }
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}
