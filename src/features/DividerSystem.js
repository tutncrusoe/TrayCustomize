// src/features/DividerSystem.js
import { store } from '../core/Store.js';

export class DividerSystem {
    constructor() {
        this.draggingDivider = null;
        this.pendingAction = null;
        this.selectedForRemoval = null;
        this.isTouchInteracting = false;

        // UI Elements
        this.indicator = this.createIndicator();
        this.previewLine = this.createPreviewLine();

        this.statsEl = document.getElementById('divider-stats');
        this.clearBtn = document.getElementById('clear-dividers');

        this.bindEvents();
    }

    createIndicator() {
        // Reuse existing if in DOM (from old HTML) or create
        let el = document.getElementById('add-indicator');
        if (!el) {
            el = document.createElement('div');
            el.id = 'add-indicator';
            el.style.cssText = `
                position: fixed; width: 36px; height: 36px;
                background: #18181b; color: white; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-weight: bold; font-size: 24px; pointer-events: none;
                z-index: 100; opacity: 0; transform: scale(0);
                transition: opacity 0.2s, transform 0.2s;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(el);
        }
        return el;
    }

    createPreviewLine() {
        let el = document.getElementById('preview-line');
        if (!el) {
            el = document.createElement('div');
            el.id = 'preview-line';
            el.style.cssText = `
                position: fixed; background: #3b82f6; pointer-events: none;
                z-index: 90; display: none;
                box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
            `;
            document.body.appendChild(el);
        }
        return el;
    }

    bindEvents() {
        store.on('POINTER_MOVE', (e) => this.onMove(e));
        store.on('POINTER_DOWN', (e) => this.onDown(e));
        store.on('POINTER_UP', (e) => this.onUp(e));

        // Listen for stats updates
        store.on('dividersChanged', (divs) => {
             this.updateStats(divs);
        });

        // Clear Button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                store.updateDividers('x', []);
                store.updateDividers('z', []);
                store.setHiddenSegments({});
            });
        }
    }

    updateStats(divs) {
        if (this.statsEl) {
            this.statsEl.innerText = `Vert: ${divs.x.length} | Horiz: ${divs.z.length}`;
        }
    }

    onMove({ world, client }) {
        const state = store.getState();
        const { l, w } = state.dimensions;

        // Handle Dragging
        if (this.draggingDivider) {
            this.draggingDivider.hasMoved = true;

            const { radius } = state.dimensions;
            const minSize = (radius * 2) + 1;
            const isX = this.draggingDivider.type === 'X';
            const { leftBound, rightBound } = this.draggingDivider;

            // Strict Clamping: current divider must be at least minSize from neighbors
            const minPos = leftBound + minSize;
            const maxPos = rightBound - minSize;

            let val = isX ? world.x : world.z;
            val = Math.max(minPos, Math.min(maxPos, val));

            // Update
            const divs = isX ? state.dividers.x : state.dividers.z;
            const newDivs = [...divs];
            newDivs[this.draggingDivider.index] = val;
            store.updateDividers(isX ? 'x' : 'z', newDivs);
            
            const icon = isX ? '↔' : '↕';
            this.updateIndicator(client, icon, 'active move');
            return;
        }

        // Stop if outside or touching UI
        if (!world.isInside) {
            this.hideUI();
            return;
        }

        // Check Hit (Hover existing)
        const hit = this.checkHit(world.x, world.z, l, w, state.dividers);

        if (hit) {
            this.pendingAction = { type: 'remove', ...hit };
            const isConfirming = this.selectedForRemoval &&
                                 this.selectedForRemoval.axis === hit.axis &&
                                 this.selectedForRemoval.lineIdx === hit.lineIdx &&
                                 this.selectedForRemoval.segIdx === hit.segIdx;

            this.updateIndicator(client, '-', 'active' + (isConfirming ? ' remove-confirm' : ' move'));
            this.previewLine.style.display = 'none';
        } else {
            // Check Add Preview
            const margin = 25;
            const isInsideW = Math.abs(world.x) < (l/2 - 2);
            const isInsideD = Math.abs(world.z) < (w/2 - 2);
            const isNearH = Math.abs(world.z - w/2) < margin || Math.abs(world.z + w/2) < margin;
            const isNearV = Math.abs(world.x - l/2) < margin || Math.abs(world.x + l/2) < margin;

            const rect = document.getElementById('view-top-placeholder').getBoundingClientRect();
            const aspect = rect.width / rect.height;
            const frustum = Math.max(w, l/aspect) * 1.4;
            const pxPerUnit = rect.height / frustum;

            if (isNearH && isInsideW) {
                const wallT = state.dimensions.wallThickness;
                const radius = state.dimensions.radius;
                const minSize = (radius * 2) + 1;
                const pos = world.x;

                // Check distance to other vertical dividers
                const tooClose = state.dividers.x.some(v => Math.abs(v - pos) < minSize) ||
                                Math.abs(pos - (-l/2)) < minSize ||
                                Math.abs(pos - (l/2)) < minSize;

                const maxN = this.getMaxDividers(l, wallT, radius);
                
                if (state.dividers.x.length < maxN && !tooClose) {
                    this.pendingAction = { type: 'addX', pos: pos };
                    this.updateIndicator(client, '+', 'active');

                    this.previewLine.style.display = 'block';
                    this.previewLine.style.width = '2px';
                    this.previewLine.style.height = `${w * pxPerUnit}px`;
                    this.previewLine.style.left = `${client.x}px`;
                    this.previewLine.style.top = `${rect.top + rect.height/2 - (w * pxPerUnit)/2}px`;
                } else {
                    this.hideUI();
                    this.pendingAction = null;
                }

            } else if (isNearV && isInsideD) {
                const wallT = state.dimensions.wallThickness;
                const radius = state.dimensions.radius;
                const minSize = (radius * 2) + 1;
                const pos = world.z;

                // Check distance to other horizontal dividers
                const tooClose = state.dividers.z.some(v => Math.abs(v - pos) < minSize) ||
                                Math.abs(pos - (-w/2)) < minSize ||
                                Math.abs(pos - (w/2)) < minSize;

                const maxN = this.getMaxDividers(w, wallT, radius);
                
                if (state.dividers.z.length < maxN && !tooClose) {
                    this.pendingAction = { type: 'addZ', pos: pos };
                    this.updateIndicator(client, '+', 'active');

                    this.previewLine.style.display = 'block';
                    this.previewLine.style.height = '2px';
                    this.previewLine.style.width = `${l * pxPerUnit}px`;
                    this.previewLine.style.top = `${client.y}px`;
                    this.previewLine.style.left = `${rect.left + rect.width/2 - (l * pxPerUnit)/2}px`;
                } else {
                    this.hideUI();
                    this.pendingAction = null;
                }

            } else {
                this.hideUI();
                this.pendingAction = null;
            }
        }
    }

    onDown({ world, client, isTouch }) {
        if (!world.isInside) return;

        const state = store.getState();
        const { l, w } = state.dimensions;

        const hit = this.checkHit(world.x, world.z, l, w, state.dividers);

        if (hit) {
            // Start Drag - Lock boundaries to prevent index-swapping chaos
            const isX = hit.axis === 'X';
            const divs = isX ? state.dividers.x : state.dividers.z;
            const maxDim = isX ? l : w;
            const dIndex = hit.lineIdx;

            this.draggingDivider = { 
                type: hit.axis, 
                index: dIndex, 
                segment: hit.segIdx, 
                hasMoved: false,
                leftBound: dIndex === 0 ? -maxDim / 2 : divs[dIndex - 1],
                rightBound: dIndex === divs.length - 1 ? maxDim / 2 : divs[dIndex + 1]
            };
            document.body.style.cursor = 'grabbing';
        } else {
            if (this.selectedForRemoval) {
                this.selectedForRemoval = null;
            }

            if (!isTouch && this.pendingAction && (this.pendingAction.type === 'addX' || this.pendingAction.type === 'addZ')) {
                const pos = this.pendingAction.pos;
                store.addDivider(this.pendingAction.type === 'addX' ? 'x' : 'z', pos);
            }

            if (isTouch) {
                this.isTouchInteracting = true;
            }
        }
    }

    onUp({ isTouch }) {
        document.body.style.cursor = '';

        if (this.draggingDivider) {
            if (!this.draggingDivider.hasMoved) {
                const hit = { axis: this.draggingDivider.type, lineIdx: this.draggingDivider.index, segIdx: this.draggingDivider.segment };

                if (this.selectedForRemoval &&
                    this.selectedForRemoval.axis === hit.axis &&
                    this.selectedForRemoval.lineIdx === hit.lineIdx &&
                    this.selectedForRemoval.segIdx === hit.segIdx) {

                    const key = `${hit.axis}_${hit.lineIdx}_${hit.segIdx}`;
                    const newHidden = { ...store.getState().hiddenSegments, [key]: true };
                    store.setHiddenSegments(newHidden);

                    this.selectedForRemoval = null;
                    this.cleanupDividers();

                } else {
                    this.selectedForRemoval = hit;
                }
            } else {
                this.selectedForRemoval = null;
            }
            this.draggingDivider = null;

        } else if (this.isTouchInteracting) {
            if (this.pendingAction && (this.pendingAction.type === 'addX' || this.pendingAction.type === 'addZ')) {
                 store.addDivider(this.pendingAction.type === 'addX' ? 'x' : 'z', this.pendingAction.pos);
            }
            this.isTouchInteracting = false;
            this.hideUI();
            this.pendingAction = null;
        }
    }

    checkHit(wx, wz, l, w, dividers) {
        const hitMargin = 10;
        const hiddenSegments = store.getState().hiddenSegments;

        for (let i = 0; i < dividers.x.length; i++) {
            if (Math.abs(wx - dividers.x[i]) < hitMargin && Math.abs(wz) < w/2) {
                const sortedZ = [-w/2, ...[...dividers.z].sort((a,b)=>a-b), w/2];
                for(let j=0; j<sortedZ.length-1; j++) {
                    if(wz >= sortedZ[j] && wz <= sortedZ[j+1]) {
                        // Ensure we don't return a hit on a segment that is already hidden
                        if (!hiddenSegments[`X_${i}_${j}`]) {
                            return { axis: 'X', lineIdx: i, segIdx: j };
                        }
                    }
                }
            }
        }

        for (let i = 0; i < dividers.z.length; i++) {
            if (Math.abs(wz - dividers.z[i]) < hitMargin && Math.abs(wx) < l/2) {
                 const sortedX = [-l/2, ...[...dividers.x].sort((a,b)=>a-b), l/2];
                 for(let j=0; j<sortedX.length-1; j++) {
                     if(wx >= sortedX[j] && wx <= sortedX[j+1]) {
                         // Ensure we don't return a hit on a segment that is already hidden
                         if (!hiddenSegments[`Z_${i}_${j}`]) {
                             return { axis: 'Z', lineIdx: i, segIdx: j };
                         }
                     }
                 }
            }
        }

        return null;
    }

    updateIndicator(client, text, classes) {
        this.indicator.style.left = `${client.x - 18}px`;
        this.indicator.style.top = `${client.y - 18}px`;
        this.indicator.innerText = text;
        this.indicator.className = classes;
        
        // Reset rotation by default
        this.indicator.style.transform = ''; 

        if (classes.includes('active')) {
             this.indicator.style.opacity = 1;
             this.indicator.style.transform = 'scale(1)';
             if (classes.includes('remove-confirm')) {
                 this.indicator.style.background = '#ef4444';
             } else if (classes.includes('move')) {
                 this.indicator.style.background = '#3b82f6';
                 this.indicator.style.fontSize = '16px';
             } else {
                 this.indicator.style.background = '#18181b';
                 this.indicator.style.fontSize = '24px';
             }
        } else {
             this.indicator.style.opacity = 0;
             this.indicator.style.transform = 'scale(0)';
        }
    }

    hideUI() {
        this.indicator.style.opacity = 0;
        this.indicator.style.transform = 'scale(0)';
        this.previewLine.style.display = 'none';
        this.indicator.className = '';
    }

    cleanupDividers() {
        let changed = true;
        const state = store.getState();
        let { x: dX, z: dZ } = state.dividers;
        let hidden = { ...state.hiddenSegments };

        // Helper to get true spatial array index
        const getSpatialIdx = (val, arr) => [...arr].sort((a,b)=>a-b).indexOf(val);

        while(changed) {
            changed = false;
            
            // --- Check X Dividers (Verticals) ---
            for(let i=0; i<dX.length; i++) {
                let allHidden = true;
                for(let j=0; j <= dZ.length; j++) {
                    if(!hidden[`X_${i}_${j}`]) { allHidden = false; break; }
                }
                if(allHidden) {
                    const spatialIdx = getSpatialIdx(dX[i], dX);
                    // Check if crossing walls have identical visibility on both sides
                    let canRemove = true;
                    for(let k=0; k<dZ.length; k++) {
                        if (!!hidden[`Z_${k}_${spatialIdx}`] !== !!hidden[`Z_${k}_${spatialIdx+1}`]) {
                            canRemove = false; break;
                        }
                    }

                    if (canRemove) {
                        dX.splice(i, 1);
                        
                        // Rebuild hidden map
                        const newHidden = {};
                        for (let k in hidden) {
                            const [axis, lineStr, segStr] = k.split('_');
                            const lineIdx = parseInt(lineStr);
                            const segIdx = parseInt(segStr);

                            if (axis === 'X') {
                                if (lineIdx < i) newHidden[k] = hidden[k];
                                else if (lineIdx > i) newHidden[`X_${lineIdx-1}_${segIdx}`] = hidden[k];
                            } else { // Z axis
                                if (segIdx < spatialIdx) newHidden[k] = hidden[k];
                                else if (segIdx > spatialIdx) newHidden[`Z_${lineIdx}_${segIdx-1}`] = hidden[k];
                            }
                        }
                        hidden = newHidden;
                        changed = true;
                        break;
                    }
                }
            }
            if (changed) continue;

            // --- Check Z Dividers (Horizontals) ---
            for(let i=0; i<dZ.length; i++) {
                let allHidden = true;
                for(let j=0; j <= dX.length; j++) {
                    if(!hidden[`Z_${i}_${j}`]) { allHidden = false; break; }
                }
                if(allHidden) {
                    const spatialIdx = getSpatialIdx(dZ[i], dZ);
                    // Check if crossing walls have identical visibility on both sides
                    let canRemove = true;
                    for(let k=0; k<dX.length; k++) {
                        if (!!hidden[`X_${k}_${spatialIdx}`] !== !!hidden[`X_${k}_${spatialIdx+1}`]) {
                            canRemove = false; break;
                        }
                    }

                    if (canRemove) {
                        dZ.splice(i, 1);
                        
                        // Rebuild hidden map
                        const newHidden = {};
                        for (let k in hidden) {
                            const [axis, lineStr, segStr] = k.split('_');
                            const lineIdx = parseInt(lineStr);
                            const segIdx = parseInt(segStr);

                            if (axis === 'Z') {
                                if (lineIdx < i) newHidden[k] = hidden[k];
                                else if (lineIdx > i) newHidden[`Z_${lineIdx-1}_${segIdx}`] = hidden[k];
                            } else { // X axis
                                if (segIdx < spatialIdx) newHidden[k] = hidden[k];
                                else if (segIdx > spatialIdx) newHidden[`X_${lineIdx}_${segIdx-1}`] = hidden[k];
                            }
                        }
                        hidden = newHidden;
                        changed = true;
                        break;
                    }
                }
            }
        }

        store.updateDividers('x', dX);
        store.updateDividers('z', dZ);
        store.setHiddenSegments(hidden);
    }

    getMaxDividers(totalLength, wallThickness, radius) {
        const minSize = (radius * 2) + 1;
        // Formula: N <= (L - 2*WT - minSize) / (WT + minSize)
        const availableInternalSpace = totalLength - (2 * wallThickness) - minSize;
        const spacePerNewDivider = wallThickness + minSize;
        if (availableInternalSpace < 0) return 0;
        return Math.floor(availableInternalSpace / spacePerNewDivider);
    }
}
