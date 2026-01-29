// src/features/TutorialSystem.js
import { store } from '../core/Store.js';

export class TutorialSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.step = 0;
        this.isActive = false;
        this.lastAddedDividerX = null;
        this.lastAddedDividerZ = null;
        this.previousDividersX = [];
        this.previousDividersZ = [];

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
             // Detect newly added X divider for Step 5 targeting
             const newX = divs.x;
             if (newX.length > this.previousDividersX.length) {
                 // Find the value that is new
                 const added = newX.find(val => !this.previousDividersX.includes(val));
                 if (added !== undefined) {
                     this.lastAddedDividerX = added;
                 }
             }

             // Detect newly added Z divider for Step 6 targeting
             const newZ = divs.z;
             if (newZ.length > this.previousDividersZ.length) {
                 const added = newZ.find(val => !this.previousDividersZ.includes(val));
                 if (added !== undefined) {
                     this.lastAddedDividerZ = added;
                 }
             }

             const xMoved = JSON.stringify(newX.sort()) !== JSON.stringify(this.previousDividersX.sort());
             const zMoved = JSON.stringify(newZ.sort()) !== JSON.stringify(this.previousDividersZ.sort());

             this.previousDividersX = [...newX];
             this.previousDividersZ = [...newZ];

             if (!this.isActive) return;

             // Step 3 (Add Horiz/Z)
             if (this.step === 3 && divs.z.length > 0) {
                 this.advance();
                 return;
             }

             // Step 4 (Add Vert/X)
             if (this.step === 4 && divs.x.length > 0) {
                 this.advance();
                 return;
             }

             // Step 5 (Drag X)
             if (this.step === 5 && xMoved) {
                 this.advance();
                 return;
             }

             // Step 6 (Drag Z)
             if (this.step === 6 && zMoved) {
                 this.advance();
                 return;
             }
        });

        // Step 7 (Delete)
        store.on('hiddenSegmentsChanged', () => {
             if (this.isActive && this.step === 7) {
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

        if (stepIndex > 7) {
            this.complete();
            return;
        }

        // Wait for potential transitions
        setTimeout(() => this.renderStep(stepIndex), 100);
    }

    renderStep(stepIndex) {
        if (!this.blob) return;

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
            case 5: // Drag X
                let dragTargetX = topView;
                if (this.sceneManager) {
                    const state = store.getState();
                    const divsX = state.dividers.x;
                    let targetX = null;

                    if (this.lastAddedDividerX !== null && divsX.includes(this.lastAddedDividerX)) {
                        targetX = this.lastAddedDividerX;
                    } else if (divsX.length > 0) {
                        targetX = divsX[divsX.length - 1];
                    }

                    if (targetX !== null) {
                        const coords = this.sceneManager.getScreenCoordsFromTopWorld(targetX, 0);
                        dragTargetX = {
                            getBoundingClientRect: () => ({
                                left: coords.x - 1,
                                top: coords.y - 1,
                                right: coords.x + 1,
                                bottom: coords.y + 1,
                                width: 2,
                                height: 2,
                                x: coords.x,
                                y: coords.y
                            }),
                            tagName: 'DIV',
                            id: 'virtual-divider-target-x',
                            classList: { contains: () => false }
                        };
                    }
                }
                this.positionHint(dragTargetX, 'Drag to move divider', 'bottom');
                this.playDragAnimation(dragTargetX, 'x');
                break;
            case 6: // Drag Z
                let dragTargetZ = topView;
                if (this.sceneManager) {
                    const state = store.getState();
                    const divsZ = state.dividers.z;
                    let targetZ = null;

                    if (this.lastAddedDividerZ !== null && divsZ.includes(this.lastAddedDividerZ)) {
                        targetZ = this.lastAddedDividerZ;
                    } else if (divsZ.length > 0) {
                        targetZ = divsZ[divsZ.length - 1];
                    }

                    if (targetZ !== null) {
                        // For Z dividers (horizontal lines), X is 0 (center), Z is the position
                        const coords = this.sceneManager.getScreenCoordsFromTopWorld(0, targetZ);
                        dragTargetZ = {
                            getBoundingClientRect: () => ({
                                left: coords.x - 1,
                                top: coords.y - 1,
                                right: coords.x + 1,
                                bottom: coords.y + 1,
                                width: 2,
                                height: 2,
                                x: coords.x,
                                y: coords.y
                            }),
                            tagName: 'DIV',
                            id: 'virtual-divider-target-z',
                            classList: { contains: () => false }
                        };
                    }
                }
                this.positionHint(dragTargetZ, 'Drag to move divider', 'right');
                this.playDragAnimation(dragTargetZ, 'z');
                break;
            case 7: // Delete
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

        if (target.tagName === 'INPUT' || target.classList.contains('input-group')) {
            top = rect.bottom + 10;
            left = rect.left + rect.width/2 - 50;
            this.arrow.style.opacity = 0;
        } else if (target.id.startsWith('label-3d-')) {
            top = rect.top + rect.height/2 - 50;
            left = rect.left + rect.width/2 - 50;
            this.arrow.style.opacity = 0;
        } else {
            if (side === 'right-offset') {
                top = rect.top + rect.height / 2 - 50;
                left = rect.right - 110;
                this.arrow.style.opacity = 0;
            } else if (side === 'bottom-offset') {
                top = rect.bottom - 90;
                left = rect.left + rect.width / 2 - 70;
                arrowRot = 270;
                this.arrow.style.opacity = 0;
            } else if (side === 'right') {
                // New logic for Drag Z (Horizontal line)
                top = rect.top + rect.height/2 - 50;
                left = rect.right + 20;
                if (left + 140 > window.innerWidth) left = rect.left - 120; // Flip if too far right
                arrowRot = 180; // Point Left
                arrowTop = rect.top;
                arrowLeft = rect.right - 5;
                this.arrow.style.opacity = 0; // Hide arrow for drag steps anyway as per request/design
            } else {
                top = rect.bottom + 60;
                left = rect.left + rect.width/2 - 70;
                arrowRot = 45;
                arrowTop = rect.bottom + 5;
                arrowLeft = rect.left + rect.width/2 - 30;
                if(side !== 'right-offset' && side !== 'bottom-offset') this.arrow.style.opacity = 1;
            }
        }

        // Hide arrow specifically for Drag steps (5 & 6) as we rely on the Hand Cursor
        if (text === 'Drag to move divider') {
             this.arrow.style.opacity = 0;
             // Adjust bubble position for horizontal line drag (Step 6)
             if (side === 'right') {
                  // Center vertically on the line
                  top = rect.top - 20;
                  // Place to the right
                  left = rect.right + 40;
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

        if (edge === 'right-edge-outer') {
            const cursorX = rect.right - 130;
            const cursorYStart = rect.top + rect.height/2;
            this.cursor.style.left = `${cursorX}px`;
            this.cursor.style.top = `${cursorYStart}px`;

            this.cursorTrail.style.opacity = 1;
            this.cursorTrail.style.left = `${cursorX + 6}px`;
            this.cursorTrail.style.top = `${cursorYStart - 75}px`;
            this.cursorTrail.style.height = '150px';
            this.cursorTrail.style.width = '4px';
        } else if (edge === 'bottom-edge-outer') {
            const cursorX = rect.left + rect.width/2 - 75;
            const cursorY = rect.bottom - 130;
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

    playDragAnimation(target, axis) {
        if(!target) return;
        const rect = target.getBoundingClientRect();
        const startX = rect.left + rect.width/2;
        const startY = rect.top + rect.height/2;

        this.cursor.style.left = `${startX}px`;
        this.cursor.style.top = `${startY}px`;
        this.cursor.style.opacity = '1';
        // Grab/Fist Icon
        this.cursor.innerHTML = '<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M20 10.95V7c0-1.1-.9-2-2-2s-2 .9-2 2v2.5h-1V5c0-1.1-.9-2-2-2s-2 .9-2 2v4.5h-1V6c0-1.1-.9-2-2-2s-2 .9-2 2v7.5c0 3.31 2.69 6 6 6s6-2.69 6-6z" /></svg>';

        const anim = axis === 'z' ? 'cursor-wiggle-y' : 'cursor-wiggle-x';
        this.cursor.style.animation = `${anim} 4s infinite`;

        this.ghostDivider.style.left = `${startX}px`;
        this.ghostDivider.style.top = `${startY}px`;
        this.ghostDivider.style.opacity = 0;
        this.ghostDivider.style.animation = `${anim} 4s infinite`;

        if (axis === 'z') {
            // Horizontal Line, Move Y
            this.ghostDivider.style.width = '100px';
            this.ghostDivider.style.height = '4px';
        } else {
            // Vertical Line, Move X
            this.ghostDivider.style.width = '4px';
            this.ghostDivider.style.height = '100px';
        }
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
