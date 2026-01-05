from fastapi import FastAPI, UploadFile, File, HTTPException, Query, status
from fastapi.responses import JSONResponse, HTMLResponse
from pathlib import Path
from werkzeug.utils import safe_join

app = FastAPI(docs_url=None, redoc_url=None)

BASE_DIR = Path(__file__).resolve().parent
CALC_DIR = BASE_DIR / "calculations"
CALC_DIR.mkdir(exist_ok=True)

ALLOWED_CHARS = set("0123456789+-*/ \t\n\r")

def is_valid_expression(text: str) -> bool:
    return bool(text) and all(ch in ALLOWED_CHARS for ch in text)

def get_calc_path(filename: str) -> Path:
    joined = safe_join(str(CALC_DIR), filename)
    if joined is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path.",
        )
    return Path(joined)

@app.get("/", response_class=HTMLResponse)
def main():
    index_path = BASE_DIR / "static" / "index.html"
    if not index_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="index.html not found.",
        )
    return HTMLResponse(content=index_path.read_text(encoding="utf-8"))

@app.get("/files")
def list_files():
    files = [p.name for p in CALC_DIR.iterdir() if p.is_file()]
    files.sort()
    return {"files": files}

@app.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_calculation(file: UploadFile = File(...)):
    original_name = file.filename

    if not original_name.lower().endswith(".py"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .py files are allowed.",
        )

    target_path = get_calc_path(original_name)

    file_bytes = file.file.read()

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    try:
        content = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 text.",
        )

    if not is_valid_expression(content):
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File contains characters other than digits and + - * /",
        )

    return {
        "message": "File uploaded and validated.",
        "filename": original_name,
    }

@app.get("/calculate")
def calculate(
    filename: str = Query(..., description="Filename of the uploaded .py file"),
):
    target_path = get_calc_path(filename)

    if not target_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    content = target_path.read_text(encoding="utf-8")
    expression = content.strip()

    try:
        result = eval(expression)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error evaluating expression: {exc}",
        )

    return JSONResponse({"expression": expression, "result": result})
