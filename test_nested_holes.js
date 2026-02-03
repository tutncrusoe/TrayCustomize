
const THREE = require('three');

// Mock Three.js environment if needed, or just use the logic
// Since I can't run browser code easily without a harness, I'll assume standard Three.js behavior
// and write a script that runs in node if 'three' is installed.
// But 'three' might not be in the node_modules of the root.
// I will check if 'three' is available.

try {
    const THREE = require('three');

    // 1. Create Main Shape (100x100)
    const main = new THREE.Shape();
    main.moveTo(0,0);
    main.lineTo(100,0);
    main.lineTo(100,100);
    main.lineTo(0,100);
    main.lineTo(0,0); // CCW

    // 2. Create Hole Shape (80x80)
    const hole = new THREE.Path();
    hole.moveTo(10,10);
    hole.lineTo(10,90);
    hole.lineTo(90,90);
    hole.lineTo(90,10);
    hole.lineTo(10,10); // CW (Clockwise for holes)

    // 3. Create Island Shape (Inside Hole) (40x40)
    // Theoretically, if nested holes work, we add this to 'hole.holes'
    // But 'THREE.Path' does not have a 'holes' array usually?
    // 'THREE.Shape' extends 'THREE.Path' and ADDS 'holes'.
    // So 'hole' must be a Shape to have holes.

    const holeShape = new THREE.Shape();
    holeShape.moveTo(10,10);
    holeShape.lineTo(10,90);
    holeShape.lineTo(90,90);
    holeShape.lineTo(90,10);
    holeShape.lineTo(10,10); // CW

    const island = new THREE.Path();
    island.moveTo(30,30);
    island.lineTo(70,30);
    island.lineTo(70,70);
    island.lineTo(30,70);
    island.lineTo(30,30); // CCW (Positive winding for solid)

    holeShape.holes.push(island);
    main.holes.push(holeShape);

    // 4. Generate Geometry
    const geo = new THREE.ExtrudeGeometry(main, { depth: 10, bevelEnabled: false });

    console.log("Geometry Generated.");
    console.log("Vertex Count:", geo.attributes.position.count);
    console.log("Face Count:", geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3);

    // To verify if the island exists, we check if we have faces in the center.
    // A simple 100x100 square minus 80x80 hole = Frame.
    // Frame area = 10000 - 6400 = 3600.
    // If Island exists (40x40), we ADD 1600. Total Area = 5200.
    // Triangulation is hard to measure by face count alone, but let's see if it errors.

} catch (e) {
    console.error("Test Error:", e);
}
