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

            // Limit to valid range
            const limit = (this.draggingDivider.type === 'X' ? l : w) / 2 - 2;
            const val = Math.max(-limit, Math.min(limit, this.draggingDivider.type === 'X' ? world.x : world.z));

            // Update
            const divs = state.dividers;
            if (this.draggingDivider.type === 'X') {
                const newX = [...divs.x];
                newX[this.draggingDivider.index] = val;
                store.updateDividers('x', newX);
            } else {
                const newZ = [...divs.z];
                newZ[this.draggingDivider.index] = val;
                store.updateDividers('z', newZ);
            }

            this.updateIndicator(client, '↔', 'active move');
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
                this.pendingAction = { type: 'addX', pos: world.x };
                this.updateIndicator(client, '+', 'active');

                this.previewLine.style.display = 'block';
                this.previewLine.style.width = '2px';
                this.previewLine.style.height = `${w * pxPerUnit}px`;
                this.previewLine.style.left = `${client.x}px`;
                this.previewLine.style.top = `${rect.top + rect.height/2 - (w * pxPerUnit)/2}px`;

            } else if (isNearV && isInsideD) {
                this.pendingAction = { type: 'addZ', pos: world.z };
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
        }
    }

    onDown({ world, client, isTouch }) {
        if (!world.isInside) return;

        const state = store.getState();
        const { l, w } = state.dimensions;

        const hit = this.checkHit(world.x, world.z, l, w, state.dividers);

        if (hit) {
            // Start Drag
            this.draggingDivider = { type: hit.axis, index: hit.lineIdx, segment: hit.segIdx, hasMoved: false };
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

        for (let i = 0; i < dividers.x.length; i++) {
            if (Math.abs(wx - dividers.x[i]) < hitMargin && Math.abs(wz) < w/2) {
                const sortedZ = [-w/2, ...[...dividers.z].sort((a,b)=>a-b), w/2];
                for(let j=0; j<sortedZ.length-1; j++) {
                    if(wz >= sortedZ[j] && wz <= sortedZ[j+1]) {
                        return { axis: 'X', lineIdx: i, segIdx: j };
                    }
                }
            }
        }

        for (let i = 0; i < dividers.z.length; i++) {
            if (Math.abs(wz - dividers.z[i]) < hitMargin && Math.abs(wx) < l/2) {
                 const sortedX = [-l/2, ...[...dividers.x].sort((a,b)=>a-b), l/2];
                 for(let j=0; j<sortedX.length-1; j++) {
                     if(wx >= sortedX[j] && wx <= sortedX[j+1]) {
                         return { axis: 'Z', lineIdx: i, segIdx: j };
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

        const updateHiddenMap = (removedAxis, removedArrIdx, removedSpatialIdx) => {
            const newHidden = {};
            for (let key in hidden) {
                const parts = key.split('_');
                const axis = parts[0];
                const lineIdx = parseInt(parts[1]);
                const segIdx = parseInt(parts[2]);

                if (axis === removedAxis) {
                    if (lineIdx < removedArrIdx) newHidden[key] = true;
                    else if (lineIdx > removedArrIdx) newHidden[`${axis}_${lineIdx - 1}_${segIdx}`] = true;
                } else {
                    if (segIdx < removedSpatialIdx) newHidden[key] = true;
                    else if (segIdx > removedSpatialIdx + 1) newHidden[`${axis}_${lineIdx}_${segIdx - 1}`] = true;
                }
            }

            // Check for merged segments that should remain hidden
            const crossAxis = removedAxis === 'X' ? 'Z' : 'X';
            const crossDividers = removedAxis === 'X' ? dZ : dX;

            for (let i = 0; i < crossDividers.length; i++) {
                const k1 = `${crossAxis}_${i}_${removedSpatialIdx}`;
                const k2 = `${crossAxis}_${i}_${removedSpatialIdx + 1}`;
                if (hidden[k1] && hidden[k2]) {
                    newHidden[`${crossAxis}_${i}_${removedSpatialIdx}`] = true;
                }
            }

            return newHidden;
        };

        while(changed) {
            changed = false;
            // Check X
            for(let i=0; i<dX.length; i++) {
                let allHidden = true;
                for(let j=0; j <= dZ.length; j++) {
                    if(!hidden[`X_${i}_${j}`]) { allHidden = false; break; }
                }
                if(allHidden) {
                    const val = dX[i];
                    const sortedX = [...dX].sort((a,b)=>a-b);
                    const spatialIdx = sortedX.indexOf(val);

                    dX.splice(i, 1);
                    hidden = updateHiddenMap('X', i, spatialIdx);
                    changed = true;
                    break;
                }
            }
            if(changed) continue;

            // Check Z
            for(let i=0; i<dZ.length; i++) {
                let allHidden = true;
                for(let j=0; j <= dX.length; j++) {
                    if(!hidden[`Z_${i}_${j}`]) { allHidden = false; break; }
                }
                if(allHidden) {
                    const val = dZ[i];
                    const sortedZ = [...dZ].sort((a,b)=>a-b);
                    const spatialIdx = sortedZ.indexOf(val);

                    dZ.splice(i, 1);
                    hidden = updateHiddenMap('Z', i, spatialIdx);
                    changed = true;
                    break;
                }
            }
        }

        store.updateDividers('x', dX);
        store.updateDividers('z', dZ);
        store.setHiddenSegments(hidden);
    }
}
