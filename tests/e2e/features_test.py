"""
Uji end-to-end fitur paket lengkap (offline):
  1. Writing Studio: tulis → periksa → simpan; teks asli tidak berubah; draf tersimpan otomatis
  2. Progres: grafik tampil; catat hasil tes mengubah level
  3. Hari 8–14 tersedia setelah Hari 1–7 selesai (dibuka lewat data)
  4. Update otomatis: versi baru terpasang sendiri di halaman aman

Jalankan: python3 tests/e2e/features_test.py <folder-proyek> <folder-output>
"""
import os, re, shutil, signal, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

APP = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
PROFILE = OUT / "chrome-features"; shutil.rmtree(PROFILE, ignore_errors=True)
PORT = 4176
URL = f"http://localhost:{PORT}/"
results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

def build(build_id):
    env = dict(os.environ, VITE_BUILD_ID=build_id)
    subprocess.run(["npx", "vite", "build"], cwd=APP, env=env, check=True, capture_output=True)

def serve():
    p = subprocess.Popen(["npx", "vite", "preview", "--port", str(PORT), "--strictPort"], cwd=APP,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)
    for _ in range(60):
        try: urllib.request.urlopen(URL, timeout=1); return p
        except Exception: time.sleep(0.5)
    raise RuntimeError("server tidak menyala")

def stop(p): os.killpg(os.getpgid(p.pid), signal.SIGTERM); p.wait(timeout=10)

DB = """async (stores) => {
  const db = await new Promise((r) => { const o = indexedDB.open('english-mastery'); o.onsuccess = () => r(o.result); });
  const out = {}; for (const s of stores) out[s] = await new Promise((r) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
  db.close(); return out;
}"""

