import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from time import sleep
from dotenv import load_dotenv

load_dotenv()
FLAG = os.getenv("FLAG")

def visit(url):
    options = Options()
    options.binary_location = "/usr/bin/chromium"
    options.add_argument('--headless')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-software-rasterizer')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument("--disable-dev-tools")
    options.add_argument('--no-sandbox')
    options.add_argument('--js-flags=--noexpose_wasm,--jitless')

    prefs = {
        "download_restrictions": 3,
        "safebrowsing.enabled": "true"
    }

    options.add_experimental_option("prefs", prefs)
    service = Service("/usr/bin/chromedriver")

    driver = webdriver.Chrome(service=service, options=options)

    try:

        print(f"Visiting http://127.0.0.1:8000/")

        driver.get("http://127.0.0.1:8000/")

        print("Adding FLAG cookie")

        driver.add_cookie({
            "name": "FLAG",
            "value": FLAG,
            "path": "/",
            "domain": "127.0.0.1"
        })

        print(f"Visiting {url}")
        driver.get(url)
        sleep(3)
        print("Visited successfully")

        driver.close()
        driver.quit()

    except Exception as e:
        print(e)
        return False

    return True
