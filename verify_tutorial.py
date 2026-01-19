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
    # We can try to manually change input to trigger advance
    page.fill("#dim-l", "150")
    page.dispatch_event("#dim-l", "change") # Trigger commit to maybe auto-zoom/advance?
    # Actually TutorialSystem listens to 'dimensionsChanged' from store.
    # Input change triggers store update.

    # Wait for Step 1 (Set Width)
    page.wait_for_timeout(1000) # Wait for transition
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
