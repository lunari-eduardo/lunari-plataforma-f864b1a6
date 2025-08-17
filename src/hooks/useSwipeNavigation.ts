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
      
      // Check for specific classes that indicate scrollable content
      if (current.classList.contains('overflow-x-auto') || 
          current.classList.contains('scrollbar-elegant')) {
        return true;
      }
      
      current = current.parentElement as Element;
    }
    return false;
  }, []);

  const isInteractiveElement = useCallback((element: Element): boolean => {
    const tagName = element.tagName.toLowerCase();
    const interactiveTags = ['input', 'textarea', 'select', 'button'];
    
    if (interactiveTags.includes(tagName)) {
      return true;
    }
    
    if (element.hasAttribute('contenteditable')) {
      return true;
    }
    
    return false;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    
    const target = e.target as Element;
    
    // Check if target is interactive or has scrollable parent
    if (isInteractiveElement(target) || isScrollableParent(target)) {
      touchState.current = null;
      return;
    }
    
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isValid: true
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
    
    // More aggressive horizontal detection for swipes
    if (absX > thresholdPx * 0.7 && absY / absX < maxVerticalRatio) {
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
    
    // Validate the swipe
    if (absX > thresholdPx && 
        absY / absX < maxVerticalRatio && 
        deltaTime < 500) {
      
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