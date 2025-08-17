import { useCallback, useRef } from 'react';

interface UseSwipeNavigationProps {
  enabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  thresholdPx?: number;
  maxVerticalRatio?: number;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isValid: boolean;
  scrollEl?: HTMLElement | null;
}

export function useSwipeNavigation({
  enabled,
  onPrev,
  onNext,
  thresholdPx = 45,
  maxVerticalRatio = 0.5
}: UseSwipeNavigationProps) {
  const touchState = useRef<TouchState | null>(null);

  const isScrollableParent = useCallback((element: Element): boolean => {
    let current = element;
    while (current && current !== document.body) {
      const styles = window.getComputedStyle(current);
      const overflowX = styles.overflowX;
      
      // Check if element has horizontal scrolling capability and content
      if ((overflowX === 'auto' || overflowX === 'scroll') && 
          current.scrollWidth > current.clientWidth) {
        return true;
      }
      
      // Removed class-based scroll detection to avoid blocking swipes on containers with decorative scroll classes
      
      current = current.parentElement as Element;
    }
    return false;
  }, []);

  const isInteractiveElement = useCallback((element: Element): boolean => {
    const tagName = element.tagName.toLowerCase();
    
    // Only prevent swipe for actual input elements
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }
    
    // Check for contenteditable
    if (element.hasAttribute('contenteditable')) {
      return true;
    }
    
    return false;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const target = e.target as Element;
    const touch = e.touches[0];

    // Only block swipe for actual input elements
    if (isInteractiveElement(target)) {
      touchState.current = null;
      return;
    }

    // Edge swipes are always allowed
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const edgeSwipe = touch.clientX < 24 || touch.clientX > vw - 24;

    // Find nearest horizontally scrollable parent (if any)
    let scrollEl: HTMLElement | null = null;
    if (!edgeSwipe) {
      let current: Element | null = target;
      while (current && current !== document.body) {
        const styles = window.getComputedStyle(current);
        const overflowX = styles.overflowX;
        if ((overflowX === 'auto' || overflowX === 'scroll') && (current as HTMLElement).scrollWidth > (current as HTMLElement).clientWidth) {
          scrollEl = current as HTMLElement;
          break;
        }
        current = current.parentElement;
      }
    }

    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isValid: true,
      scrollEl
    };
  }, [enabled, isInteractiveElement, isScrollableParent]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchState.current?.isValid) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;
    
    // Check if this is a horizontal swipe
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // If inside a horizontally scrollable container, only allow swipe when at boundaries
    const el = touchState.current.scrollEl;
    if (el) {
      const movingLeft = deltaX < 0;
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      const atLeft = el.scrollLeft <= 0;
      const atRight = el.scrollLeft >= maxScrollLeft - 1;

      // If the container can scroll further in the gesture direction, cancel swipe handling
      if ((movingLeft && !atRight) || (!movingLeft && !atLeft)) {
        touchState.current.isValid = false;
        return;
      }
    }
    
    // More sensitive horizontal detection for swipes  
    if (absX > thresholdPx * 0.2 && absY / absX < maxVerticalRatio) {
      // This is a valid horizontal swipe, prevent default scrolling
      e.preventDefault();
    } else if (absY > absX * 1.5) {
      // This is more of a vertical gesture, invalidate
      touchState.current.isValid = false;
    }
  }, [enabled, thresholdPx, maxVerticalRatio]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchState.current?.isValid) {
      touchState.current = null;
      return;
    }
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;
    const deltaTime = Date.now() - touchState.current.startTime;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Validate the swipe with optimized parameters
    if (absX > thresholdPx && 
        absY / absX < maxVerticalRatio && 
        deltaTime < 600) {
      
      if (deltaX < 0) {
        onNext(); // Swipe left = next
      } else {
        onPrev(); // Swipe right = previous
      }
    }
    
    touchState.current = null;
  }, [enabled, thresholdPx, maxVerticalRatio, onNext, onPrev]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
}