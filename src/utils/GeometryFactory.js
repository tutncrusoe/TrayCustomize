
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

// Helper to convert processed vertices to a Shape (with rounded corners)
function verticesToShape(vertices) {
    const shape = new THREE.Shape();
    const len = vertices.length;

    if (len < 3) return shape;

    for (let i = 0; i < len; i++) {
        const curr = vertices[i];
        const prev = vertices[(i - 1 + len) % len];
        const next = vertices[(i + 1) % len];

        const r = curr.r;

        const dPrev = Math.sqrt((curr.x - prev.x)**2 + (curr.z - prev.z)**2);
        const dNext = Math.sqrt((curr.x - next.x)**2 + (curr.z - next.z)**2);
        const effR = Math.min(r, dPrev/2, dNext/2);

        // Vector to prev
        const vPrev = {x: prev.x - curr.x, z: prev.z - curr.z};
        const magPrev = Math.sqrt(vPrev.x**2 + vPrev.z**2);
        if (magPrev < 0.0001) { vPrev.x = 0; vPrev.z = 0; } else { vPrev.x /= magPrev; vPrev.z /= magPrev; }

        // Vector to next
        const vNext = {x: next.x - curr.x, z: next.z - curr.z};
        const magNext = Math.sqrt(vNext.x**2 + vNext.z**2);
        if (magNext < 0.0001) { vNext.x = 0; vNext.z = 0; } else { vNext.x /= magNext; vNext.z /= magNext; }

        const start = {x: curr.x + vPrev.x * effR, z: curr.z + vPrev.z * effR};
        const end = {x: curr.x + vNext.x * effR, z: curr.z + vNext.z * effR};

        if (i === 0) {
            shape.moveTo(start.x, start.z);
        } else {
            shape.lineTo(start.x, start.z);
        }

        shape.quadraticCurveTo(curr.x, curr.z, end.x, end.z);
    }
    return shape;
}

