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

    # Wait for loading
    page.wait_for_selector("#main-canvas")
    page.wait_for_selector("aside")

    # Screenshot Top
    print("Screenshotting Top...")
    page.screenshot(path="verification/mobile_layout_top.png")

    # Scroll the sidebar inner container to bottom
    # The selector for the inner container is 'aside > div.overflow-y-auto'
    # Or by class
    sidebar_inner = page.locator("aside div.overflow-y-auto")

    # Scroll to bottom
    print("Scrolling to bottom...")
    sidebar_inner.evaluate("element => element.scrollTop = element.scrollHeight")

    # Wait a bit for scroll (though evaluate is sync, render might need a tick)
    page.wait_for_timeout(500)

    # Screenshot Bottom
    print("Screenshotting Bottom...")
    page.screenshot(path="verification/mobile_layout_bottom.png")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
