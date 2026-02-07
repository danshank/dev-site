# Plan: Migrate to Vite + Tailwind CSS

## Goal
Add Vite as a build system and Tailwind CSS for responsive utilities, while preserving the existing Three.js CSS3D panel architecture.

## Current State
- Vanilla HTML/CSS/JS with no build step
- ~1300 lines of custom CSS in `styles.css`
- Three.js with CSS3DRenderer (HTML panels positioned in 3D space)
- Import maps for Three.js from CDN
- `live-server` for development

## Migration Strategy

### Phase 1: Add Vite (preserves everything, just adds build tooling)

**New files:**
- `package.json` - dependencies and scripts
- `vite.config.js` - Vite configuration

**Changes:**
- Move `index.html` to work with Vite's expectations (minimal)
- Update script imports to use Vite's module resolution
- Three.js installed via npm instead of CDN import maps

**Result:** `npm run dev` gives you hot-reloading dev server, `npm run build` produces optimized output.

### Phase 2: Add Tailwind CSS

**New files:**
- `tailwind.config.js` - Tailwind configuration with your Catppuccin colors
- `src/styles/main.css` - Entry point that imports Tailwind + your custom CSS

**Changes:**
- Import Tailwind's base/components/utilities
- Keep ALL your existing CSS (1300 lines) - we're adding Tailwind alongside, not replacing
- Configure Tailwind with your existing color variables

**Result:** You can use Tailwind utility classes in HTML while keeping all existing styles.

### Phase 3: Gradually adopt Tailwind for responsive layouts

**No immediate changes required.** As you build new features or fix responsive issues, you can choose:
- Use Tailwind classes: `<div class="flex flex-col md:flex-row">`
- Or keep writing custom CSS in `styles.css`

Both work together.

## File Structure After Migration

```
dev-site/
├── index.html              (updated entry point)
├── package.json            (new)
├── vite.config.js          (new)
├── tailwind.config.js      (new)
├── postcss.config.js       (new - required by Tailwind)
├── src/
│   ├── styles/
│   │   ├── main.css        (new - imports Tailwind + legacy)
│   │   └── legacy.css      (renamed from styles.css)
│   ├── js/
│   │   ├── three-setup.js  (moved)
│   │   └── camera-controls.js (moved)
│   └── script.js           (moved)
├── public/                  (new - static assets)
└── dist/                    (generated on build)
```

## What Stays the Same
- All your HTML structure
- All your existing CSS (just moved to `src/styles/legacy.css`)
- Three.js CSS3DRenderer approach
- Panel positioning and 3D transforms
- Catppuccin color scheme

## New Development Workflow

**Before:**
```bash
npx live-server
```

**After:**
```bash
npm run dev     # Vite dev server with hot reload
npm run build   # Production build to dist/
npm run preview # Preview production build
```

## Tailwind Configuration Highlights

```js
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        // Your Catppuccin palette
        crust: '#11111b',
        base: '#1e1e2e',
        surface0: '#313244',
        text: '#cdd6f4',
        accent: '#89b4fa',
        // ... etc
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Space Mono', 'monospace'],
      },
    },
  },
}
```

This means you can use `bg-crust`, `text-accent`, `font-mono` in Tailwind classes.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing styles | Keep all CSS, just reorganize |
| Three.js import issues | Test thoroughly after Vite migration |
| Build complexity | Vite is minimal config, mostly works out of box |

## Implementation Order

1. Initialize npm and install dependencies
2. Create Vite config
3. Reorganize files into src/ structure
4. Update index.html for Vite
5. Verify Three.js still works
6. Add Tailwind + PostCSS
7. Configure Tailwind with your colors
8. Test responsive behavior
9. Take mobile screenshot to verify nothing broke
