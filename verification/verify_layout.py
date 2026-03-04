from playwright.sync_api import sync_playwright
import sys

def verify_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set a standard desktop resolution
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        try:
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")

            # Elements to check
            view_3d = page.locator("#view-3d-wrapper")
            view_top = page.locator("#view-top-wrapper")
            sidebar = page.locator("aside")

            # Ensure they are visible
            if not view_3d.is_visible() or not view_top.is_visible() or not sidebar.is_visible():
                print("FAIL: One or more elements are not visible on desktop.")
                sys.exit(1)

            # Get Bounding Boxes
            rect_3d = view_3d.bounding_box()
            rect_top = view_top.bounding_box()
            rect_sidebar = sidebar.bounding_box()

            # Use viewport-container to check main container width
            main_container = page.locator("#viewports-container")
            rect_main = main_container.bounding_box()

            print(f"Viewport Width: 1920")
            print(f"Main Container: {rect_main}")
            print(f"3D View: {rect_3d}")
            print(f"Top View: {rect_top}")
            print(f"Sidebar: {rect_sidebar}")

            # Calculate metrics
            top_right_edge = rect_top['x'] + rect_top['width']
            sidebar_left_edge = rect_sidebar['x']

            # Check overlap
            # If top_right_edge > sidebar_left_edge, they overlap
            overlap = top_right_edge - sidebar_left_edge
            print(f"Overlap: {overlap}px")

            if overlap > 1: # Allow 1px rounding error
                print("FAIL: Top View overlaps with Sidebar.")
                # sys.exit(1) # Don't exit yet, let's see ratios
                layout_ok = False
            else:
                print("PASS: No significant overlap detected.")
                layout_ok = True

            # Check widths (approximate)
            # 3D View ~ 40% (of 1920 is 768)
            # Top View ~ 40% (of 1920 is 768)
            # Sidebar ~ 20% (of 1920 is 384)

            width_3d_pct = (rect_3d['width'] / 1920) * 100
            width_top_pct = (rect_top['width'] / 1920) * 100
            width_sidebar_pct = (rect_sidebar['width'] / 1920) * 100

            print(f"Widths %: 3D={width_3d_pct:.2f}%, Top={width_top_pct:.2f}%, Sidebar={width_sidebar_pct:.2f}%")

            # Assertions for balance
            # We expect sidebar to be ~20%
            if not (19 <= width_sidebar_pct <= 21):
                print("WARNING: Sidebar width is not close to 20%.")

            # We expect views to be roughly equal and filling the rest
            # If we fixed it, views should be around 38-40% each (accounting for gaps/padding)
            # There is padding: p-8 (32px) and gap-8 (32px).
            # Total horizontal padding/gap = 32 (left) + 32 (gap) + 32 (right? no right padding on main?)
            # Main has p-8, so 32px left and 32px right padding.
            # Gap 32px.
            # Available width for children = 80% of 1920 = 1536px.
            # Minus padding (64px) - gap (32px) = 1440px.
            # Each child = 720px.
            # 720 / 1920 = 37.5%.

            if not (35 <= width_3d_pct <= 41):
                 print("WARNING: 3D View width is unexpected.")

            if not (35 <= width_top_pct <= 41):
                 print("WARNING: Top View width is unexpected.")

            # Take screenshot
            page.screenshot(path="verification/layout_fixed.png")
            print("Screenshot saved to verification/layout_fixed.png")

            if not layout_ok:
                sys.exit(1)

        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_layout()
