#!/usr/bin/env python3
# CTF Challenge

import os
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from pydantic import BaseModel
import random
import time

random.seed(time.time_ns())

class Prediction(BaseModel):
    value: int

app = FastAPI(docs_url=None, redoc_url=None)

app.mount("/static", StaticFiles(directory="static"), name="static")

# Load flag from file if exists
flag = 'FLAG{example-flag}'
if os.path.isfile('flag.txt'):
	with open('flag.txt', 'r') as f:
		flag = f.read().strip()

@app.post("/roll")
async def predict(prediction: Prediction):
    roll = random.getrandbits(32)
    if prediction.value == roll:
        return {"prediction":"succeeded", "real_value":roll, "your_prediction":prediction.value, "flag":flag}
    else:
        return {"prediction":"failed", "real_value":roll, "your_prediction":prediction.value}

@app.get("/", response_class=HTMLResponse)
async def index():
    return """
        <html>
            <head>
                <title>Le Super Predictor</title>
                <link rel="stylesheet" href="static/styles.css">
                <script defer src="static/main.js"></script>
            </head>
            <body>
                <center>
                    <h1>Predict the next <b>random</br> roll for eternal glory!</h1>
                    <img src="/static/dice.png">
                </center>
                <br>
                <div class="centered-container">
                    Prediction:
                    <input id="prediction-input" type="text" />
                    <button id="prediction-btn">Predict</button>
                </div>
                <br>
                <center>
                    <div id="results"></div>
                </center>
            </body>
        </html>
    """