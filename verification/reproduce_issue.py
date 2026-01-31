import sys
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

# Start a simple HTTP server to serve the project files
def start_server():
    # Serve from the current directory (repo root)
    server_address = ('', 8081) # Use 8081 to avoid conflict with potential 8000
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    print("Serving on port 8081...")
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

        url = "http://localhost:8081/verification/reproduce_issue.html"
        print(f"Navigating to {url}")
        try:
            page.goto(url)

            # Wait for module to load and function to be defined
            page.wait_for_timeout(1000)

            result = page.evaluate("window.runGeometryTest()")
            print("X Coordinates found:", result)

            # Check for the bug
            # Buggy: +/- 45 (for 50 outer).
            # Fixed: +/- 40.

            # Note: 50 might be slightly off due to bevels/curves if not careful, but flat wall should be exact.

            has_buggy_inner = any(abs(abs(x) - 45.0) < 0.1 for x in result)
            has_correct_inner = any(abs(abs(x) - 40.0) < 0.1 for x in result)

            if has_buggy_inner:
                print("VERIFICATION RESULT: BUG_CONFIRMED (Inner wall at +/- 45.0)")
            elif has_correct_inner:
                print("VERIFICATION RESULT: FIXED (Inner wall at +/- 40.0)")
            else:
                print("VERIFICATION RESULT: INCONCLUSIVE (Unexpected coordinates)")

        except Exception as e:
            print(f"Error: {e}")

        finally:
            browser.close()
            # Server will die with the script

if __name__ == "__main__":
    run_test()
