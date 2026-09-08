#!/usr/bin/env python3
"""Render the recorded UI scenes into a captioned, shareable walkthrough."""

import argparse
import html
import json
import math
import os
from pathlib import Path
import shlex
import subprocess
import sys


FPS = 25
DEFAULT_MANIFEST = "artifacts/demos/moonlit-market/recording.json"
ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1600
PlayResY: 1000
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,DejaVu Sans,18,&H00C2DCCB,&H00FFFFFF,&H0024402E,&H0024402E,0,0,0,0,100,100,0,0,1,0,0,2,55,55,67,1
Style: Caption,DejaVu Sans,27,&H00F5F5F5,&H00FFFFFF,&H0024402E,&H0024402E,0,0,0,0,100,100,0,0,1,0,0,2,55,55,23,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def timestamp(seconds, separator=".", precision=3):
    units = 10**precision
    ticks = round(seconds * units)
    whole, fraction = divmod(ticks, units)
    minutes, second = divmod(whole, 60)
    hour, minute = divmod(minutes, 60)
    if precision == 0:
        return f"{hour:02}:{minute:02}:{second:02}"
    return f"{hour:02}:{minute:02}:{second:02}{separator}{fraction:0{precision}}"


def plain_text(value):
    return " ".join(str(value or "").split())


def ass_text(value):
    # Captions are plain text; never interpret supplied ASS drawing/style codes.
    return plain_text(value).replace("\\", "/").replace("{", "(").replace("}", ")")


def caption_events(scene, start=0):
    end = start + scene["duration"]
    interval = f"{timestamp(start, precision=2)},{timestamp(end, precision=2)}"
    return (
        f"Dialogue: 0,{interval},Title,,0,0,0,,{ass_text(scene['title'])}\n"
        f"Dialogue: 0,{interval},Caption,,0,0,0,,{ass_text(scene['caption'])}\n"
    )


def command(name):
    result = shlex.split(os.environ.get(f"DEMO_{name.upper()}", name))
    if not result:
        raise ValueError(f"DEMO_{name.upper()} must name an executable or wrapper command")
    return result


