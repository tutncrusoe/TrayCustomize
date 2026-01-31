from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        # Emulate iPhone 12
        iphone_12 = p.devices['iPhone 12']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone_12)
        page = context.new_page()

        # Load page
        page.goto('http://localhost:8080/index.html')

        # Wait for LabelSystem to initialize and render
        # We can wait for .dim-label-3d selector
        try:
            page.wait_for_selector('.dim-label-3d', state='visible', timeout=5000)
            print("Found visible 3D labels.")
        except:
            print("Did not find visible 3D labels in time.")

        # Wait a bit more for rendering to stabilize
        page.wait_for_timeout(2000)

        # Take screenshot
        screenshot_path = 'verification/verification_labels.png'
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
