from playwright.sync_api import sync_playwright

def verify_tutorial(page):
    page.goto("http://localhost:8000")

    # Wait for tutorial overlay
    page.wait_for_selector("#tutorial-overlay", state="visible")

    # Wait for Step 0 (Set Length)
    # Check if 'Set Length' text is present in the bubble
    page.wait_for_selector("#tut-text")
    text = page.inner_text("#tut-text")
    print(f"Step 0 Text: {text}")

    # Take screenshot of Step 0
    page.screenshot(path="verification_step0.png")

    # Advance tutorial (simulate L change)
    # 1. Click the label to open input
    # Note: 3D labels might take a moment to appear/position
    page.wait_for_selector("#label-3d-l", state="visible")
    page.click("#label-3d-l")

    # 2. Wait for global input
    page.wait_for_selector("#global-dim-input", state="visible")

    # 3. Fill and commit
    page.fill("#global-dim-input", "150")
    page.press("#global-dim-input", "Enter")

    # Wait for Step 1 (Set Width)
    # We might need to wait for the transition or text update
    # The tutorial system advances on 'dimensionsChanged' event.
    page.wait_for_function('document.getElementById("tut-text").innerText.includes("Set Width")')

    text = page.inner_text("#tut-text")
    print(f"Step 1 Text: {text}")
    page.screenshot(path="verification_step1.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_tutorial(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
