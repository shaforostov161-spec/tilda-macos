(function (global) {
  const DEBUG = () => Boolean(global.DOCK_UI_DEBUG);

  const logMapping = (...args) => {
    if (DEBUG()) {
      console.log('[DockUI][mapping]', ...args);
    }
  };

  const logWindow = (...args) => {
    if (DEBUG()) {
      console.log('[DockUI][window]', ...args);
    }
  };

  const ready = (fn) => {
    if (global.t_onReady) {
      global.t_onReady(fn);
    } else if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const cssNum = (root, name, fallback) => {
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeKey = (value) => {
    if (!value) return '';
    return String(value).trim().toLowerCase();
  };

  const getAttrFromElemOrAtom = (el, attr) => {
    if (!el) return { value: '', location: 'missing' };

    const direct = el.getAttribute?.(attr);
    if (direct) {
      return { value: direct, location: 'element' };
    }

    const atom = el.classList?.contains('tn-atom') ? el : el.querySelector?.('.tn-atom');
    const atomValue = atom?.getAttribute?.(attr);
    if (atomValue) {
      return { value: atomValue, location: 'atom' };
    }

    const parent = el.closest?.('.t396__elem');
    if (parent && parent !== el) {
      const parentValue = parent.getAttribute?.(attr);
      if (parentValue) {
        return { value: parentValue, location: 'parent' };
      }
    }

    return { value: '', location: 'missing' };
  };

  const getItemKey = (item) => {
    const result = getAttrFromElemOrAtom(item, 'data-item');
    return {
      key: normalizeKey(result.value),
      location: result.location,
      raw: result.value,
    };
  };

  const getWindowKey = (win) => {
    const result = getAttrFromElemOrAtom(win, 'data-window');
    return {
      key: normalizeKey(result.value),
      location: result.location,
      raw: result.value,
    };
  };

  const buildWindowIndex = (windows) => {
    const index = new Map();
    windows.forEach((win) => {
      const info = getWindowKey(win);
      if (!info.key) {
        logMapping('Window missing data-window', win, info);
        return;
      }
      index.set(info.key, { win, info });
    });
    return index;
  };

  const mapItemToWindow = (item, windowIndex) => {
    const itemInfo = getItemKey(item);
    if (!itemInfo.key) {
      logMapping('Dock item missing data-item', item, itemInfo);
      return { window: null, reason: 'missing-data-item', info: itemInfo };
    }

    const entry = windowIndex.get(itemInfo.key);
    if (!entry) {
      logMapping('No window matched for item', itemInfo, Array.from(windowIndex.keys()));
      return { window: null, reason: 'no-window-match', info: itemInfo };
    }

    logMapping('Mapped item to window', itemInfo, entry.info);
    return { window: entry.win, reason: 'matched', info: itemInfo };
  };

  const debugMappingSummary = (items, windows) => {
    if (!DEBUG()) return;

    logMapping('Dock items found', items.length);
    items.forEach((item) => {
      const info = getItemKey(item);
      logMapping('Item', info.key || '(empty)', 'raw:', info.raw || '(none)', 'location:', info.location);
    });

    logMapping('Windows found', windows.length);
    windows.forEach((win) => {
      const info = getWindowKey(win);
      logMapping('Window', info.key || '(empty)', 'raw:', info.raw || '(none)', 'location:', info.location);
    });
  };

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
      right: global.innerWidth,
      bottom: global.innerHeight,
      width: global.innerWidth,
      height: global.innerHeight,
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
      global.gsap?.to(win, {
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

  const createResizeHandler = ({ boundsSelector, getFlip, setNormalRect, setMaxState }) => (win, state) => {
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
        global.gsap?.set(win, { x: 0, y: 0 });
        applyRect(win, maximizedRect);
        Flip.from(flipState, { duration: 0.5, ease: 'power1.inOut', absolute: true, fade: true });
      } else {
        global.gsap?.set(win, { x: 0, y: 0 });
        global.gsap?.to(win, {
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
        global.gsap?.set(win, { x: 0, y: 0 });
        applyRect(win, rect);
        Flip.from(flipState, { duration: 0.5, ease: 'power1.inOut', absolute: true, fade: true });
      } else {
        global.gsap?.set(win, { x: 0, y: 0 });
        global.gsap?.to(win, {
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

  const createOverlay = () => {
    let overlay = document.querySelector('.dock-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'dock-overlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  };

  const createWindowManager = ({ windows, boundsSelector, onToggleOverlay, onToggleWindow, getOpenWindows, getFlip }) => {
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

    const toggleResize = createResizeHandler({ boundsSelector, getFlip, setNormalRect, setMaxState });

    const openWindow = (win) => {
      const st = state.get(win);
      if (!st || st.isOpen) return;

      getOpenWindows()
        .filter((other) => other !== win)
        .forEach((other) => closeWindow(other));

      onToggleOverlay(true);

      win.classList.add('is-open');
      global.gsap?.set(win, { autoAlpha: 1 });

      global.gsap?.fromTo(
        win,
        { scale: 0.96, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out', overwrite: 'auto' }
      );

      setOpenState(win, true);
      onToggleWindow(win, true);

      const bounds = getBoundsRect(boundsSelector);
      if (st.isMaximized) {
        logWindow('Re-applying maximized state on open', win);
        const rect = getMaximizedRect(bounds);
        global.gsap?.set(win, { x: 0, y: 0 });
        applyRect(win, rect);
      }

      keepInBounds(win, bounds, 15);
      st.drag?.update();
    };

    const closeWindow = (win) => {
      const st = state.get(win);
      if (!st || !st.isOpen) return;

      global.gsap?.to(win, {
        scale: 0.98,
        opacity: 0,
        duration: 0.18,
        ease: 'power2.in',
        overwrite: 'auto',
        onComplete: () => {
          global.gsap?.set(win, { autoAlpha: 0, scale: 1 });
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

  const initWindowDrag = ({ win, state, boundsSelector }) => {
    if (!global.Draggable || state.drag) return;

    const handle = win.querySelector('.dock-window-handle') || win;

    state.drag = global.Draggable.create(win, {
      type: 'x,y',
      trigger: handle,
      inertia: false,
      onDragEnd() {
        const bounds = getBoundsRect(boundsSelector);
        keepInBounds(win, bounds, 15);
        this.update();
      },
    })[0];
  };

  const setupDockHover = ({ dock, items }) => {
    if (!global.gsap) return;

    const root = document.documentElement;
    const rec = dock.closest('.r.t-rec') || document;
    const art = rec.querySelector('.t396__artboard') || rec;

    if (items.length < 2) {
      console.warn('[DockUI][dock] Need at least 2 .dock-item elements for hover.');
      return;
    }

    const zbArt = rec.querySelector('.t396__artboard');
    if (zbArt) {
      zbArt.style.overflow = 'visible';
    }

    let order = [];
    let centersAbs = [];
    let widths = [];
    let min = 48;
    let bound = min * Math.PI;

    const dur = cssNum(root, '--dockDur', 0.2);
    const ease = getComputedStyle(root).getPropertyValue('--dockEase').trim() || 'power2.out';

    const padDock = () => cssNum(root, '--dockPad', 10);
    const maxExtra = () => cssNum(root, '--dockMaxExtra', 900);

    const xToMap = new Map(items.map((el) => [el, global.gsap.quickTo(el, 'x', { duration: dur, ease, overwrite: 'auto' })]));
    const sToMap = new Map(
      items.map((el) => {
        const atom = el.querySelector('.tn-atom') || el;
        return [atom, global.gsap.quickTo(atom, '--dockS', { duration: dur, ease, overwrite: 'auto' })];
      })
    );

    const dockWTo = global.gsap.quickTo(dock, 'width', { duration: dur, ease, overwrite: 'auto' });
    const dockLTo = global.gsap.quickTo(dock, 'left', { duration: dur, ease, overwrite: 'auto' });

    const baseX = new Map(items.map((el) => [el, global.gsap.getProperty(el, 'x') || 0]));
    const baseS = new Map(
      items.map((el) => {
        const atom = el.querySelector('.tn-atom') || el;
        const v = getComputedStyle(atom).getPropertyValue('--dockS').trim();
        const n = parseFloat(v);
        const s = Number.isFinite(n) ? n : 1;
        atom.style.setProperty('--dockS', String(s));
        return [atom, s];
      })
    );

    let baseDockW = 0;
    let baseDockL = 0;
    let baseDockC = 0;

    const measure = () => {
      const cs = getComputedStyle(dock);
      baseDockW = parseFloat(cs.width) || dock.getBoundingClientRect().width;

      const leftNum = parseFloat(cs.left);
      baseDockL = Number.isFinite(leftNum) ? leftNum : dock.getBoundingClientRect().left;

      baseDockC = baseDockL + baseDockW / 2;

      order = items
        .map((item) => {
          const r = item.getBoundingClientRect();
          return { item, atom: item.querySelector('.tn-atom') || item, cxAbs: r.left + r.width / 2, w: r.width };
        })
        .sort((a, b) => a.cxAbs - b.cxAbs);

      centersAbs = order.map((o) => o.cxAbs);
      widths = order.map((o) => o.w);

      const minCss = cssNum(root, '--dockMin', 0);
      if (minCss > 0) {
        min = minCss;
      } else {
        let sum = 0;
        let cnt = 0;
        for (let i = 1; i < centersAbs.length; i += 1) {
          const d = centersAbs[i] - centersAbs[i - 1];
          if (d > 0) {
            sum += d;
            cnt += 1;
          }
        }
        min = cnt ? sum / cnt : 48;
      }
      bound = min * Math.PI;

      dockWTo(baseDockW);
      dockLTo(baseDockL);
    };

    measure();
    requestAnimationFrame(measure);
    setTimeout(measure, 250);
    global.addEventListener(
      'resize',
      () => {
        measure();
        requestAnimationFrame(measure);
      },
      { passive: true }
    );

    const resetDock = () => {
      order.forEach((o) => {
        xToMap.get(o.item)(baseX.get(o.item) || 0);
        sToMap.get(o.atom)(baseS.get(o.atom) || 1);
        o.item.style.zIndex = '1';
      });
      dockWTo(baseDockW);
      dockLTo(baseDockL);
    };

    const updateDock = (pointer) => {
      const maxScale = cssNum(root, '--dockMaxScale', 2.0);
      const maxPx = min * maxScale;
      const amp = maxPx - min;

      let minAbs = Infinity;
      let maxAbs = -Infinity;

      for (let i = 0; i < order.length; i += 1) {
        const o = order[i];
        const distance = i * min + min / 2 - pointer;

        let x = 0;
        let s = 1;
        if (-bound < distance && distance < bound) {
          const rad = (distance / min) * 0.5;
          s = 1 + (maxScale - 1) * Math.cos(rad);
          x = 2 * amp * Math.sin(rad);
        } else {
          x = (-bound < distance ? 2 : -2) * amp;
          s = 1;
        }

        const bx = baseX.get(o.item) || 0;
        const bs = baseS.get(o.atom) || 1;

        xToMap.get(o.item)(bx + x);
        sToMap.get(o.atom)(bs * s);

        o.item.style.zIndex = String(Math.round(s * 1000));

        const cx = centersAbs[i] + x;
        const half = (widths[i] * (bs * s)) / 2;
        minAbs = Math.min(minAbs, cx - half);
        maxAbs = Math.max(maxAbs, cx + half);
      }

      let desiredL = minAbs - padDock();
      let desiredW = maxAbs - minAbs + padDock() * 2;

      if (desiredW < baseDockW) {
        desiredW = baseDockW;
        desiredL = baseDockL;
      }

      const maxW = baseDockW + maxExtra();
      if (desiredW > maxW) {
        desiredW = maxW;
        desiredL = baseDockC - desiredW / 2;
      }

      dockWTo(desiredW);
      dockLTo(desiredL);
    };

    let active = false;

    const onMove = (event) => {
      const rect = dock.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;
      const hitPad = cssNum(root, '--dockHitPad', -10);

      const isActive = x >= rect.left && x <= rect.right && y >= rect.top - hitPad && y <= rect.bottom + hitPad;

      if (!isActive) {
        if (active) resetDock();
        active = false;
        return;
      }
      active = true;

      const leftRefAbs = centersAbs[0] - min / 2;
      let pointer = x - leftRefAbs;

      const minP = min / 2;
      const maxP = (order.length - 0.5) * min;
      pointer = clamp(pointer, minP, maxP);

      updateDock(pointer);
    };

    art.addEventListener('mousemove', onMove, { passive: true });
    art.addEventListener(
      'mouseleave',
      () => {
        if (active) resetDock();
        active = false;
      },
      { passive: true }
    );
  };

  const init = ({
    dockSelector = '.dock',
    itemSelector = '.dock-item',
    windowSelector = '.dock-window',
    boundsSelector = '.uc-dockbounds',
  } = {}) => {
    if (global.DOCK_UI_DEBUG === undefined) {
      global.DOCK_UI_DEBUG = false;
    }

    ready(() => {
      if (!global.gsap) {
        console.warn('[DockUI] GSAP is required but not loaded.');
        return;
      }

      if (global.Flip) {
        global.gsap.registerPlugin(global.Flip);
      }

      if (global.Draggable) {
        global.gsap.registerPlugin(global.Draggable);
      }

      const docks = Array.from(document.querySelectorAll(dockSelector));
      const windows = Array.from(document.querySelectorAll(windowSelector));

      const overlay = createOverlay();
      const manager = createWindowManager({
        windows,
        boundsSelector,
        getFlip: () => global.Flip || null,
        getOpenWindows: () => windows.filter((win) => manager.getState(win)?.isOpen),
        onToggleOverlay: (isOpen) => {
          global.gsap.to(overlay, {
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

        global.gsap.set(win, { autoAlpha: 0 });
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
      debugMappingSummary(Array.from(document.querySelectorAll(itemSelector)), windows);

      docks.forEach((dock) => {
        if (dock.dataset.dockInited) return;
        dock.dataset.dockInited = '1';

        const rec = dock.closest('.r.t-rec') || document;
        const dockItems = Array.from(rec.querySelectorAll(itemSelector));

        setupDockHover({ dock, items: dockItems });

        dockItems.forEach((item) => {
          item.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

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

  global.DockUI = { init };
})(window);
