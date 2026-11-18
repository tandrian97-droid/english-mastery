"""
Uji end-to-end English Mastery (Tahap 1) dengan Chrome sungguhan.

Skenario:
 1. Buka aplikasi (online), buat profil, service worker terpasang.
 2. Jalankan timer belajar 17 detik -> tersimpan di IndexedDB.
 3. MATIKAN server (benar-benar tidak ada jaringan), tutup browser, buka lagi.
 4. Aplikasi harus terbuka dari cache, profil & menit tetap ada, kurikulum bisa dibuka.
 5. Belajar lagi saat offline -> menit bertambah dan tersimpan.
 6. Backup diunduh -> isi JSON valid; restore lewat UI berhasil.
 7. Screenshot layar luar & layar dalam Fold 7.
"""
import json, subprocess, sys, time, os, shutil, signal
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

APP = Path(sys.argv[1])
OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
PROFILE_DIR = OUT / "chrome-profile"
shutil.rmtree(PROFILE_DIR, ignore_errors=True)
URL = "http://localhost:4173/"
COVER = {"width": 412, "height": 900}
INNER = {"width": 884, "height": 980}

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

def start_server():
    p = subprocess.Popen(["npx", "vite", "preview", "--port", "4173", "--strictPort"], cwd=APP,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid)
    for _ in range(60):
        try:
            import urllib.request; urllib.request.urlopen(URL, timeout=1); return p
        except Exception: time.sleep(0.5)
    raise RuntimeError("server tidak menyala")

def stop_server(p):
    os.killpg(os.getpgid(p.pid), signal.SIGTERM); p.wait(timeout=10)

READ_DB = """async () => {
  const open = indexedDB.open('english-mastery');
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
  const all = (store) => new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const out = { profile: await all('profile'), daily_log: await all('daily_log') };
  db.close(); return out;
}"""

def launch(p, viewport):
    return p.chromium.launch_persistent_context(str(PROFILE_DIR), executable_path="/usr/bin/google-chrome",
                                                headless=True, viewport=viewport, accept_downloads=True,
                                                args=["--no-first-run"])

def seconds_today(state):
    return sum(l["activeSeconds"] for l in state["daily_log"])

