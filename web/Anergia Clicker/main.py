import io
import ipaddress
import json
import os
import secrets
import sqlite3
from base64 import b64decode, b64encode
from urllib.parse import urlparse
import itsdangerous
import requests as http_client
from PIL import Image
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

FLAG           = os.environ.get("FLAG",           "ECSC_GR{t3st_fl4g_r3pl4c3_m3}")
ADMIN_PASSWORD = secrets.token_urlsafe(16)
SESSION_SECRET = os.environ.get("SESSION_SECRET", secrets.token_hex(32))
DB_PATH        = os.environ.get("DB_PATH",        "challenge.db")

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT UNIQUE NOT NULL,
            password     TEXT NOT NULL,
            display_name TEXT NOT NULL,
            score        INTEGER NOT NULL DEFAULT 0,
            avatar       TEXT DEFAULT NULL,
            created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.execute("DELETE FROM users WHERE username='administrator'")
    conn.execute(
        "INSERT INTO users (username, password, display_name, score) VALUES (?,?,?,?)",
        ("administrator", ADMIN_PASSWORD, "adm1n", 6742069),
    )
    conn.commit()
    conn.close()
    print(f"[*] Admin password: {ADMIN_PASSWORD}", flush=True)


init_db()


def current_user(request: Request):
    uid = request.session.get("user_id")
    if not uid:
        return None
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def _host_is_allowed(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return False
    try:
        addr = ipaddress.ip_address(host)
        return not (addr.is_loopback or addr.is_private or addr.is_link_local)
    except ValueError:
        return host.lower() not in ("localhost",)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return RedirectResponse("/game" if current_user(request) else "/login")


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    if current_user(request):
        return RedirectResponse("/game")
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login", response_class=HTMLResponse)
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM users WHERE username=? AND password=?", (username, password)
    ).fetchone()
    conn.close()
    if not row:
        return templates.TemplateResponse(
            "login.html", {"request": request, "error": "Invalid credentials."}
        )
    request.session["user_id"] = row["id"]
    return RedirectResponse("/game", status_code=302)


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    if current_user(request):
        return RedirectResponse("/game")
    return templates.TemplateResponse("register.html", {"request": request})


@app.post("/register", response_class=HTMLResponse)
async def register(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    display_name: str = Form(...),
):
    if len(username) > 32 or len(display_name) > 32 or len(password) > 128:
        return templates.TemplateResponse(
            "register.html", {"request": request, "error": "Field too long."}
        )
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (username, password, display_name) VALUES (?,?,?)",
            (username, password, display_name),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return templates.TemplateResponse(
            "register.html", {"request": request, "error": "Username already taken."}
        )
    row = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
    conn.close()
    request.session["user_id"] = row["id"]
    return RedirectResponse("/game", status_code=302)


@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/login")


@app.get("/game", response_class=HTMLResponse)
async def game_page(request: Request):
    user = current_user(request)
    if not user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("game.html", {"request": request, "user": user})


@app.get("/game/score")
async def game_score(request: Request, score: int, session: str):
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1"):
        raise HTTPException(status_code=404)
    try:
        signer  = itsdangerous.TimestampSigner(SESSION_SECRET)
        raw     = signer.unsign(session, max_age=14 * 24 * 60 * 60, return_timestamp=False)
        payload = json.loads(b64decode(raw))
        user_id = payload["user_id"]
    except Exception:
        raise HTTPException(status_code=401)
    conn = get_db()
    new_score = max(0, min(score, 6742069))
    conn.execute("UPDATE users SET score=? WHERE id=?", (new_score, user_id))
    conn.commit()
    conn.close()
    return JSONResponse({"score": new_score})


@app.post("/profile/picture")
async def set_profile_picture(request: Request):
    user = current_user(request)
    if not user:
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid request"}, status_code=400)

    url = str(data.get("url", "")).strip()
    if not url:
        return JSONResponse({"error": "url required"}, status_code=400)

    if not _host_is_allowed(url):
        return JSONResponse({"error": "private addresses not allowed"}, status_code=400)

    try:
        resp = http_client.get(url, timeout=5, allow_redirects=False)
        img = Image.open(io.BytesIO(resp.content))
        img = img.resize((128, 128))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        avatar = b64encode(buf.getvalue()).decode()
    except Exception:
        return JSONResponse({"error": "failed to fetch or process image"}, status_code=400)

    conn = get_db()
    conn.execute("UPDATE users SET avatar=? WHERE id=?", (avatar, user["id"]))
    conn.commit()
    conn.close()
    return JSONResponse({"ok": True, "avatar": avatar})


@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    user = current_user(request)
    if not user:
        return RedirectResponse("/login")
    return templates.TemplateResponse("settings.html", {"request": request, "user": user})


@app.post("/settings", response_class=HTMLResponse)
async def settings_update(
    request: Request,
    display_name: str = Form(default=""),
    password: str = Form(default=""),
):
    user = current_user(request)
    if not user:
        return RedirectResponse("/login")

    conn = get_db()
    if display_name:
        conn.execute(
            "UPDATE users SET display_name=? WHERE id=?",
            (display_name[:32], user["id"]),
        )
    if password:
        conn.execute(
            "UPDATE users SET password=? WHERE id=?",
            (password[:128], user["id"]),
        )
    conn.commit()
    conn.close()

    user = current_user(request)
    return templates.TemplateResponse(
        "settings.html", {"request": request, "user": user, "success": True}
    )


@app.get("/users", response_class=HTMLResponse)
async def users_page(request: Request):
    user = current_user(request)
    if not user:
        return RedirectResponse("/login")

    conn = get_db()
    rows = conn.execute(
        "SELECT username, display_name, avatar, created_at FROM users ORDER BY created_at ASC"
    ).fetchall()
    conn.close()
    return templates.TemplateResponse(
        "users.html",
        {"request": request, "user": user, "users": [dict(r) for r in rows]},
    )


@app.get("/scoreboard", response_class=HTMLResponse)
async def scoreboard_page(request: Request):
    user = current_user(request)
    if not user:
        return RedirectResponse("/login")

    conn = get_db()
    rows = conn.execute(
        "SELECT id, display_name, score FROM users ORDER BY score DESC, display_name ASC, password ASC"
    ).fetchall()
    conn.close()

    entries = [dict(r) for r in rows]
    return templates.TemplateResponse(
        "scoreboard.html",
        {
            "request": request,
            "user": user,
            "entries": entries,
            "current_user_id": user["id"],
        },
    )


@app.get("/vault", response_class=HTMLResponse)
async def vault_page(request: Request):
    user = current_user(request)
    if not user:
        return RedirectResponse("/login")
    if user["username"] != "administrator":
        raise HTTPException(status_code=403, detail="Forbidden")
    return templates.TemplateResponse(
        "vault.html", {"request": request, "user": user, "flag": FLAG}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=6767, reload=False)
