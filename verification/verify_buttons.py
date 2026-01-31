import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    device = playwright.devices['iPhone 12 Pro']
    context = browser.new_context(**device)
    page = context.new_page()

    page.goto("http://localhost:8000")
    page.wait_for_selector("aside")

    # Locate Buy Now button
    buy_btn = page.locator("button", has_text="Buy Now")

    # Scroll into view
    buy_btn.scroll_into_view_if_needed()

    # Wait a bit
    page.wait_for_timeout(500)

    print("Screenshotting Buttons...")
    page.screenshot(path="verification/mobile_layout_buttons.png")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
