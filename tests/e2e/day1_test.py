"""
Uji end-to-end Tahap 2: menyelesaikan Hari 1 sepenuhnya dalam MODE OFFLINE.

Jalankan: python3 tests/e2e/day1_test.py <folder-proyek> <folder-output>
(butuh build di dist/ dan Python Playwright + Chrome)
"""
import json, os, re, signal, subprocess, sys, time, shutil, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

APP = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
PROFILE = OUT / "chrome-day1"; shutil.rmtree(PROFILE, ignore_errors=True)
URL = "http://localhost:4174/"
DAY = json.loads((APP / "public/content/month-01/day-01.json").read_text())

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

def plain(s):  # hapus format **tebal** / *miring*
    return re.sub(r"[*~]", "", s).strip()

EXERCISES = {}
for sec in (DAY["lesson"]["exercises"], DAY["reading"]["questions"], DAY["writing"]["exercises"]):
    for e in sec:
        EXERCISES[plain(e["prompt"])] = e

srv = subprocess.Popen(["npx", "vite", "preview", "--port", "4174", "--strictPort"], cwd=APP,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)
for _ in range(60):
    try: urllib.request.urlopen(URL, timeout=1); break
    except Exception: time.sleep(0.5)

READ_DB = """async () => {
  const db = await new Promise((res, rej) => { const o = indexedDB.open('english-mastery'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
  const all = (s) => new Promise((res) => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => res(r.result); });
  const out = {}; for (const s of ['profile','vocab_cards','vocab_reviews','lesson_progress','exercise_attempts','writings','error_stats','daily_log']) out[s] = await all(s);
  db.close(); return out;
}"""

