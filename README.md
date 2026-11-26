# canonical.design

This is the codebase for the canonical.design static website

## Architecture overview

This site is currently under-development.
## Development

The simplest way to run the site is with `dotrun`.

Afterwards the website will be available at <http://localhost:8052>.

## Updating the fonts

The glyph specimen on `/brand/font/glyphs` reads its data from `_data/glyphs.yaml`. That file is generated from the font files in `static/fonts/`. It is not rebuilt during the build, so whenever you add, remove or update a font you must regenerate it in the same PR:

1. Add the new `.woff2` files to `static/fonts/` and delete the ones they replace.
2. Update the `@font-face` URLs in `static/sass/_fonts.scss` and the font preloads in `templates/base.html` to match.
3. Regenerate the glyph data:

   ```bash
   pip install fonttools brotli pyyaml
   python scripts/generate_glyph_data.py
   ```

4. Commit the updated `_data/glyphs.yaml` along with the fonts.

The "Glyph data" CI check runs whenever `static/fonts/`, the script, or `_data/glyphs.yaml` change. It regenerates the file and fails if the result differs from the committed version.

The script fails if a file in `static/fonts/` does not match a known face (`Ubuntu-`, `Ubuntu-Italic-`, `UbuntuMono-`). If you add a new face, add its prefix to `FACE_PREFIXES` in `scripts/generate_glyph_data.py`.
