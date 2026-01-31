import { EventBus } from './EventBus.js';

export class Store extends EventBus {
    constructor() {
        super();
        this.state = {
            dimensions: {
                l: 120,
                w: 120,
                h: 40,
                radius: 8,
                wallThickness: 2
            },
            dividers: {
                x: [],
                z: []
            },
            hiddenSegments: {},
            isEditing: false,
            mobileView: '3d', // '3d' or 'top'
            tutorialStep: 0,
            colorTheme: 'brown', // 'brown' or 'white'
            logo: null // { type: 'image'|'text', data: string, x: number, z: number, scale: number }
        };
    }

    setColorTheme(theme) {
        this.state.colorTheme = theme;
        this.emit('colorThemeChanged', this.state.colorTheme);
    }

    setLogo(logoObj) {
        this.state.logo = logoObj;
        this.emit('logoChanged', this.state.logo);
    }

    updateLogoPosition(x, z) {
        if (this.state.logo) {
            this.state.logo.x = x;
            this.state.logo.z = z;
            this.emit('logoPositionChanged', { x, z });
        }
    }

    setDimensions(newDims) {
        const nextDims = { ...this.state.dimensions, ...newDims };

        // Clamp wallThickness
        if (nextDims.wallThickness < 2) nextDims.wallThickness = 2;
        if (nextDims.wallThickness > 10) nextDims.wallThickness = 10;

        // Calculate dynamic minimum based on wall thickness
        // Ensure at least 10mm overall, and enough space for walls + 1mm hole
        const minDim = Math.max(10, (nextDims.wallThickness * 2) + 1);
        const maxDim = 280;

        // Clamp Dimensions
        nextDims.l = Math.max(minDim, Math.min(maxDim, nextDims.l));
        nextDims.w = Math.max(minDim, Math.min(maxDim, nextDims.w));
        nextDims.h = Math.max(minDim, Math.min(maxDim, nextDims.h));

        this.state.dimensions = nextDims;
        this.emit('dimensionsChanged', this.state.dimensions);
    }

    addDivider(axis, pos) {
        const arr = axis === 'x' ? this.state.dividers.x : this.state.dividers.z;
        // Prevent duplicates (tolerance 0.1)
        if (arr.some(v => Math.abs(v - pos) < 0.1)) return;

        arr.push(pos);
        arr.sort((a, b) => a - b);
        this.emit('dividersChanged', this.state.dividers);
    }

    updateDividers(axis, newDividers) {
        // Filter duplicates
        const sorted = [...newDividers].sort((a, b) => a - b);
        const unique = [];
        sorted.forEach(v => {
            if (unique.length === 0 || Math.abs(v - unique[unique.length - 1]) >= 0.1) {
                unique.push(v);
            }
        });

        if (axis === 'x') {
            this.state.dividers.x = unique;
        } else {
            this.state.dividers.z = unique;
        }
        this.emit('dividersChanged', this.state.dividers);
    }

    setHiddenSegments(segments) {
        this.state.hiddenSegments = segments;
        this.emit('hiddenSegmentsChanged', this.state.hiddenSegments);
    }

    setEditing(isEditing) {
        this.state.isEditing = isEditing;
        this.emit('editingStateChanged', this.state.isEditing);
    }

    setMobileView(view) {
        this.state.mobileView = view;
        this.emit('mobileViewChanged', this.state.mobileView);
    }

    getState() {
        return this.state;
    }
}

export const store = new Store();
