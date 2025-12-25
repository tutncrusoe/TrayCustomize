import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto("http://localhost:8000/index.html")
        await page.wait_for_load_state("networkidle")

        # Step 0: Set Length
        await page.locator(".dim-label-3d").first.click()
        await page.locator("#global-dim-input").fill("150")
        await page.locator("#global-dim-input").press("Enter")
        await page.wait_for_timeout(500)

        # Step 1: Set Width
        await page.locator(".dim-label-3d").nth(1).click()
        await page.locator("#global-dim-input").fill("150")
        await page.locator("#global-dim-input").press("Enter")
        await page.wait_for_timeout(500)

        # Step 2: Set Height - Verification Target
        await page.screenshot(path="verification_adjustments.png")
        print("Screenshot saved to verification_adjustments.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
