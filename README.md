# RoboTouch Lab — Static Site

A fully self-contained static mirror of **robotouchlab.com**, ready to host on GitHub Pages
(or any static host). All pages, styles, scripts, images, fonts, and video are included, and every
internal link and asset reference has been rewritten to a **relative path** so the site works from
any location.

## Contents

| Path | What it is |
|------|------------|
| `index.html` | Home page |
| `perception/`, `sensor-design/`, `manipulation/`, `simulation/`, `human-robot-interaction/`, `visual-tactile-synthesis-and-generation/`, `research/`, `publication/`, `people/`, `join-us/` | Interior pages (each is a folder with an `index.html`, giving clean URLs like `/people/`) |
| `wp-content/` | Theme CSS/JS, uploaded images, and video |
| `wp-includes/` | WordPress core front-end CSS/JS the theme relies on |
| `.nojekyll` | Tells GitHub Pages to serve files as-is (no Jekyll processing) |

11 pages, 140 assets (~75 MB, mostly one video and photos).

## Deploy to GitHub Pages

1. Create a new repository on GitHub (e.g. `robotouch-site`).
2. From this folder, push the files:
   ```bash
   git init
   git add .
   git commit -m "Static site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment**, set **Source = Deploy from a branch**,
   branch **main** / folder **/ (root)**, then **Save**.
4. Your site goes live at `https://<your-username>.github.io/<repo>/` in a minute or two.

Because all paths are relative, it works whether it's served from a repo subpath
(`username.github.io/repo/`), a user site (`username.github.io`), or a custom domain.

## Custom domain (optional)

To serve it at your own domain, add a file named `CNAME` (no extension) containing just your
domain, e.g. `robotouchlab.com`, then configure the domain in **Settings → Pages**.

## Preview locally

Any static server works. For example, with the VS Code "Live Server" extension, right-click
`index.html` → *Open with Live Server*.

## Notes

- This is a **static snapshot** — dynamic WordPress features (search, comment forms, the admin area)
  are not functional, since there is no server/database. All visible content and navigation work.
- To refresh the content later, re-run the mirroring process against the live site.