def probe(ffprobe, path):
    result = subprocess.run(
        ffprobe + ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def run(args, cwd, log):
    log.write(f"\n$ {shlex.join(args)}\n")
    log.flush()
    subprocess.run(args, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, check=True)


def prepare_scenes(raw_scenes, source_duration):
    if not isinstance(raw_scenes, list) or not raw_scenes:
        raise ValueError("recording.json must contain at least one scene")
    scenes = []
    for index, raw in enumerate(raw_scenes, 1):
        start, end, speed = (float(raw.get(key, default)) for key, default in [("start", -1), ("end", -1), ("speed", 1)])
        if not all(math.isfinite(value) for value in [start, end, speed]):
            raise ValueError(f"Scene {index} contains a non-finite time or speed")
        if start < 0 or start >= source_duration or end <= start or speed <= 0 or end > source_duration + 0.1:
            raise ValueError(f"Scene {index} needs 0 <= start < end <= video duration and speed > 0")
        end = min(end, source_duration)
        frames = max(1, round((end - start) / speed * FPS))
        caption = plain_text(raw.get("caption"))
        if speed > 1:
            caption = f"{caption} · Accelerated {speed:g}×".lstrip(" ·")
        scenes.append({
            "title": plain_text(raw.get("title")) or f"Scene {index}",
            "caption": caption,
            "start": start, "end": end, "speed": speed,
            "frames": frames, "duration": frames / FPS,
        })
    return scenes


def write_chapters(output, scenes):
    ass = [ASS_HEADER]
    vtt = ["WEBVTT\n"]
    markdown = ["# TurnBased game creation walkthrough\n"]
    cursor = 0
    for index, scene in enumerate(scenes, 1):
        finish = cursor + scene["duration"]
        ass.append(caption_events(scene, cursor))
        vtt.append(f"{index}\n{timestamp(cursor)} --> {timestamp(finish)}\n{html.escape(scene['title'])}\n")
        markdown.append(f"- **{timestamp(cursor, precision=0)} — {scene['title']}**: {scene['caption']}")
        cursor = finish
    (output / "captions.ass").write_text("".join(ass), encoding="utf-8")
    (output / "chapters.vtt").write_text("\n".join(vtt), encoding="utf-8")
    (output / "chapters.md").write_text("\n".join(markdown) + "\n", encoding="utf-8")
    return cursor


def render(manifest, output):
    recording = json.loads(manifest.read_text(encoding="utf-8"))
    source = Path(recording["video"])
    source = source.resolve() if source.is_absolute() else (manifest.parent / source).resolve()
    if not source.is_file():
        raise ValueError(f"Recording video not found: {source}")
    ffmpeg, ffprobe = command("ffmpeg"), command("ffprobe")
    metadata = probe(ffprobe, source)
    streams = [stream for stream in metadata["streams"] if stream["codec_type"] == "video"]
    if not streams or (streams[0].get("width"), streams[0].get("height")) != (1600, 900):
        raise ValueError("The walkthrough expects a 1600×900 browser recording")
    scenes = prepare_scenes(recording.get("scenes"), float(metadata["format"]["duration"]))
    output.mkdir(parents=True, exist_ok=True)
    work = output / "render-work"
    work.mkdir(exist_ok=True)
    duration = write_chapters(output, scenes)
    final = output / "turnbased-game-creation.mp4"
    with (output / "render.log").open("w", encoding="utf-8") as log:
        clips = []
        for index, scene in enumerate(scenes, 1):
            stem = f"scene-{index:03}"
            (work / f"{stem}.ass").write_text(ASS_HEADER + caption_events(scene), encoding="utf-8")
            filters = (
                f"setpts=(PTS-STARTPTS)/{scene['speed']:.8f},fps={FPS},"
                f"pad=iw:ih+100:0:0:color=0x24402e,ass={stem}.ass,"
                "tpad=stop_mode=clone:stop_duration=1"
            )
            print(f"Rendering {index}/{len(scenes)}: {scene['title']} ({scene['duration']:.2f}s)", flush=True)
            run(ffmpeg + [
                "-hide_banner", "-y", "-ss", f"{scene['start']:.6f}",
                "-t", f"{scene['end'] - scene['start']:.6f}", "-i", str(source),
                "-an", "-vf", filters, "-frames:v", str(scene["frames"]),
                "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                "-pix_fmt", "yuv420p", "-video_track_timescale", "12800", f"{stem}.mp4",
            ], work, log)
            clips.append(f"file '{stem}.mp4'")
        (work / "concat.txt").write_text("\n".join(clips) + "\n", encoding="utf-8")
        run(ffmpeg + [
            "-hide_banner", "-y", "-f", "concat", "-safe", "1", "-i", "concat.txt",
            "-c", "copy", "-movflags", "+faststart", str(final),
        ], work, log)
        run(ffmpeg + [
            "-hide_banner", "-y", "-ss", f"{min(3, duration / 2):.3f}", "-i", str(final),
            "-frames:v", "1", "-q:v", "2", str(output / "poster.jpg"),
        ], work, log)
    rendered_duration = float(probe(ffprobe, final)["format"]["duration"])
    if abs(rendered_duration - duration) > 0.15:
        raise ValueError(f"Rendered duration {rendered_duration:.2f}s differs from expected {duration:.2f}s; inspect render.log")
    print(json.dumps({"video": str(final), "duration": rendered_duration, "scenes": len(scenes), "poster": str(output / "poster.jpg")}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recording", nargs="?", default=DEFAULT_MANIFEST, type=Path)
    parser.add_argument("--output-dir", type=Path, help="Defaults to the recording.json directory")
    options = parser.parse_args()
    manifest = options.recording.resolve()
    try:
        render(manifest, (options.output_dir or manifest.parent).resolve())
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Render failed: {error}. Check render.log and DEMO_FFMPEG/DEMO_FFPROBE.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
