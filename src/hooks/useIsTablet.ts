import { useState, useEffect } from 'react';

const TABLET_MIN_WIDTH = 768;
const TABLET_MAX_WIDTH = 1023;

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const width = window.innerWidth;
    return width >= TABLET_MIN_WIDTH && width <= TABLET_MAX_WIDTH;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH}px) and (max-width: ${TABLET_MAX_WIDTH}px)`);
    const sync = () => setIsTablet(mql.matches);
    
    sync();
    const onChange = () => sync();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isTablet;
}