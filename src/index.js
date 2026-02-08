import { setupDockHover } from './dockHover.js';
import {
  buildWindowIndex,
  mapItemToWindow,
  debugMappingSummary,
} from './windowMapping.js';
import { createOverlay, createWindowManager } from './windowManager.js';
import { initWindowDrag } from './windowDrag.js';

const ready = (fn) => {
  if (window.t_onReady) {
    window.t_onReady(fn);
  } else if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
};

const init = ({
  dockSelector = '.dock',
  itemSelector = '.dock-item',
  windowSelector = '.dock-window',
  boundsSelector = '.uc-dockbounds',
} = {}) => {
  if (window.DOCK_UI_DEBUG === undefined) {
    window.DOCK_UI_DEBUG = false;
  }

  ready(() => {
    if (!window.gsap) {
      console.warn('[DockUI] GSAP is required but not loaded.');
      return;
    }

    if (window.Flip) {
      window.gsap.registerPlugin(window.Flip);
    }

    if (window.Draggable) {
      window.gsap.registerPlugin(window.Draggable);
    }

    const docks = Array.from(document.querySelectorAll(dockSelector));
    const windows = Array.from(document.querySelectorAll(windowSelector));

    const overlay = createOverlay();
    const manager = createWindowManager({
      windows,
      boundsSelector,
      getFlip: () => window.Flip || null,
      getOpenWindows: () => windows.filter((win) => manager.getState(win)?.isOpen),
      onToggleOverlay: (isOpen) => {
        window.gsap.to(overlay, {
          autoAlpha: isOpen ? 1 : 0,
          duration: 0.18,
          ease: isOpen ? 'power2.out' : 'power2.in',
          overwrite: 'auto',
        });
        overlay.style.pointerEvents = isOpen ? 'auto' : 'none';
      },
      onToggleWindow: (win, isOpen) => {
        if (manager.getState(win)?.drag) {
          if (isOpen) {
            manager.getState(win).drag.enable();
          } else {
            manager.getState(win).drag.disable();
          }
        }
      },
    });

    windows.forEach((win) => {
      if (win.dataset.winInited) return;
      win.dataset.winInited = '1';

      window.gsap.set(win, { autoAlpha: 0 });
      win.classList.remove('is-open');

      win.querySelectorAll('.dock-window-close').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          manager.closeWindow(win);
        });
      });

      win.querySelectorAll('.dock-resize').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          manager.toggleResize(win);
        });
      });

      initWindowDrag({ win, state: manager.getState(win), boundsSelector });
    });

    if (!overlay.dataset.bound) {
      overlay.dataset.bound = '1';
      overlay.addEventListener('click', () => {
        const opened = windows.slice().reverse().find((win) => manager.getState(win)?.isOpen);
        if (opened) manager.closeWindow(opened);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          const opened = windows.slice().reverse().find((win) => manager.getState(win)?.isOpen);
          if (opened) manager.closeWindow(opened);
        }
      });
    }

    const windowIndex = buildWindowIndex(windows);
    debugMappingSummary(
      Array.from(document.querySelectorAll(itemSelector)),
      windows
    );

    docks.forEach((dock) => {
      if (dock.dataset.dockInited) return;
      dock.dataset.dockInited = '1';

      const rec = dock.closest('.r.t-rec') || document;
      const dockItems = Array.from(rec.querySelectorAll(itemSelector));

      setupDockHover({ dock, items: dockItems });

      dockItems.forEach((item) => {
        const atom = item.classList.contains('tn-atom')
          ? item
          : item.querySelector('.tn-atom') || item;

        atom.style.setProperty('--dockPress', '1');

        const pressDown = () => {
          window.gsap?.to(atom, {
            '--dockPress': 0.94,
            duration: 0.1,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        };

        const pressUp = () => {
          window.gsap?.to(atom, {
            '--dockPress': 1,
            duration: 0.18,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        };

        item.addEventListener('pointerdown', pressDown);
        item.addEventListener('pointerup', pressUp);
        item.addEventListener('pointerleave', pressUp);
        item.addEventListener('pointercancel', pressUp);

        item.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          window.gsap?.fromTo(
            atom,
            { '--dockPress': 0.92 },
            {
              '--dockPress': 1,
              duration: 0.35,
              ease: 'back.out(2)',
              overwrite: 'auto',
            }
          );

          const result = mapItemToWindow(item, windowIndex);
          if (!result.window) {
            return;
          }

          const state = manager.getState(result.window);
          if (state?.isOpen) {
            manager.closeWindow(result.window);
          } else {
            manager.openWindow(result.window);
          }
        });
      });
    });
  });
};

export { init };
