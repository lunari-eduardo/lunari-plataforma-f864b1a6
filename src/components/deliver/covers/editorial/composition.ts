export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorialSpec {
  orientation: 'vertical' | 'horizontal';
  seam: number; // 0 to 1
  photoRect: Rect;
  titleBox: Rect;
  subtitlePos: { x: number; y: number };
  datePos: { x: number; y: number };
  ctaPos: { x: number; y: number };
}

export interface ResolvedEditorialSpec {
  orientation: 'vertical' | 'horizontal';
  seamPx: number;
  photo: Rect;
  title: Rect;
  subtitle: { x: number; y: number };
  date: { x: number; y: number };
  cta: { x: number; y: number };
  width: number;
  height: number;
}

const DESKTOP_SPEC: EditorialSpec = {
  orientation: 'vertical',
  seam: 0.42,
  photoRect: { x: 0.42, y: 0, width: 0.58, height: 1 },
  titleBox: { x: 0.06, y: 0.46, width: 0.52, height: 0.35 }, // vertical centered handled in resolver
  subtitlePos: { x: 0.06, y: 0.68 },
  datePos: { x: 0.06, y: 0.94 },
  ctaPos: { x: 0.94, y: 0.94 }, // right aligned handled in resolver
};

const TABLET_SPEC: EditorialSpec = {
  orientation: 'vertical',
  seam: 0.36,
  photoRect: { x: 0.36, y: 0, width: 0.64, height: 1 },
  titleBox: { x: 0.05, y: 0.46, width: 0.60, height: 0.32 },
  subtitlePos: { x: 0.05, y: 0.66 },
  datePos: { x: 0.05, y: 0.94 },
  ctaPos: { x: 0.95, y: 0.94 },
};

const MOBILE_SPEC: EditorialSpec = {
  orientation: 'horizontal',
  seam: 0.48,
  photoRect: { x: 0, y: 0.48, width: 1, height: 0.52 },
  titleBox: { x: 0.06, y: 0.42, width: 0.88, height: 0.25 }, // overlapping seam
  subtitlePos: { x: 0.06, y: 0.28 },
  datePos: { x: 0.06, y: 0.94 },
  ctaPos: { x: 0.94, y: 0.94 },
};

export function resolveEditorialSpec(width: number, height: number): ResolvedEditorialSpec {
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const spec = isMobile ? MOBILE_SPEC : isTablet ? TABLET_SPEC : DESKTOP_SPEC;

  const seamPx = spec.orientation === 'vertical' ? width * spec.seam : height * spec.seam;

  return {
    orientation: spec.orientation,
    seamPx,
    photo: {
      x: spec.photoRect.x * width,
      y: spec.photoRect.y * height,
      width: spec.photoRect.width * width,
      height: spec.photoRect.height * height,
    },
    title: {
      x: spec.titleBox.x * width,
      y: spec.titleBox.y * height, // simplified, will be centered in component
      width: spec.titleBox.width * width,
      height: spec.titleBox.height * height,
    },
    subtitle: {
      x: spec.subtitlePos.x * width,
      y: spec.subtitlePos.y * height,
    },
    date: {
      x: spec.datePos.x * width,
      y: spec.datePos.y * height,
    },
    cta: {
      x: spec.ctaPos.x * width,
      y: spec.ctaPos.y * height,
    },
    width,
    height,
  };
}
