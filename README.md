# IGG project page

Project page for **IGG: A Benchmark for Interactive GUI Grounding under Visibility Constraints** (EMNLP 2026), served at <https://igg-bench.github.io>.

Plain static HTML: `index.html` and `static/css/index.css`. Font: Inter (same as the poster).
Figures in `static/fig/` come from the EMNLP and Humantech papers and the EMNLP poster.

The inline **Just for fun!** section runs four existing IGG tasks in the original
Pagely, Wavr, and Figma mockups. `static/mockup-tasks.json` records the task IDs,
initial states, instructions, and target IDs. The parent accepts click feedback
only from its active same-origin frame. This casual preview does not submit
benchmark scores.

`mockup-source/` preserves the source snapshot and SHA-256 provenance. After
`npm install`, run `npm run build:mockups` to regenerate `static/mockups/`.
The build uses Next.js static exports, adapting Figma's query-parameter entry
point without changing its UI or state logic. `.nojekyll` keeps the generated
`_next` assets available on GitHub Pages. Wavr retains its original external
placeholder image URLs.
