from fastapi import FastAPI, Response, HTTPException
from pydantic import BaseModel
from guard.middleware import SecurityMiddleware
from guard.models import SecurityConfig
from guard.decorators import SecurityDecorator
from bot import visit
import time

app = FastAPI()

start_time = time.time()

class NoteModel(BaseModel):
    note: str

class VisitIDModel(BaseModel):
    id: int

notes = [
    {"id": 1, "content": "https://www.youtube.com/shorts/wiSwW5G3BrM"}
]

config = SecurityConfig(auto_ban_threshold=5, auto_ban_duration=5)
guard = SecurityDecorator(config)
app.add_middleware(SecurityMiddleware, config=config)
app.state.guard = guard

@app.post("/note")
async def create_note(data: NoteModel):
    new_id = len(notes) + 1

    note_entry = {
        "id": new_id,
        "content": data.note
    }

    notes.append(note_entry)

    return {"status": "saved", "id": new_id}

@app.get("/note/{note_id}")
async def render_note(note_id: int):

    index = note_id - 1

    if index < 0 or index >= len(notes):
        raise HTTPException(status_code=404, detail="Note not found")

    note = notes[index]

    html = f"""
    <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    margin: 0;
                    padding: 0;
                    background-image: url('https://blob.gifcities.org/gifcities/3ZJ2TBAHTYSUHBHTMSAQIDAUWEUJAPEZ.gif');
                    background-repeat: repeat;
                    background-size: auto;
                    font-family: Arial, Helvetica, sans-serif;
                    height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                }}

                .overlay {{
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.35);
                    z-index: 1;
                }}

                .container {{
                    position: relative;
                    z-index: 2;
                    background: rgba(255, 255, 255, 0.85);
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.3);
                    width: 600px;
                    text-align: center;
                }}

                textarea {{
                    width: 100%;
                    height: 250px;
                    font-size: 16px;
                    padding: 10px;
                    border-radius: 8px;
                    border: 1px solid #aaa;
                    resize: none;
                }}

                h1 {{
                    margin-top: 0;
                }}
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <div class="container">
                <h1>Note {note_id}</h1>
                <textarea readonly>{note["content"]}</textarea>
            </div>
        </body>
    </html>
    """

    return Response(content=html, media_type="text/html")


@app.get("/status")
async def status():
    uptime_seconds = int(time.time() - start_time)

    req_file = "./requirements.txt"
    with open(req_file, "r") as f:
        requirements = [line.strip() for line in f.readlines() if line.strip()]

    return {
        "uptime_seconds": uptime_seconds,
        "uptime_human": f"{uptime_seconds // 3600}h {uptime_seconds % 3600 // 60}m {uptime_seconds % 60}s",
        "requirements": requirements
    }

@app.post("/report")
def report_link_to_admins(data: VisitIDModel):
    note_id = data.id
    link = f"http://127.0.0.1:8000/note/{note_id}"

    result = visit(link)
    if result:
        return {"status": "visited page successfully.", "link": link}

    return {"status": "failed to visit page.", "link": link}

@app.get("/")
async def under_construction():
    html = """
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                margin: 0;
                padding: 0;
                background: #111;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                font-family: Arial, Helvetica, sans-serif;
                color: white;
                text-align: center;
            }}
            h1 {{
                margin-bottom: 20px;
                font-size: 32px;
            }}
            img {{
                width: 300px;
            }}
        </style>
    </head>
    <body>
        <center>
            <h1>Notes App Under Construction</h1>
            <img src="https://media.tenor.com/MRCIli40TYoAAAAj/under-construction90s-90s.gif">
        </center>
    </body>
    </html>
    """
    return Response(content=html, media_type="text/html")
