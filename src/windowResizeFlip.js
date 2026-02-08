const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getBoundsRect = (boundsSelector) => {
  const boundsEl = boundsSelector ? document.querySelector(boundsSelector) : null;
  if (boundsEl) {
    const rect = boundsEl.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }
  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const fitRectToBounds = (rect, bounds, pad) => {
  const maxW = Math.max(0, bounds.width - pad * 2);
  const maxH = Math.max(0, bounds.height - pad * 2);

  const width = Math.min(rect.width, maxW);
  const height = Math.min(rect.height, maxH);

  const left = clamp(rect.left, bounds.left + pad, bounds.right - pad - width);
  const top = clamp(rect.top, bounds.top + pad, bounds.bottom - pad - height);

  return { left, top, width, height };
};

const keepInBounds = (win, bounds, pad) => {
  const rect = win.getBoundingClientRect();
  let dx = 0;
  let dy = 0;

  if (rect.left < bounds.left + pad) {
    dx += bounds.left + pad - rect.left;
  }
  if (rect.right > bounds.right - pad) {
    dx += bounds.right - pad - rect.right;
  }
  if (rect.top < bounds.top + pad) {
    dy += bounds.top + pad - rect.top;
  }
  if (rect.bottom > bounds.bottom - pad) {
    dy += bounds.bottom - pad - rect.bottom;
  }

  if (dx || dy) {
    window.gsap?.to(win, {
      x: `+=${dx}`,
      y: `+=${dy}`,
      duration: 0.22,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }
};

const applyRect = (win, rect) => {
  win.style.left = `${rect.left}px`;
  win.style.top = `${rect.top}px`;
  win.style.width = `${rect.width}px`;
  win.style.height = `${rect.height}px`;
};

const getMaximizedRect = (bounds) => {
  const insetTop = 45;
  const insetX = 15;
  const insetBottom = 90;
  return {
    left: bounds.left + insetX,
    top: bounds.top + insetTop,
    width: Math.max(0, bounds.width - insetX * 2),
    height: Math.max(0, bounds.height - insetTop - insetBottom),
  };
};

const createResizeHandler = ({
  boundsSelector,
  getFlip,
  setNormalRect,
  setMaxState,
}) => (win, state) => {
  if (!state?.isOpen) return;

  const bounds = getBoundsRect(boundsSelector);
  const pad = 15;

  if (!state.isMaximized) {
    const rect = fitRectToBounds(win.getBoundingClientRect(), bounds, pad);
    setNormalRect(win, rect);

    const maximizedRect = getMaximizedRect(bounds);
    const Flip = getFlip();
    if (Flip) {
      const flipState = Flip.getState(win);
      window.gsap?.set(win, { x: 0, y: 0 });
      applyRect(win, maximizedRect);
      Flip.from(flipState, { duration: 0.5, ease: 'power1.inOut', absolute: true, fade: true });
    } else {
      window.gsap?.set(win, { x: 0, y: 0 });
      window.gsap?.to(win, {
        left: maximizedRect.left,
        top: maximizedRect.top,
        width: maximizedRect.width,
        height: maximizedRect.height,
        duration: 0.25,
        ease: 'power2.out',
      });
    }

    state.drag?.disable();
    state.drag?.update();
    setMaxState(win, true);
  } else {
    if (!state.normalRect) return;
    const rect = fitRectToBounds(state.normalRect, bounds, pad);
    const Flip = getFlip();
    if (Flip) {
      const flipState = Flip.getState(win);
      window.gsap?.set(win, { x: 0, y: 0 });
      applyRect(win, rect);
      Flip.from(flipState, { duration: 0.5, ease: 'power1.inOut', absolute: true, fade: true });
    } else {
      window.gsap?.set(win, { x: 0, y: 0 });
      window.gsap?.to(win, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        duration: 0.25,
        ease: 'power2.out',
      });
    }

    state.drag?.enable();
    state.drag?.update();
    setMaxState(win, false);
    keepInBounds(win, bounds, pad);
  }
};

export {
  getBoundsRect,
  fitRectToBounds,
  keepInBounds,
  applyRect,
  getMaximizedRect,
  createResizeHandler,
};
