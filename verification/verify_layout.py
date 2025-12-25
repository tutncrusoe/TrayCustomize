from playwright.sync_api import sync_playwright

def verify_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 1. Desktop View
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        page.goto("http://localhost:8000/index.html")
        page.wait_for_selector("#viewports-container")
        # Wait a bit for 3D to render
        page.wait_for_timeout(2000)
        page.screenshot(path="verification/layout_desktop.png")
        print("Desktop screenshot captured.")

        # 2. Mobile View (3D Tab Active)
        page_mobile = browser.new_page(viewport={'width': 375, 'height': 667})
        page_mobile.goto("http://localhost:8000/index.html")
        page_mobile.wait_for_selector("#viewports-container")
        page_mobile.wait_for_timeout(2000)
        page_mobile.screenshot(path="verification/layout_mobile_3d.png")
        print("Mobile 3D screenshot captured.")

        # 3. Mobile View (Top Tab Active)
        # Click Top View tab
        page_mobile.click("#tab-top")
        page_mobile.wait_for_timeout(1000)
        page_mobile.screenshot(path="verification/layout_mobile_top.png")
        print("Mobile Top screenshot captured.")

        browser.close()

if __name__ == "__main__":
    verify_layout()
