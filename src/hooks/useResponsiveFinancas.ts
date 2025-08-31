import { useState, useEffect, useMemo } from 'react';

interface BreakpointsFinancas {
  mobile: boolean;
  tablet: boolean;
  desktop: boolean;
  largeDesktop: boolean;
}

interface LayoutFinancas {
  colunas: number;
  tamanhoCarta: 'sm' | 'md' | 'lg';
  espacamento: string;
  orientacao: 'vertical' | 'horizontal';
}

/**
 * Hook centralizado para responsividade nas páginas financeiras
 * Padroniza breakpoints e comportamentos responsivos
 */
export function useResponsiveFinancas() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const breakpoints: BreakpointsFinancas = useMemo(() => ({
    mobile: windowSize.width < 768,
    tablet: windowSize.width >= 768 && windowSize.width < 1024,
    desktop: windowSize.width >= 1024 && windowSize.width < 1440,
    largeDesktop: windowSize.width >= 1440,
  }), [windowSize.width]);

  const layout: LayoutFinancas = useMemo(() => {
    if (breakpoints.mobile) {
      return {
        colunas: 1,
        tamanhoCarta: 'sm',
        espacamento: 'space-y-3',
        orientacao: 'vertical'
      };
    }
    
    if (breakpoints.tablet) {
      return {
        colunas: 2,
        tamanhoCarta: 'md',
        espacamento: 'gap-4',
        orientacao: 'horizontal'
      };
    }
    
    if (breakpoints.desktop) {
      return {
        colunas: 3,
        tamanhoCarta: 'lg',
        espacamento: 'gap-6',
        orientacao: 'horizontal'
      };
    }
    
    return {
      colunas: 4,
      tamanhoCarta: 'lg',
      espacamento: 'gap-8',
      orientacao: 'horizontal'
    };
  }, [breakpoints]);

  const classesGrid = useMemo(() => {
    const base = 'grid';
    const colunas = `grid-cols-${layout.colunas}`;
    return `${base} ${colunas} ${layout.espacamento}`;
  }, [layout]);

  const classesCarta = useMemo(() => {
    const bases = 'rounded-xl border shadow-sm transition-all duration-200';
    const tamanhos = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6'
    };
    return `${bases} ${tamanhos[layout.tamanhoCarta]}`;
  }, [layout.tamanhoCarta]);

  return {
    breakpoints,
    layout,
    classesGrid,
    classesCarta,
    isMobile: breakpoints.mobile,
    isTablet: breakpoints.tablet,
    isDesktop: breakpoints.desktop || breakpoints.largeDesktop
  };
}