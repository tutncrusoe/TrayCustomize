from playwright.sync_api import sync_playwright

def verify_mobile_fix(page):
    # Set mobile viewport
    page.set_viewport_size({"width": 390, "height": 844}) # iPhone 12/13 size
    page.goto("http://localhost:8000")

    # Verify index.html class change
    # Check if #viewports-container has h-[45%]
    container = page.locator("#viewports-container")
    classes = container.get_attribute("class")
    if "h-[45%]" in classes:
        print("PASS: #viewports-container has h-[45%]")
    else:
        print(f"FAIL: #viewports-container classes: {classes}")

    # Wait for labels to appear
    # In tutorial mode, labels might be hidden or specific ones shown?
    # LabelSystem shows labels if dimensions are valid.
    page.wait_for_selector(".dim-label, .dim-label-3d", timeout=5000)

    # Find a label to click
    # Since we are in 3D view (default for mobile < 768), look for .dim-label-3d
    label = page.locator(".dim-label-3d").first
    if not label.count():
        print("No 3D labels found, trying 2D")
        label = page.locator(".dim-label").first

    if label.count():
        print("Found label, clicking...")
        label.click()

        # Check if body height is locked
        body_style = page.locator("body").get_attribute("style")
        print(f"Body style after click: {body_style}")

        if "height: 844px" in body_style or "height: 844" in body_style: # Playwright might normalize
             print("PASS: Body height is locked")
        else:
             print("FAIL: Body height not locked correctly")

        # Simulate switching inputs (click another label if exists, or click same one?)
        # Clicking same one might not trigger startEditing again if already focused?
        # Let's try to find another label
        labels = page.locator(".dim-label-3d")
        if labels.count() > 1:
            print("Clicking second label...")
            labels.nth(1).click()
            body_style_2 = page.locator("body").get_attribute("style")
            print(f"Body style after second click: {body_style_2}")
            if body_style == body_style_2:
                print("PASS: Body height lock preserved")
            else:
                print("FAIL: Body height changed")
        else:
            print("Only one label found, skipping switch test")

    else:
        print("FAIL: No labels found to click")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_mobile_fix(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