function traceRoomBoundary(cells, sortedX, sortedZ, thick, l, w, outerR, hiddenSegments, dX, dZ) {
    const halfEdges = [];
    const cellEdges = {};

    // 1. Create 4 directed half-edges for each cell
    cells.forEach(cell => {
        const { i, j } = cell;
        const xMin = sortedX[i];
        const xMax = sortedX[i+1];
        const zMin = sortedZ[j];
        const zMax = sortedZ[j+1];

        // u -> v represents the edge direction keeping interior on the LEFT
        const top = { u: {x: xMin, z: zMin}, v: {x: xMax, z: zMin}, type: 'top', cell, removed: false };
        const right = { u: {x: xMax, z: zMin}, v: {x: xMax, z: zMax}, type: 'right', cell, removed: false };
        const bottom = { u: {x: xMax, z: zMax}, v: {x: xMin, z: zMax}, type: 'bottom', cell, removed: false };
        const left = { u: {x: xMin, z: zMax}, v: {x: xMin, z: zMin}, type: 'left', cell, removed: false };

        // Link them in a CCW loop
        top.next = right; right.prev = top;
        right.next = bottom; bottom.prev = right;
        bottom.next = left; left.prev = bottom;
        left.next = top; top.prev = left;

        halfEdges.push(top, right, bottom, left);
        cellEdges[`${i},${j}`] = { top, right, bottom, left };
    });

    const cellSet = new Set(cells.map(c => `${c.i},${c.j}`));

    // 2. Splice edges corresponding to HIDDEN walls between adjacent cells
    cells.forEach(cell => {
        const { i, j } = cell;
        const my = cellEdges[`${i},${j}`];

        // Check right neighbor
        if (cellSet.has(`${i+1},${j}`)) {
            const rawIdx = dX.indexOf(sortedX[i+1]);
            // If wall is hidden, we remove the barrier between them
            // In Native CSG logic, walls exist UNLESS explicitly hidden
            if (rawIdx !== -1 && hiddenSegments[`X_${rawIdx}_${j}`]) {
                const neighbor = cellEdges[`${i+1},${j}`];
                const eA = my.right;
                const eB = neighbor.left;
                if (!eA.removed && !eB.removed) {
                    eA.prev.next = eB.next;
                    eB.next.prev = eA.prev;
                    eB.prev.next = eA.next;
                    eA.next.prev = eB.prev;
                    eA.removed = true;
                    eB.removed = true;
                }
            }
        }

        // Check bottom neighbor
        if (cellSet.has(`${i},${j+1}`)) {
            const rawIdx = dZ.indexOf(sortedZ[j+1]);
            if (rawIdx !== -1 && hiddenSegments[`Z_${rawIdx}_${i}`]) {
                const neighbor = cellEdges[`${i},${j+1}`];
                const eA = my.bottom;
                const eB = neighbor.top;
                if (!eA.removed && !eB.removed) {
                    eA.prev.next = eB.next;
                    eB.next.prev = eA.prev;
                    eB.prev.next = eA.next;
                    eA.next.prev = eB.prev;
                    eA.removed = true;
                    eB.removed = true;
                }
            }
        }
    });

    // 3. Extract loops from remaining edges
    const activeEdges = halfEdges.filter(e => !e.removed);
    if (activeEdges.length === 0) return null;

    const loops = [];
    const used = new Set();
    activeEdges.forEach(startEdge => {
        if (used.has(startEdge)) return;

        const loop = [];
        let curr = startEdge;
        let count = 0;
        do {
            used.add(curr);
            loop.push(curr);
            curr = curr.next;
            count++;
            if (count > activeEdges.length * 2) {
                console.error("Infinite loop in boundary tracing");
                break;
            }
        } while (curr && curr !== startEdge && !used.has(curr));

        if (loop.length >= 3) loops.push(loop);
    });

    if (loops.length === 0) return null;

    // 4. Identify Outer Loop vs Holes based on signed Area
    const getArea = (verts) => {
        let area = 0;
        for (let i = 0; i < verts.length; i++) {
            const p1 = verts[i];
            const p2 = verts[(i + 1) % verts.length];
            area += (p1.x * p2.z - p2.x * p1.z);
        }
        return area / 2;
    };

    const polygons = loops.map(loop => loop.map(e => e.u));
    const areas = polygons.map(p => getArea(p));
    let maxArea = -1;
    let outerIdx = -1;
    areas.forEach((a, i) => {
        if (Math.abs(a) > maxArea) {
            maxArea = Math.abs(a);
            outerIdx = i;
        }
    });

    // 5. Process Vertices (Inset + Radius + Cap U-turns)
    const processedLoops = loops.map((loop, loopIdx) => {
        const isOuter = (loopIdx === outerIdx);

        const shiftedLines = loop.map(e => {
            let sx = e.u.x, sz = e.u.z, ex = e.v.x, ez = e.v.z;
            const EPS = 0.001;
            let inset = thick / 2;

            if (e.type === 'top') {
                if (Math.abs(e.u.z - (-w/2)) < EPS) inset = thick;
                sz += inset; ez += inset;
            } else if (e.type === 'right') {
                if (Math.abs(e.u.x - (l/2)) < EPS) inset = thick;
                sx -= inset; ex -= inset;
            } else if (e.type === 'bottom') {
                if (Math.abs(e.u.z - (w/2)) < EPS) inset = thick;
                sz -= inset; ez -= inset;
            } else if (e.type === 'left') {
                if (Math.abs(e.u.x - (-l/2)) < EPS) inset = thick;
                sx += inset; ex += inset;
            }
            return { p1: {x: sx, z: sz}, p2: {x: ex, z: ez}, type: e.type, origE: e };
        });

        const newVerts = [];
        for (let i = 0; i < shiftedLines.length; i++) {
            const l1 = shiftedLines[i];
            const l2 = shiftedLines[(i + 1) % shiftedLines.length];
            
            const isH1 = (l1.type === 'top' || l1.type === 'bottom');
            const isH2 = (l2.type === 'top' || l2.type === 'bottom');

            if (isH1 !== isH2) {
                // Perpendicular intersection
                let x, z;
                if (isH1) {
                    z = l1.p1.z; x = l2.p1.x;
                } else {
                    x = l1.p1.x; z = l2.p1.z;
                }
                const last = newVerts.length > 0 ? newVerts[newVerts.length - 1] : null;
                if (!last || Math.abs(last.x - x) > 0.001 || Math.abs(last.z - z) > 0.001) {
                    newVerts.push({x, z, rOrig: l2.origE.u});
                }
            } else {
                // Parallel (U-turn) or Collinear
                const p2 = l1.p2;
                const last = newVerts.length > 0 ? newVerts[newVerts.length - 1] : null;
                if (!last || Math.abs(last.x - p2.x) > 0.001 || Math.abs(last.z - p2.z) > 0.001) {
                    // For U-turn cap, physical corner is the end of the segment
                    newVerts.push({x: p2.x, z: p2.z, rOrig: l1.origE.v}); 
                }
                const p1 = l2.p1;
                if (Math.abs(p2.x - p1.x) > 0.001 || Math.abs(p2.z - p1.z) > 0.001) {
                    newVerts.push({x: p1.x, z: p1.z, rOrig: l2.origE.u});
                }
            }
        }

        if (Math.abs(getArea(newVerts)) < 1) return null;

        const isTrayCorner = (p) => Math.abs(Math.abs(p.x) - l/2) < 0.1 && Math.abs(Math.abs(p.z) - w/2) < 0.1;
        const getRadius = (vertObj) => {
            const origV = vertObj.rOrig;
            if (isTrayCorner(origV)) return Math.max(outerR - thick, 0.1);
            return 4; // Fillet radius for internal wall intersections
        };

        const vertices = newVerts.map(v => ({ x: v.x, z: v.z, r: getRadius(v) }));

        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        vertices.forEach(v => {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.z < minZ) minZ = v.z;
            if (v.z > maxZ) maxZ = v.z;
        });

        const shape = verticesToShape(vertices);
        return { shape, vertices, isOuter, bounds: { minX, maxX, minZ, maxZ } };
    }).filter(l => l !== null);

    const outerLoopData = processedLoops.find(l => l.isOuter);
    if (!outerLoopData) return null;

    const innerLoopsData = processedLoops.filter(l => !l.isOuter);

    return {
        shape: outerLoopData.shape,
        bounds: outerLoopData.bounds,
        islands: innerLoopsData.map(l => ({ shape: l.shape, bounds: l.bounds }))
    };
}

