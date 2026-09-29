# OnSport AI website

Static single-page marketing site (plain HTML/CSS/JS, no build step), built from the approved design handoff.

- `index.html`: markup and client-approved copy
- `style.css`: design tokens and all styles
- `main.js`: nav glass state, hero video play/pause, stat count-up, photo drift, demo form
- `assets/`: web-compressed media (hero video 1280px H.264 ~2.7 MB + VP9 WebM ~1.9 MB; photos resized to ≤1400px)

Run locally: `python3 -m http.server --directory onsport` and open http://localhost:8000.

## Demo form
The form is wired to **Netlify Forms** (`name="demo-request"`). After deploying, open Netlify → Forms →
Form notifications and add an email notification to **info@onsportai.com**. On success the card shows
"Thanks, we'll be in touch shortly." If the handler can't be reached (e.g. not hosted on Netlify), the
page falls back to a pre-filled `mailto:info@onsportai.com`.

## Open items
- **Before launch on the client domain:** remove the `noindex` meta tag in `index.html` and the `X-Robots-Tag` header in `netlify.toml`, which keep the preview out of search engines. Also change `onsportai.netlify.app` in the `og:url`, `og:image` and `twitter:image` tags to the client domain.
- SVG versions of the logo (optional: the PNGs are sharp at the sizes used; an SVG can be exported from the .ai/.pdf/.eps source files).
- Confirm licensing of the photo-card images.
