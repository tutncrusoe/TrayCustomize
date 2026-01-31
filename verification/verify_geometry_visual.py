from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 800})

    # Load app
    print("Loading app...")
    page.goto("http://localhost:8080")
    page.wait_for_selector("#main-canvas")

    # Wait for inputs
    print("Waiting for inputs...")
    page.wait_for_selector("#radius")

    # Set dimensions: Radius=10, Wall=10.
    print("Setting dimensions...")
    page.evaluate("""
        const r = document.getElementById('radius');
        r.value = 10;
        r.dispatchEvent(new Event('input'));

        const w = document.getElementById('wall-thickness');
        w.value = 10;
        w.dispatchEvent(new Event('input'));
    """)
    page.wait_for_timeout(2000) # Wait for render

    # Take screenshot
    print("Taking screenshot...")
    page.screenshot(path="verification/geometry_visual.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