server = start_server()
with sync_playwright() as p:
    # ---------- 1. online: instalasi ----------
    ctx = launch(p, COVER)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    expect(page.get_by_text("Mau dipanggil siapa?")).to_be_visible()
    page.screenshot(path=str(OUT / "01-onboarding-cover.png"))
    page.get_by_placeholder("Nama panggilan").fill("Budi")
    page.get_by_role("button", name="Mulai").click()
    expect(page.get_by_text("Budi", exact=False).first).to_be_visible()
    check("Onboarding membuat profil", True)

    sw_ok = page.evaluate("""async () => { const r = await navigator.serviceWorker.ready; return !!r.active; }""")
    check("Service worker aktif", sw_ok)
    page.reload()
    page.wait_for_function("() => !!navigator.serviceWorker.controller", timeout=15000)
    check("Service worker mengontrol halaman", True)
    page.wait_for_timeout(1500)
    cache_keys = page.evaluate("""async () => { const ks = await caches.keys(); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return {ks, n}; }""")
    check("Aset & materi tersimpan di cache", cache_keys["n"] >= 10, f"{cache_keys['n']} file di {cache_keys['ks']}")
    has_curr = page.evaluate("""async () => { for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) if (r.url.includes('curriculum.json')) return true; } return false; }""")
    check("curriculum.json ada di cache", has_curr)

    # ---------- 2. timer online ----------
    page.get_by_role("button", name="Mulai belajar").click()
    page.wait_for_timeout(17_500)
    page.get_by_role("button", name="Jeda").click()
    page.wait_for_timeout(800)
    s1 = page.evaluate(READ_DB)
    secs1 = seconds_today(s1)
    check("Timer menyimpan detik belajar", 16 <= secs1 <= 19, f"{secs1} detik")
    # refresh setelah jeda: total hari ini tetap tampil (bukan 00:00)
    page.reload()
    clock = page.locator(".timer").first.inner_text()
    check("Setelah refresh, timer menampilkan total hari ini (bukan 00:00)", clock != "00:00", clock)
    expect(page.get_by_role("button", name="Lanjutkan")).to_be_visible()

    # refresh SAAT timer masih berjalan: maksimal 5 detik terakhir boleh hilang
    page.get_by_role("button", name="Lanjutkan").click()
    page.wait_for_timeout(12_500)
    page.reload()
    page.wait_for_timeout(1000)
    s_mid = page.evaluate(READ_DB)
    gained = seconds_today(s_mid) - secs1
    check("Refresh saat timer berjalan: waktu tetap tersimpan", gained >= 7, f"+{gained} detik dari 12")
    secs1 = seconds_today(s_mid)
    page.screenshot(path=str(OUT / "02-dashboard-cover.png"), full_page=True)
    ctx.close()

    # ---------- 3. server mati: benar-benar offline ----------
    stop_server(server)
    ctx = launch(p, COVER)
    ctx.set_offline(True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    expect(page.get_by_text("Budi", exact=False).first).to_be_visible(timeout=10000)
    check("Aplikasi terbuka tanpa server & tanpa internet (setelah browser ditutup)", True)
    expect(page.get_by_text("offline — semua fitur inti tetap jalan")).to_be_visible()
    check("Indikator offline tampil", True)
    s2 = page.evaluate(READ_DB)
    check("Profil & menit tetap ada setelah restart", seconds_today(s2) == secs1 and s2["profile"][0]["name"] == "Budi", f"{seconds_today(s2)} detik")

    page.get_by_role("link", name="Belajar").click()
    expect(page.get_by_text("Bulan 1 · Fondasi").first).to_be_visible()
    check("Kurikulum terbuka offline (dari cache)", True)
    page.screenshot(path=str(OUT / "03-learn-offline-cover.png"), full_page=True)

    # ---------- 4. belajar saat offline ----------
    page.get_by_role("link", name="Beranda").click()
    page.get_by_role("button", name="Lanjutkan").or_(page.get_by_role("button", name="Mulai belajar")).click()
    page.wait_for_timeout(16_500)
    page.get_by_role("button", name="Jeda").click()
    page.wait_for_timeout(800)
    s3 = page.evaluate(READ_DB)
    check("Menit belajar offline tersimpan", seconds_today(s3) >= secs1 + 15, f"{seconds_today(s3)} detik total")

    page.get_by_role("link", name="AI Tutor").click()
    expect(page.get_by_text("Anda sedang offline. AI Tutor (Claude) butuh internet.")).to_be_visible()
    check("AI Tutor memberi tahu butuh internet saat offline", True)

    # ---------- 5. backup & restore (offline) ----------
    page.goto(URL + "#/settings")
    with page.expect_download() as dl:
        page.get_by_role("button", name="Unduh backup sekarang").click()
    path = OUT / dl.value.suggested_filename
    dl.value.save_as(str(path))
    data = json.loads(path.read_text())
    check("Backup terunduh & valid", data["app"] == "english-mastery" and data["counts"]["profile"] == 1 and data["counts"]["daily_log"] >= 1,
          f"{path.name}, {len(path.read_bytes())} byte")

    # ubah nama, lalu restore backup -> nama kembali 'Budi'
    page.get_by_label("Nama panggilan").fill("Nama Lain")
    page.get_by_role("button", name="Simpan nama").click()
    page.wait_for_timeout(500)
    page.locator("input[type=file]").set_input_files(str(path))
    expect(page.get_by_text("Ganti semua data dengan backup ini?")).to_be_visible()
    with page.expect_download() as safety:
        page.get_by_role("button", name="Ya, restore").click()
    expect(page.get_by_text("Restore berhasil", exact=False)).to_be_visible()
    s4 = page.evaluate(READ_DB)
    check("Restore mengembalikan data", s4["profile"][0]["name"] == "Budi" and seconds_today(s4) == seconds_today(s3))
    check("Backup cadangan otomatis dibuat sebelum restore", safety.value.suggested_filename.endswith(".json"))
    check("Waktu backup terakhir tetap tercatat setelah restore", s4["profile"][0]["lastBackupAt"] is not None)
    expect(page.get_by_text("Backup terakhir: belum pernah")).to_have_count(0)
    page.screenshot(path=str(OUT / "04-settings-cover.png"), full_page=True)
    ctx.close()

    # ---------- 6. layar dalam Fold 7 ----------
    ctx = launch(p, INNER)
    ctx.set_offline(True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(URL)
    expect(page.get_by_text("Budi", exact=False).first).to_be_visible(timeout=10000)
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "05-dashboard-inner.png"), full_page=True)
    page.get_by_role("link", name="Belajar").click()
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "06-learn-inner.png"), full_page=True)
    ctx.close()

    check("Tidak ada error JavaScript", not errors, "; ".join(errors[:3]))

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} lulus")
sys.exit(1 if failed else 0)
