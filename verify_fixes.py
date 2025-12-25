
from playwright.sync_api import sync_playwright
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 720})

        # Open page
        page.goto("http://localhost:8000")

        # Ensure tutorial starts (clear session storage if needed, though clean profile usually empty)
        page.evaluate("sessionStorage.clear()")
        page.reload()

        # Wait for tutorial to appear
        page.wait_for_selector("#tutorial-overlay")
        time.sleep(1) # Wait for fade in

        # Step 1: Set Length (Default start)
        # Capture screenshot for text overlap check
        if not os.path.exists("verification"):
            os.makedirs("verification")

        page.screenshot(path="verification/step1_fix.png")
        print("Captured step1_fix.png")

        # Jump to Step 3: Horizontal Divider (Right Edge)
        # In JS: tutorial.showStep(3)
        page.evaluate("tutorial.showStep(3)")
        time.sleep(1) # Wait for animation/positioning
        page.screenshot(path="verification/step2_horizontal_fix.png")
        print("Captured step2_horizontal_fix.png")

        # Jump to Step 4: Vertical Divider (Bottom Edge)
        # In JS: tutorial.showStep(4)
        page.evaluate("tutorial.showStep(4)")
        time.sleep(1)
        page.screenshot(path="verification/step2_vertical_fix.png")
        print("Captured step2_vertical_fix.png")

        browser.close()

if __name__ == "__main__":
    run()
