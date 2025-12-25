from playwright.sync_api import sync_playwright

def verify_mobile_layout():
    with sync_playwright() as p:
        # Use a mobile viewport size
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 375, 'height': 812})
        page = context.new_page()

        page.goto("http://localhost:8000/index.html")
        page.wait_for_load_state('networkidle')

        # 1. Verify 3D Tab is active by default
        tab_3d = page.locator('#tab-3d')
        tab_top = page.locator('#tab-top')

        print("Checking default state...")
        # Check styles to confirm active state (bg-zinc-600)
        assert 'bg-zinc-600' in tab_3d.get_attribute('class')
        assert 'bg-zinc-600' not in tab_top.get_attribute('class')

        # Verify 3D Viewport is visible and Top Viewport is hidden
        view_3d = page.locator('#view-3d-placeholder')
        view_top = page.locator('#view-top-placeholder')

        assert 'flex-1' in view_3d.get_attribute('class')
        assert 'hidden' in view_top.get_attribute('class')

        page.screenshot(path="verification/mobile_3d_view.png")
        print("Screenshot saved: mobile_3d_view.png")

        # 2. Click Top View Tab
        print("Clicking Top View tab...")
        tab_top.click()
        page.wait_for_timeout(500) # Wait for transition/render

        # Verify Top View is now active
        assert 'bg-zinc-600' in tab_top.get_attribute('class')
        assert 'bg-zinc-600' not in tab_3d.get_attribute('class')

        assert 'hidden' in view_3d.get_attribute('class')
        assert 'flex-1' in view_top.get_attribute('class')

        page.screenshot(path="verification/mobile_top_view.png")
        print("Screenshot saved: mobile_top_view.png")

        browser.close()

if __name__ == "__main__":
    verify_mobile_layout()
