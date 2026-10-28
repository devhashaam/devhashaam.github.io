# devhashaam.github.io

Portfolio of **Muhammad Hashaam**, front-end developer in Islamabad.
Live: https://devhashaam.github.io/

Hand-coded with HTML, CSS and JavaScript. No frameworks and no build step.

| Project | What it shows | Live |
|---|---|---|
| **ShopSphere**: React store ([own repo](https://github.com/devhashaam/shopsphere)) | React, Redux Toolkit, RTK Query, React Router, 19 Vitest tests, GitHub Actions CI/CD | [/shopsphere/](https://devhashaam.github.io/shopsphere/) |
| **Chai Corner**: café landing page | Semantic HTML, SEO (meta, Open Graph, JSON-LD structured data), mobile-first CSS Grid, accessible tabs, form validation | [/projects/chai-corner/](https://devhashaam.github.io/projects/chai-corner/) |
| **TechBazaar**: product catalogue | jQuery, AJAX (`$.getJSON`), event delegation, debounced search, filters/sort, cart in `localStorage`, loading/empty/error states | [/projects/techbazaar/](https://devhashaam.github.io/projects/techbazaar/) |
| **FinTrack**: finance dashboard | Design-to-code, design tokens with CSS custom properties, light/dark theme, hand-built SVG chart, responsive sidebar | [/projects/fintrack/](https://devhashaam.github.io/projects/fintrack/) |
| **Skies**: weather app | Live REST API (Open-Meteo), async/await, AbortController, debounced autocomplete, geolocation, caching | [/projects/skies/](https://devhashaam.github.io/projects/skies/) |
| **Taskboard**: kanban board | HTML5 drag and drop with a keyboard alternative, `<dialog>`, live-region announcements, `localStorage` | [/projects/taskboard/](https://devhashaam.github.io/projects/taskboard/) |
| **Signup Wizard**: multi-step form | Written functional requirements, then built to them: per-step validation, error summary, focus management | [/projects/signup/](https://devhashaam.github.io/projects/signup/) |

## Run locally

```bash
python -m http.server 5500
```
Then open http://localhost:5500. TechBazaar loads JSON over HTTP, so it needs a local server instead of opening the file directly.

## Quality checklist
- Responsive from 320px up, with no horizontal scroll
- Keyboard accessible, visible focus states, `prefers-reduced-motion` respected
- `robots.txt` + `sitemap.xml`, a unique title and description on every page
