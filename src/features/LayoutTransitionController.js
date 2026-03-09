import { store } from '../core/Store.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (start, end, progress) => start + ((end - start) * progress);

export class LayoutTransitionController {
    constructor() {
        this.shell = document.getElementById('editor-shell');
        this.workspace = document.getElementById('workspace-shell');
        this.viewports = document.getElementById('viewports-container');
        this.sidebar = document.getElementById('control-sidebar');
        this.header = document.getElementById('editor-header');

        this.desktopSidebarWidth = 288;
        this.minSidebarWidth = 176;
        this.desktopViewportWidth = 1440;
        this.mobileMergeWidth = 760;
        this.sidebarDockWidth = 1040;
        this.sidebarCompressWidth = 1320;
        this.currentLayout = null;
        this.viewportResizeTimer = null;

        this.handleResize = this.handleResize.bind(this);
        this.handleTransitionEnd = this.handleTransitionEnd.bind(this);

        this.bindEvents();
        this.handleResize({ immediate: true });
    }

    bindEvents() {
        window.addEventListener('resize', this.handleResize);
        this.sidebar?.addEventListener('transitionend', this.handleTransitionEnd);
        this.viewports?.addEventListener('transitionend', this.handleTransitionEnd);
    }

    handleTransitionEnd(event) {
        if (!event || !['transform', 'height', 'grid-template-columns', 'grid-template-rows'].includes(event.propertyName)) {
            return;
        }
        this.emitViewportResize();
    }

    handleResize(options = {}) {
        const nextLayout = this.computeLayout();
        const prevLayout = this.currentLayout;
        const shouldFlip = !this.shouldReduceMotion()
            && !options.immediate
            && prevLayout
            && prevLayout.mode !== nextLayout.mode;
        const flipTargets = shouldFlip ? this.captureFlipTargets() : [];

        this.applyLayout(nextLayout);
        this.currentLayout = nextLayout;

        if (shouldFlip) {
            requestAnimationFrame(() => this.playFlip(flipTargets));
        }

        const resizeDelay = options.immediate || this.shouldReduceMotion() ? 0 : 260;
        this.scheduleViewportResize(resizeDelay);
    }

    shouldReduceMotion() {
        if (window.innerWidth <= this.mobileMergeWidth) return true;
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    }

    captureFlipTargets() {
        const targets = [];
        [this.sidebar, this.viewports].forEach((element) => {
            if (!element) return;
            targets.push({ element, first: element.getBoundingClientRect() });
        });
        return targets;
    }

    playFlip(targets) {
        targets.forEach(({ element, first }) => {
            if (!element || !first) return;
            const last = element.getBoundingClientRect();
            const deltaX = first.left - last.left;
            const deltaY = first.top - last.top;
            const scaleX = last.width ? first.width / last.width : 1;
            const scaleY = last.height ? first.height / last.height : 1;

            if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1 && Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01) {
                return;
            }

            element.animate(
                [
                    {
                        transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
                    },
                    {
                        transform: 'translate(0px, 0px) scale(1, 1)'
                    }
                ],
                {
                    duration: 260,
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                }
            );
        });
    }

    computeLayout() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const compressionSpan = this.desktopViewportWidth - this.mobileMergeWidth;
        const layoutProgress = clamp((this.desktopViewportWidth - Math.min(viewportWidth, this.desktopViewportWidth)) / compressionSpan, 0, 1);

        let mode = 'desktop';
        if (layoutProgress >= 0.8 || viewportWidth <= this.mobileMergeWidth) {
            mode = 'mobile-merged';
        } else if (layoutProgress >= 0.58 || viewportWidth <= this.sidebarDockWidth) {
            mode = 'views-compress';
        } else if (layoutProgress >= 0.5) {
            mode = 'sidebar-docked';
        } else if (layoutProgress > 0) {
            mode = 'sidebar-compress';
        }

        const sidebarProgress = clamp(layoutProgress / 0.5, 0, 1);
        const sidebarWidthPx = Math.round(lerp(this.desktopSidebarWidth, this.minSidebarWidth, sidebarProgress));
        const isDocked = mode === 'sidebar-docked' || mode === 'views-compress' || mode === 'mobile-merged';
        const isSingleView = mode === 'mobile-merged';
        const viewCompressProgress = mode === 'views-compress' || mode === 'mobile-merged'
            ? clamp((layoutProgress - 0.58) / 0.22, 0, 1)
            : 0;

        const workspacePaddingPx = Math.round(lerp(32, 14, layoutProgress));
        const viewportGapPx = Math.round(lerp(32, 14, clamp(layoutProgress / 0.8, 0, 1)));
        const dockedSidebarHeightPx = Math.round(lerp(320, 360, viewCompressProgress));
        const workspaceMainHeightPx = isDocked
            ? Math.round(lerp(viewportHeight * 0.62, viewportHeight * 0.42, viewCompressProgress))
            : viewportHeight - 120;

        const baselineEditorWidth = this.desktopViewportWidth - this.desktopSidebarWidth - 64;
        const editorWidth = isDocked ? viewportWidth - (workspacePaddingPx * 2) : viewportWidth - sidebarWidthPx - (workspacePaddingPx * 2);
        const editorWidthRatio = clamp(editorWidth / baselineEditorWidth, 0.45, 1);

        return {
            mode,
            layoutProgress: Number(layoutProgress.toFixed(3)),
            editorWidthRatio: Number(editorWidthRatio.toFixed(3)),
            sidebarWidthPx,
            isSingleView,
            isDocked,
            viewportGapPx,
            workspacePaddingPx,
            dockedSidebarHeightPx,
            workspaceMainHeightPx
        };
    }

    applyLayout(layout) {
        if (!this.shell) return;

        this.shell.dataset.layoutMode = layout.mode;
        this.shell.dataset.singleView = layout.isSingleView ? 'true' : 'false';
        this.shell.dataset.appReady = 'true';
        this.shell.style.setProperty('--sidebar-width', `${layout.sidebarWidthPx}px`);
        this.shell.style.setProperty('--workspace-gap', `${layout.viewportGapPx}px`);
        this.shell.style.setProperty('--workspace-padding', `${layout.workspacePaddingPx}px`);
        this.shell.style.setProperty('--docked-sidebar-height', `${layout.dockedSidebarHeightPx}px`);
        this.shell.style.setProperty('--workspace-main-height', `${layout.workspaceMainHeightPx}px`);
        this.shell.style.setProperty('--layout-progress', String(layout.layoutProgress));

        store.setLayoutState({
            mode: layout.mode,
            layoutProgress: layout.layoutProgress,
            editorWidthRatio: layout.editorWidthRatio,
            sidebarWidthPx: layout.sidebarWidthPx,
            isSingleView: layout.isSingleView,
            isDocked: layout.isDocked
        });
    }

    scheduleViewportResize(delay) {
        clearTimeout(this.viewportResizeTimer);
        this.viewportResizeTimer = setTimeout(() => this.emitViewportResize(), delay);
    }

    emitViewportResize() {
        store.emit('viewportResize');
    }
}
