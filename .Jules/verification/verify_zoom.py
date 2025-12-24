from playwright.sync_api import sync_playwright, expect
import time

def verify_zoom():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Load the page
        page.goto("http://localhost:8000/index.html")
        time.sleep(1) # wait for init

        # Capture initial state
        print("Capturing initial state...")
        page.screenshot(path=".Jules/verification/zoom_initial.png")

        # Helper to get input value
        def get_val(id):
            return float(page.input_value(f"#{id}"))

        # 1. Change L by 10% (120 -> 130). Diff 10/120 = 8.3%. Should NOT zoom.
        # Initial zoom was based on 120.
        print("Changing L to 130 (small change)...")
        page.fill("#dim-l", "130")
        page.keyboard.press("Enter")
        time.sleep(1) # wait for transition
        page.screenshot(path=".Jules/verification/zoom_step1.png")

        # Check lastZoomedMaxDim - access directly
        last_zoomed_1 = page.evaluate("lastZoomedMaxDim")
        print(f"Last Zoomed Max Dim after 130: {last_zoomed_1}")
        # Expected: 120 (initial), because 130 didn't trigger zoom.

        # 2. Change L to 150 (Total from 120 is 30/120 = 25%). Should ZOOM.
        print("Changing L to 150 (large change)...")
        page.fill("#dim-l", "150")
        page.keyboard.press("Enter")
        time.sleep(1)
        page.screenshot(path=".Jules/verification/zoom_step2.png")

        last_zoomed_2 = page.evaluate("lastZoomedMaxDim")
        print(f"Last Zoomed Max Dim after 150: {last_zoomed_2}")

        if last_zoomed_2 == 150:
            print("SUCCESS: lastZoomedMaxDim updated to 150")
        elif last_zoomed_2 == 130:
             print("FAILURE: Updated to 130? That implies it zoomed on 130 step.")
        elif last_zoomed_2 == 120:
             print("FAILURE: Still 120. Did not zoom.")
        else:
             print(f"FAILURE: Unexpected value {last_zoomed_2}")

        browser.close()

if __name__ == "__main__":
    verify_zoom()
