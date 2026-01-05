#!/usr/bin/env python3
# CTF Challenge

from fastapi.responses import HTMLResponse
from urllib.parse import urlparse
from fastapi import FastAPI, Request
from pydantic import BaseModel
import requests as r
import socket
import ipaddress
import os

class Host(BaseModel):
    hostname: str

app = FastAPI(docs_url=None, redoc_url=None)

flag = 'FLAG{example-flag}'
if os.path.isfile('flag.txt'):
	with open('flag.txt', 'r') as f:
		flag = f.read().strip()

def secureFetch(target):
    try:
        o = urlparse(target)
        if o.scheme not in ["http", "https"]:
            return {"response":"Invalid schema!"}
        ip = socket.gethostbyname(o.hostname)
        if ipaddress.ip_address(ip).is_private:
            return {"response":"You shall not pass..."}
        resp = r.get(target, timeout=(3, 27), allow_redirects=False).text
        return {"response": resp}
    except Exception as e:
        print(e)
        return {"response": "Something went wrong with your request..."}

@app.get("/flag")
def pepe(request: Request):
    if request.client.host not in ["127.0.0.1", "::1"]:
        return {"response":"nah ah"}
    return {"flag":flag}

@app.post("/fetcher")
def fetcher(host: Host):
    target = host.hostname
    return secureFetch(target)    

@app.get("/", response_class=HTMLResponse)
def index():
    return """
        <html>
            <head>
                <title>Nothing here...</title>
            </head>
            <body>
                <center>
                    <h1>No for real, there is nothing here.</h1>
                </center>
            </body>
        </html>
    """