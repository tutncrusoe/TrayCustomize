
from playwright.sync_api import sync_playwright
import time

def verify_materials():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the local server
        page.goto("http://localhost:8000")

        # Wait for the canvas to load and the tutorial to potentially appear
        time.sleep(2)

        # Take a screenshot of the initial state (which should now be the new 'white' theme)
        page.screenshot(path="verification/material_check.png")

        print("Screenshot taken at verification/material_check.png")
        browser.close()

if __name__ == "__main__":
    verify_materials()
