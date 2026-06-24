# Fine Mess

A single-page site for the Fine Mess studio. Pure black field, the wordmark dead-centre,
and a manifesto view that animates in. No build step, no dependencies — one `index.html`.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server
```

To publish on **GitHub Pages**: push this repo, then enable Pages on the `main` branch (root).
Because everything is in one file, that's all it needs.

## ⚠️ Before it goes live — replace the logo

The wordmark currently points at a **temporary Figma export URL that expires ~7 days**
after it was generated. It *will* break. Replace it with a local asset:

1. Export the wordmark from Figma (**SVG preferred** — sharper, lighter).
2. Save it as `assets/fine-mess.svg`.
3. In `index.html`, update the one `src` on the `<img class="mark">` (around line 164):

   ```html
   <img class="mark" id="mark" src="assets/fine-mess.svg" alt="Fine Mess" />
   ```

## How it works

- **Home** — the wordmark over a living background: a fine grid in the dark that a soft
  light reveals as the cursor passes, drifting back to rest behind the logo when idle.
- **Manifesto** — click `MANIFESTO` to animate it in. The type sits still until the cursor
  nears it, then the letters push away with a little rotation and scale, settling back as
  you move on.
- **Back home** — click anywhere on the manifesto, press `Esc`, or use the browser back
  button. The view is hash-routed (`#manifesto` / `#home`), so URLs are shareable.
- Respects `prefers-reduced-motion`: animations and the letter effect switch off.

## Tuning

**Background & layout** — the `:root` block at the top of `index.html`:

| Variable | Does |
|---|---|
| `--grid-lit` / `--light-size` | brightness & radius of the cursor light |
| `--bloom` | soft glow strength (`0` = texture reveal only) |
| `--aura` | ambient drifting light (`0` = stiller field) |
| `--grid-gap` / `--grid-dim` | grid density & resting visibility |
| `--grain-opacity` | film grain |
| `--parallax` | logo drift toward cursor (`0` = locked) |
| `--copy-w` | manifesto column width |

**Manifesto letter-push** — constants near the top of the `<script>`:

| Constant | Does |
|---|---|
| `RADIUS` | how close the cursor must be before letters react (px) |
| `MAXPUSH` | how far letters fly (px) |
| `MAXROT` | how much they twist (deg) |

## Notes

- `CONTACT` is removed for now (no inbox yet). The styling is still present, so it's a
  one-line restore in the home `<section>` when the address is live.
- Built to the Figma source, copy and line breaks included verbatim — including the
  `JFD1` in "And JFDI can JFD1 Anyway" (left as designed; flag if it's a typo).
