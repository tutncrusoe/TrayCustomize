// src/features/TutorialSystem.js
import { store } from '../core/Store.js';

export class TutorialSystem {
    constructor() {
        this.step = 0;
        this.isActive = false;

        // DOM Elements
        this.overlay = document.getElementById('tutorial-overlay');
        this.underlay = document.getElementById('tutorial-underlay');
        this.blob = document.getElementById('tut-blob');
        this.text = document.getElementById('tut-text');
        this.arrow = document.getElementById('tut-arrow');
        this.cursor = document.getElementById('ghost-cursor');
        this.skipBtn = document.getElementById('tut-skip');
        this.ghostDivider = document.getElementById('ghost-divider');
        this.cursorTrail = document.getElementById('cursor-trail');

        this.bindEvents();
        this.init();
    }

    init() {
        if (!sessionStorage.getItem('tutorial_seen')) {
            this.start();
            sessionStorage.setItem('tutorial_seen', 'true');
        } else {
            if (this.skipBtn) this.skipBtn.innerText = "Tutorial";
            document.body.classList.remove('tutorial-active');
            if (this.overlay) this.overlay.style.pointerEvents = 'none';
        }
    }

    bindEvents() {
        if (this.skipBtn) {
            this.skipBtn.addEventListener('click', () => this.toggle());
        }

        // Subscribe to Store events to advance steps automatically
        store.on('dimensionsChanged', () => {
             // Steps 0 (L), 1 (W), 2 (H)
             if (this.isActive && this.step < 3) {
                 this.advance();
             }
        });

        store.on('dividersChanged', (divs) => {
             // Step 3 (Add Horiz/Z), Step 4 (Add Vert/X)
             // We need to check if count increased?
             // Or just simple logic: if step 3 and Z added -> step 4.
             // If step 4 and X added -> step 5.
             // Let's keep it simple: any divider change in those steps advances.
             if (this.isActive) {
                 if (this.step === 3 && divs.z.length > 0) this.advance(); // Added Horizontal (Z)
                 else if (this.step === 4 && divs.x.length > 0) this.advance(); // Added Vertical (X)
             }
        });

        // For Step 5 (Drag), we need a "Drag Finished" event?
        // DividerSystem doesn't explicitly emit "DragFinished", but it updates dividers.
        // However, dividersChanged also fires on Drag.
        // Step 5 is "Drag". If dividers changed and we are in step 5, advance?
        // Yes, likely user moved something.
        store.on('dividersChanged', () => {
             if (this.isActive && this.step === 5) this.advance();
        });

        // Step 6 (Delete)
        store.on('hiddenSegmentsChanged', () => {
             if (this.isActive && this.step === 6) {
                 this.complete(); // Finish tutorial
             }
        });
    }

    toggle() {
        if (this.isActive) this.complete();
        else this.start();
    }

    start() {
        this.isActive = true;
        document.body.classList.add('tutorial-active');
        if (this.skipBtn) this.skipBtn.innerText = "Skip Tutorial";
        this.showStep(0);
    }

    complete() {
        this.isActive = false;
        document.body.classList.remove('tutorial-active');
        if (this.skipBtn) this.skipBtn.innerText = "Tutorial";
        if (this.overlay) this.overlay.style.pointerEvents = 'none';
    }

    advance() {
        this.showStep(this.step + 1);
    }

    showStep(stepIndex) {
        if (!this.isActive) return;
        this.step = stepIndex;

        // Reset animations
        if (this.cursor) {
            this.cursor.style.animation = 'none';
            this.cursor.style.opacity = 0;
            this.cursor.innerHTML = '<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" /></svg>';
        }
        if (this.ghostDivider) {
            this.ghostDivider.style.opacity = 0;
            this.ghostDivider.style.animation = 'none';
        }
        if (this.cursorTrail) this.cursorTrail.style.opacity = 0;

        // Mobile View Switching
        if (window.innerWidth < 768) {
            if (stepIndex >= 3) store.setMobileView('top');
            else store.setMobileView('3d');
        }

        // Z-Index adjustments
        if (this.underlay) {
            this.underlay.style.zIndex = (stepIndex === 3 || stepIndex === 4) ? '50' : '15';
        }

        if (stepIndex > 6) {
            this.complete();
            return;
        }

        // Wait for potential transitions
        setTimeout(() => this.renderStep(stepIndex), 100);
    }

    renderStep(stepIndex) {
        if (!this.blob) return;

        // Target Identification Helper
        // We need to find DOM elements.
        // Dimensions: Inputs or 3D labels?
        // Original code used 3D labels if available, fallback to inputs.
        // We have 3D labels in SceneManager? No, SceneManager doesn't render DOM labels yet.
        // Wait, the Original code had `update3DLabels` in `animate`.
        // I haven't implemented `update3DLabels` in SceneManager fully!
        // `SceneManager` emits `update3DOverlay`.
        // Who handles that event? `DimensionControl`? Or a separate `OverlaySystem`?
        // I haven't created an overlay system.
        // I should probably add 3D label rendering to `DimensionControl` or `SceneManager` directly.
        // Let's assume for now we target the DOM INPUTS for steps 0,1,2 if 3D labels aren't there.
        // Or better, I should implement the 3D labels in `DimensionControl`.

        const getLabel3D = (axis) => {
            const label3D = document.getElementById(`label-3d-${axis}`);
            if (label3D && label3D.offsetParent !== null) return label3D;
            return document.getElementById(`dim-${axis}`);
        };

        const topView = document.getElementById('view-top-placeholder');

        switch(stepIndex) {
            case 0: // Set Length
                this.positionHint(getLabel3D('l'), 'Set Length', 'left');
                break;
            case 1: // Set Width
                this.positionHint(getLabel3D('w'), 'Set Width', 'right');
                break;
            case 2: // Set Height
                this.positionHint(getLabel3D('h'), 'Set Height', 'top');
                break;
            case 3: // Add Horizontal (Add Z)
                this.positionHint(topView, 'Add Horizontal', 'right-offset');
                this.playAnimation('cursor-scan-h', topView, 'right-edge-outer');
                break;
            case 4: // Add Vertical (Add X)
                this.positionHint(topView, 'Add Vertical', 'bottom-offset');
                this.playAnimation('cursor-scan-v', topView, 'bottom-edge-outer');
                break;
            case 5: // Drag
                this.positionHint(topView, 'Click & Hold to move', 'bottom');
                this.playDragAnimation(topView);
                break;
            case 6: // Delete
                this.positionHint(topView, 'Double click to delete', 'bottom');
                this.playDeleteAnimation(topView);
                break;
            default:
                this.complete();
        }
    }

