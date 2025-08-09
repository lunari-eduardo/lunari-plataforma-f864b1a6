export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Gera um canvas com razão de aspecto fixa (aspect = width/height)
export function drawImageToCanvasAspect(
  image: HTMLImageElement,
  aspect: number, // ex.: 4/5
  offsetX: number,
  offsetY: number,
  scale: number
): HTMLCanvasElement {
  const targetW = 1080; // base de trabalho
  const targetH = Math.round(targetW / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  const iw = image.naturalWidth * scale;
  const ih = image.naturalHeight * scale;

  const cx = (targetW - iw) / 2 + offsetX;
  const cy = (targetH - ih) / 2 + offsetY;

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(image, cx, cy, iw, ih);

  return canvas;
}

export async function compressToJpeg(
  input: HTMLCanvasElement | HTMLImageElement,
  maxDim = 1080,
  quality = 0.7
): Promise<string> {
  let canvas: HTMLCanvasElement;

  if (input instanceof HTMLCanvasElement) {
    canvas = input;
  } else {
    const scale = Math.min(maxDim / input.naturalWidth, maxDim / input.naturalHeight, 1);
    canvas = document.createElement('canvas');
    canvas.width = Math.round(input.naturalWidth * scale);
    canvas.height = Math.round(input.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(input, 0, 0, canvas.width, canvas.height);
  }

  if (Math.max(canvas.width, canvas.height) > maxDim) {
    const s = maxDim / Math.max(canvas.width, canvas.height);
    const resized = document.createElement('canvas');
    resized.width = Math.round(canvas.width * s);
    resized.height = Math.round(canvas.height * s);
    const rctx = resized.getContext('2d')!;
    rctx.drawImage(canvas, 0, 0, resized.width, resized.height);
    canvas = resized;
  }

  return new Promise((resolve) => {
    const dataURL = canvas.toDataURL('image/jpeg', quality);
    resolve(dataURL);
  });
}
