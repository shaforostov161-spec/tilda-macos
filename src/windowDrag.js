import { getBoundsRect, keepInBounds } from './windowResizeFlip.js';

const initWindowDrag = ({ win, state, boundsSelector }) => {
  if (!window.Draggable || state.drag) return;

  const handle = win.querySelector('.dock-window-handle') || win;

  state.drag = window.Draggable.create(win, {
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

export { initWindowDrag };
