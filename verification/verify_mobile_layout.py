import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # Emulate iPhone 12 Pro (390x844)
    device = playwright.devices['iPhone 12 Pro']
    context = browser.new_context(**device)
    page = context.new_page()

    print("Navigating to app...")
    page.goto("http://localhost:8000")

    # Wait for the app to load
    print("Waiting for canvas...")
    page.wait_for_selector("#main-canvas")

    # Wait for 3D view wrapper
    print("Waiting for 3D wrapper...")
    page.wait_for_selector("#view-3d-wrapper")

    # Verify Color Buttons are circular
    print("Verifying UI elements...")
    brown_btn = page.locator("#color-brown")
    expect(brown_btn).to_have_class(re.compile(r"rounded-full"))
    expect(brown_btn).to_have_class(re.compile(r"w-12"))
    expect(brown_btn).to_have_class(re.compile(r"h-12"))

    # Verify Action Buttons
    export_btn = page.locator("#export-btn")
    expect(export_btn).to_be_visible()

    # Take Screenshot of initial state
    print("Taking screenshot...")
    page.screenshot(path="verification/mobile_layout.png")

    browser.close()
    print("Done.")

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
