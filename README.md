# CytoSwing — Progressive Web App

CytoSwing is now installable: it works offline (chart UI, watchlist, saved
drawings, saved API keys), launches full-screen from your home screen with
no browser chrome, and prompts you when a new version is available.

```
CytoMobile/
├── index.html          # the app (was CytoSwing_mobile.html)
├── manifest.json        # PWA metadata (name, icons, theme, shortcuts)
├── service-worker.js    # offline caching logic
├── sw-register.js       # registers the SW + shows an "update ready" banner
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── maskable-512.png
├── screenshots/          # optional install-UI screenshots (see below)
├── _headers              # Cloudflare Pages headers config
└── README.md
```

## What was added on top of the original dashboard

- `<link rel="manifest">`, theme-color, and apple-mobile-web-app meta tags
  in `index.html`'s `<head>`.
- `sw-register.js` included right before `</body>`.
- Nothing else in the app's logic changed — this is a pure wrapper.

## Caching strategy (`service-worker.js`)

| Content                                      | Strategy                | Why |
|-----------------------------------------------|--------------------------|-----|
| App shell (`index.html`, icons, manifest)     | cache-first              | Instant load, works offline |
| Google Fonts                                  | stale-while-revalidate   | Fast, but stays fresh |
| `data.alpaca.markets` / `api.alpaca.markets`  | **network-only, never cached** | Live price/order data must never be served stale |
| Everything else                               | network-first, cache fallback | Reasonable default |

Your Alpaca API key/secret and chart drawings are stored in
`localStorage`, which already persists across offline sessions — the
service worker doesn't need to (and doesn't) touch them.

## Local testing

PWAs require HTTPS or `localhost` — `file://` won't register a service
worker. From inside `CytoMobile/`:

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080` in Chrome/Edge and check:
- DevTools → Application → Manifest (icons, name, colors all show up)
- DevTools → Application → Service Workers (shows "activated and running")
- Lighthouse → PWA audit (should pass installability checks)
- Network tab → set to "Offline" → reload → app shell still loads

## Deploying to Cloudflare Pages

1. Push this folder to a GitHub repo (or drag-and-drop deploy in the
   Cloudflare dashboard).
2. Cloudflare Pages → Create project → point it at this repo.
   - Build command: *(none)* — it's static
   - Build output directory: `/` (repo root, i.e. this `CytoMobile/` folder)
3. The included `_headers` file is auto-applied by Cloudflare Pages: it
   sets correct `Content-Type`s for `manifest.json`/`service-worker.js`,
   disables long-term caching on the app shell so updates roll out
   quickly, and caches icons for a year.
4. Cloudflare Pages serves everything over HTTPS by default, which is
   required for service workers — no extra config needed.

Any other static host (Netlify, Vercel, GitHub Pages, S3+CloudFront, plain
nginx) works too — HTTPS is the only hard requirement. On other hosts,
replicate the header rules from `_headers` manually if you want the same
caching behavior.

## Icons

`icons/icon-192.png`, `icon-512.png`, and `maskable-512.png` were
generated to match the app's dark navy / teal-candle branding. If you'd
rather use your own artwork, keep the same filenames and sizes (192×192,
512×512, 512×512) so `manifest.json` doesn't need edits. For the
maskable icon, keep your logo within the inner ~80% "safe zone" — OS
icon masks (circle, squircle, rounded-square) crop the outer edge.

## Screenshots (optional)

Some browsers show manifest `screenshots` in a richer install prompt.
`manifest.json` currently references:
- `screenshots/mobile-1.png` (540×1170, portrait)
- `screenshots/desktop-1.png` (1920×1080, landscape)

Drop real screenshots in with those filenames/sizes, or delete the
`"screenshots"` block in `manifest.json` if you'd rather skip this —
it's purely cosmetic and won't block installability either way.

## Updating the app later

Bump `CACHE_VERSION` at the top of `service-worker.js` any time you
change `index.html` (or add/remove cached files). Without that bump,
returning users may keep seeing a cached old version until they
force-refresh.
