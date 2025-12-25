from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8000")

        # 1. Verify Sidebar Existence
        sidebar = page.locator("aside")
        if not sidebar.is_visible():
            print("Error: Sidebar not visible")
            browser.close()
            return

        print("Sidebar visible")

        # 2. Verify Color Buttons
        btn_brown = page.locator("#color-brown")
        btn_white = page.locator("#color-white")

        if btn_brown.is_visible() and btn_white.is_visible():
             print("Color buttons visible")
        else:
             print("Error: Color buttons missing")

        # 3. Verify Radius Input
        if page.locator("#radius").is_visible():
             print("Radius slider visible")

        # 4. Verify Pricing
        price = page.locator("#total-price")
        if price.is_visible() and "VNĐ" in price.inner_text():
             print(f"Price visible: {price.inner_text()}")

        # 4.1 Verify Buy Now Button
        buy_now = page.locator("button", has_text="Mua Ngay")
        if buy_now.is_visible():
            print("Buy Now button visible")
        else:
            print("Error: Buy Now button missing")

        # 5. Verify Logo Controls
        if page.locator("#logo-text-input").is_visible():
             print("Logo text input visible")

        # 6. Test Text Logo Addition (Functional Check)
        page.fill("#logo-text-input", "JULES")
        page.click("#add-text-btn")

        # Wait for logo to be processed/added (Store event)
        page.wait_for_timeout(1000)

        # Check if Remove button appears
        if page.locator("#remove-logo-btn").is_visible():
             print("Logo added, remove button appeared")
        else:
             print("Error: Remove button did not appear after adding logo")

        # 7. Test Persistence (Change Radius)
        page.fill("#radius", "15") # Change value
        page.dispatch_event("#radius", "input")
        page.wait_for_timeout(500)

        # We can't easily verify the 3D mesh existence in headless without visual regression or console hacks,
        # but we can verify the UI state persisted.
        if page.locator("#remove-logo-btn").is_visible():
             print("UI State persisted after model update")
        else:
             print("Error: UI State lost after model update")

        # Take screenshots
        page.screenshot(path="verification/ui_verification.png")

        # Mobile View Test
        page.set_viewport_size({"width": 375, "height": 812})
        page.wait_for_timeout(500)
        page.screenshot(path="verification/mobile_verification.png")
        print("Screenshots saved")

        browser.close()

if __name__ == "__main__":
    verify_ui()
