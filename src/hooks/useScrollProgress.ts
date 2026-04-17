import { useEffect, useState } from 'react';

export function useScrollProgress(containerRef: React.RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    // Debug — confirm the ref is attached to a real scrollable element
    console.log('[ScrollProgress]', {
      el,
      scrollHeight: el?.scrollHeight,
      clientHeight: el?.clientHeight,
      overflowY: el ? window.getComputedStyle(el).overflowY : null,
    });

    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const total = scrollHeight - clientHeight;
      setProgress(total > 0 ? Math.round((scrollTop / total) * 100) : 0);
    };

    // Seed on mount — catches short passages that never need scrolling
    handleScroll();

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }); // No dep array — re-attaches after every render so late-mounted elements are caught

  return progress;
}
