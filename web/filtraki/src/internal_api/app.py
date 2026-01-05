from fastapi import FastAPI, Response 
import os

app = FastAPI(docs_url=None, redoc_url=None)

FLAG = "FLAG{this_is_an_example_flag}"
if os.path.isfile('flag.txt'):
	with open('flag.txt', 'r') as f:
		FLAG = f.read().strip()

@app.get("/flag.txt")
def le_flag(response: Response):
    return {"message": FLAG}
