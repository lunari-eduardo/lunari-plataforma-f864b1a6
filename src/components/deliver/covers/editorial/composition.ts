export interface Rect {
  x: number; // Fração da largura (0..1)
  y: number; // Fração da altura (0..1)
  w: number; // Fração da largura (0..1)
  h: number; // Fração da altura (0..1)
}

export interface TitleSpec {
  x: number; // Fração da largura (0..1)
  y: number; // Fração da altura (0..1), âncora vertical (centro)
  w: number; // Fração da largura (0..1)
}

export interface EditorialSpec {
  photo: Rect;
  title: TitleSpec;
}

export const DESKTOP_SPEC: EditorialSpec = {
  photo: { x: 0.50, y: 0.10, w: 0.45, h: 0.74 },
  title: { x: 0.06, y: 0.50, w: 0.58 },
};

export const COMPACT_SPEC: EditorialSpec = {
  photo: { x: 0.38, y: 0.12, w: 0.56, h: 0.60 },
  title: { x: 0.06, y: 0.46, w: 0.62 },
};

export const MOBILE_SPEC: EditorialSpec = {
  photo: { x: 0.28, y: 0.10, w: 0.70, h: 0.58 },
  title: { x: 0.05, y: 0.60, w: 0.82 },
};

export interface ResolvedRect {
  x: number; // pixels
  y: number; // pixels
  w: number; // pixels
  h: number; // pixels
}

export interface ResolvedTitle {
  x: number; // pixels
  centerY: number; // pixels (ponto central vertical)
  w: number; // pixels
}

export interface ResolvedSpec {
  photo: ResolvedRect;
  title: ResolvedTitle;
  breakpoint: 'desktop' | 'compact' | 'mobile';
}

export type EditorialOverrides = Partial<{
  desktop: Partial<{ photo: Partial<Rect>; title: Partial<TitleSpec> }>;
  compact: Partial<{ photo: Partial<Rect>; title: Partial<TitleSpec> }>;
  mobile: Partial<{ photo: Partial<Rect>; title: Partial<TitleSpec> }>;
}>;

function mergeSpec(base: EditorialSpec, override?: Partial<{ photo: Partial<Rect>; title: Partial<TitleSpec> }>): EditorialSpec {
  if (!override) return base;
  return {
    photo: { ...base.photo, ...override.photo },
    title: { ...base.title, ...override.title },
  };
}

export function resolveSpec(
  viewportWidth: number,
  viewportHeight: number,
  overrides?: EditorialOverrides
): ResolvedSpec {
  let baseSpec: EditorialSpec;
  let breakpoint: ResolvedSpec['breakpoint'];

  if (viewportWidth >= 1024) {
    baseSpec = mergeSpec(DESKTOP_SPEC, overrides?.desktop);
    breakpoint = 'desktop';
  } else if (viewportWidth >= 640) {
    baseSpec = mergeSpec(COMPACT_SPEC, overrides?.compact);
    breakpoint = 'compact';
  } else {
    baseSpec = mergeSpec(MOBILE_SPEC, overrides?.mobile);
    breakpoint = 'mobile';
  }

  const resolvedPhoto = {
    x: baseSpec.photo.x * viewportWidth,
    y: baseSpec.photo.y * viewportHeight,
    w: baseSpec.photo.w * viewportWidth,
    h: baseSpec.photo.h * viewportHeight,
  };

  const resolvedTitle = {
    x: baseSpec.title.x * viewportWidth,
    centerY: baseSpec.title.y * viewportHeight,
    w: baseSpec.title.w * viewportWidth,
  };

  if (process.env.NODE_ENV !== 'production') {
    // Validação da invariante: o texto deve sobrepor a foto para o efeito editorial funcionar.
    const titleRight = resolvedTitle.x + resolvedTitle.w;
    const photoLeft = resolvedPhoto.x;
    if (titleRight <= photoLeft) {
      console.warn(
        `[EditorialCover] Invariante de sobreposição violada no breakpoint ${breakpoint}. ` +
        `O título (termina em ${titleRight}px) não sobrepõe a foto (começa em ${photoLeft}px).`
      );
    }
  }

  return {
    photo: resolvedPhoto,
    title: resolvedTitle,
    breakpoint,
  };
}