    positionHint(target, text, side) {
        if(!target) return;
        const rect = target.getBoundingClientRect();
        this.text.innerText = text;

        let top, left, arrowRot, arrowTop, arrowLeft;

        // Simplified logic from original
        if (target.tagName === 'INPUT' || target.classList.contains('input-group')) {
            // Center near input
            top = rect.bottom + 10;
            left = rect.left + rect.width/2 - 50;
            this.arrow.style.opacity = 0; // Hide arrow for inputs
        } else if (target.id.startsWith('label-3d-')) {
            // 3D Label Targeting
            top = rect.top + rect.height/2 - 50;
            left = rect.left + rect.width/2 - 50;
            this.arrow.style.opacity = 0;
        } else {
             // Logic for Viewport targets
            if (side === 'right-offset') {
                top = rect.top + rect.height / 2 - 50;
                left = rect.right - 110;
                this.arrow.style.opacity = 0;
            } else if (side === 'bottom-offset') {
                top = rect.bottom - 90;
                left = rect.left + rect.width / 2 - 70;
                arrowRot = 270;
                this.arrow.style.opacity = 0;
            } else {
                top = rect.bottom + 60;
                left = rect.left + rect.width/2 - 70;
                arrowRot = 45;
                arrowTop = rect.bottom + 5;
                arrowLeft = rect.left + rect.width/2 - 30;
                if(side !== 'right-offset' && side !== 'bottom-offset') this.arrow.style.opacity = 1;
            }
        }

        // Bounds
        if (left + 140 > window.innerWidth) left = window.innerWidth - 160;
        if (left < 0) left = 10;

        this.blob.style.top = `${top}px`;
        this.blob.style.left = `${left}px`;

        if (this.arrow.style.opacity !== '0') {
            this.arrow.style.transform = `rotate(${arrowRot}deg)`;
            this.arrow.style.top = `${arrowTop}px`;
            this.arrow.style.left = `${arrowLeft}px`;
        }
    }

    playAnimation(animName, target, edge) {
        if(!target || !this.cursor) return;
        const rect = target.getBoundingClientRect();

        // Reuse original logic for positions
        if (edge === 'right-edge-outer') {
            const cursorX = rect.right - 130;
            const cursorYStart = rect.top + rect.height/2;
            this.cursor.style.left = `${cursorX}px`;
            this.cursor.style.top = `${cursorYStart}px`;

            this.cursorTrail.style.opacity = 1;
            this.cursorTrail.style.left = `${cursorX + 6}px`;
            this.cursorTrail.style.top = `${cursorYStart - 75}px`;
            this.cursorTrail.style.height = '150px';
        } else if (edge === 'bottom-edge-outer') {
            const cursorX = rect.left + rect.width/2 - 75;
            const cursorY = rect.bottom - 5;
            this.cursor.style.left = `${cursorX}px`;
            this.cursor.style.top = `${cursorY}px`;

            this.cursorTrail.style.opacity = 1;
            this.cursorTrail.style.left = `${cursorX}px`;
            this.cursorTrail.style.top = `${cursorY + 5}px`;
            this.cursorTrail.style.width = '150px';
            this.cursorTrail.style.height = '4px';
        }

        this.cursor.style.animation = `${animName} 4s infinite`;
    }

    playDragAnimation(target) {
        if(!target) return;
        const rect = target.getBoundingClientRect();
        const startX = rect.left + rect.width/2;
        const startY = rect.top + rect.height/2;

        this.cursor.style.left = `${startX}px`;
        this.cursor.style.top = `${startY}px`;
        this.cursor.innerHTML = '<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v1h-1V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v3h-1V2a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5h-1V5a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6c0 4.418 3.582 8 8 8s8-3.582 8-8z" /></svg>';
        this.cursor.style.animation = 'cursor-drag-shadow 4s infinite';

        this.ghostDivider.style.left = `${startX}px`;
        this.ghostDivider.style.top = `${startY}px`;
        this.ghostDivider.style.width = '100px';
        this.ghostDivider.style.height = '4px';
        this.ghostDivider.style.opacity = 0;
        this.ghostDivider.style.animation = 'divider-drag-shadow 4s infinite';
    }

    playDeleteAnimation(target) {
        if(!target) return;
        const rect = target.getBoundingClientRect();
        const startX = rect.left + rect.width/2;
        const startY = rect.top + rect.height/2;

        this.cursor.style.left = `${startX}px`;
        this.cursor.style.top = `${startY}px`;
        this.cursor.style.animation = 'cursor-click-delete-slow 4s infinite';
    }
}
