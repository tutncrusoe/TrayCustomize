import asyncio
from playwright.async_api import async_playwright

async def verify_z_index():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Load the page
        await page.goto("http://localhost:8000")

        # Helper to get z-index
        async def get_z_index():
            return await page.eval_on_selector("#tutorial-underlay", "el => window.getComputedStyle(el).zIndex")

        # Step 0: Initial State
        print("Checking Step 0...")
        z_index_0 = await get_z_index()
        print(f"Step 0 Z-Index: {z_index_0}")
        if z_index_0 != "5":
            print("FAILURE: Step 0 z-index should be 5")
            await browser.close()
            return

        # Advance to Step 3
        print("Advancing to Step 3...")
        await page.evaluate("tutorial.showStep(3)")
        await asyncio.sleep(0.1)

        z_index_3 = await get_z_index()
        print(f"Step 3 Z-Index: {z_index_3}")
        if z_index_3 != "50":
            print("FAILURE: Step 3 z-index should be 50")
            await browser.close()
            return

        # Advance to Step 4
        print("Advancing to Step 4...")
        await page.evaluate("tutorial.showStep(4)")
        await asyncio.sleep(0.1)

        z_index_4 = await get_z_index()
        print(f"Step 4 Z-Index: {z_index_4}")
        if z_index_4 != "50":
            print("FAILURE: Step 4 z-index should be 50")
            await browser.close()
            return

        # Go back to Step 0 to verify reset
        print("Returning to Step 0...")
        await page.evaluate("tutorial.showStep(0)")
        await asyncio.sleep(0.1)

        z_index_back = await get_z_index()
        print(f"Step 0 (Again) Z-Index: {z_index_back}")
        if z_index_back != "5":
             print("FAILURE: Reset to z-index 5 failed")
             await browser.close()
             return

        print("SUCCESS: Z-Index logic verified correctly for Steps 3 and 4.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_z_index())
