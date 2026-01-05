from fastapi import FastAPI, File, UploadFile, Response, status
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import subprocess
import uuid

app = FastAPI(docs_url=None, redoc_url=None)

uploadDir = "./uploads"
Path(uploadDir).mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=uploadDir, follow_symlink=True), name="uploads")

@app.post("/upload")
def upload_file(response: Response, file: UploadFile | None = None):
    if not file:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"message": "Please upload a file :("}
    else:
        if not file.filename.endswith(".zip"):
            response.status_code = status.HTTP_400_BAD_REQUEST
            return {"message": "Sorry, only zip files allowed."}
        targetDir = str(uuid.uuid4())
        filename = targetDir + ".zip"
        filepath = uploadDir + filename 
        with open(filepath, "wb") as f:
            f.write(file.file.read())
        try:
            subprocess.call(["unzip", filepath, "-d", f"{uploadDir}/{targetDir}"])
            tree = subprocess.check_output(["tree", f"{uploadDir}/{targetDir}"])
            return {"message": f"Uploaded and extracted zip at: {uploadDir}/{targetDir}", "tree":tree}
        except:
            response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            return {"message": f"Failed to extract zip :("}

app.mount("/", StaticFiles(directory="static", html=True), name="static")