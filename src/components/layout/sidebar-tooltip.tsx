import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FocusEvent, ReactNode } from 'react';

interface SidebarTooltipProps {
  label: string;
  children: ReactNode;
}

interface TooltipPosition {
  left: number;
  top: number;
}

export function SidebarTooltip({ label, children }: SidebarTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useCallback(() => {
    const target = anchorRef.current?.firstElementChild;
    if (!(target instanceof HTMLElement)) return;

    const rect = target.getBoundingClientRect();
    const top = Math.min(
      Math.max(rect.top + rect.height / 2, 20),
      window.innerHeight - 20,
    );
    setPosition({ left: rect.right + 14, top });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  function showTooltip() {
    updatePosition();
    setIsOpen(true);
  }

  function hideTooltip(event?: FocusEvent<HTMLSpanElement>) {
    if (
      event?.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsOpen(false);
  }

  return (
    <span
      ref={anchorRef}
      className="app-sidebar__tooltip-anchor"
      onMouseEnter={showTooltip}
      onMouseLeave={() => hideTooltip()}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isOpen &&
        position &&
        createPortal(
          <span
            aria-hidden="true"
            className="app-sidebar-tooltip"
            style={{ left: position.left, top: position.top }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
