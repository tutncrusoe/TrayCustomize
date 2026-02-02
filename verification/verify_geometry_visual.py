
from playwright.sync_api import sync_playwright
import time

def verify_geometry(page):
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

    page.goto("http://localhost:8000")

    # Wait for store
    try:
        page.wait_for_function("() => window.store !== undefined", timeout=5000)
    except:
        print("Timeout waiting for window.store. Checking window properties...")
        page.evaluate("() => console.log('Window keys:', Object.keys(window))")

    # Setup state: Ring Room with Center Island
    page.evaluate("""() => {
        if (!window.store) {
            console.error("Window.store is missing!");
            return;
        }
        window.store.setDimensions({ l: 120, w: 120, h: 40, radius: 8, wallThickness: 2 });
        window.store.updateDividers('x', [-20, 20]);
        window.store.updateDividers('z', [-20, 20]);

        const hidden = {
            'X_0_0': true, 'X_1_0': true, 'X_0_2': true, 'X_1_2': true,
            'Z_0_0': true, 'Z_1_0': true, 'Z_0_2': true, 'Z_1_2': true
        };
        window.store.setHiddenSegments(hidden);
    }""")

    # Wait for render updates (animations etc)
    time.sleep(2)

    # Take screenshot
    page.screenshot(path="verification/geometry_visual.png")
    print("Screenshot saved to verification/geometry_visual.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_geometry(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