export function createModel(l, h, w, r, wallThickness, dX, dZ, hiddenSegments = {}, colorTheme = 'brown') {
    const group = new THREE.Group();

    let colorBase, colorWall;

    if (colorTheme === 'white') {
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

    // Base Tray Shape (Main Solid)
    const outerShape = createRoundedRectShape(l, w, effectiveOuterR);

    const solids = [ { shape: outerShape, bounds: { minX: -l/2, maxX: l/2, minZ: -w/2, maxZ: w/2 } } ];
    const voids = [];

    const sortedX = [-l/2, ...[...dX].sort((a,b) => a - b), l/2];
    const sortedZ = [-w/2, ...[...dZ].sort((a,b) => a - b), w/2];
    const visited = new Set();
    const rooms = [];
    const getCellId = (i, j) => `${i},${j}`;

    // Room Detection
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
            rooms.push({cells: roomCells});
        }
    }

    // Process Rooms
    rooms.forEach(room => {
        const res = traceRoomBoundary(room.cells, sortedX, sortedZ, thick, l, w, effectiveOuterR, hiddenSegments, dX, dZ);
        if (res) {
            voids.push({ shape: res.shape, bounds: res.bounds });
            if (res.islands) {
                res.islands.forEach(island => {
                    solids.push({ shape: island.shape, bounds: island.bounds });
                });
            }
        }
    });

    // Assign Voids to Solids
    voids.forEach(v => {
        // Find best solid: smallest area that fully contains the void
        // Check containment using Bounding Boxes
        // Allow small tolerance EPS
        const EPS = 0.1;

        let bestSolid = null;
        let minArea = Infinity;

        solids.forEach(s => {
            const containsX = (v.bounds.minX >= s.bounds.minX - EPS) && (v.bounds.maxX <= s.bounds.maxX + EPS);
            const containsZ = (v.bounds.minZ >= s.bounds.minZ - EPS) && (v.bounds.maxZ <= s.bounds.maxZ + EPS);

            if (containsX && containsZ) {
                const w = s.bounds.maxX - s.bounds.minX;
                const h = s.bounds.maxZ - s.bounds.minZ;
                const area = w * h;

                if (area < minArea) {
                    minArea = area;
                    bestSolid = s;
                }
            }
        });

        if (bestSolid) {
            bestSolid.shape.holes.push(v.shape);
        }
    });

    // Generate Geometry
    solids.forEach((s, idx) => {
        const geo = new THREE.ExtrudeGeometry(s.shape, { depth: h, bevelEnabled: false, curveSegments: 24 });
        geo.rotateX(Math.PI / 2);

        const mesh = new THREE.Mesh(geo, matWall);
        mesh.position.y = -h/2 + h;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    });

    // NOTE: Internal Walls explicitly generating using BoxGeometry/ExtrudeGeometry has been REMOVED!
    // The new Half-Edge `traceRoomBoundary` mathematically generates ALL baffle walls from negative space
    // and naturally offsets/fillets them exactly like the outer tray frame.


    const baseShape = createRoundedRectShape(l, w, effectiveOuterR);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: 2, bevelEnabled: false, curveSegments: 24 });
    baseGeo.rotateX(Math.PI / 2);

    const base = new THREE.Mesh(baseGeo, matBase);
    base.position.y = -h/2 + 2;
    base.receiveShadow = true;

    group.add(base);

    return group;
}
