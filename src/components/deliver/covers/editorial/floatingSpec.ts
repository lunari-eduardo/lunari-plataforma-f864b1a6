export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatingSpec {
  photo: Rect;
  title: { y: number; width: number; height: number };
  subtitleY: number;
  ctaY: number;
  isMobile: boolean;
}

export function resolveFloatingSpec(width: number, height: number): FloatingSpec {
  const isMobile = width < 640;
  
  if (isMobile) {
    const photoWidth = width * 0.85;
    const photoHeight = photoWidth * (2/3);
    const photoX = (width - photoWidth) / 2;
    const photoY = height * 0.12;
    
    return {
      isMobile: true,
      photo: { x: photoX, y: photoY, width: photoWidth, height: photoHeight },
      title: { y: photoY + photoHeight + 40, width: width * 0.8, height: height * 0.15 },
      subtitleY: photoY + photoHeight + 40 + 60, // approximate, will be flexed
      ctaY: photoY + photoHeight + 160,
    };
  }

  // Desktop
  const photoWidth = Math.min(width * 0.6, 900);
  const photoHeight = photoWidth * (10 / 16);
  const photoX = (width - photoWidth) / 2;
  const photoY = height * 0.15;

  return {
    isMobile: false,
    photo: { x: photoX, y: photoY, width: photoWidth, height: photoHeight },
    title: { y: photoY + photoHeight + 60, width: width * 0.7, height: height * 0.2 },
    subtitleY: photoY + photoHeight + 180,
    ctaY: photoY + photoHeight + 260,
  };
}
