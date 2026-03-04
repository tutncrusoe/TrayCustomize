from playwright.sync_api import sync_playwright

def verify_mobile_fix_v2(page):
    # Set mobile viewport (iPhone 12/13)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("http://localhost:8000")

    # 1. Verify Body Height Lock on Load
    body_style = page.locator("body").get_attribute("style")
    print(f"Initial Body Style: {body_style}")

    # Check if height is set to pixel value (approx 844px)
    if "height: 844px" in body_style or "height: 844" in body_style:
        print("PASS: Body height locked on load")
    else:
        print("FAIL: Body height not locked on load")

    # 2. Verify Input Position on Edit
    # Wait for labels
    page.wait_for_selector(".dim-label-3d", timeout=5000)
    label = page.locator(".dim-label-3d").first

    if label.count():
        print("Clicking label to start edit...")
        label.click()

        # Check input visibility and position
        input_el = page.locator("#global-dim-input")
        input_style = input_el.get_attribute("style")
        print(f"Input Style: {input_style}")

        if "top: 15%" in input_style and "left: 50%" in input_style:
            print("PASS: Input positioned at top safe zone")
        else:
             print("FAIL: Input not at top safe zone")

    else:
        print("FAIL: No 3D labels found")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_mobile_fix_v2(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
