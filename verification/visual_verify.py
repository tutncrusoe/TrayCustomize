import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

def start_server():
    server_address = ('', 8082)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    httpd.serve_forever()

def run_visual_verify():
    thread = threading.Thread(target=start_server)
    thread.daemon = True
    thread.start()
    time.sleep(2)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 720})

        # Load the main app
        page.goto("http://localhost:8082/index.html")

        # Wait for 3D view to load (canvas)
        page.wait_for_selector("canvas", state="visible")

        # Wait a bit for rendering
        page.wait_for_timeout(2000)

        # Take screenshot
        path = "verification/fixed_wall_thickness.png"
        page.screenshot(path=path)
        print(f"Screenshot saved to {path}")

        browser.close()

if __name__ == "__main__":
    run_visual_verify()
