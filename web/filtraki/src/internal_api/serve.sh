#!/bin/sh

# Serve application
fastapi run app.py --port $INTERNAL_APP_PORT
