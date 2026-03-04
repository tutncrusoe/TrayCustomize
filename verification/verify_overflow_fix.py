import sys
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

# Start a simple HTTP server to serve the project files
def start_server():
    # Serve from the current directory (repo root)
    # Use a different port to avoid conflicts
    server_address = ('', 8082)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    print("Serving on port 8082...")
    httpd.serve_forever()

def run_test():
    # Start server in background
    thread = threading.Thread(target=start_server)
    thread.daemon = True
    thread.start()

    # Give it a moment to start
    time.sleep(2)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Set viewport large enough for desktop view to ensure Top View is visible
        page.set_viewport_size({"width": 1280, "height": 800})

        url = "http://localhost:8082/index.html"
        print(f"Navigating to {url}")

        try:
            page.goto(url)
            page.wait_for_timeout(2000) # Wait for init

            # Get initial frustum size
            initial_frustum = page.evaluate("window.app.sceneManager.frustumSize")
            print(f"Initial Frustum Size: {initial_frustum}")

            # Find a dimension label in Top View (value 120)
            # The top view labels are in #dim-container
            label = page.locator("#dim-container .dim-label:has-text('120')").first

            if not label.is_visible():
                print("Error: Could not find Top View dimension label '120'")
                return

            print("Clicking label...")
            label.click()

            # Wait for input
            input_box = page.locator("#global-dim-input")
            input_box.wait_for(state="visible")

            print("Typing 280...")
            input_box.fill("280")
            page.keyboard.press("Enter")

            # Wait a tiny bit for the sync events to propagate if any
            page.wait_for_timeout(100)

            # Get new frustum size
            new_frustum = page.evaluate("window.app.sceneManager.frustumSize")
            print(f"New Frustum Size: {new_frustum}")

            # Check logic
            # For 120mm, frustum is ~252.
            # For 280mm, frustum should be ~476 (280 + 60 padding * 1.4)

            if new_frustum > 350:
                print("VERIFICATION RESULT: PASS - Camera zoomed out.")
            else:
                print(f"VERIFICATION RESULT: FAIL - Frustum size {new_frustum} is too small for 280mm object (Overflow!)")

            page.screenshot(path="verification/overflow_fix.png")
            print("Screenshot saved to verification/overflow_fix.png")

        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    run_test()
