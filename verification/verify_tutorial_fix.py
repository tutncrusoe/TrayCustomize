from playwright.sync_api import sync_playwright
import time

def test_tutorial():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8000/")

        # Wait for 3D model to render and tutorial to start
        page.wait_for_selector("#tut-blob", state="visible", timeout=10000)

        # Step 0: Initial state (Set Length)
        # Give it a moment to position
        time.sleep(1)
        page.screenshot(path="verification/step0_fix.png")

        # We need to verify that arrow is hidden and left position is NOT based on rect.left
        arrow_opacity = page.evaluate("document.getElementById('tut-arrow').style.opacity")
        print(f"Step 0 Arrow opacity: {arrow_opacity}")

        blob_left = page.evaluate("document.getElementById('tut-blob').style.left")
        print(f"Step 0 Blob left: {blob_left}")

        browser.close()

if __name__ == "__main__":
    test_tutorial()
