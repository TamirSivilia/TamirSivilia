# Bunny's Rainbow Hop — pilot (≤60s, 9:16, 1080×1920)

Claude Code side: structure, timing, assembly, QA. **No paid generation is run from here.**

## Layout
- `timing.json` — 10 scenes × 6s, lyric lines, color words, number cues (single source of truth)
- `tools/build.py` — assembles clips + song + ASS captions → `build/final.mp4` (trims/freezes each clip to its slot, 1080×1920, 30fps, loudnorm)
- `tools/placeholders.sh` — free test clips to verify pipeline
- `assets/refs|clips|audio` — drop deliverables here (`scene_01.mp4`…`scene_10.mp4`, `song.wav|mp3`)
- `docs/ledger.csv`, `docs/budget.md`, `docs/lyrics_changes.md` — cost and lyric logs

## Workflow
`python3 tools/build.py` (needs ffmpeg with libass). After the song is measured, edit scene/line times in `timing.json` and rebuild; captions show one lyric line at a time (~380px above bottom), color words and 1-2-3 are rendered by the editor, not the video model, so spelling is always exact.
Pipeline was tested end-to-end with synthetic clips (1080×1920, 60.0s, AAC).

## Needed from Codex
1. Reference images: Bunny + Frog (final chosen base design, front/side/3-4, outfit, palette hex values).
2. Final song file (full 60s) + measured BPM and per-line vocal start times (or let me derive them via ffmpeg silence/onset analysis).
3. Per-scene clips (any length/aspect; I crop to 9:16) with the tool used and its clip length, so I can adjust slots.
4. Credits spent/committed so far → `docs/ledger.csv`.
5. Any lyric tweaks, with reasons.

## Recommendations
- Generate clips as image-to-video from the same reference sheet; keep one action per clip. If the tool caps clips at ~5s, plan 5s clips and let edit hold the last frame (build.py does this) or use gentle speed-up.
- Make scene 10's last frame = scene 1's first frame (use scene 1 first frame as end-frame reference if the tool supports it) for the loop.
- Do the single motion test (scene 1) before committing the other nine.
- Hop/clap sync: I can snap cut points to the beat grid (80 BPM = 0.75s/beat); number cues in scene 8 are placed on beats 2/4/6 of the scene.
- Rainbow in scene 7 stays the five-color fantasy bridge (red, yellow, blue, green, purple), per brief.

## Update: v1 references received
`assets/refs/bunny-frog-reference-v1.webp` and `docs/character-spec-v1.md` (palette: fur #FFF9F0, overalls #368BDD, ears #F5B7C7, buttons #F7C948, frog #70BE69, belly #D8EFA9, dark #263047; Frog ≈ 1/3 Bunny height).
Short clips (e.g. 5s) are now slowed evenly to fill a 6s slot (up to 1.25x, `--max-stretch`), not padded with a frozen second. Still awaiting: song file, vocal timings, motion-test clip.

## Policy (Codex)
Aim for clips covering the full 6s. Slowing is a spot fix after sync check against the song; `build.py` lists slowed clips as NOTE and treats freeze-frame holds as a WARNING with exit code 3 until `--allow-hold` is passed. Next: song analysis (line + beat times) when the file arrives.
