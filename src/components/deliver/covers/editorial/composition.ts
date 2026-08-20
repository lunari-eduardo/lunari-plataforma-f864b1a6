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
  datePos: { x: number; y: number };
  ctaPos: { x: number; y: number };
}

export interface ResolvedEditorialSpec {
  orientation: 'vertical' | 'horizontal';
  seamPx: number;
  photo: Rect;
  title: Rect;
  date: { x: number; y: number };
  cta: { x: number; y: number };
  width: number;
  height: number;
}

const DESKTOP_SPEC: EditorialSpec = {
  orientation: 'vertical',
  seam: 0.42,
  photoRect: { x: 0.42, y: 0, width: 0.58, height: 1 },
  titleBox: { x: 0.08, y: 0.5, width: 0.55, height: 0.4 }, // y: 0.5 is anchor for vertical center
  datePos: { x: 0.08, y: 0.92 },
  ctaPos: { x: 0.92, y: 0.92 },
};

const TABLET_SPEC: EditorialSpec = {
  orientation: 'vertical',
  seam: 0.38,
  photoRect: { x: 0.38, y: 0, width: 0.62, height: 1 },
  titleBox: { x: 0.08, y: 0.5, width: 0.55, height: 0.35 },
  datePos: { x: 0.08, y: 0.92 },
  ctaPos: { x: 0.92, y: 0.92 },
};

const MOBILE_SPEC: EditorialSpec = {
  orientation: 'horizontal',
  seam: 0.22,
  photoRect: { x: 0, y: 0.22, width: 1, height: 0.78 },
  titleBox: { x: 0.08, y: 0.22, width: 0.84, height: 0.35 }, // y: 0.22 anchors center of title block to seam
  datePos: { x: 0.08, y: 0.90 },
  ctaPos: { x: 0.92, y: 0.90 },
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
      y: spec.titleBox.y * height,
      width: spec.titleBox.width * width,
      height: spec.titleBox.height * height,
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