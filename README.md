# IGG project page

Project page for **IGG: A Benchmark for Interactive GUI Grounding under Visibility Constraints** (EMNLP 2026), served at <https://igg-bench.github.io>.

Plain static HTML: `index.html` and `static/css/index.css`. Headings: Nunito. Body: Inter.
Figures in `static/fig/` come from the EMNLP and Humantech papers and the EMNLP poster.

The inline **Just for fun!** section runs separate sets of four practice and
four recorded IGG tasks in the original
Pagely, Wavr, Figma, and Mailo mockups. `static/ranked-tasks-v2.json` records the task IDs,
initial states, instructions, and target IDs for recorded runs;
`static/practice-tasks.json` pins a different practice set from the same catalog. The parent accepts click feedback
only from its active same-origin frame. Practice stays browser-local. Recorded
runs save to a shared D1-backed service and appear in the inline Human Leaderboard;
they are separate from the paper's study and official benchmark results.

The compact play area scales the same 1440 × 900 mockup to the screen height.
Each completion dims the mockup and shows elapsed time with an in-frame next
button. Practice time is uncapped and starts at mockup readiness. Recorded runs
keep the existing 60-second limit and protocol; their next button waits for the
save response. Network failures offer an in-frame retry without losing the result.

## Human challenge (`igg-fun-v2`)

The public leaderboard shows only the current set, which ends with Mailo’s PPTX
upload task. Records from the previous `igg-fun-v1` set remain stored separately.
The original
`static/mockup-tasks.json` stays unchanged for cached v1 clients.

Four fixed tasks, in catalog order, with 60 seconds each. No hints, switching,
or restarting within a recorded run. Interactions continue until the correct
click, skip, or timeout. GA is successes / 4. TT is the mean elapsed milliseconds
across all four tasks, including skips and timeouts, displayed in seconds.
The clock starts when each embedded mockup reports ready, excludes loading and
between-task time, and continues while the tab is in the background. Rank by GA
descending, TT ascending, then submission time. Every run is a separate entry.

The service is `https://igg-human-leaderboard.kaist-ami-lab.chatgpt.site`.
Its source is maintained in the sibling `human-leaderboard-service` checkout and
Sites source repository. It uses Cloudflare D1; records are shared across devices.
No GitHub token or service-wide secret is exposed in the frontend. Per-run bearer
tokens are stored in this browser to authorize saving/deleting that run. Nickname,
GA, TT, and date are public; emails and visitor IPs are not stored by application
code. Clearing browser storage loses the ability to delete old runs from the UI.

Scores are **browser-measured and unverified**: the backend validates task order,
result structure and elapsed-time bounds and computes GA/TT, but it cannot prove
a human performed the actions or prevent a modified client. Do not combine these
four-task scores with the paper's 601-task benchmark or model leaderboard.

For local preview, serve this folder on `127.0.0.1:8766` and start the built service
on `127.0.0.1:8789`. The frontend only chooses the local service on localhost.
Never submit synthetic test scores to the public board.

`mockup-source/` preserves the source snapshot and SHA-256 provenance. After
`npm install`, run `npm run build:mockups` to regenerate `static/mockups/`.
The build uses Next.js static exports, adapting Figma's query-parameter entry
point without changing its UI or state logic. `.nojekyll` keeps the generated
`_next` assets available on GitHub Pages. Wavr retains its original external
placeholder image URLs.
