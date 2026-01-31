from playwright.sync_api import sync_playwright

def verify_mobile_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # iPhone X viewport
        page = browser.new_page(viewport={"width": 375, "height": 812}, device_scale_factor=3)

        page.goto("http://localhost:8000")

        # Wait for app to load (checking for 3D View placeholder)
        page.wait_for_selector("#view-3d-placeholder")

        # Wait a bit for 3D rendering (though capturing exact 3D content isn't critical, layout is)
        page.wait_for_timeout(2000)

        # Screenshot Top (View + Toggle)
        page.screenshot(path="verification/mobile_top.png")

        # Scroll down to see Controls
        page.evaluate("window.scrollBy(0, 500)")
        page.wait_for_timeout(500)

        # Screenshot Bottom (Controls)
        page.screenshot(path="verification/mobile_bottom.png")

        # Screenshot full page? Playwright full_page might work if body scrolls
        # But we made a div scrollable. "body" has overflow hidden.
        # We need to target the scrollable div.
        # The scrollable div is the one with class "overflow-y-auto"
        # We can find it by class or structure.
        scrollable_div = page.locator(".overflow-y-auto").first

        # Take screenshot of the scrollable container (if possible, but scrolling manually is safer for "what user sees")

        print("Screenshots taken.")
        browser.close()

if __name__ == "__main__":
    verify_mobile_layout()
