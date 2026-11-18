#!/usr/bin/env python3
"""
Membuat file audio pengucapan (Ogg Opus) untuk semua materi yang tersedia,
memakai Piper TTS (open-source, berjalan offline di komputer pembuat materi).

Pemakaian:
  python3 scripts/generate-audio.py --model /path/en-us-lessac-medium.onnx

Nama file = hash FNV-1a 32-bit dari teks yang dinormalisasi, sama persis dengan
src/engine/audio.ts, sehingga aplikasi bisa menemukan audio tanpa daftar terpisah.
File yang sudah ada tidak dibuat ulang.
"""
import argparse, json, re, subprocess, sys, tempfile, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "public" / "content"
AUDIO = ROOT / "public" / "audio"


def normalize(text: str) -> str:
    """Harus identik dengan normalizeForAudio() di src/engine/audio.ts."""
    t = re.sub(r"[*~]", "", text)
    t = re.sub(r"^[A-Z][a-z]+:\s", "", t)  # label pembicara "Sara: "
    t = re.sub(r"\s+", " ", t).strip()
    return t


def fnv1a(text: str) -> str:
    h = 0x811C9DC5
    for b in text.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def collect_texts() -> set[str]:
    texts: set[str] = set()
    curriculum = json.loads((CONTENT / "curriculum.json").read_text())
    for m in curriculum["months"]:
        if not m.get("availableThroughDay"):
            continue
        mdir = CONTENT / f"month-{m['month']:02d}"
        for w in json.loads((mdir / "words.json").read_text()):
            texts.add(w["word"])
            texts.add(w["example"])
        for d in range(m["days"][0], m["availableThroughDay"] + 1):
            day = json.loads((mdir / f"day-{d:02d}.json").read_text())
            for layer in day["lesson"]["layers"]:
                for b in layer["blocks"]:
                    if b["type"] == "examples":
                        for ex in b["items"]:
                            texts.add(re.sub(r"→.*$", "", ex["en"]))
            for p in day["reading"]["paragraphs"]:
                texts.add(p["en"])
                for tok in re.findall(r"[A-Za-z']+", p["en"]):
                    texts.add(tok)
            for it in day["listening"]["items"]:
                texts.add(it["en"])
    return {normalize(t) for t in texts if normalize(t)}


def synth(model: str, text: str, out: Path) -> None:
    with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
        subprocess.run([sys.executable, "-m", "piper", "--model", model, "--output_file", wav.name],
                       input=text.encode("utf-8"), check=True, capture_output=True)
        with wave.open(wav.name) as w:
            if w.getnframes() == 0:
                raise RuntimeError(f"audio kosong: {text!r}")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav.name, "-ac", "1", "-c:a", "libopus",
                        "-b:a", "24k", "-application", "voip", str(out)], check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    args = ap.parse_args()
    AUDIO.mkdir(parents=True, exist_ok=True)
    texts = sorted(collect_texts())
    made = 0
    for i, t in enumerate(texts, 1):
        out = AUDIO / f"{fnv1a(t)}.ogg"
        if out.exists():
            continue
        synth(args.model, t, out)
        made += 1
        if made % 50 == 0:
            print(f"  {i}/{len(texts)} …", flush=True)
    total = sum(f.stat().st_size for f in AUDIO.glob("*.ogg"))
    print(f"{len(texts)} teks, {made} file baru, total {len(list(AUDIO.glob('*.ogg')))} file, {total / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
