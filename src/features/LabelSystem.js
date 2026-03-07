// src/features/LabelSystem.js
import { store } from '../core/Store.js';
import { getTutorialWrongActionMessage, isTutorialActionAllowed } from './TutorialGuard.js';

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
     * myAxis='X' -> we check divider at sortedX[segIdx+1], keys X_rawIdx_j for all j
     * myAxis='Z' -> we check divider at sortedZ[segIdx+1], keys Z_rawIdx_j for all j
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

    getInnerEdgeDeduction(room, halfExtent, wallThickness) {
        const EPS = 0.001;
        const leftIsOuter = Math.abs(room.minCoord + halfExtent) < EPS;
        const rightIsOuter = Math.abs(room.maxCoord - halfExtent) < EPS;
        const leftDeduction = leftIsOuter ? wallThickness : wallThickness / 2;
        const rightDeduction = rightIsOuter ? wallThickness : wallThickness / 2;
        return leftDeduction + rightDeduction;
    }

    toDisplayedSpan(room, halfExtent, wallThickness, useInnerMeasure) {
        if (!useInnerMeasure) return room.size;
        return Math.max(0, room.size - this.getInnerEdgeDeduction(room, halfExtent, wallThickness));
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

    createEditableLabel(text, cb, worldPos3D = null, actionMeta = null) {
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

            const tutorialState = store.getState();
            if (tutorialState.tutorialActive) {
                const allowed = isTutorialActionAllowed(
                    actionMeta?.actionType || 'unknown',
                    actionMeta || {},
                    tutorialState.tutorialStep,
                    tutorialState.tutorialActive
                );

                if (!allowed) {
                    store.emit('tutorialWrongAction', {
                        message: getTutorialWrongActionMessage(tutorialState.tutorialStep),
                        anchor: {
                            x: r.left + r.width / 2,
                            y: r.top + r.height / 2
                        }
                    });
                    return;
                }
            }

            const onCommit = (nextValue) => {
                if (typeof cb === 'function') {
                    cb(nextValue);
                }

                if (actionMeta?.actionType) {
                    store.emit('tutorialAction', {
                        type: actionMeta.actionType,
                        axis: actionMeta.axis
                    });
                }
            };

            // Emit event to request Global Input to appear
            store.emit('REQUEST_EDIT', {
                x: r.left + r.width/2,
                y: r.top + r.height/2,
                value: parseFloat(text),
                callback: onCommit,
                worldPos3D: worldPos3D,
                sourceElement: el
            });
        };
        el.addEventListener('mousedown', handler);
        el.addEventListener('touchstart', handler);

        return el;
    }

    updateLabels() {
        const state = store.getState();
        const { l, w, h, radius, wallThickness } = state.dimensions;
        const { x: dX, z: dZ } = state.dividers;
        const rect = this.dimContainer.getBoundingClientRect();

        // Check if update is needed to avoid jitter from DOM recreation
        // Include frustumSize and hiddenSegments in check
        const frustum = this.sceneManager.frustumSize;
        const hiddenSegs = state.hiddenSegments;
        if (this.lastState) {
            const s = this.lastState;
            const dimsMatch = Math.abs(s.l - l) < 0.01 &&
                              Math.abs(s.w - w) < 0.01 &&
                              Math.abs(s.h - h) < 0.01 &&
                              Math.abs(s.radius - radius) < 0.01 &&
                              Math.abs(s.wallThickness - wallThickness) < 0.01;

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
            l, w, h, radius, wallThickness,
            rectW: rect.width,
            rectH: rect.height,
            dX: [...dX],
            dZ: [...dZ],
            frustum,
            hiddenSegs: { ...hiddenSegs }
        };

        // Clear only labels, do NOT clear canvases
        const topLabels = this.dimContainer.querySelectorAll('.dim-label, .dim-label-3d');
        topLabels.forEach(l => l.remove());
        
        const oldLabels3D = this.dimContainer3D.querySelectorAll('.dim-label, .dim-label-3d');
        oldLabels3D.forEach(l => l.remove());

        // --- Top View Labels ---

        // Only generate Top View labels if visible
        if (rect.width > 0) {
            const aspect = rect.width / rect.height;
            const frustum = this.sceneManager.frustumSize;

            const w2pX = (wx) => rect.width/2 + (wx / (frustum * aspect / 2)) * (rect.width/2);
            const w2pZ = (wz) => rect.height/2 + (wz / (frustum / 2)) * (rect.height/2);

            // --- X-axis labels (widths of merged rooms along X) ---
            const sortedX = [-l/2, ...[...dX].sort((a,b) => a-b), l/2];
            const sortedZ = [-w/2, ...[...dZ].sort((a,b) => a-b), w/2];
            const useInnerMeasureX = dX.length > 0;
            const useInnerMeasureZ = dZ.length > 0;

            const mergedX = this.getMergedRooms(sortedX, 'X', dZ, hiddenSegs);
            mergedX.forEach(room => {
                if (room.size < 1) return;
                const displaySize = this.toDisplayedSpan(room, l / 2, wallThickness, useInnerMeasureX);
                const cb = (inputNd) => {
                    const { radius, wallThickness } = state.dimensions;
                    const minSize = radius * 2;
                    const deduction = useInnerMeasureX
                        ? this.getInnerEdgeDeduction(room, l / 2, wallThickness)
                        : 0;
                    let nd = Math.max(minSize, inputNd + deduction); // Clamp by center-line span
                    
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
                const xLabelActionMeta = dX.length === 0
                    ? { actionType: 'editDimension', axis: 'l' }
                    : { actionType: 'editSegment', axis: 'x' };
                const el = this.createEditableLabel(Math.round(displaySize), cb, null, xLabelActionMeta);
                el.style.left = `${w2pX(room.center)}px`;
                el.style.top = `${w2pZ(-w/2) - 25}px`;
                el.style.transform = 'translateX(-50%)';
                this.dimContainer.appendChild(el);
            });

            // --- Z-axis labels (depths of merged rooms along Z) ---
            const mergedZ = this.getMergedRooms(sortedZ, 'Z', dX, hiddenSegs);
            mergedZ.forEach(room => {
                if (room.size < 1) return;
                const displaySize = this.toDisplayedSpan(room, w / 2, wallThickness, useInnerMeasureZ);
                const cb = (inputNd) => {
                    const { radius, wallThickness } = state.dimensions;
                    const minSize = radius * 2;
                    const deduction = useInnerMeasureZ
                        ? this.getInnerEdgeDeduction(room, w / 2, wallThickness)
                        : 0;
                    let nd = Math.max(minSize, inputNd + deduction);
                    
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
                const zLabelActionMeta = dZ.length === 0
                    ? { actionType: 'editDimension', axis: 'w' }
                    : { actionType: 'editSegment', axis: 'z' };
                const el = this.createEditableLabel(Math.round(displaySize), cb, null, zLabelActionMeta);
                el.style.left = `${w2pX(-l/2) - 35}px`;
                el.style.top = `${w2pZ(room.center)}px`;
                el.style.transform = 'translateY(-50%)';
                this.dimContainer.appendChild(el);
            });
        }

        // --- 3D View Labels ---
        // Labels for L, W, H using static CSS positions inside the relative container
        const labels3D = [
            { text: Math.round(h), axis: 'h', style: { left: '4%', top: '55%', transform: 'translateY(-50%)' } },
            { text: Math.round(l), axis: 'l', style: { left: '30%', bottom: '10%', transform: 'translateX(-50%)' } },
            { text: Math.round(w), axis: 'w', style: { right: '20%', bottom: '15%', transform: 'translateX(50%)' } }
        ];

        labels3D.forEach((info) => {
            const cb = (nv) => {
                store.setDimensions({ [info.axis]: nv });
                store.emit('dimensionsCommitted');
            };
            const el = this.createEditableLabel(info.text, cb, null, {
                actionType: 'editDimension',
                axis: info.axis
            });
            el.id = `label-3d-${info.axis}`;
            el.classList.add('dim-label-3d');
            Object.assign(el.style, info.style);
            this.dimContainer3D.appendChild(el);
        });
    }
}
