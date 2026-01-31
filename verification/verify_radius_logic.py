import re
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Capture console logs
    logs = []
    def on_console(msg):
        if "GeometryFactory" in msg.text:
            logs.append(msg.text)
            print(f"Browser Log: {msg.text}")

    page.on("console", on_console)

    # Load app
    print("Loading app...")
    page.goto("http://localhost:8080")
    page.wait_for_selector("#main-canvas")

    # Set dimensions via DOM inputs
    print("Setting dimensions: Radius=2, Wall=5...")

    # Need to wait for inputs to be available? Sidebar is loaded.
    page.wait_for_selector("#radius")

    # Force value directly and event
    page.evaluate("""
        const r = document.getElementById('radius');
        r.value = 2;
        r.dispatchEvent(new Event('input'));

        const w = document.getElementById('wall-thickness');
        w.value = 5;
        w.dispatchEvent(new Event('input'));
    """)

    page.wait_for_timeout(1000) # Wait for update

    # Analyze logs
    input_r = None
    wall = None
    outer_r = None
    inner_r = None

    # Reverse logs to get latest
    for log in reversed(logs):
        if input_r is None:
            m_input = re.search(r"Input R \(Inner\)=(\d+(\.\d+)?), Wall=(\d+(\.\d+)?)", log)
            if m_input:
                input_r = float(m_input.group(1))
                wall = float(m_input.group(3))

        if outer_r is None:
            m_outer = re.search(r"Calculated Outer R=(\d+(\.\d+)?)", log)
            if m_outer:
                outer_r = float(m_outer.group(1))

        if inner_r is None:
            m_inner = re.search(r"Trace Inner R=(\d+(\.\d+)?)", log)
            if m_inner:
                inner_r = float(m_inner.group(1))

    print(f"Parsed Values (Latest) -> Input R: {input_r}, Wall: {wall}, Outer R: {outer_r}, Inner R: {inner_r}")

    if outer_r is None or inner_r is None:
        print("FAIL: Could not find geometry logs.")
        return

    # Check Formula: Outer = Inner + Wall
    expected_outer = inner_r + wall
    if abs(outer_r - expected_outer) < 0.01:
        print(f"SUCCESS: Outer ({outer_r}) == Inner ({inner_r}) + Wall ({wall})")
    else:
        print(f"FAIL: Outer ({outer_r}) != Inner ({inner_r}) + Wall ({wall})")

    # Check if Inner R matches Input R (User Intent)
    if abs(inner_r - 2.0) < 0.01:
         print(f"SUCCESS: Inner Radius matches User Input (2.0)")
    else:
         print(f"FAIL: Inner Radius ({inner_r}) does not match User Input (2.0)")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
