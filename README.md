
# 🌊 Fluv.js

**High‑Performance, Matrix‑Driven Animation Engine for SVG.js**

[Fluv] (like the French word **"Fleuve"** /flœv/, meaning *river*)

Fluv is a professional-grade animation engine designed to extend and stabilize SVG.js animations.  
It replaces fire‑and‑forget runners with a **centralized timeline engine** and a **deterministic matrix compositor**, allowing precise control, reversibility, and seekable animation flows.

# Demo
https://github.com/user-attachments/assets/96dda844-8050-42aa-afc1-f86352e9f714


---

# ✨ Features

- Fully seekable timelines
- Native reverse and scrubbing
- Atomic matrix recomposition
- Advanced path morphing and reshaping
- Motion paths and filters support
- Staggering utilities
- External state integration
- High‑performance rendering pipeline

---

# 📦 Installation

## Using web

```html
<script src="./fluv.js"></script>
```

## Using ES Modules

```js
import { Fluv } from "fluv";
```

---

# 🚀 Quick Start

```js
import { Fluv } from "fluv";

const timeline = new Fluv({
  duration: 2000,
  easing: "easeInOutExpo"
});

timeline.add({
  targets: "#element",
  translateX: [{ value: 500, duration: 1000 }],
  rotate: [{ value: 360, duration: 1000 }]
});

timeline.play();
```

---

# 🧠 Architecture Overview

Fluv is built around three core subsystems:

## 1. Time Engine
Controls:
- play
- pause
- reverse
- seek
- speed scaling

The time engine is decoupled from the DOM so frames can be recomputed deterministically.

## 2. Matrix Resolver
Each frame:
1. Collect animated values
2. Compose transforms in deterministic order
3. Generate one matrix
4. Apply one DOM write

Transform order:

```
Translate → Rotate → Scale → Skew
```

## 3. Interpolation Core
Handles:
- numeric values
- colors
- matrices
- paths

Interpolation happens in memory before DOM commit.

---

# 🧩 Timeline API

## Constructor

```js
new Fluv(options)
```

### Options

| Option | Type | Description |
|--------|--------|--------|
| duration | number | Total timeline duration |
| easing | string/function | Default easing |
| managedState | boolean | Pull values from store |
| getManagedState | function | Getter for external state |

---

## timeline.add()

Adds animations to the timeline.

```js
timeline.add({
  targets: "#rect",
  translateY: [
    { value: 100, duration: 500 }, // <-- keyframe
    { value: 0, duration: 500, delay: 500 } // <-- keyframe
  ]
});

// NOTE : a delay must be added between keyframes to avoid overlaping
```

### Animation Object Format

| Property | Description |
|--------|--------|
| targets | CSS selector or node |
| duration | Tween duration |
| delay | Delay before tween |
| easing | Optional easing |
| value | Target value |

---

# 🎛 Timeline Controls

```js
timeline.play();
timeline.pause();
timeline.reverse();
timeline.seek(percent);
timeline.time(time);
```

---

# 🔁 Lifecycle Hooks

| Hook | Description |
|--------|--------|
| update | Fires every frame |
| complete | Fires when finished |

Example:

```js
const tl = new Fluv({
  update: (t) => console.log(t),
  complete: () => console.log("done")
});
```

---

# 🎨 Supported Properties

| Category | Examples |
|--------|--------|
| Transform | translateX, translateY, rotate, scale |
| Geometry | width, height, rx, ry |
| Appearance | fill, stroke, opacity |
| Paths | morphTo |
| Filters | blur, brightness |

---

# ⏱ Staggering

```js
timeline.add({
  targets: ".items",
  delay: Fluv.stagger(100),
  translateY: [{ value: 50, duration: 500 }]
});
```

---

# 🧪 Performance Techniques

Fluv minimizes layout and paint cost by:

- Caching bounding boxes
- Performing interpolation off‑DOM
- Writing a single matrix per frame
- Avoiding layout thrashing

---

# 📊 Comparison

| Feature | SVG.js Runner | Fluv |
|--------|--------|--------|
| Seek | ❌ | ✅ |
| Reverse | Partial | Native |
| Matrix composition | Limited | Deterministic |
| Path morphing | Basic | Advanced |
| Timeline control | Minimal | Full |

---

# 🗺 Roadmap

Planned features:
- Keyframe editor
- DevTools timeline panel
- Physics-based easing
- GPU acceleration experiments

---

# 📄 License

MIT © 2026 - @Habibe BA (Abu Nazir)
