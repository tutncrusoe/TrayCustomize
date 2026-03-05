// src/features/LabelSystem.js
import { store } from '../core/Store.js';

export class LabelSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.dimContainer = document.getElementById('dim-container'); // Top View
        this.dimContainer3D = document.getElementById('dim-container-3d'); // 3D View
        this.lastState = null;

        this.bindEvents();
        this.updateVisibility();
    }

    bindEvents() {
        store.on('dimensionsChanged', () => this.updateLabels());
        store.on('dividersChanged', () => this.updateLabels());
        store.on('hiddenSegmentsChanged', () => this.updateLabels());

        // Listen for frustum changes to update label positions (Auto-Zoom fix)
        store.on('frustumChanged', () => this.updateLabels());

        // Listen to frame update for positioning
        // SceneManager emits this every frame
        store.on('update3DOverlay', ({ camera, rect }) => {
            this.update3DPositions(camera, rect);
        });

        store.on('mobileViewChanged', () => {
            setTimeout(() => this.updateVisibility(), 0);
        });

        window.addEventListener('resize', () => {
            setTimeout(() => this.updateVisibility(), 0);
        });
    }

    /**
     * Compute merged visible room spans along one axis.
     * Uses BFS: adjacent segments whose separating wall is fully hidden are merged.
     *
     * @param {number[]} sorted  - sorted boundary coords e.g. [-60,-20,20,60]
     * @param {string}   myAxis  - 'X' or 'Z' (the axis whose dividers we label)
     * @param {number[]} crossDividers - divider positions on the OTHER axis
     * @param {object}   hiddenSegs   - store.state.hiddenSegments
     * @returns {Array<{center:number, size:number}>} visible room labels
     */
    getMergedRooms(sorted, myAxis, crossDividers, hiddenSegs) {
        const n = sorted.length - 1; // number of raw segments
        const visited = new Array(n).fill(false);
        const rooms = [];

        for (let start = 0; start < n; start++) {
            if (visited[start]) continue;

            // BFS along this axis
            const queue = [start];
            visited[start] = true;
            const cells = [start];

            while (queue.length > 0) {
                const cur = queue.shift();

                // Try merging with cur+1 (right/down neighbor)
                const right = cur + 1;
                if (right < n && !visited[right]) {
                    // The wall between cur and right is the divider at sorted[right]
                    // It is "absent" (passable) iff ALL its cross-segments are hidden
                    if (this._wallFullyHidden(myAxis, cur, crossDividers, hiddenSegs)) {
                        visited[right] = true;
                        queue.push(right);
                        cells.push(right);
                    }
                }
            }

            // Compute merged span
            const minCoord = sorted[Math.min(...cells)];
            const maxCoord = sorted[Math.max(...cells) + 1];
            rooms.push({
                center: (minCoord + maxCoord) / 2,
                size: maxCoord - minCoord,
                minCoord,
                maxCoord
            });
        }

        return rooms;
    }

    /**
     * Returns true if the wall AFTER segment index `segIdx` (i.e. at the right/bottom boundary
     * of that segment) is fully hidden across all cross-divider spans.
     *
     * myAxis='X' → we check divider at sortedX[segIdx+1], keys X_rawIdx_j for all j
     * myAxis='Z' → we check divider at sortedZ[segIdx+1], keys Z_rawIdx_j for all j
     */
    _wallFullyHidden(myAxis, segIdx, crossDividers, hiddenSegs) {
        const rawIdx = segIdx; // array index in the dividers list (already sorted)
        const crossCount = crossDividers.length + 1; // number of cross-segments

        for (let j = 0; j < crossCount; j++) {
            const key = `${myAxis}_${rawIdx}_${j}`;
            if (!hiddenSegs[key]) return false;
        }
        return true;
    }

    updateVisibility() {
        const isMobile = window.innerWidth < 768;
        const mobileView = store.getState().mobileView;

        if (!isMobile) {
            this.dimContainer.style.display = 'block';
            this.dimContainer3D.style.display = 'block';
        } else {
            if (mobileView === '3d') {
                this.dimContainer.style.display = 'none';
                this.dimContainer3D.style.display = 'block';
            } else {
                this.dimContainer.style.display = 'block';
                this.dimContainer3D.style.display = 'none';
            }
        }

        this.updateLabels();
    }

    createEditableLabel(text, cb, worldPos3D = null) {
        const el = document.createElement('div');
        el.className = 'dim-label';
        el.innerText = text;

        // Simple click handler - in a full refactor, this might dispatch an EDIT_START action
        // For now, we reuse the prompt logic or simple input swap?
        // The original code used a complex `startEditing` global function.
        // We should probably replicate `startEditing` logic here or in a separate EditSystem.
        // For simplicity, let's just make them display-only or use a simple prompt for now to restore VISUAL parity.
        // To restore full functionality, we need the Edit logic.
        // I'll assume we want at least visual parity first.

        // Let's implement a basic click-to-edit if needed, but the main goal is rendering.
        // To support editing, I'd need to bring back `startEditing` logic which was in `index.html`.
        // Let's create a minimal handler that emits an event `REQUEST_EDIT`.
        // But we don't have an EditSystem.
        // Let's stick to visual rendering.

        if (worldPos3D) {
            el.dataset.worldPos = JSON.stringify(worldPos3D);
            el.classList.add('dim-label-3d');
        }

        // Edit Handler
        const handler = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const r = el.getBoundingClientRect();
            // Emit event to request Global Input to appear
            store.emit('REQUEST_EDIT', {
                x: r.left + r.width/2,
                y: r.top + r.height/2,
                value: parseFloat(text),
                callback: cb,
                worldPos3D: worldPos3D
            });
        };
        el.addEventListener('mousedown', handler);
        el.addEventListener('touchstart', handler);

        return el;
    }

    updateLabels() {
        const state = store.getState();
        const { l, w, h } = state.dimensions;
        const { x: dX, z: dZ } = state.dividers;
        const rect = document.getElementById('view-top-placeholder').getBoundingClientRect();

        // Check if update is needed to avoid jitter from DOM recreation
        // Include frustumSize and hiddenSegments in check
        const frustum = this.sceneManager.frustumSize;
        const hiddenSegs = state.hiddenSegments;
        if (this.lastState) {
            const s = this.lastState;
            const dimsMatch = Math.abs(s.l - l) < 0.01 &&
                              Math.abs(s.w - w) < 0.01 &&
                              Math.abs(s.h - h) < 0.01;

            const rectMatch = Math.abs(s.rectW - rect.width) < 0.1 &&
                              Math.abs(s.rectH - rect.height) < 0.1;

            const divXMatch = s.dX.length === dX.length &&
                              s.dX.every((v, i) => Math.abs(v - dX[i]) < 0.01);

            const divZMatch = s.dZ.length === dZ.length &&
                              s.dZ.every((v, i) => Math.abs(v - dZ[i]) < 0.01);

            const frustumMatch = Math.abs(s.frustum - frustum) < 0.01;

            const hiddenMatch = JSON.stringify(s.hiddenSegs) === JSON.stringify(hiddenSegs);

            if (dimsMatch && rectMatch && divXMatch && divZMatch && frustumMatch && hiddenMatch) return;
        }

        this.lastState = {
            l, w, h,
            rectW: rect.width,
            rectH: rect.height,
            dX: [...dX],
            dZ: [...dZ],
            frustum,
            hiddenSegs: { ...hiddenSegs }
        };

        this.dimContainer.innerHTML = '';
        this.dimContainer3D.innerHTML = '';

        // --- Top View Labels ---

        // Only generate Top View labels if visible
        if (rect.width > 0) {
            const aspect = rect.width / rect.height;
            const frustum = this.sceneManager.frustumSize;

            const w2pX = (wx) => rect.left + rect.width/2 + (wx / (frustum * aspect / 2)) * (rect.width/2);
            const w2pZ = (wz) => rect.top + rect.height/2 + (wz / (frustum / 2)) * (rect.height/2);

            // --- X-axis labels (widths of merged rooms along X) ---
            const sortedX = [-l/2, ...[...dX].sort((a,b) => a-b), l/2];
            const sortedZ = [-w/2, ...[...dZ].sort((a,b) => a-b), w/2];

            const mergedX = this.getMergedRooms(sortedX, 'X', dZ, hiddenSegs);
            mergedX.forEach(room => {
                if (room.size < 1) return;
                const cb = (inputNd) => {
                    const { radius, wallThickness } = state.dimensions;
                    const minSize = (radius * 2) + 1;
                    let nd = Math.max(minSize, inputNd); // Always clamp min
                    
                    let moved = false;
                    const newDX = [...dX];
                    
                    // Logic 1: move internal divider
                    const maxIdx = newDX.findIndex(v => Math.abs(v - room.maxCoord) < 0.01);
                    if (maxIdx !== -1) {
                        const sortedIdx = sortedX.findIndex(v => Math.abs(v - room.maxCoord) < 0.01);
                        const nextBound = sortedX[sortedIdx + 1];
                        const totalSpace = nextBound - room.minCoord;
                        const maxSize = totalSpace - minSize;
                        nd = Math.min(maxSize, nd);
                        
                        const diff = nd - room.size;
                        newDX[maxIdx] += diff;
                        moved = true;
                    } else {
                        const minIdx = newDX.findIndex(v => Math.abs(v - room.minCoord) < 0.01);
                        if (minIdx !== -1) {
                            const sortedIdx = sortedX.findIndex(v => Math.abs(v - room.minCoord) < 0.01);
                            const prevBound = sortedX[sortedIdx - 1];
                            const totalSpace = room.maxCoord - prevBound;
                            const maxSize = totalSpace - minSize;
                            nd = Math.min(maxSize, nd);
                            
                            const diff = nd - room.size;
                            newDX[minIdx] -= diff;
                            moved = true;
                        }
                    }

                    const diff = nd - room.size;
                    if (moved) {
                        store.updateDividers('x', newDX);
                    } else {
                        store.setDimensions({ l: l + diff });
                    }
                    store.emit('dimensionsCommitted');
                };
                const el = this.createEditableLabel(Math.round(room.size), cb);
                el.style.left = `${w2pX(room.center)}px`;
                el.style.top = `${w2pZ(-w/2) - 25}px`;
                el.style.transform = 'translateX(-50%)';
                this.dimContainer.appendChild(el);
            });

            // --- Z-axis labels (depths of merged rooms along Z) ---
            const mergedZ = this.getMergedRooms(sortedZ, 'Z', dX, hiddenSegs);
            mergedZ.forEach(room => {
                if (room.size < 1) return;
                const cb = (inputNd) => {
                    const { radius, wallThickness } = state.dimensions;
                    const minSize = (radius * 2) + 1;
                    let nd = Math.max(minSize, inputNd);
                    
                    let moved = false;
                    const newDZ = [...dZ];
                    
                    // Logic 1: move internal divider
                    const maxIdx = newDZ.findIndex(v => Math.abs(v - room.maxCoord) < 0.01);
                    if (maxIdx !== -1) {
                        const sortedIdx = sortedZ.findIndex(v => Math.abs(v - room.maxCoord) < 0.01);
                        const nextBound = sortedZ[sortedIdx + 1];
                        const totalSpace = nextBound - room.minCoord;
                        const maxSize = totalSpace - minSize;
                        nd = Math.min(maxSize, nd);
                        
                        const diff = nd - room.size;
                        newDZ[maxIdx] += diff;
                        moved = true;
                    } else {
                        const minIdx = newDZ.findIndex(v => Math.abs(v - room.minCoord) < 0.01);
                        if (minIdx !== -1) {
                            const sortedIdx = sortedZ.findIndex(v => Math.abs(v - room.minCoord) < 0.01);
                            const prevBound = sortedZ[sortedIdx - 1];
                            const totalSpace = room.maxCoord - prevBound;
                            const maxSize = totalSpace - minSize;
                            nd = Math.min(maxSize, nd);
                            
                            const diff = nd - room.size;
                            newDZ[minIdx] -= diff;
                            moved = true;
                        }
                    }

                    const diff = nd - room.size;
                    if (moved) {
                        store.updateDividers('z', newDZ);
                    } else {
                        store.setDimensions({ w: w + diff });
                    }
                    store.emit('dimensionsCommitted');
                };
                const el = this.createEditableLabel(Math.round(room.size), cb);
                el.style.left = `${w2pX(-l/2) - 35}px`;
                el.style.top = `${w2pZ(room.center)}px`;
                el.style.transform = 'translateY(-50%)';
                this.dimContainer.appendChild(el);
            });
        }

        // --- 3D View Labels ---
        // Labels for L, W, H
        const labels3D = [
            { text: Math.round(l), pos: new THREE.Vector3(0, -h/2 - 10, w/2 + 10), axis: 'l' },
            { text: Math.round(w), pos: new THREE.Vector3(l/2 + 15, -h/2 - 10, 0), axis: 'w' },
            { text: Math.round(h), pos: new THREE.Vector3(-l/2 - 15, 0, w/2 + 15), axis: 'h' }
        ];

        labels3D.forEach((info) => {
            const cb = (nv) => {
                store.setDimensions({ [info.axis]: nv });
                store.emit('dimensionsCommitted');
            };
            const el = this.createEditableLabel(info.text, cb, info.pos);
            el.id = `label-3d-${info.axis}`;
            this.dimContainer3D.appendChild(el);
        });
    }

    update3DPositions(camera, rect3D) {
        if (rect3D.width === 0 || rect3D.height === 0) return;

        const labels = this.dimContainer3D.querySelectorAll('.dim-label-3d');
        const boxGroup = this.sceneManager.boxGroup;

        labels.forEach(el => {
            // If editing, logic might pause, but we check Store.isEditing in SceneManager loop usually?
            // Original code: update3DLabels executed every frame WITHOUT isEditing guard.

            const worldPos = JSON.parse(el.dataset.worldPos);
            const vector = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);

            // Apply box rotation
            if (boxGroup) vector.applyQuaternion(boxGroup.quaternion);

            vector.project(camera);

            const x = rect3D.left + (vector.x * 0.5 + 0.5) * rect3D.width;
            const y = rect3D.top + (-(vector.y) * 0.5 + 0.5) * rect3D.height;

            if (vector.z < 1) {
                el.style.display = 'block';
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
                el.style.transform = 'translate(-50%, -50%)';
            } else {
                el.style.display = 'none';
            }
        });
    }
}
