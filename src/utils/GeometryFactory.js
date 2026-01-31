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

function traceRoomBoundary(cells, sortedX, sortedZ, thick, l, w, outerR) {
    const edges = [];
    const cellSet = new Set(cells.map(c => `${c.i},${c.j}`));

    // 1. Collect all boundary edges
    cells.forEach(cell => {
        const { i, j } = cell;
        const xMin = sortedX[i];
        const xMax = sortedX[i+1];
        const zMin = sortedZ[j];
        const zMax = sortedZ[j+1];

        // Top Edge (min Z) - Direction: Left to Right
        if (!cellSet.has(`${i},${j-1}`)) {
            edges.push({
                u: {x: xMin, z: zMin}, v: {x: xMax, z: zMin},
                type: 'top'
            });
        }
        // Right Edge (max X) - Direction: Top to Bottom
        if (!cellSet.has(`${i+1},${j}`)) {
             edges.push({
                u: {x: xMax, z: zMin}, v: {x: xMax, z: zMax},
                type: 'right'
            });
        }
        // Bottom Edge (max Z) - Direction: Right to Left
        if (!cellSet.has(`${i},${j+1}`)) {
             edges.push({
                u: {x: xMax, z: zMax}, v: {x: xMin, z: zMax},
                type: 'bottom'
            });
        }
        // Left Edge (min X) - Direction: Bottom to Top
        if (!cellSet.has(`${i-1},${j}`)) {
             edges.push({
                u: {x: xMin, z: zMax}, v: {x: xMin, z: zMin},
                type: 'left'
            });
        }
    });

    // Filter out zero-length edges (caused by duplicate dividers)
    const validEdges = edges.filter(e => {
        const dist = Math.abs(e.u.x - e.v.x) + Math.abs(e.u.z - e.v.z);
        return dist > 0.0001;
    });

    if (validEdges.length === 0) return null;

    // 2. Chain edges into loops
    const key = (p) => `${p.x.toFixed(4)},${p.z.toFixed(4)}`;
    const edgeMap = new Map();
    // Assuming simple polygons (no vertex shared by >2 edges), we can map start point -> edge
    validEdges.forEach(e => edgeMap.set(key(e.u), e));

    const loops = [];
    const usedEdges = new Set();

    validEdges.forEach(startEdge => {
        if (usedEdges.has(startEdge)) return;

        const loop = [];
        let curr = startEdge;
        while (curr) {
            usedEdges.add(curr);
            loop.push(curr);

            // Next edge starts where current ends
            const nextKey = key(curr.v);
            const next = edgeMap.get(nextKey);

            if (!next) break; // Should not happen for closed loop
            if (next === startEdge) break; // Loop closed
            if (usedEdges.has(next)) break; // Merged into existing loop (shouldn't happen with startEdge check)

            curr = next;
        }
        if (loop.length > 2) loops.push(loop);
    });

    const shape = new THREE.Shape();
    if (loops.length === 0) return shape;

    // Calculate signed area to identify outer loop vs holes
    // Area > 0 : Counter-Clockwise (Standard for Shape in 2D usually? Wait, checking Three.js)
    // Three.js ShapeUtils.area(): positive if CCW (Y up).
    // Our Z is "down" on screen in 2D sense if we map Z->Y.
    // Let's rely on absolute area. Largest area is Outer.

    // Convert loops to polygons (vertices) to calc area
    const polygons = loops.map(loop => {
        return loop.map(e => e.u);
    });

    const getArea = (poly) => {
        let area = 0;
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i];
            const p2 = poly[(i + 1) % poly.length];
            area += (p1.x * p2.z - p2.x * p1.z); // Using Z as Y
        }
        return area / 2;
    };

    const areas = polygons.map(p => getArea(p));
    // Find largest absolute area
    let maxArea = -1;
    let outerIdx = -1;
    areas.forEach((a, i) => {
        if (Math.abs(a) > maxArea) {
            maxArea = Math.abs(a);
            outerIdx = i;
        }
    });

    loops.forEach((loop, loopIdx) => {
        const isOuter = (loopIdx === outerIdx);
        // Use Shape for outer, Path for holes
        const path = isOuter ? shape : new THREE.Path();

        // 3. Inset polygon by thick/2
        const shiftedLines = loop.map(e => {
            let sx = e.u.x, sz = e.u.z, ex = e.v.x, ez = e.v.z;
            const half = thick / 2;

            if (e.type === 'top') {
                sz += half; ez += half;
            } else if (e.type === 'right') {
                sx -= half; ex -= half;
            } else if (e.type === 'bottom') {
                sz -= half; ez -= half;
            } else if (e.type === 'left') {
                sx += half; ex += half;
            }
            return {p1: {x: sx, z: sz}, p2: {x: ex, z: ez}, type: e.type};
        });

        // Reconstruct vertices from intersections
        const newVerts = [];
        for (let i = 0; i < shiftedLines.length; i++) {
            const l1 = shiftedLines[i];
            const l2 = shiftedLines[(i + 1) % shiftedLines.length];

            let x, z;
            if (l1.type === 'top' || l1.type === 'bottom') {
                z = l1.p1.z;
                x = l2.p1.x;
            } else {
                x = l1.p1.x;
                z = l2.p1.z;
            }
            newVerts.push({x, z});
        }

        // Validate Area: If the inset polygon is too small or inverted, skip it (effectively filling the room)
        const getPolyArea = (verts) => {
            let a = 0;
            for(let k=0; k<verts.length; k++) {
                const p1 = verts[k];
                const p2 = verts[(k+1)%verts.length];
                a += (p1.x * p2.z - p2.x * p1.z);
            }
            return a / 2;
        };
        // Original loop area (approx)
        const origArea = Math.abs(getArea(loop.map(e=>e.u)));
        const newArea = getPolyArea(newVerts);

        // If new area is very small or sign flipped relative to expectation (though sign depends on direction)
        // Simple heuristic: If new area is < 1mm^2, it's too tight.
        if (Math.abs(newArea) < 1) return;

        // 4. Draw path with rounded corners
        const isTrayCorner = (p) => {
            return (Math.abs(Math.abs(p.x) - l/2) < 0.1) && (Math.abs(Math.abs(p.z) - w/2) < 0.1);
        };

        const getRadius = (idx) => {
            // Original vertex for corner i corresponds to start of edge (i+1)
            const origV = loop[(idx + 1) % loop.length].u;
            if (isTrayCorner(origV)) {
                return Math.max(outerR - thick, 0.1);
            }
            return 4; // Standard radius for internal/wall corners
        };

        const len = newVerts.length;
        for (let i = 0; i < len; i++) {
            const curr = newVerts[i];
            const prev = newVerts[(i - 1 + len) % len];
            const next = newVerts[(i + 1) % len];

            const r = getRadius(i);

            const dPrev = Math.sqrt((curr.x - prev.x)**2 + (curr.z - prev.z)**2);
            const dNext = Math.sqrt((curr.x - next.x)**2 + (curr.z - next.z)**2);
            const effR = Math.min(r, dPrev/2, dNext/2);

            // Vector to prev
            const vPrev = {x: prev.x - curr.x, z: prev.z - curr.z};
            const magPrev = Math.sqrt(vPrev.x**2 + vPrev.z**2);
            vPrev.x /= magPrev; vPrev.z /= magPrev;

            // Vector to next
            const vNext = {x: next.x - curr.x, z: next.z - curr.z};
            const magNext = Math.sqrt(vNext.x**2 + vNext.z**2);
            vNext.x /= magNext; vNext.z /= magNext;

            const start = {x: curr.x + vPrev.x * effR, z: curr.z + vPrev.z * effR};
            const end = {x: curr.x + vNext.x * effR, z: curr.z + vNext.z * effR};

            if (i === 0) {
                path.moveTo(start.x, start.z);
            } else {
                path.lineTo(start.x, start.z);
            }

            path.quadraticCurveTo(curr.x, curr.z, end.x, end.z);
        }

        if (!isOuter) {
            shape.holes.push(path);
        }
    });

    return shape;
}

