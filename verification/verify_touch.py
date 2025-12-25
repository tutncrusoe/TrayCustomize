from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # Enable touch emulation
    context = browser.new_context(
        viewport={'width': 390, 'height': 844},
        has_touch=True,
        is_mobile=True
    )
    page = context.new_page()
    page.goto("http://localhost:8000")

    # Wait for init
    page.wait_for_timeout(2000)

    # --- Test 3D Label Touch ---
    print("Testing 3D Label Touch...")
    try:
        page.click('#tut-skip', timeout=2000)
    except:
        pass

    # Find a 3D label
    label = page.locator('.dim-label-3d').first
    if label.is_visible():
        print("Found 3D label")
        # Touch start
        # Playwright's tap sends a sequence: touchstart, touchend, click...
        label.tap()
        page.wait_for_timeout(500)

        # Check if input appeared
        input_el = page.locator('#global-dim-input')
        if input_el.is_visible():
            print("SUCCESS: Global input visible after touching 3D label")
        else:
            print("FAILURE: Global input NOT visible")

        page.screenshot(path="verification/step1_3d_touch.png")

        # Close input (Escape or blur)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
    else:
        print("WARNING: No 3D label found (maybe hidden?)")

    # --- Test Top View Touch Add ---
    print("Testing Top View Touch Add...")
    # Switch to Top View
    page.click('#tab-top')
    page.wait_for_timeout(1000) # Wait for resize/render

    view_top = page.locator('#view-top-placeholder')
    box = view_top.bounding_box()

    center_x = box['x'] + box['width'] / 2
    center_y = box['y'] + box['height'] / 2

    start_x = center_x
    start_y = center_y

    # We use CDP to simulate precise touch drag
    cdp = context.new_cdp_session(page)

    print("Simulating Touch Start...")
    cdp.send("Input.dispatchTouchEvent", {
        "type": "touchStart",
        "touchPoints": [{"x": start_x, "y": start_y}]
    })
    page.wait_for_timeout(200)

    # Move slightly to show it tracks (Preview)
    print("Simulating Touch Move...")
    cdp.send("Input.dispatchTouchEvent", {
        "type": "touchMove",
        "touchPoints": [{"x": start_x + 50, "y": start_y}]
    })
    page.wait_for_timeout(500)

    # Take screenshot of Preview
    page.screenshot(path="verification/step2_top_preview.png")

    # End (Lift)
    print("Simulating Touch End...")
    cdp.send("Input.dispatchTouchEvent", {
        "type": "touchEnd",
        "touchPoints": []
    })
    page.wait_for_timeout(500)

    # Take screenshot of Result
    page.screenshot(path="verification/step3_top_added.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
