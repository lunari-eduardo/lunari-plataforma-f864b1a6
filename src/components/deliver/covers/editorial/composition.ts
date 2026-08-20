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
  // Foto imponente no quadrante direito
  photo: { x: 0.47, y: 0.08, w: 0.48, h: 0.76 },
  // Título monumental partindo da esquerda e cruzando a foto
  title: { x: 0.06, y: 0.50, w: 0.65 },
};

export const COMPACT_SPEC: EditorialSpec = {
  photo: { x: 0.38, y: 0.10, w: 0.57, h: 0.65 },
  title: { x: 0.06, y: 0.52, w: 0.72 },
};

export const MOBILE_SPEC: EditorialSpec = {
  // Mobile: Foto deslocada para o canto superior direito
  photo: { x: 0.22, y: 0.08, w: 0.73, h: 0.54 },
  // Título nasce abaixo/à esquerda e cruza a base da foto
  title: { x: 0.06, y: 0.58, w: 0.88 },
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

  return {
    photo: resolvedPhoto,
    title: resolvedTitle,
    breakpoint,
  };
}
