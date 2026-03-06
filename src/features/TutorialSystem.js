// src/features/TutorialSystem.js
import { store } from '../core/Store.js';
import {
    TUTORIAL_TOTAL_STEPS,
    formatTutorialStepLabel,
    getTutorialWrongActionMessage
} from './TutorialGuard.js';

export class TutorialSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.step = 0;
        this.isActive = false;
        this.isFirstShow = true;
        this.isResetting = false;
        this.lastAddedDividerX = null;
        this.lastAddedDividerZ = null;
        this.wrongActionTimer = null;

        // DOM Elements
        this.overlay = document.getElementById('tutorial-overlay');
        this.underlay = document.getElementById('tutorial-underlay');
        this.blob = document.getElementById('tut-blob');
        this.text = document.getElementById('tut-text');
        this.cursor = document.getElementById('ghost-cursor');
        this.skipBtn = document.getElementById('tut-skip');
        this.ghostDivider = document.getElementById('ghost-divider');
        this.cursorTrail = document.getElementById('cursor-trail');
        this.sidebar = document.querySelector('aside');
        this.wrongTooltip = this.createWrongTooltip();

        this.pendingStart = false;
        this.ensureUiLockStyle();
        this.bindEvents();
        this.init();
    }

    init() {
        store.setTutorialActive(false);
        if (!sessionStorage.getItem('tutorial_seen')) {
            this.pendingStart = true;
            sessionStorage.setItem('tutorial_seen', 'true');
        } else {
            if (this.skipBtn) this.skipBtn.innerText = 'Tutorial';
            document.body.classList.remove('tutorial-active');
            if (this.overlay) this.overlay.style.pointerEvents = 'none';
            this.applyUiLocks(false);
        }
    }

    bindEvents() {
        if (this.skipBtn) {
            this.skipBtn.addEventListener('click', () => this.toggle());
        }

        // Start tutorial only after the model is generated and everything is ready for the first time
        store.on('modelRegenerated', () => {
            if (this.pendingStart) {
                this.pendingStart = false;
                this.start();
            }
        });

        store.on('dimensionsPatched', ({ changedKeys = [] } = {}) => {
            if (!this.isActive || this.isResetting) return;
            if (this.step === 0 && changedKeys.includes('l')) {
                this.advance();
            } else if (this.step === 1 && changedKeys.includes('w')) {
                this.advance();
            } else if (this.step === 2 && changedKeys.includes('h')) {
                this.advance();
            }
        });

        store.on('tutorialAction', (action) => {
            if (!this.isActive || this.isResetting || !action) return;

            if (action.type === 'addDivider' && action.axis === 'x') {
                this.lastAddedDividerX = action.pos;
            }
            if (action.type === 'addDivider' && action.axis === 'z') {
                this.lastAddedDividerZ = action.pos;
            }

            if (this.step === 3 && action.type === 'addDivider' && action.axis === 'z') {
                this.advance();
                return;
            }

            if (this.step === 4 && action.type === 'addDivider' && action.axis === 'x') {
                this.advance();
                return;
            }

            if (this.step === 5 && action.type === 'moveDivider' && action.axis === 'x') {
                this.advance();
                return;
            }

            if (this.step === 6 && action.type === 'moveDivider' && action.axis === 'z') {
                this.advance();
                return;
            }

            if (this.step === 7 && action.type === 'deleteDividerSegment') {
                this.complete();
            }
        });

        store.on('tutorialWrongAction', (payload) => {
            this.showWrongAction(payload);
        });
    }

    ensureUiLockStyle() {
        if (document.getElementById('tutorial-lock-style')) return;
        const style = document.createElement('style');
        style.id = 'tutorial-lock-style';
        style.textContent = `
            .tutorial-ui-locked {
                opacity: 0.38 !important;
                filter: grayscale(0.5);
                pointer-events: none !important;
                cursor: not-allowed !important;
            }
        `;
        document.head.appendChild(style);
    }

    createWrongTooltip() {
        let el = document.getElementById('tutorial-wrong-tooltip');
        if (el) return el;

        el = document.createElement('div');
        el.id = 'tutorial-wrong-tooltip';
        el.style.cssText = `
            position: fixed;
            z-index: 10004;
            max-width: 220px;
            padding: 8px 10px;
            background: rgba(239, 68, 68, 0.95);
            color: #fff;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.3;
            pointer-events: none;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.35);
            display: none;
        `;
        document.body.appendChild(el);
        return el;
    }

    getLockControlIds() {
        return [
            'reset-btn',
            'color-brown',
            'color-white',
            'color-red',
            'color-blue',
            'radius',
            'wall-thickness',
            'upload-logo-btn',
            'add-text-btn',
            'remove-logo-btn',
            'export-btn',
            'add-to-cart-btn',
            'open-cart-btn',
            'buy-now-btn',
            'tab-3d',
            'tab-top'
        ];
    }

    setElementLocked(el, locked) {
        if (!el) return;

        if (locked) {
            if (el.dataset.tutorialPrevDisabled === undefined) {
                el.dataset.tutorialPrevDisabled = ('disabled' in el && el.disabled) ? '1' : '0';
            }
            if ('disabled' in el) {
                el.disabled = true;
            }
            el.classList.add('tutorial-ui-locked');
        } else {
            if ('disabled' in el && el.dataset.tutorialPrevDisabled !== undefined) {
                el.disabled = el.dataset.tutorialPrevDisabled === '1';
            }
            delete el.dataset.tutorialPrevDisabled;
            el.classList.remove('tutorial-ui-locked');
        }
    }

    applyUiLocks(locked) {
        this.getLockControlIds().forEach((id) => {
            this.setElementLocked(document.getElementById(id), locked);
        });
        if (this.sidebar) {
            this.sidebar.classList.toggle('tutorial-ui-locked', locked);
        }
    }

    showWrongAction(payload = {}) {
        if (!this.isActive || !this.wrongTooltip) return;

        const message = payload.message || getTutorialWrongActionMessage(this.step);
        const blobRect = this.blob?.getBoundingClientRect();
        const anchorX = payload.anchor?.x ?? (blobRect ? blobRect.left + blobRect.width / 2 : window.innerWidth / 2);
        const anchorY = payload.anchor?.y ?? (blobRect ? blobRect.bottom + 8 : window.innerHeight / 2);

        this.wrongTooltip.innerText = message;
        this.wrongTooltip.style.display = 'block';

        const tooltipRect = this.wrongTooltip.getBoundingClientRect();
        const left = Math.min(Math.max(12, anchorX - tooltipRect.width / 2), window.innerWidth - tooltipRect.width - 12);
        const top = Math.min(Math.max(12, anchorY + 10), window.innerHeight - tooltipRect.height - 12);

        this.wrongTooltip.style.left = `${left}px`;
        this.wrongTooltip.style.top = `${top}px`;
        this.wrongTooltip.style.opacity = '1';

        clearTimeout(this.wrongActionTimer);
        this.wrongActionTimer = setTimeout(() => this.hideWrongAction(), 1200);
    }

    hideWrongAction() {
        if (!this.wrongTooltip) return;
        this.wrongTooltip.style.display = 'none';
    }

    toggle() {
        if (this.isActive) this.complete();
        else this.start();
    }

    resetToTutorialPreset() {
        const preset = { l: 120, w: 120, h: 40, radius: 8, wallThickness: 2 };
        store.setDimensions(preset);
        store.updateDividers('x', []);
        store.updateDividers('z', []);
        store.setHiddenSegments({});
        store.setLogo(null);
        store.setColorTheme('brown');

        const radiusInput = document.getElementById('radius');
        if (radiusInput) radiusInput.value = String(preset.radius);
        const wallInput = document.getElementById('wall-thickness');
        if (wallInput) wallInput.value = String(preset.wallThickness);

        ['brown', 'white', 'red', 'blue'].forEach((theme) => {
            document.getElementById(`color-${theme}`)?.classList.remove('border-white', 'scale-105');
        });
        document.getElementById('color-brown')?.classList.add('border-white');
    }

    start() {
        this.isActive = true;
        this.isFirstShow = true;
        this.isResetting = true;
        this.lastAddedDividerX = null;
        this.lastAddedDividerZ = null;

        store.setTutorialActive(true);
        document.body.classList.add('tutorial-active');
        this.applyUiLocks(true);
        if (this.skipBtn) this.skipBtn.innerText = 'Skip Tutorial';

        this.resetToTutorialPreset();

        this.isResetting = false;
        this.showStep(0);
    }

    complete() {
        this.isActive = false;
        this.isResetting = false;
        document.body.classList.remove('tutorial-active');
        this.applyUiLocks(false);
        if (this.skipBtn) this.skipBtn.innerText = 'Tutorial';
        if (this.overlay) this.overlay.style.pointerEvents = 'none';
        this.hideWrongAction();
        store.setTutorialActive(false);
        store.emit('tutorialCompleted');
    }

    advance() {
        this.showStep(this.step + 1);
    }

    showStep(stepIndex) {
        if (!this.isActive) return;
        this.step = stepIndex;
        store.setTutorialStep(stepIndex);

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

        if (stepIndex >= TUTORIAL_TOTAL_STEPS) {
            this.complete();
            return;
        }

        // Wait for potential transitions
        setTimeout(() => this.renderStep(stepIndex), 100);
    }

    withProgress(text, stepIndex) {
        return `${formatTutorialStepLabel(stepIndex)} - ${text}`;
    }

    renderStep(stepIndex) {
        if (!this.blob) return;

        const getLabel3D = (axis) => {
            const label3D = document.getElementById(`label-3d-${axis}`);
            if (label3D && label3D.offsetParent !== null) return label3D;
            return document.getElementById(`dim-${axis}`);
        };

        const topView = document.getElementById('dim-container');

        switch(stepIndex) {
            case 0: // Set Length
                this.positionHint(getLabel3D('l'), this.withProgress('Set Length', stepIndex), 'left');
                break;
            case 1: // Set Width
                this.positionHint(getLabel3D('w'), this.withProgress('Set Width', stepIndex), 'right');
                break;
            case 2: // Set Height
                this.positionHint(getLabel3D('h'), this.withProgress('Set Height', stepIndex), 'top');
                break;
            case 3: // Add Horizontal (Add Z)
                this.positionHint(topView, this.withProgress('Add Horizontal', stepIndex), 'right-offset');
                this.playAnimation('cursor-scan-h', topView, 'right-edge-outer');
                break;
            case 4: // Add Vertical (Add X)
                this.positionHint(topView, this.withProgress('Add Vertical', stepIndex), 'bottom-offset');
                this.playAnimation('cursor-scan-v', topView, 'bottom-edge-outer');
                break;
            case 5: { // Drag X
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
                this.positionHint(dragTargetX, this.withProgress('Drag to move divider', stepIndex), 'bottom');
                this.playDragAnimation(dragTargetX, 'x');
                break;
            }
            case 6: { // Drag Z
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
                this.positionHint(dragTargetZ, this.withProgress('Drag to move divider', stepIndex), 'bottom');
                this.playDragAnimation(dragTargetZ, 'z');
                break;
            }
            case 7: { // Delete
                let deleteTarget = topView;
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
                        const coords = this.sceneManager.getScreenCoordsFromTopWorld(0, targetZ);
                        deleteTarget = {
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
                            id: 'virtual-divider-target-delete',
                            classList: { contains: () => false }
                        };
                    }
                }
                this.positionHint(topView, this.withProgress('Double click to delete', stepIndex), 'bottom-offset');
                this.playDeleteAnimation(deleteTarget);
                break;
            }
            default:
                this.complete();
        }
    }

    positionHint(target, text, side) {
        if(!target || !this.text || !this.blob) return;
        const rect = target.getBoundingClientRect();
        this.text.innerText = text;

        let top;
        let left;

        if (target.tagName === 'INPUT' || target.classList.contains('input-group')) {
            top = rect.bottom + 10;
            left = rect.left + rect.width/2 - 50;
        } else if (target.id && (target.id.startsWith('label-3d-') || (target.id.startsWith('dim-') && target.id !== 'dim-container'))) {
            top = rect.top + rect.height/2 - 50;
            left = rect.left + rect.width/2 - 50;
        } else {
            if (side === 'right-offset') {
                top = rect.top + rect.height / 2 - 50;
                let wallX = rect.right; // fallback
                if (this.sceneManager) {
                    const { l } = store.getState().dimensions;
                    const coords = this.sceneManager.getScreenCoordsFromTopWorld(l / 2, 0);
                    wallX = coords.x;
                }
                left = wallX + 20;
            } else if (side === 'bottom-offset') {
                let wallY = rect.bottom; // fallback
                if (this.sceneManager) {
                    const { w } = store.getState().dimensions;
                    const coords = this.sceneManager.getScreenCoordsFromTopWorld(0, w / 2);
                    wallY = coords.y;
                }
                top = wallY + 20;
                left = rect.left + rect.width / 2 - 70;
            } else if (side === 'right') {
                top = rect.top + rect.height/2 - 50;
                left = rect.right + 20;
                if (left + 140 > window.innerWidth) left = rect.left - 120;
            } else {
                top = rect.bottom + 60;
                left = rect.left + rect.width/2 - 70;
            }
        }

        if (window.innerWidth < 768) {
            this.blob.style.transform = 'scale(0.8)';
        } else {
            this.blob.style.transform = '';
        }

        if (this.isFirstShow) {
            this.blob.style.transition = 'none';
        }

        this.blob.style.top = `${top}px`;
        this.blob.style.left = `${left}px`;

        if (this.isFirstShow) {
            this.isFirstShow = false;
            this.blob.style.display = 'block';
            this.blob.offsetHeight;
            this.blob.style.transition = 'all 0.5s ease-out, opacity 0.3s ease-in';
        }
    }

    playAnimation(animName, target, edge) {
        if(!target || !this.cursor || !this.cursorTrail) return;
        const rect = target.getBoundingClientRect();

        if (edge === 'right-edge-outer') {
            let wallX = rect.right;
            if (this.sceneManager) {
                const { l } = store.getState().dimensions;
                const coords = this.sceneManager.getScreenCoordsFromTopWorld(l / 2, 0);
                wallX = coords.x;
            }
            const cursorX = wallX + 5;
            const cursorYStart = rect.top + rect.height/2;
            this.cursor.style.left = `${cursorX}px`;
            this.cursor.style.top = `${cursorYStart}px`;

            this.cursorTrail.style.opacity = 1;
            this.cursorTrail.style.left = `${cursorX + 6}px`;
            this.cursorTrail.style.top = `${cursorYStart - 75}px`;
            this.cursorTrail.style.height = '150px';
            this.cursorTrail.style.width = '4px';
        } else if (edge === 'bottom-edge-outer') {
            let wallY = rect.bottom;
            if (this.sceneManager) {
                const { w } = store.getState().dimensions;
                const coords = this.sceneManager.getScreenCoordsFromTopWorld(0, w / 2);
                wallY = coords.y;
            }
            const cursorX = rect.left + rect.width/2 - 75;
            const cursorY = wallY + 5;
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
        if(!target || !this.cursor || !this.ghostDivider) return;
        const rect = target.getBoundingClientRect();
        const startX = rect.left + rect.width/2;
        const startY = rect.top + rect.height/2;

        this.cursor.style.left = `${startX}px`;
        this.cursor.style.top = `${startY}px`;
        this.cursor.style.transform = 'translate(-50%, -50%)';
        this.cursor.style.opacity = '1';
        this.cursor.innerHTML = '<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M20 10.95V7c0-1.1-.9-2-2-2s-2 .9-2 2v2.5h-1V5c0-1.1-.9-2-2-2s-2 .9-2 2v4.5h-1V6c0-1.1-.9-2-2-2s-2 .9-2 2v7.5c0 3.31 2.69 6 6 6s6-2.69 6-6z" /></svg>';

        const anim = axis === 'z' ? 'cursor-wiggle-y' : 'cursor-wiggle-x';
        this.cursor.style.animation = `${anim} 4s infinite`;

        this.ghostDivider.style.left = `${startX}px`;
        this.ghostDivider.style.top = `${startY}px`;
        this.ghostDivider.style.transform = 'translate(-50%, -50%)';
        this.ghostDivider.style.opacity = '0.7';
        this.ghostDivider.style.animation = 'none';

        if (axis === 'z') {
            this.ghostDivider.style.width = '180px';
            this.ghostDivider.style.height = '4px';
        } else {
            this.ghostDivider.style.width = '4px';
            this.ghostDivider.style.height = '180px';
        }
    }

    playDeleteAnimation(target) {
        if(!target || !this.cursor) return;
        const rect = target.getBoundingClientRect();
        const startX = rect.left + rect.width/2;
        const startY = rect.top + rect.height/2;

        this.cursor.style.left = `${startX}px`;
        this.cursor.style.top = `${startY}px`;
        this.cursor.style.animation = 'cursor-click-delete-slow 4s infinite';
    }
}
