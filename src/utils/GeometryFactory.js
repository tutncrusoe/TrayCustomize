// src/utils/GeometryFactory.js

export function createRoundedRectShape(w, h, r) {
    const ctx = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    const radius = Math.min(r, Math.min(w, h) / 2);

    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);

    return ctx;
}

export function createAdaptiveHoleShape(x, z, w, h, radii) {
    const shape = new THREE.Shape();
    const startX = x - w / 2;
    const startY = z - h / 2;

    const r_br = Math.min(radii[2], Math.min(w, h) / 2);
    const r_tr = Math.min(radii[1], Math.min(w, h) / 2);
    const r_tl = Math.min(radii[0], Math.min(w, h) / 2);
    const r_bl = Math.min(radii[3], Math.min(w, h) / 2);

    shape.moveTo(startX + r_bl, startY);
    shape.lineTo(startX + w - r_br, startY);
    shape.quadraticCurveTo(startX + w, startY, startX + w, startY + r_br);
    shape.lineTo(startX + w, startY + h - r_tr);
    shape.quadraticCurveTo(startX + w, startY + h, startX + w - r_tr, startY + h);
    shape.lineTo(startX + r_tl, startY + h);
    shape.quadraticCurveTo(startX, startY + h, startX, startY + h - r_tl);
    shape.lineTo(startX, startY + r_bl);
    shape.quadraticCurveTo(startX, startY, startX + r_bl, startY);

    return shape;
}

export function createModel(l, h, w, r, dX, dZ, hiddenSegments = {}, colorTheme = 'brown') {
    const group = new THREE.Group();

    // Materials based on theme
    // User requested distinct contrast between Base and Wall.
    // Wall should be lighter than Base.

    let colorBase, colorWall;

    if (colorTheme === 'white') {
        // Ceramic White / Matte Light Grey
        colorBase = 0x9CA3AF; // Zinc 400 for high contrast
        colorWall = 0xF3F4F6; // Very light grey for walls
    } else {
        // Ceramic Brown
        colorBase = 0x4E342E; // Dark brown
        colorWall = 0x8D6E63; // Lighter brown
    }

    const matSettings = { roughness: 0.7, metalness: 0.1 };
    const matWall = new THREE.MeshStandardMaterial({ color: colorWall, ...matSettings });
    const matBase = new THREE.MeshStandardMaterial({ color: colorBase, ...matSettings });

    const thick = 2;
    const outerShape = createRoundedRectShape(l, w, r);

    // Prepare divider logic
    const sortedX = [-l / 2, ...[...dX].sort((a, b) => a - b), l / 2];
    const sortedZ = [-w / 2, ...[...dZ].sort((a, b) => a - b), w / 2];
    const visited = new Set();
    const rooms = [];
    const getCellId = (i, j) => `${i},${j}`;

    for (let i = 0; i < sortedX.length - 1; i++) {
        for (let j = 0; j < sortedZ.length - 1; j++) {
            if (visited.has(getCellId(i, j))) continue;

            let roomCells = [];
            let queue = [{ i, j }];
            visited.add(getCellId(i, j));

            let minI = i, maxI = i, minJ = j, maxJ = j;

            while (queue.length > 0) {
                const curr = queue.pop();
                roomCells.push(curr);

                minI = Math.min(minI, curr.i);
                maxI = Math.max(maxI, curr.i);
                minJ = Math.min(minJ, curr.j);
                maxJ = Math.max(maxJ, curr.j);

                // Check neighbors
                const directions = [
                    [1, 0, 'X'], [-1, 0, 'X'], [0, 1, 'Z'], [0, -1, 'Z']
                ];

                directions.forEach(d => {
                    const ni = curr.i + d[0];
                    const nj = curr.j + d[1];

                    if (ni >= 0 && ni < sortedX.length - 1 && nj >= 0 && nj < sortedZ.length - 1) {
                        let hasWall = true;
                        if (d[2] === 'X') {
                            const wallIdx = Math.max(curr.i, ni);
                            const rawIdx = dX.indexOf(sortedX[wallIdx]);
                            if (rawIdx !== -1 && hiddenSegments[`X_${rawIdx}_${Math.min(curr.j, nj)}`]) {
                                hasWall = false;
                            }
                        } else {
                            const wallIdx = Math.max(curr.j, nj);
                            const rawIdx = dZ.indexOf(sortedZ[wallIdx]);
                            if (rawIdx !== -1 && hiddenSegments[`Z_${rawIdx}_${Math.min(curr.i, ni)}`]) {
                                hasWall = false;
                            }
                        }

                        if (!hasWall && !visited.has(getCellId(ni, nj))) {
                            visited.add(getCellId(ni, nj));
                            queue.push({ i: ni, j: nj });
                        }
                    }
                });
            }
            rooms.push({ bounds: { minI, maxI, minJ, maxJ } });
        }
    }

    rooms.forEach(room => {
        const xStart = sortedX[room.bounds.minI];
        const xEnd = sortedX[room.bounds.maxI + 1];
        const zStart = sortedZ[room.bounds.minJ];
        const zEnd = sortedZ[room.bounds.maxJ + 1];

        const roomW = xEnd - xStart;
        const roomH = zEnd - zStart;
        const centerX = xStart + roomW / 2;
        const centerZ = zStart + roomH / 2;

        const holeW = roomW - thick;
        const holeH = roomH - thick;

        if (holeW > 0 && holeH > 0) {
            const touchingL = Math.abs(xStart - (-l / 2)) < 0.1;
            const touchingR = Math.abs(xEnd - (l / 2)) < 0.1;
            const touchingT = Math.abs(zStart - (-w / 2)) < 0.1;
            const touchingB = Math.abs(zEnd - (w / 2)) < 0.1;

            const stdR = 4;
            const bigR = Math.max(stdR, r - thick);

            const radii = [
                (touchingL && touchingT) ? bigR : (touchingL || touchingT ? bigR : stdR), // TL
                (touchingR && touchingT) ? bigR : (touchingR || touchingT ? bigR : stdR), // TR
                (touchingR && touchingB) ? bigR : (touchingR || touchingB ? bigR : stdR), // BR
                (touchingL && touchingB) ? bigR : (touchingL || touchingB ? bigR : stdR)  // BL
            ];

            outerShape.holes.push(createAdaptiveHoleShape(centerX, centerZ, holeW, holeH, radii));
        }
    });

    const geo = new THREE.ExtrudeGeometry(outerShape, { depth: h, bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(Math.PI / 2);

    const mesh = new THREE.Mesh(geo, matWall);
    mesh.position.y = -h / 2 + h;

    const baseShape = createRoundedRectShape(l, w, r);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: 2, bevelEnabled: false, curveSegments: 24 });
    baseGeo.rotateX(Math.PI / 2);

    const base = new THREE.Mesh(baseGeo, matBase);
    base.position.y = -h / 2 + 2;

    group.add(mesh);
    group.add(base);

    return group;
}