def run_exercises(page, wrong_once_id=None, shots_prefix=None):
    """Menjawab soal satu per satu sampai layar hasil muncul."""
    answered_wrong = False
    n = 0
    while True:
        result_h = page.get_by_role("heading", name="Hasil latihan")
        expect(result_h.or_(page.locator(".exercise .prompt"))).to_be_visible()
        if result_h.is_visible():
            return
        prompt = page.locator(".exercise .prompt").inner_text().strip()
        ex = EXERCISES.get(plain(prompt))
        assert ex, f"soal tidak dikenali: {prompt!r}"
        make_wrong = (ex["id"] == wrong_once_id and not answered_wrong)
        t = ex["type"]
        if t == "mc":
            idx = ex["answer"] if not make_wrong else (ex["answer"] + 1) % len(ex["options"])
            page.locator(".opt").nth(idx).click()
        elif t in ("fill", "translate"):
            page.get_by_label("Jawaban").fill("salah sekali" if make_wrong else ex["accept"][0])
            page.get_by_role("button", name="Periksa").click()
        elif t == "order":
            tokens = ex["tokens"] if not make_wrong else list(reversed(ex["tokens"]))
            for tok in tokens:
                page.locator(".order-pool .chip:not([disabled])", has_text=tok).first.click()
            page.get_by_role("button", name="Periksa").click()
        elif t == "explain":
            page.get_by_label("Penjelasan Anda").fill("Good evening untuk datang, Good night untuk pulang.")
            page.get_by_role("button", name="Simpan & lihat contoh").click()
        if make_wrong:
            answered_wrong = True
            expect(page.locator(".feedback.wrong")).to_be_visible()
            if shots_prefix: page.screenshot(path=str(OUT / f"{shots_prefix}-feedback-wrong.png"), full_page=True)
        else:
            expect(page.locator(".feedback")).to_be_visible()
        page.locator(".feedback").get_by_role("button", name="Lanjut").click()
        n += 1
        assert n < 60, "terlalu banyak soal (loop?)"

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(str(PROFILE), executable_path="/usr/bin/google-chrome", headless=True,
                                               viewport={"width": 412, "height": 900})
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.get_by_placeholder("Nama panggilan").fill("Tester")
    page.get_by_role("button", name="Mulai").click()
    page.evaluate("async () => { await navigator.serviceWorker.ready }")
    page.reload(); page.wait_for_function("() => !!navigator.serviceWorker.controller")
    page.wait_for_timeout(1500)

    # ===== OFFLINE mulai di sini =====
    stop = lambda: os.killpg(os.getpgid(srv.pid), signal.SIGTERM)
    stop()
    ctx.set_offline(True)
    page.reload()
    expect(page.get_by_text("Halo! Menyapa dan memperkenalkan diri")).to_be_visible(timeout=10000)
    check("Beranda menampilkan pelajaran Hari 1 saat offline", True)
    page.get_by_role("link", name=re.compile("Mulai: Kosakata")).click()

    # --- Blok 1: kosakata ---
    expect(page.get_by_text("Kata baru 1 dari 10")).to_be_visible()
    page.screenshot(path=str(OUT / "10-word-intro.png"), full_page=True)
    for _ in range(9): page.get_by_role("button", name="Kata berikutnya").click()
    page.get_by_role("button", name="Latih dengan flashcard").click()
    first = True
    for _ in range(40):
        done_h = page.get_by_role("heading", name="Review selesai")
        reveal = page.get_by_role("button", name="Lihat jawaban")
        expect(done_h.or_(reveal)).to_be_visible()
        if done_h.is_visible(): break
        reveal.click()
        if first: page.screenshot(path=str(OUT / "11-flashcard.png"), full_page=True)
        page.locator(".rate.r1" if first else ".rate.r4").click()  # sekali 'Lupa' agar kartu diulang
        first = False
    expect(page.get_by_role("heading", name="Review selesai")).to_be_visible()
    page.get_by_role("button", name="Lanjut").click()
    db1 = page.evaluate(READ_DB)
    check("10 kartu kosakata dibuat", len(db1["vocab_cards"]) == 10)
    check("Kartu 'Lupa' diulang di sesi yang sama", len(db1["vocab_reviews"]) >= 11, f"{len(db1['vocab_reviews'])} review")

    # --- Blok 2: grammar ---
    expect(page.get_by_role("heading", name="Grammar", exact=True)).to_be_visible()
    layers = 1
    while page.get_by_role("button", name=re.compile("Lanjut ke lapis berikutnya")).is_visible():
        page.get_by_role("button", name=re.compile("Lanjut ke lapis berikutnya")).click(); layers += 1
    check("Pelajaran terbuka lapis demi lapis", layers == len(DAY["lesson"]["layers"]), f"{layers} lapis")
    page.get_by_role("button", name="Pelajari lebih dalam").click()
    expect(page.get_by_text("God be with ye", exact=False)).to_be_visible()
    page.screenshot(path=str(OUT / "12-lesson.png"), full_page=True)
    page.get_by_role("button", name=re.compile("Mulai latihan")).click()
    run_exercises(page, wrong_once_id="d1-e3", shots_prefix="13")
    score_text = page.locator(".timer").last.inner_text()
    graded = len([e for e in DAY["lesson"]["exercises"] if e["type"] != "explain"])
    expected_score = round((graded - 1) / graded * 100)
    check("Nilai dihitung dari percobaan pertama", score_text == f"{expected_score}%", f"{score_text}, harapan {expected_score}%")
    page.screenshot(path=str(OUT / "14-result.png"), full_page=True)
    page.get_by_role("button", name="Selesai & lanjut").click()

    # --- Blok 3: reading ---
    expect(page.get_by_role("heading", name="At the office")).to_be_visible()
    page.locator(".tap-word", has_text="meet").first.click()
    expect(page.locator(".lookup")).to_contain_text("bertemu")
    page.locator(".tap-word", has_text="morning").first.click()
    expect(page.locator(".lookup")).to_contain_text("pagi")
    check("Ketuk kata menampilkan arti (glosarium & daftar kata)", True)
    page.get_by_role("button", name="Terjemahan").first.click()
    page.screenshot(path=str(OUT / "15-reading.png"), full_page=True)
    page.get_by_role("button", name=re.compile("Jawab pertanyaan")).click()
    run_exercises(page)
    page.get_by_role("button", name="Selesai & lanjut").click()

    # --- Blok 4: listening ---
    expect(page.get_by_role("heading", name="Dengar & tirukan")).to_be_visible()
    boxes = page.get_by_label("Sudah saya tirukan")
    for i in range(boxes.count()): boxes.nth(i).check()
    page.get_by_role("button", name="Selesai").click()

    # --- Blok 5: writing ---
    expect(page.get_by_role("heading", name="Menulis")).to_be_visible()
    run_exercises(page)
    page.get_by_role("button", name="Selesai").click()

    expect(page.get_by_text("Hari 1 selesai.")).to_be_visible()
    check("Hari 1 selesai & ringkasan tampil", True)
    page.screenshot(path=str(OUT / "16-day-done.png"), full_page=True)

    db2 = page.evaluate(READ_DB)
    check("Hari kurikulum maju ke 2", db2["profile"][0]["curriculumDay"] == 2)
    check("5 blok tercatat selesai", len([r for r in db2["lesson_progress"] if r["status"] == "completed"]) == 5)
    check("Jawaban 'jelaskan sendiri' tersimpan sebagai tulisan", len(db2["writings"]) == 2)
    check("Kesalahan tercatat di statistik", any(s["errorTag"] == "greeting-time" for s in db2["error_stats"]))
    mastery = {c["wordId"]: c["mastery"] for c in db2["vocab_cards"]}
    check("Kata di bacaan naik ke 'dipahami' (2)", mastery.get("morning", 0) >= 2, f"morning={mastery.get('morning')}")
    check("Kata yang ditulis benar naik ke 'dipakai' (3)", mastery.get("name", 0) >= 3, f"name={mastery.get('name')}")
    check("Waktu belajar tercatat otomatis", sum(l["activeSeconds"] for l in db2["daily_log"]) > 0,
          f"{sum(l['activeSeconds'] for l in db2['daily_log'])} detik")

    # --- restart offline: progres tetap ---
    page.reload()
    page.get_by_role("link", name="Beranda").click()
    expect(page.get_by_text("Sebuah dan banyak", exact=False).or_(page.get_by_text("Saya, kamu, dia: kata ganti orang"))).to_be_visible(timeout=10000)
    check("Setelah reload offline, Beranda menampilkan Hari 2", True)
    page.get_by_role("link", name="Belajar").click()
    expect(page.locator(".day-cell.done", has_text="1")).to_be_visible()
    page.screenshot(path=str(OUT / "17-learn-days.png"), full_page=True)
    page.get_by_role("link", name="Kosakata").click()
    expect(page.get_by_text("10 kata dikenal")).to_be_visible()
    page.screenshot(path=str(OUT / "18-vocab.png"), full_page=True)
    check("Tidak ada error JavaScript", not errors, "; ".join(errors[:3]))
    ctx.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} lulus")
sys.exit(1 if failed else 0)
