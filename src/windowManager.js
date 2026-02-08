import {
  getBoundsRect,
  keepInBounds,
  getMaximizedRect,
  applyRect,
  createResizeHandler,
} from './windowResizeFlip.js';

const DEBUG = () => Boolean(window.DOCK_UI_DEBUG);

const log = (...args) => {
  if (DEBUG()) {
    console.log('[DockUI][window]', ...args);
  }
};

const createOverlay = () => {
  let overlay = document.querySelector('.dock-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'dock-overlay';
    document.body.appendChild(overlay);
  }
  return overlay;
};

const createWindowManager = ({
  windows,
  boundsSelector,
  onToggleOverlay,
  onToggleWindow,
  getOpenWindows,
  getFlip,
}) => {
  const state = new WeakMap();

  windows.forEach((win) => {
    state.set(win, {
      isOpen: false,
      isMaximized: false,
      normalRect: null,
      drag: null,
    });
  });

  const setOpenState = (win, isOpen) => {
    const st = state.get(win);
    if (!st) return;
    st.isOpen = isOpen;
    state.set(win, st);
  };

  const setMaxState = (win, isMaximized) => {
    const st = state.get(win);
    if (!st) return;
    st.isMaximized = isMaximized;
    state.set(win, st);
  };

  const setNormalRect = (win, rect) => {
    const st = state.get(win);
    if (!st) return;
    st.normalRect = rect;
    state.set(win, st);
  };

  const getState = (win) => state.get(win);

  const toggleResize = createResizeHandler({
    boundsSelector,
    getFlip,
    setNormalRect,
    setMaxState,
  });

  const openWindow = (win) => {
    const st = state.get(win);
    if (!st || st.isOpen) return;

    onToggleOverlay(true);

    win.classList.add('is-open');
    window.gsap?.set(win, { autoAlpha: 1 });

    window.gsap?.fromTo(
      win,
      { scale: 0.96, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out', overwrite: 'auto' }
    );

    setOpenState(win, true);
    onToggleWindow(win, true);

    const bounds = getBoundsRect(boundsSelector);
    if (st.isMaximized) {
      log('Re-applying maximized state on open', win);
      const rect = getMaximizedRect(bounds);
      window.gsap?.set(win, { x: 0, y: 0 });
      applyRect(win, rect);
    }

    keepInBounds(win, bounds, 15);
    st.drag?.update();
  };

  const closeWindow = (win) => {
    const st = state.get(win);
    if (!st || !st.isOpen) return;

    window.gsap?.to(win, {
      scale: 0.98,
      opacity: 0,
      duration: 0.18,
      ease: 'power2.in',
      overwrite: 'auto',
      onComplete: () => {
        window.gsap?.set(win, { autoAlpha: 0, scale: 1 });
        win.classList.remove('is-open');
      },
    });

    setOpenState(win, false);
    onToggleWindow(win, false);

    if (!getOpenWindows().some((other) => state.get(other)?.isOpen)) {
      onToggleOverlay(false);
    }
  };

  const toggleResizeWithState = (win) => {
    const st = state.get(win);
    if (!st) return;
    toggleResize(win, st);
  };

  return {
    state,
    openWindow,
    closeWindow,
    toggleResize: toggleResizeWithState,
    getState,
  };
};

export { createOverlay, createWindowManager };
