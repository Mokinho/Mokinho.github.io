# Portfolio Website

Personal portfolio for Faiq Zharfan — Front-End Developer & WordPress Specialist.
Plain HTML/CSS/JS, no build step required.

## Structure

```
index.html   — all page content/sections
style.css    — theme, layout, responsive rules
script.js    — mobile nav, scroll reveal, active nav link, footer year
assets/      — put images (photo, project screenshots) here
```

## Editing content

- **About / bio** — edit the text inside `<section class="about">` in `index.html`.
- **Skills** — edit the list items inside `<section class="skills">`.
- **Projects** — each project is an `<article class="project">` block inside
  `<section class="work">`. Copy that block to add a new project, or edit the
  existing ones. Replace the placeholder card (`project-placeholder`) once you
  have a third project ready.
- **Contact** — update the email/LinkedIn links inside `<section class="contact">`.
- **Colors** — all colors are CSS variables at the top of `style.css` under
  `:root`. Change `--accent` to restyle the whole site.

## Adding a profile photo or project screenshots

Drop image files into `assets/` and reference them with an `<img>` tag, e.g.:

```html
<img src="assets/your-photo.jpg" alt="Faiq Zharfan">
```

## Running locally

Just open `index.html` in a browser, or serve it locally:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploying

**GitHub Pages** (free, easiest):
1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → set source to the `main` branch, root folder.
3. Site goes live at `https://<username>.github.io/<repo>/`.

**Netlify / Vercel**: drag-and-drop this folder in their dashboard, or connect
the GitHub repo — no build command needed, publish directory is `.`.
