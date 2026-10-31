# KDEC Worship — Option B branding

The original artwork was recovered from `KDEC Worship Brand Identity Board.png` on the Desktop. Its SHA-256 is `02638a7610ff08cce008b2ee226eb6d10e46555f5339842837fb5c5ea18fd5b3`.

Option B is the tile labeled **B. Integrated Symbol**. The full tower/wordmark lockup is extracted directly, with its existing photographic background. No redraw, tracing, generated lettering, recoloring, background removal, or CSS filter is applied. The separate legacy JPEG remains untouched.

- `public/brand/option-b-lockup.png`: original pixels at x=386, y=338, width=176, height=180.
- `public/brand/option-b-tower.png`: original tower at x=424, y=338, width=100, height=118.
- `public/favicon.png`: tower crop centered on a 128px dark-teal canvas. App icons resize this same source; `favicon.svg` embeds it for old favicon URLs.
- `src/components/BrandLogo.jsx`: shared identity used by the header, sidebar, sign-in/invitation/password-recovery screens. The collapsed sidebar uses the tower crop.

The **His Presence** palette from the board supplies dark teal `#101923`, blue teal `#233a50`, mist `#b5c6d0`, sand `#c8b896`, and ivory `#f6f5f1`. Existing brand/indigo utilities use related accessible shades. Semantic status colors remain distinct. Supporting UI uses DM Sans, editorial headings use Cormorant Garamond, and Arabic uses Cairo. Font loading retains the existing Google Fonts setup and local fallbacks.

The recovered board is raster artwork; the full lockup is only 176×180 pixels. A higher-resolution original can replace the same files later without component changes. These assets are intentionally not represented as vector originals or invented transparent variants.

No routes, authentication handlers, database schemas, permissions, persistence keys, or data actions are changed by this branding work. The existing service worker caches only the generic offline page, retry script, and public logo; no private data or authenticated HTML is cached.

Verification: run `npm test`, `npm run lint`, and `npm run build`. Visually check login, password recovery, expanded/collapsed sidebar, header, English/Arabic, mobile widths, and light/dark themes. Use explicit development demo mode on a separate local origin for browser checks; do not clear an existing user's storage or test against live records.
