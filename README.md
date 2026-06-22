# FISHER SWEETS — CRT TV site

A mobile-first, single-page site for the indie hip-hop artist **Fisher Sweets** (Paid In Full Records).
The whole site is a glitchy retro **television**: fans turn the **dial** to "change the channel"
between his music, demos, photos, and contact info — with CRT scanlines, static, glitch effects,
and synthesized TV sounds.

## Files at a glance
- **`index.html`** — the finished site, **fully self-contained** (CSS, JavaScript, and images all
  baked in). This is the only file you need to view, share, or deploy. Just **double-click it** and
  it works — no server required.
- `index.src.html`, `styles.css`, `script.js` — the clean, editable *source* files.
- `assets/` — the original image files.
- `build_inline.py` — rebuilds `index.html` from the source files (see **Editing** below).

## The channels
- **CH 01 — NOW PLAYING:** The EP, tracklist, playable Spotify embed, Spotify/Apple links
- **CH 02 — DEMOS:** "Unreleased" teaser + TikTok follow
- **CH 03 — PHOTO DUMP:** Tap the photo to flip through pics
- **CH 04 — TRANSMISSION:** Bio, all social links, booking email

Change channels by **turning the dial** (drag it), **tapping it**, the **CH▴ / CH▾** buttons,
or arrow keys. The power button turns the TV on/off; the speaker icon mutes the sound.

## Switching the look (retro tan ↔ black)
There's a **theme toggle** in the top-right corner ("TAN" / "BLACK") so you can flip the
hardware color live and keep whichever you like. The site **defaults to retro-tan** vintage plastic.
To make **black** the permanent default, remove `class="theme-retro"` from the `<body>` tag.

## Editing the site
Edit the **source files**, then rebuild the self-contained `index.html`:

```bash
python3 build_inline.py     # regenerates index.html from the source files
```

What to edit (all in **`index.src.html`** — search for the channel):
- **Tracklist** — the `<ol class="tracklist">` under CH 01
- **Bio** — the `<p class="bio">` under CH 04
- **Links / email** — the `<div class="links">` and `mailto:` under CH 04

Look & colors live in **`styles.css`** (`:root` = black theme, `body.theme-retro` = tan).
Behavior (dial, sounds, transitions) is in **`script.js`**.

### The photo dump (CH 03)
The photos in order are `assets/dump-1.jpg` … `dump-4.jpg` (first → last). To add/replace:
1. Drop a web image (`.jpg`/`.png` — **not** `.heic`, browsers can't show those) into `assets/`.
   To shrink a phone photo first: `sips -s format jpeg -Z 1000 -s formatOptions 45 IN.HEIC --out assets/dump-5.jpg`
2. In `index.src.html`, find `CH 03 — PHOTO DUMP` and add a line where you want it in the order:
   ```html
   <img src="assets/dump-5.jpg" alt="Fisher Sweets" class="photo" />
   ```
   (The filmstrip dots update automatically.)
3. Run `python3 build_inline.py` to rebuild `index.html`.

> Not comfortable running the build? You can also just edit `index.html` directly — the `<style>`
> block is near the top and the `<script>` is near the bottom. (The big base64 chunks in the middle
> are the embedded images — leave those alone.)

## Deploy (free, ~2 min)
`index.html` is all you need. Easiest options:
- **GitHub Pages:** push the repo, then Settings → Pages → Source: `main` / root. Live at
  `https://YOUR-USERNAME.github.io/YOUR-REPO/`.
- **Netlify:** drag the folder (or just `index.html`) onto https://app.netlify.com/drop
- **Vercel:** import the repo, or run `vercel` in this folder

Tip: after deploying, set the social-share image to the live URL — in `index.src.html` change
`<meta property="og:image" content="assets/rap-reverend.jpg" />` to the full
`https://.../assets/rap-reverend.jpg` and rebuild.

## Credits
Artist photo, cover art & links: Fisher Sweets / Paid In Full Records.
EP data pulled from the public Spotify / Apple Music pages.
