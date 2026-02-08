const DEBUG = () => Boolean(window.DOCK_UI_DEBUG);

const log = (...args) => {
  if (DEBUG()) {
    console.log('[DockUI][mapping]', ...args);
  }
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

  const atom = el.classList?.contains('tn-atom')
    ? el
    : el.querySelector?.('.tn-atom');
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
      log('Window missing data-window', win, info);
      return;
    }
    index.set(info.key, { win, info });
  });
  return index;
};

const mapItemToWindow = (item, windowIndex) => {
  const itemInfo = getItemKey(item);
  if (!itemInfo.key) {
    log('Dock item missing data-item', item, itemInfo);
    return { window: null, reason: 'missing-data-item', info: itemInfo };
  }

  const entry = windowIndex.get(itemInfo.key);
  if (!entry) {
    log('No window matched for item', itemInfo, Array.from(windowIndex.keys()));
    return { window: null, reason: 'no-window-match', info: itemInfo };
  }

  log('Mapped item to window', itemInfo, entry.info);
  return { window: entry.win, reason: 'matched', info: itemInfo };
};

const debugMappingSummary = (items, windows) => {
  if (!DEBUG()) return;

  log('Dock items found', items.length);
  items.forEach((item) => {
    const info = getItemKey(item);
    log('Item', info.key || '(empty)', 'raw:', info.raw || '(none)', 'location:', info.location);
  });

  log('Windows found', windows.length);
  windows.forEach((win) => {
    const info = getWindowKey(win);
    log('Window', info.key || '(empty)', 'raw:', info.raw || '(none)', 'location:', info.location);
  });
};

export {
  normalizeKey,
  getAttrFromElemOrAtom,
  getItemKey,
  getWindowKey,
  buildWindowIndex,
  mapItemToWindow,
  debugMappingSummary,
};
