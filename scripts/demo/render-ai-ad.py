#!/usr/bin/env python3
"""Render the reviewed AI-rulebook ad edit and publish its static web assets."""

import argparse
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", nargs="?", type=Path,
                        default=Path("artifacts/demos/ai-rules-ad/recording.json"))
    parser.add_argument("--public-dir", type=Path, default=Path("apps/web/public/demo"))
    options = parser.parse_args()
    manifest = options.manifest.resolve()
    output = manifest.parent
    spec = importlib.util.spec_from_file_location(
        "walkthrough", Path(__file__).with_name("render-walkthrough.py"))
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)
    # Same browser footage and established renderer; a restrained caption band.
    renderer.ASS_HEADER = renderer.ASS_HEADER.replace(
        "Style: Caption,DejaVu Sans,27", "Style: Caption,DejaVu Sans,25")
    renderer.render(manifest, output)
    video = output / "turnbased-ai-rules.mp4"
    (output / "turnbased-game-creation.mp4").replace(video)

    recording = json.loads(manifest.read_text())
    source = Path(recording["video"])
    if not source.is_absolute():
        source = manifest.parent / source
    metadata = renderer.probe(renderer.command("ffprobe"), source)
    scenes = renderer.prepare_scenes(recording["scenes"], float(metadata["format"]["duration"]))
    # Lead the embedded player with the actual AI proposal rather than a blank
    # rulebook. The first three scenes cover opening, briefing, and generation.
    poster_time = sum(scene["duration"] for scene in scenes[:3]) + 2
    with (output / "render.log").open("a", encoding="utf-8") as log:
        renderer.run(renderer.command("ffmpeg") + [
            "-hide_banner", "-y", "-ss", f"{poster_time:.3f}", "-i", str(video),
            "-frames:v", "1", "-q:v", "2", str(output / "poster.jpg"),
        ], output, log)
    cues, cursor = ["WEBVTT\n"], 0
    for index, scene in enumerate(scenes, 1):
        end = cursor + scene["duration"]
        cues.append(f"{index}\n{renderer.timestamp(cursor)} --> {renderer.timestamp(end)}\n"
                    f"{html.escape(scene['title'])}\n{html.escape(scene['caption'])}\n")
        cursor = end
    subtitles = output / "captions.vtt"
    subtitles.write_text("\n".join(cues), encoding="utf-8")
    public = options.public_dir.resolve()
    public.mkdir(parents=True, exist_ok=True)
    assets = [(video, public / video.name),
              (output / "poster.jpg", public / "turnbased-ai-rules.jpg"),
              (subtitles, public / "turnbased-ai-rules.vtt")]
    for original, target in assets:
        shutil.copy2(original, target)
    evidence = {
        "durationSeconds": round(cursor, 2), "width": 1600, "height": 1000,
        "audio": "Silent; captions are burned in and supplied as WebVTT.",
        "sourceManifest": str(manifest.relative_to(Path.cwd())),
        "observedAiHttpResponses": recording.get("responses", []),
        "editingNotes": recording.get("editingNotes", []),
        "browserErrors": recording.get("errors", []),
        "assets": [{"path": str(path.relative_to(Path.cwd())),
                    "bytes": path.stat().st_size,
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                   for _, path in assets],
    }
    (output / "release-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    main()
