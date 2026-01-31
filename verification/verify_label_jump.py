import sys
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

def start_server():
    server_address = ('', 8083)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    print("Serving on port 8083...")
    httpd.serve_forever()

def run_test():
    thread = threading.Thread(target=start_server)
    thread.daemon = True
    thread.start()
    time.sleep(2)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 900})

        url = "http://localhost:8083/index.html"
        print(f"Navigating to {url}")

        try:
            page.goto(url)
            page.wait_for_timeout(2000)

            top_view_box = page.locator("#view-top-placeholder").bounding_box()
            print(f"Top View Box: {top_view_box}")

            # Identify labels. Assuming start is 120x120.
            # There are two '120' labels.
            labels = page.locator("#dim-container .dim-label:has-text('120')").all()
            if len(labels) < 2:
                print("Error: Expected 2 labels with text '120'")
                return

            # Click the first one (arbitrary, say Length)
            target_label = labels[0]
            print("Clicking a 120 label...")
            target_label.click()

            input_box = page.locator("#global-dim-input")
            input_box.wait_for(state="visible")
            input_box.fill("280")
            page.keyboard.press("Enter")

            page.wait_for_timeout(1000)

            # Now, one label is 280, the other is 120.
            # We want to check the position of the REMAINING '120' label.
            # This corresponds to the Width dimension (which didn't change),
            # but its X position depends on Length (-L/2).

            remaining_120 = page.locator("#dim-container .dim-label:has-text('120')").first
            if not remaining_120.is_visible():
                print("Error: Remaining 120 label not visible")
                return

            label_box = remaining_120.bounding_box()
            print(f"Remaining 120 Label Box: {label_box}")

            label_cx = label_box['x'] + label_box['width']/2
            top_view_left = top_view_box['x']

            print(f"Label Center X: {label_cx}")
            print(f"Top View Left X: {top_view_left}")

            # If label is to the left of the view container, it jumped.
            if label_cx < top_view_left:
                print("VERIFICATION RESULT: FAIL - Label is to the left of Top View (likely in 3D View area).")
            else:
                print("VERIFICATION RESULT: PASS - Label is inside Top View.")

            page.screenshot(path="verification/label_jump_repro.png")

        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    run_test()