export function createModel(l, h, w, r, wallThickness, dX, dZ, hiddenSegments = {}, colorTheme = 'brown') {
    const group = new THREE.Group();

    let colorBase, colorWall;

    if (colorTheme === 'white') {
        // Neutral High-Contrast (User Request)
        // Wall: Off-White #F8F9FA
        // Base: Medium Grey #71767C
        colorBase = 0x71767C;
        colorWall = 0xF8F9FA;
    } else if (colorTheme === 'red') {
        colorBase = 0xB71C1C;
        colorWall = 0xEF5350;
    } else if (colorTheme === 'blue') {
        colorBase = 0x0D47A1;
        colorWall = 0x42A5F5;
    } else {
        colorBase = 0x4E342E;
        colorWall = 0x8D6E63;
    }

    // Switch to StandardMaterial for PBR (Ceramic look)
    const matWall = new THREE.MeshStandardMaterial({
        color: colorWall,
        roughness: 0.5,
        metalness: 0.1
    });
    const matBase = new THREE.MeshStandardMaterial({
        color: colorBase,
        roughness: 0.6,
        metalness: 0.1
    });

    const thick = wallThickness;
    const effectiveOuterR = Math.min(r + wallThickness, Math.min(l, w) / 2);
    const outerShape = createRoundedRectShape(l, w, effectiveOuterR);

    const sortedX = [-l/2, ...[...dX].sort((a,b) => a - b), l/2];
    const sortedZ = [-w/2, ...[...dZ].sort((a,b) => a - b), w/2];
    const visited = new Set();
    const rooms = [];
    const getCellId = (i, j) => `${i},${j}`;

    for(let i=0; i<sortedX.length-1; i++) {
        for(let j=0; j<sortedZ.length-1; j++) {
            if(visited.has(getCellId(i,j))) continue;

            let roomCells = [];
            let queue = [{i, j}];
            visited.add(getCellId(i,j));

            let minI=i, maxI=i, minJ=j, maxJ=j;

            while(queue.length > 0) {
                const curr = queue.pop();
                roomCells.push(curr);

                minI = Math.min(minI, curr.i);
                maxI = Math.max(maxI, curr.i);
                minJ = Math.min(minJ, curr.j);
                maxJ = Math.max(maxJ, curr.j);

                const directions = [
                    [1,0,'X'], [-1,0,'X'], [0,1,'Z'], [0,-1,'Z']
                ];

                directions.forEach(d => {
                    const ni = curr.i + d[0];
                    const nj = curr.j + d[1];

                    if(ni >= 0 && ni < sortedX.length-1 && nj >= 0 && nj < sortedZ.length-1) {
                        let hasWall = true;
                        if(d[2] === 'X') {
                            const wallIdx = Math.max(curr.i, ni);
                            const rawIdx = dX.indexOf(sortedX[wallIdx]);
                            if(rawIdx !== -1 && hiddenSegments[`X_${rawIdx}_${Math.min(curr.j, nj)}`]) {
                                hasWall = false;
                            }
                        } else {
                            const wallIdx = Math.max(curr.j, nj);
                            const rawIdx = dZ.indexOf(sortedZ[wallIdx]);
                            if(rawIdx !== -1 && hiddenSegments[`Z_${rawIdx}_${Math.min(curr.i, ni)}`]) {
                                hasWall = false;
                            }
                        }

                        if(!hasWall && !visited.has(getCellId(ni,nj))) {
                            visited.add(getCellId(ni,nj));
                            queue.push({i: ni, j: nj});
                        }
                    }
                });
            }
            rooms.push({cells: roomCells, bounds: {minI, maxI, minJ, maxJ}});
        }
    }

    const roomShapes = [];
    rooms.forEach(room => {
        // Use traceRoomBoundary for all rooms (handles both rectangles and complex shapes)
        const holeShape = traceRoomBoundary(room.cells, sortedX, sortedZ, thick, l, w, effectiveOuterR);
        if (holeShape) {
            roomShapes.push(holeShape);
            outerShape.holes.push(holeShape);
        }
    });

    const geo = new THREE.ExtrudeGeometry(outerShape, { depth: h, bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(Math.PI / 2);

    const mesh = new THREE.Mesh(geo, matWall);
    mesh.position.y = -h/2 + h;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const baseShape = createRoundedRectShape(l, w, effectiveOuterR);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: 2, bevelEnabled: false, curveSegments: 24 });
    baseGeo.rotateX(Math.PI / 2);

    const base = new THREE.Mesh(baseGeo, matBase);
    base.position.y = -h/2 + 2;
    base.receiveShadow = true;

    group.add(mesh);
    group.add(base);

    return group;
}
