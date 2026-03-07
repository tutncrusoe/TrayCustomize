// src/features/DividerSystem.js
import { store } from '../core/Store.js';
import { getTutorialWrongActionMessage, isTutorialActionAllowed } from './TutorialGuard.js';

export class DividerSystem {
    constructor() {
        this.draggingDivider = null;
        this.pendingAction = null;
        this.selectedForRemoval = null;
        this.isTouchInteracting = false;
        this.lastPointerClient = null;
        this.dragUpdateEpsilon = 0.05;
        this.pendingDragCommit = null;
        this.dragCommitFrame = null;
        this.lastDragQueuedValue = null;
        this.maxGridCells = 400;
        this.warningTimer = null;

        // UI Elements
        this.indicator = this.createIndicator();
        this.previewLine = this.createPreviewLine();
        this.warningTooltip = this.createWarningTooltip();

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

    createWarningTooltip() {
        let el = document.getElementById('divider-performance-tooltip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'divider-performance-tooltip';
            el.style.cssText = `
                position: fixed;
                z-index: 10004;
                max-width: 240px;
                padding: 8px 10px;
                background: rgba(239, 68, 68, 0.95);
                color: #fff;
                border-radius: 8px;
                font-size: 12px;
                font-family: "Patrick Hand", cursive;
                font-weight: 600;
                line-height: 1.3;
                pointer-events: none;
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.35);
                display: none;
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

    canUseTutorialAction(actionType, payload = {}, client = null, silent = false) {
        const state = store.getState();
        const allowed = isTutorialActionAllowed(actionType, payload, state.tutorialStep, state.tutorialActive);

        if (!allowed && !silent) {
            const anchor = client ? { x: client.x, y: client.y } : null;
            store.emit('tutorialWrongAction', {
                message: getTutorialWrongActionMessage(state.tutorialStep),
                anchor
            });
        }

        return allowed;
    }

    getMinClearSize(radius) {
        return radius * 2;
    }

    getMinCenterSpan(isOuterBoundary, minClearSize, wallThickness) {
        // Centerline distance needed so inner-clear room size stays >= minClearSize.
        // Outer<->divider uses 1.5T, divider<->divider uses 1.0T.
        const wallDeduction = isOuterBoundary ? (wallThickness * 1.5) : wallThickness;
        return minClearSize + wallDeduction;
    }

    canPlaceDividerAt(pos, dividers, halfExtent, minClearSize, wallThickness) {
        const sorted = [...dividers].sort((a, b) => a - b);
        let leftBound = -halfExtent;
        let rightBound = halfExtent;

        for (let i = 0; i < sorted.length; i++) {
            const v = sorted[i];
            if (v < pos) leftBound = v;
            else {
                rightBound = v;
                break;
            }
        }

        const leftIsOuter = Math.abs(leftBound + halfExtent) < 0.0001;
        const rightIsOuter = Math.abs(rightBound - halfExtent) < 0.0001;
        const minLeftSpan = this.getMinCenterSpan(leftIsOuter, minClearSize, wallThickness);
        const minRightSpan = this.getMinCenterSpan(rightIsOuter, minClearSize, wallThickness);

        return (pos - leftBound) >= minLeftSpan && (rightBound - pos) >= minRightSpan;
    }

    getNearestMidpoint(pos, bounds, threshold, isValidCandidate) {
        let nearest = null;
        let nearestDist = Infinity;

        for (let i = 0; i < bounds.length - 1; i++) {
            const mid = (bounds[i] + bounds[i + 1]) / 2;
            const dist = Math.abs(mid - pos);
            if (dist > threshold || dist >= nearestDist) continue;
            if (isValidCandidate && !isValidCandidate(mid)) continue;
            nearest = mid;
            nearestDist = dist;
        }

        return nearest;
    }

    queueDragDividerCommit(axis, newDivs, nextValue) {
        if (this.lastDragQueuedValue !== null && Math.abs(nextValue - this.lastDragQueuedValue) < this.dragUpdateEpsilon) {
            return;
        }

        this.lastDragQueuedValue = nextValue;
        this.pendingDragCommit = { axis, dividers: newDivs };

        if (this.dragCommitFrame !== null) return;
        this.dragCommitFrame = requestAnimationFrame(() => {
            this.dragCommitFrame = null;
            if (!this.pendingDragCommit) return;
            const { axis: commitAxis, dividers } = this.pendingDragCommit;
            this.pendingDragCommit = null;
            store.updateDividers(commitAxis, dividers);
        });
    }

    flushDragDividerCommit() {
        if (this.dragCommitFrame !== null) {
            cancelAnimationFrame(this.dragCommitFrame);
            this.dragCommitFrame = null;
        }
        if (this.pendingDragCommit) {
            const { axis, dividers } = this.pendingDragCommit;
            this.pendingDragCommit = null;
            store.updateDividers(axis, dividers);
        }
    }

    resetDragCommitState() {
        if (this.dragCommitFrame !== null) {
            cancelAnimationFrame(this.dragCommitFrame);
        }
        this.dragCommitFrame = null;
        this.pendingDragCommit = null;
        this.lastDragQueuedValue = null;
    }

    canAddDividerByComplexity(axis, dividers) {
        const nextX = dividers.x.length + (axis === 'x' ? 1 : 0);
        const nextZ = dividers.z.length + (axis === 'z' ? 1 : 0);
        const nextCellCount = (nextX + 1) * (nextZ + 1);
        return nextCellCount <= this.maxGridCells;
    }

    showPerformanceWarning(anchor = null, message = 'Divider limit reached for stable performance. Remove some dividers before adding more.') {
        if (!this.warningTooltip) return;
        const point = anchor || this.lastPointerClient || { x: window.innerWidth / 2, y: window.innerHeight / 2 };

        this.warningTooltip.innerText = message;
        this.warningTooltip.style.display = 'block';

        const rect = this.warningTooltip.getBoundingClientRect();
        const left = Math.min(Math.max(12, point.x - rect.width / 2), window.innerWidth - rect.width - 12);
        const top = Math.min(Math.max(12, point.y + 10), window.innerHeight - rect.height - 12);

        this.warningTooltip.style.left = `${left}px`;
        this.warningTooltip.style.top = `${top}px`;

        clearTimeout(this.warningTimer);
        this.warningTimer = setTimeout(() => {
            if (this.warningTooltip) this.warningTooltip.style.display = 'none';
        }, 1200);
    }

    onMove({ world, client }) {
        this.lastPointerClient = client || this.lastPointerClient;
        const state = store.getState();
        const { l, w } = state.dimensions;

        // Handle Dragging
        if (this.draggingDivider) {
            if (this.draggingDivider.deleteOnly) {
                return;
            }

            const dragAxis = this.draggingDivider.type === 'X' ? 'x' : 'z';
            if (!this.canUseTutorialAction('moveDivider', { axis: dragAxis }, client, true)) {
                return;
            }

            this.draggingDivider.hasMoved = true;

            const { radius, wallThickness } = state.dimensions;
            const minSize = this.getMinClearSize(radius);
            const isX = this.draggingDivider.type === 'X';
            const { leftBound, rightBound, leftIsOuter, rightIsOuter } = this.draggingDivider;

            // Clamp by clear-size rule with current wall thickness.
            const minPos = leftBound + this.getMinCenterSpan(leftIsOuter, minSize, wallThickness);
            const maxPos = rightBound - this.getMinCenterSpan(rightIsOuter, minSize, wallThickness);

            let val = isX ? world.x : world.z;
            val = Math.max(minPos, Math.min(maxPos, val));
            let snapped = false;
            let snappedClient = client;
            const rect = document.getElementById('dim-container')?.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
                const aspect = rect.width / rect.height;
                const frustum = Math.max(w, l / aspect) * 1.4;
                const pxPerUnit = rect.height / frustum;
                const snapThresholdWorld = 5 / pxPerUnit;
                const midpoint = (leftBound + rightBound) / 2;

                if (Math.abs(val - midpoint) <= snapThresholdWorld) {
                    val = midpoint;
                    snapped = true;
                    if (isX) {
                        snappedClient = {
                            x: rect.left + rect.width / 2 + (val * pxPerUnit),
                            y: client.y
                        };
                    } else {
                        snappedClient = {
                            x: client.x,
                            y: rect.top + rect.height / 2 + (val * pxPerUnit)
                        };
                    }
                }
            }

            // Update
            const divs = isX ? state.dividers.x : state.dividers.z;
            const newDivs = [...divs];
            newDivs[this.draggingDivider.index] = val;
            this.queueDragDividerCommit(isX ? 'x' : 'z', newDivs, val);
            
            const icon = isX ? '↔' : '↕';
            this.updateIndicator(snapped ? snappedClient : client, icon, 'active move');
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
            const hitAxis = hit.axis === 'X' ? 'x' : 'z';
            const canMove = this.canUseTutorialAction('moveDivider', { axis: hitAxis }, client, true);
            const canDelete = this.canUseTutorialAction('deleteDividerSegment', { axis: hitAxis }, client, true);

            if (!canMove && !canDelete) {
                this.pendingAction = null;
                this.hideUI();
                return;
            }

            if (!canDelete) {
                this.selectedForRemoval = null;
            }

            this.pendingAction = { type: 'remove', ...hit, canMove, canDelete };
            const isConfirming = canDelete && this.selectedForRemoval &&
                                 this.selectedForRemoval.axis === hit.axis &&
                                 this.selectedForRemoval.lineIdx === hit.lineIdx &&
                                 this.selectedForRemoval.segIdx === hit.segIdx;

            const isDeleteOnly = canDelete && !canMove;
            this.updateIndicator(client, '-', 'active' + (isConfirming || isDeleteOnly ? ' remove-confirm' : ' move'));
            this.previewLine.style.display = 'none';
        } else {
            // Check Add Preview
            const margin = 25;
            const isInsideW = Math.abs(world.x) < (l/2 - 2);
            const isInsideD = Math.abs(world.z) < (w/2 - 2);
            const isNearH = Math.abs(world.z - w/2) < margin || Math.abs(world.z + w/2) < margin;
            const isNearV = Math.abs(world.x - l/2) < margin || Math.abs(world.x + l/2) < margin;

            const rect = document.getElementById('dim-container').getBoundingClientRect();
            const aspect = rect.width / rect.height;
            const frustum = Math.max(w, l/aspect) * 1.4;
            const pxPerUnit = rect.height / frustum;

            if (isNearH && isInsideW) {
                const wallT = state.dimensions.wallThickness;
                const radius = state.dimensions.radius;
                const minSize = this.getMinClearSize(radius);
                let pos = world.x;
                const sortedX = [-l / 2, ...[...state.dividers.x].sort((a, b) => a - b), l / 2];

                const snapThresholdWorld = 5 / pxPerUnit;
                const midpoint = this.getNearestMidpoint(
                    pos,
                    sortedX,
                    snapThresholdWorld,
                    (candidate) => this.canPlaceDividerAt(candidate, state.dividers.x, l / 2, minSize, wallT)
                );
                const snapped = midpoint !== null;
                if (snapped) pos = midpoint;

                const canPlace = this.canPlaceDividerAt(pos, state.dividers.x, l / 2, minSize, wallT);
                const canAddByComplexity = this.canAddDividerByComplexity('x', state.dividers);

                const maxN = this.getMaxDividers(l, wallT, radius);
                
                if (state.dividers.x.length < maxN && canPlace && canAddByComplexity) {
                    this.pendingAction = { type: 'addX', pos: pos };
                    const previewX = rect.left + rect.width / 2 + (pos * pxPerUnit);
                    const indicatorClient = snapped ? { x: previewX, y: client.y } : client;
                    this.updateIndicator(indicatorClient, '+', 'active');

                    this.previewLine.style.display = 'block';
                    this.previewLine.style.width = '2px';
                    this.previewLine.style.height = `${w * pxPerUnit}px`;
                    this.previewLine.style.left = `${previewX}px`;
                    this.previewLine.style.top = `${rect.top + rect.height/2 - (w * pxPerUnit)/2}px`;
                } else if (state.dividers.x.length < maxN && canPlace && !canAddByComplexity) {
                    this.hideUI();
                    this.pendingAction = { type: 'addXBlocked', reason: 'complexity' };
                } else {
                    this.hideUI();
                    this.pendingAction = null;
                }

            } else if (isNearV && isInsideD) {
                const wallT = state.dimensions.wallThickness;
                const radius = state.dimensions.radius;
                const minSize = this.getMinClearSize(radius);
                let pos = world.z;
                const sortedZ = [-w / 2, ...[...state.dividers.z].sort((a, b) => a - b), w / 2];

                const snapThresholdWorld = 5 / pxPerUnit;
                const midpoint = this.getNearestMidpoint(
                    pos,
                    sortedZ,
                    snapThresholdWorld,
                    (candidate) => this.canPlaceDividerAt(candidate, state.dividers.z, w / 2, minSize, wallT)
                );
                const snapped = midpoint !== null;
                if (snapped) pos = midpoint;

                const canPlace = this.canPlaceDividerAt(pos, state.dividers.z, w / 2, minSize, wallT);
                const canAddByComplexity = this.canAddDividerByComplexity('z', state.dividers);

                const maxN = this.getMaxDividers(w, wallT, radius);
                
                if (state.dividers.z.length < maxN && canPlace && canAddByComplexity) {
                    this.pendingAction = { type: 'addZ', pos: pos };
                    const previewY = rect.top + rect.height / 2 + (pos * pxPerUnit);
                    const indicatorClient = snapped ? { x: client.x, y: previewY } : client;
                    this.updateIndicator(indicatorClient, '+', 'active');

                    this.previewLine.style.display = 'block';
                    this.previewLine.style.height = '2px';
                    this.previewLine.style.width = `${l * pxPerUnit}px`;
                    this.previewLine.style.top = `${previewY}px`;
                    this.previewLine.style.left = `${rect.left + rect.width/2 - (l * pxPerUnit)/2}px`;
                } else if (state.dividers.z.length < maxN && canPlace && !canAddByComplexity) {
                    this.hideUI();
                    this.pendingAction = { type: 'addZBlocked', reason: 'complexity' };
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
        this.lastPointerClient = client || this.lastPointerClient;
        if (!world.isInside) return;

        const state = store.getState();
        const { l, w } = state.dimensions;

        const hit = this.checkHit(world.x, world.z, l, w, state.dividers);

        if (hit) {
            const axis = hit.axis === 'X' ? 'x' : 'z';
            const canMove = this.canUseTutorialAction('moveDivider', { axis }, client, true);
            const canDelete = this.canUseTutorialAction('deleteDividerSegment', { axis }, client, true);

            if (!canMove && !canDelete) {
                this.canUseTutorialAction('moveDivider', { axis }, client, false);
                return;
            }

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
                canDelete,
                deleteOnly: canDelete && !canMove,
                leftIsOuter: dIndex === 0,
                rightIsOuter: dIndex === divs.length - 1,
                leftBound: dIndex === 0 ? -maxDim / 2 : divs[dIndex - 1],
                rightBound: dIndex === divs.length - 1 ? maxDim / 2 : divs[dIndex + 1]
            };
            this.resetDragCommitState();
            document.body.style.cursor = 'grabbing';
        } else {
            if (this.selectedForRemoval) {
                this.selectedForRemoval = null;
            }

            if (this.pendingAction && (this.pendingAction.type === 'addXBlocked' || this.pendingAction.type === 'addZBlocked')) {
                this.showPerformanceWarning(client);
                this.pendingAction = null;
                return;
            }

            if (!isTouch && this.pendingAction && (this.pendingAction.type === 'addX' || this.pendingAction.type === 'addZ')) {
                const pos = this.pendingAction.pos;
                const axis = this.pendingAction.type === 'addX' ? 'x' : 'z';
                if (!this.canUseTutorialAction('addDivider', { axis }, client, false)) {
                    return;
                }
                if (!this.canAddDividerByComplexity(axis, store.getState().dividers)) {
                    this.showPerformanceWarning(client);
                    return;
                }

                const added = store.addDivider(axis, pos);
                if (added) {
                    store.emit('tutorialAction', { type: 'addDivider', axis, pos });
                }
            }

            if (isTouch) {
                this.isTouchInteracting = true;
            }
        }
    }

    onUp({ isTouch }) {
        document.body.style.cursor = '';

        if (this.draggingDivider) {
            this.flushDragDividerCommit();
            if (!this.draggingDivider.hasMoved) {
                const hit = { axis: this.draggingDivider.type, lineIdx: this.draggingDivider.index, segIdx: this.draggingDivider.segment };
                const canDelete = !!this.draggingDivider.canDelete;

                if (canDelete &&
                    this.selectedForRemoval &&
                    this.selectedForRemoval.axis === hit.axis &&
                    this.selectedForRemoval.lineIdx === hit.lineIdx &&
                    this.selectedForRemoval.segIdx === hit.segIdx) {

                    const key = `${hit.axis}_${hit.lineIdx}_${hit.segIdx}`;
                    const newHidden = { ...store.getState().hiddenSegments, [key]: true };
                    store.setHiddenSegments(newHidden);
                    store.emit('tutorialAction', {
                        type: 'deleteDividerSegment',
                        axis: hit.axis === 'X' ? 'x' : 'z'
                    });

                    this.selectedForRemoval = null;
                    this.cleanupDividers();

                } else if (canDelete) {
                    this.selectedForRemoval = hit;
                } else {
                    this.selectedForRemoval = null;
                }
            } else {
                this.selectedForRemoval = null;
                if (!this.draggingDivider.deleteOnly) {
                    store.emit('tutorialAction', {
                        type: 'moveDivider',
                        axis: this.draggingDivider.type === 'X' ? 'x' : 'z'
                    });
                }
            }
            this.draggingDivider = null;
            this.resetDragCommitState();

        } else if (this.isTouchInteracting) {
            if (this.pendingAction && (this.pendingAction.type === 'addXBlocked' || this.pendingAction.type === 'addZBlocked')) {
                this.showPerformanceWarning(this.lastPointerClient);
            }
            if (this.pendingAction && (this.pendingAction.type === 'addX' || this.pendingAction.type === 'addZ')) {
                const axis = this.pendingAction.type === 'addX' ? 'x' : 'z';
                if (this.canUseTutorialAction('addDivider', { axis }, null, false)) {
                    if (!this.canAddDividerByComplexity(axis, store.getState().dividers)) {
                        this.showPerformanceWarning(this.lastPointerClient);
                        this.isTouchInteracting = false;
                        this.hideUI();
                        this.pendingAction = null;
                        return;
                    }
                    const added = store.addDivider(axis, this.pendingAction.pos);
                    if (added) {
                        store.emit('tutorialAction', { type: 'addDivider', axis, pos: this.pendingAction.pos });
                    }
                }
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
        const minSize = this.getMinClearSize(radius);
        // Formula: N <= (L - 2*WT - minSize) / (WT + minSize)
        const availableInternalSpace = totalLength - (2 * wallThickness) - minSize;
        const spacePerNewDivider = wallThickness + minSize;
        if (availableInternalSpace < 0) return 0;
        return Math.floor(availableInternalSpace / spacePerNewDivider);
    }
}
