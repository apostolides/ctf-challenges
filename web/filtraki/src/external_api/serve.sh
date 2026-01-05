#!/bin/sh

# Serve application
fastapi run app.py --port $EXTERNAL_APP_PORT
