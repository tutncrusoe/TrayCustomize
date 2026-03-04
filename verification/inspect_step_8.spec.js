
const { test, expect } = require('@playwright/test');

test('Inspect Step 8 Geometry', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');

    // 2. Setup Step 8 State (Ring)
    // 120x120, 3x3 grid (dividers at -20, 20?)
    // Default is 120x120. Dividers empty.
    // We need to add dividers and remove segments.
    // Easier to set store directly.

    await page.evaluate(() => {
        const d = 40; // Spacing 40 -> -20, 20
        // Grid: -60, -20, 20, 60.
        // Dividers at -20, 20.
        const dividers = [-20, 20];

        // Hidden segments for Step 8 (Ring)
        // We want Outer Loop clear. Inner Island (1,1) isolated.
        // Segments to HIDE (Remove):
        // X dividers:
        // Col 0: Top(0), Bot(2). Mid(1) kept? No.
        // Wait. X divider segments are indexed by Z-row.
        // X_0 (at -20): Rows 0, 1, 2.
        // X_1 (at 20): Rows 0, 1, 2.

        // We want to KEEP walls around (1,1).
        // (1,1) is bounded by X_0 (Row 1), X_1 (Row 1), Z_0 (Col 1), Z_1 (Col 1).
        // So KEEP: X_0_1, X_1_1, Z_0_1, Z_1_1.

        // HIDE everything else.
        // X_0_0, X_0_2.
        // X_1_0, X_1_2.
        // Z_0_0, Z_0_2.
        // Z_1_0, Z_1_2.

        const hidden = {
            'X_0_0': true, 'X_0_2': true,
            'X_1_0': true, 'X_1_2': true,
            'Z_0_0': true, 'Z_0_2': true,
            'Z_1_0': true, 'Z_1_2': true
        };

        window.store.setDimensions({ l: 120, w: 120, h: 40, radius: 8, wallThickness: 2 });
        window.store.updateDividers('x', dividers);
        window.store.updateDividers('z', dividers);
        // We need to set hidden segments. Store doesn't have direct setter?
        // It listens to 'toggleSegment'.
        // We can manually trigger or set state if exposed?
        // Store state is private? No, `store.state` is not directly accessible for write usually.
        // But `store` has `toggleWall(type, idx, segment)`.

        // Let's use `toggleWall`.
        // Note: `toggleWall` toggles. We need to know current state?
        // Initially empty. So calling it once hides it.

        const toHide = [
            ['X', 0, 0], ['X', 0, 2],
            ['X', 1, 0], ['X', 1, 2],
            ['Z', 0, 0], ['Z', 0, 2],
            ['Z', 1, 0], ['Z', 1, 2]
        ];

        toHide.forEach(item => {
            window.store.toggleWall(item[0], item[1], item[2]);
        });
    });

    // 3. Inspect Scene
    const info = await page.evaluate(() => {
        const scene = window.app.sceneManager.scene;
        const meshes = [];
        scene.traverse(o => {
            if (o.isMesh && o.geometry.type === 'ExtrudeGeometry') {
                const shape = o.geometry.parameters.shapes; // Single or Array?
                const shapes = Array.isArray(shape) ? shape : [shape];

                const data = shapes.map(s => ({
                    holes: s.holes.length,
                    curves: s.curves.length, // approximate complexity
                    points: s.getPoints().length
                }));

                meshes.push({
                    uuid: o.uuid,
                    color: o.material.color.getHexString(),
                    shapes: data,
                    position: o.position
                });
            }
        });
        return meshes;
    });

    console.log('Scene Meshes:', JSON.stringify(info, null, 2));
});
