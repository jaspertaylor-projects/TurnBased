import { useEffect } from 'react';
import type { CSSProperties } from 'react';

const ENGINE_UI_MOTION_STYLE_ID = 'turnbased-engine-ui-motion';

const ENGINE_UI_MOTION_CSS = `
@keyframes turnbased-soft-pulse-entity {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 0 rgba(255, 255, 255, 0));
  }
  50% {
    transform: scale(1.08);
    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.36)) drop-shadow(0 0 18px rgba(255, 255, 255, 0.18));
  }
}

@keyframes turnbased-soft-pulse-zone {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 0 rgba(255, 255, 255, 0));
  }
  50% {
    transform: scale(1.01);
    filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.18)) drop-shadow(0 0 30px rgba(255, 255, 255, 0.12));
  }
}
`;

export function useEngineUiMotionStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (document.getElementById(ENGINE_UI_MOTION_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = ENGINE_UI_MOTION_STYLE_ID;
    style.textContent = ENGINE_UI_MOTION_CSS;
    document.head.appendChild(style);

    return () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);
}

export function getAffordancePulseStyle(
  active: boolean,
  surface: 'entity' | 'zone' = 'entity',
): CSSProperties {
  if (!active) {
    return {};
  }

  return {
    animation: surface === 'entity'
      ? 'turnbased-soft-pulse-entity 1.9s ease-in-out infinite'
      : 'turnbased-soft-pulse-zone 1.9s ease-in-out infinite',
    willChange: 'transform, filter',
  };
}
