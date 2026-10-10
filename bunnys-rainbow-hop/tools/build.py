#!/usr/bin/env python3
"""Assemble Bunny's Rainbow Hop from per-scene clips + song. Local only, no paid calls.

Inputs : timing.json, assets/clips/scene_01.mp4 .. scene_10.mp4 (any length/size), assets/audio/song.wav|mp3
Outputs: build/captions.ass, build/final.mp4  (1080x1920, 30fps, <=60s)
Usage  : python3 tools/build.py [--no-audio] [--clips DIR] [--out PATH]
Clips longer than their slot are trimmed; shorter ones freeze the last frame.
"""
import argparse, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def ts(t):
    cs = round(t * 100)
    return f"{cs//360000}:{cs//6000%60:02d}:{cs//100%60:02d}.{cs%100:02d}"

def hex_ass(h):  # #RRGGBB -> &HBBGGRR&
    h = h.lstrip('#'); return f"&H{h[4:6]}{h[2:4]}{h[0:2]}&"

def make_ass(cfg, path):
    w, h = cfg["size"]
    out = [f"[Script Info]\nScriptType: v4.00+\nPlayResX: {w}\nPlayResY: {h}\nWrapStyle: 0\n",
           "[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
           # lyrics: lower-middle (MarginV 380 keeps clear of bottom UI), big, white w/ dark outline
           "Style: Lyric,DejaVu Sans,78,&H00FFFFFF,&H00FFFFFF,&H00402010,&H80000000,1,0,0,0,100,100,0,0,1,6,2,2,60,60,380,1",
           "Style: Word,DejaVu Sans,190,&H00FFFFFF,&H00FFFFFF,&H00402010,&H80000000,1,0,0,0,100,100,0,0,1,10,3,8,40,40,260,1",
           "Style: Num,DejaVu Sans,300,&H00FFFFFF,&H00FFFFFF,&H00402010,&H80000000,1,0,0,0,100,100,0,0,1,12,3,5,40,40,0,1",
           "\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text"]
    for s in cfg["scenes"]:
        d = (s["end"] - s["start"]) / 2
        for i, line in enumerate(s["lines"]):   # one line at a time
            a = s["start"] + i * d
            out.append(f"Dialogue: 0,{ts(a)},{ts(a+d)},Lyric,,0,0,0,,{{\\fad(120,120)}}{line}")
        if s.get("word"):
            a = s.get("word_at", s["start"])
            out.append(f"Dialogue: 1,{ts(a)},{ts(a+2.5)},Word,,0,0,0,,{{\\fad(150,200)\\1c{hex_ass(s['word_color'])}}}{s['word']}")
        for n in s.get("numbers", []):
            out.append(f"Dialogue: 1,{ts(n['at'])},{ts(n['at']+0.9)},Num,,0,0,0,,{{\\fad(60,150)\\fscx60\\fscy60\\t(0,200,\\fscx100\\fscy100)}}{n['n']}")
    Path(path).write_text("\n".join(out) + "\n", encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", default=str(ROOT/"assets/clips"))
    ap.add_argument("--audio", default=None)
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--out", default=str(ROOT/"build/final.mp4"))
    a = ap.parse_args()
    cfg = json.loads((ROOT/"timing.json").read_text(encoding="utf-8"))
    w, h = cfg["size"]; fps = cfg["fps"]
    (ROOT/"build").mkdir(exist_ok=True)
    ass = ROOT/"build/captions.ass"; make_ass(cfg, ass)

    inputs, chains = [], []
    for i, s in enumerate(cfg["scenes"]):
        clip = Path(a.clips) / f"scene_{s['id']:02d}.mp4"
        if not clip.exists(): sys.exit(f"missing clip: {clip}")
        dur = s["end"] - s["start"]
        inputs += ["-i", str(clip)]
        chains.append(f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps},"
                      f"tpad=stop_mode=clone:stop_duration={dur},trim=duration={dur},setpts=PTS-STARTPTS,setsar=1[v{i}]")
    n = len(cfg["scenes"])
    chains.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[cat]")
    chains.append(f"[cat]ass={ass}[vout]")
    audio = None if a.no_audio else (a.audio or next((str(p) for p in (ROOT/"assets/audio").glob("song.*")), None))
    cmd = ["ffmpeg", "-y", "-hide_banner", *inputs]
    if audio: cmd += ["-i", audio]
    cmd += ["-filter_complex", ";".join(chains), "-map", "[vout]"]
    if audio: cmd += ["-map", f"{n}:a", "-af", "loudnorm=I=-16:TP=-1.5", "-c:a", "aac", "-b:a", "192k"]
    cmd += ["-t", str(cfg["scenes"][-1]["end"]), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", a.out]
    print(" ".join(cmd[:3]), "...", a.out); subprocess.run(cmd, check=True)

if __name__ == "__main__":
    main()
