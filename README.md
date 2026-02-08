# Tilda Mac OS (GSAP)

Готовый набор для Tilda Zero Block: док с hover, строгий маппинг и окна с overlay, resize и drag.

## Подключение в Tilda

1) Подключите GSAP и плагины:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/Flip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/Draggable.min.js"></script>
```

2) Подключите стили и скрипт проекта (после GSAP):

```html
<link rel="stylesheet" href="https://your-cdn/macos.css">
<script src="https://your-cdn/macos.js"></script>
```

3) Инициализируйте:

```html
<script>
  DockUI.init({
    dockSelector: '.dock',
    itemSelector: '.dock-item',
    windowSelector: '.dock-window',
    boundsSelector: '.uc-dockbounds',
  });
</script>
```

## Классы и атрибуты в Zero Block

- `.dock` — фон/плашка дока.
- `.dock-item` — иконки дока.
- `.dock-window` — окна.
- `.dock-window-close` — кнопка закрытия окна.
- `.dock-resize` — кнопка maximize/restore.
- `.dock-window-handle` — хэндл для перетаскивания окна (если нет, тянем всё окно).

### Маппинг dock-item → dock-window

- На иконке: `data-item="gallery"`.
- На окне: `data-window="gallery"`.

Сопоставление строгого типа (trim + lower-case). Если совпадение не найдено, окно **не** открывается.

> Важно: Тильда может положить атрибут на `.t396__elem` или на `.tn-atom`. Скрипт читает оба места.

## Границы

По умолчанию границы = viewport. Если есть элемент `.uc-dockbounds`, его `getBoundingClientRect()` используется для drag/clamp/maximize.

## Debug режим

В консоли браузера:

```js
window.DOCK_UI_DEBUG = true;
```

Логи включают найденные иконки/окна, реальные значения `data-item`/`data-window` и причины отсутствия маппинга.

## Сборка

```bash
npm install
npm run build
```

Результаты:
- `dist/macos.css`
- `dist/macos.js`