build("A")
srv = serve()
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(str(PROFILE), executable_path="/usr/bin/google-chrome", headless=True, viewport={"width": 412, "height": 900})
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.get_by_placeholder("Nama panggilan").fill("Andrian")
    page.get_by_role("button", name="Mulai").click()
    page.evaluate("async () => { await navigator.serviceWorker.ready }")
    page.reload(); page.wait_for_function("() => !!navigator.serviceWorker.controller")
    page.wait_for_timeout(1500)
    expect(page.get_by_text("build A")).to_have_count(0)  # tidak di beranda
    page.goto(URL + "#/settings")
    expect(page.get_by_text("build A")).to_be_visible()
    check("Versi build A terpasang", True)

    # ===== 4. Update otomatis =====
    page.goto(URL + "#/")
    build("B")  # versi baru di server
    page.evaluate("async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }")
    expect(page.get_by_text("Aplikasi sudah diperbarui otomatis", exact=False)).to_be_visible(timeout=20000)
    page.goto(URL + "#/settings")
    expect(page.get_by_text("build B")).to_be_visible()
    check("Update otomatis terpasang sendiri di halaman aman (tanpa tombol)", True)

    # update TIDAK boleh memotong pelajaran
    page.goto(URL + "#/day/1/grammar")
    expect(page.get_by_role("heading", name="Grammar", exact=True)).to_be_visible()
    build("C")
    page.evaluate("async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }")
    page.wait_for_timeout(5000)
    still = page.get_by_role("heading", name="Grammar", exact=True).is_visible() and "day/1/grammar" in page.url
    check("Update ditunda selama berada di tengah pelajaran", still)
    page.goto(URL + "#/")  # kembali ke halaman aman → terpasang
    expect(page.get_by_text("Aplikasi sudah diperbarui otomatis", exact=False)).to_be_visible(timeout=20000)
    check("Update tertunda terpasang setelah kembali ke Beranda", True)
    page.wait_for_timeout(1500)

    # ===== offline mulai di sini =====
    stop(srv)
    ctx.set_offline(True)

    # ===== 1. Writing Studio =====
    page.goto(URL + "#/writing")
    expect(page.get_by_role("heading", name="Writing Studio")).to_be_visible(timeout=10000)
    page.locator(".list-item", has_text="Perkenalkan diri Anda").get_by_role("button", name="Tulis").click()
    text = "good morning. my name is andrian. I am architect. She work in Jakarta. I hungry"
    page.get_by_label("Tulisan Anda").fill(text)
    page.wait_for_timeout(1800)  # simpan draf otomatis
    draft_url = page.url
    page.reload()
    expect(page.get_by_label("Tulisan Anda")).to_have_value(text, timeout=10000)
    check("Draf tersimpan otomatis & bertahan setelah reload offline", True)
    page.get_by_role("button", name="Periksa").click()
    expect(page.get_by_role("heading", name="Hasil pemeriksa dasar")).to_be_visible()
    n_issues = page.locator("ol.issues li").count()
    check("Pemeriksa menemukan kesalahan khas", n_issues >= 6, f"{n_issues} catatan")
    page.screenshot(path=str(OUT / "30-writing-check.png"), full_page=True)
    page.get_by_role("button", name="Selesai & simpan").click()
    expect(page.get_by_role("heading", name="Tulisan asli Anda")).to_be_visible()
    corrected = page.locator(".card", has=page.get_by_role("heading", name="Versi terkoreksi (dasar)")).locator("p.written").inner_text()
    check("Versi terkoreksi benar", corrected == "Good morning. My name is Andrian. I am an architect. She works in Jakarta. I am hungry.", corrected)
    page.screenshot(path=str(OUT / "31-writing-result.png"), full_page=True)
    d = page.evaluate(DB, ["writings", "writing_feedback", "exercise_attempts"])
    check("Teks asli disimpan persis seperti yang diketik", d["writings"][0]["text"] == text)
    check("Tulisan, umpan balik & kesalahan tersimpan", d["writings"][0]["status"] == "submitted" and len(d["writing_feedback"]) == 1
          and sum(1 for a in d["exercise_attempts"] if a["lessonId"] == "writing-studio") == n_issues)

    # ===== 2. Progres: grafik & asesmen =====
    page.goto(URL + "#/progress")
    expect(page.get_by_role("img", name=re.compile("Menit belajar per hari"))).to_be_visible()
    expect(page.get_by_role("heading", name="Akurasi per bagian")).to_be_visible()
    weak = page.locator(".card", has=page.get_by_role("heading", name="Peta kelemahan")).inner_text()
    check("Kesalahan Writing Studio masuk Peta kelemahan", "Lupa am/is/are" in weak or "Lupa -s untuk he/she/it" in weak)
    page.get_by_role("button", name="Catat hasil tes").click()
    page.locator("select").first.select_option("reading")
    page.locator("select").nth(1).select_option("A2")
    page.get_by_role("button", name="Simpan").click()
    expect(page.get_by_text("Hasil EF SET", exact=False)).to_be_visible()
    prof = page.evaluate(DB, ["profile", "assessments"])
    check("Asesmen tersimpan & level reading menjadi A2", prof["profile"][0]["levels"]["reading"] == "A2" and len(prof["assessments"]) == 1)
    page.screenshot(path=str(OUT / "32-progress.png"), full_page=True)

    # ===== 3. Materi Hari 8–14 =====
    page.evaluate("""async () => {
      const db = await new Promise((r) => { const o = indexedDB.open('english-mastery'); o.onsuccess = () => r(o.result); });
      await new Promise((r) => { const tx = db.transaction('profile', 'readwrite'); const s = tx.objectStore('profile');
        const g = s.get(1); g.onsuccess = () => { const p = g.result; p.curriculumDay = 8; s.put(p); }; tx.oncomplete = r; });
      db.close();
    }""")
    page.goto(URL + "#/day/8/grammar"); page.reload()
    expect(page.get_by_role("heading", name="Simple present (I, you, we, they)")).to_be_visible(timeout=10000)
    page.goto(URL + "#/day/12/reading")
    page.goto(URL + "#/learn")
    expect(page.get_by_text("Tersedia s.d. Hari 14")).to_be_visible()
    check("Hari 8–14 tersedia & terbuka offline", True)
    for day in range(8, 15):
        r = page.evaluate(f"async () => (await fetch('{URL}content/month-01/day-{day:02d}.json')).status")
        if r != 200: check(f"Materi hari {day} ter-cache", False, str(r))
    check("Tidak ada error JavaScript", not errors, "; ".join(errors[:3]))
    ctx.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} lulus")
sys.exit(1 if failed else 0)
