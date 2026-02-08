const cssNum = (root, name, fallback) => {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const setupDockHover = ({ dock, items }) => {
  if (!window.gsap) return;

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

  const xToMap = new Map(items.map((el) => [el, window.gsap.quickTo(el, 'x', { duration: dur, ease, overwrite: 'auto' })]));
  const sToMap = new Map(
    items.map((el) => {
      const atom = el.querySelector('.tn-atom') || el;
      return [atom, window.gsap.quickTo(atom, '--dockS', { duration: dur, ease, overwrite: 'auto' })];
    })
  );

  const dockWTo = window.gsap.quickTo(dock, 'width', { duration: dur, ease, overwrite: 'auto' });
  const dockLTo = window.gsap.quickTo(dock, 'left', { duration: dur, ease, overwrite: 'auto' });

  const baseX = new Map(items.map((el) => [el, window.gsap.getProperty(el, 'x') || 0]));
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
  window.addEventListener(
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

export { setupDockHover };
