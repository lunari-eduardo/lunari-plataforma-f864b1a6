import { useEffect, useState } from 'react';

/**
 * Returns the current time, refreshed once per minute.
 * Pauses updates while the tab is hidden to avoid waking timers.
 */
export function useCurrentTimeIndicator() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

  return { now, minutesSinceMidnight };
}

/**
 * Given a sorted list of "HH:mm" slot strings, returns the index of the slot
 * containing the current time and the percentage offset (0-1) within it.
 * Returns null when the current time is before the first slot or after the last+1h.
 */
export function getCurrentSlotPosition(
  timeSlots: string[],
  now: Date,
  slotDurationMinutes = 60
): { index: number; offset: number } | null {
  if (!timeSlots.length) return null;
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  for (let i = 0; i < timeSlots.length; i++) {
    const startMins = toMins(timeSlots[i]);
    const nextStart = i + 1 < timeSlots.length ? toMins(timeSlots[i + 1]) : startMins + slotDurationMinutes;
    if (currentMins >= startMins && currentMins < nextStart) {
      const offset = (currentMins - startMins) / (nextStart - startMins);
      return { index: i, offset: Math.min(1, Math.max(0, offset)) };
    }
  }
  return null;
}
