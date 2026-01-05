from fastapi import FastAPI, Response, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import requests

app = FastAPI(docs_url=None, redoc_url=None)

class URL(BaseModel):
    url_value: str

def has_dot(s):
    return '.' in s

def is_localhost(s):
    return 'localhost' in s.lower()

@app.post("/fetch")
def fetch_file(response: Response, url: URL):
    if not url:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"message": "Please provide url :("}
    else:
        try:
            target = url.url_value

            # Temporary block access to 127.0.0.1 and localhost
            if(has_dot(target) or is_localhost(target)):
                response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
                return {"message": f"I don't like your intentions..."}

            resp = requests.get(target, allow_redirects=False, timeout=3)
            return {"message": resp.content}
        except Exception as e:
            print(e)
            response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            return {"message": f"Failed to fetch with provided url."}


@app.get("/", response_class=HTMLResponse)
def serve_ui():
    return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>i fetch stof</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #1e1e1e;
                    color: #eee;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin-top: 60px;
                }
                .box {
                    background: #2b2b2b;
                    padding: 25px;
                    border-radius: 8px;
                    width: 420px;
                    box-shadow: 0 0 10px #000;
                }
                input {
                    width: 100%;
                    padding: 8px;
                    font-size: 14px;
                    border-radius: 4px;
                    border: none;
                    margin-bottom: 12px;
                }
                button {
                    padding: 10px 15px;
                    background: #1976d2;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                    font-size: 14px;
                }
                button:hover {
                    background: #0f5ba5;
                }
                pre {
                    background: #111;
                    padding: 15px;
                    margin-top: 20px;
                    width: 420px;
                    border-radius: 6px;
                    color: #0f0;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
            </style>
        </head>
        <body>

        <div class="box">
            <h2>Resource Fetcher</h2>
            <h4>(disabled for security reasons, brb)</h4>
            <p>Enter a URL</p>
            <input id="urlInput" type="text" placeholder="">
            <button onclick="sendRequest()">Fetch</button>
        </div>

        <pre id="output">nop</pre>

        <script>
        async function sendRequest() {
            const urlVal = document.getElementById("urlInput").value;
            const output = document.getElementById("output");
            output.textContent = "Loading...";

            try {
                output.textContent = "...";
                const res = await fetch("/fetch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url_value: urlVal })
                });

                const data = await res.json();
                output.textContent = JSON.stringify(data, null, 2);

            } catch (err) {
                output.textContent = "Error communicating with backend.";
            }
        }
        </script>

        </body>
        </html>
    """
