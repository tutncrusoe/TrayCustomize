from playwright.sync_api import sync_playwright

def verify_camera_fit(page):
    # Navigate to app
    page.goto("http://localhost:8000")

    # Wait for the scene to load (look for 3D View label)
    page.wait_for_selector(".view-label")

    # Wait a moment for auto-fit animation/calculation
    page.wait_for_timeout(2000)

    # Take screenshot of the entire window
    page.screenshot(path="verification/camera_fit_check.png", full_page=True)
    print("Screenshot taken: verification/camera_fit_check.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Use a viewport size that mimics the user screenshot (wide)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        try:
            verify_camera_fit(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
