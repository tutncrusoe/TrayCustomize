export const TUTORIAL_TOTAL_STEPS = 8;

const STEP_CONFIGS = {
    0: {
        instruction: 'Set Length',
        wrongActionMessage: 'Hay chinh chieu dai (Length) truoc.'
    },
    1: {
        instruction: 'Set Width',
        wrongActionMessage: 'Hay chinh chieu rong (Width) truoc.'
    },
    2: {
        instruction: 'Set Height',
        wrongActionMessage: 'Hay chinh chieu cao (Height) truoc.'
    },
    3: {
        instruction: 'Add Horizontal',
        wrongActionMessage: 'Hay them divider ngang (Z) theo huong dan.'
    },
    4: {
        instruction: 'Add Vertical',
        wrongActionMessage: 'Hay them divider doc (X) theo huong dan.'
    },
    5: {
        instruction: 'Drag to move divider',
        wrongActionMessage: 'Hay keo divider doc (X) theo huong dan.'
    },
    6: {
        instruction: 'Drag to move divider',
        wrongActionMessage: 'Hay keo divider ngang (Z) theo huong dan.'
    },
    7: {
        instruction: 'Double click to delete',
        wrongActionMessage: 'Hay double click de xoa divider theo huong dan.'
    }
};

export function getTutorialStepConfig(step) {
    return STEP_CONFIGS[step] || null;
}

export function getTutorialWrongActionMessage(step) {
    const config = getTutorialStepConfig(step);
    return config?.wrongActionMessage || 'Hay thuc hien dung buoc hien tai truoc.';
}

export function formatTutorialStepLabel(step) {
    const idx = Number.isInteger(step) ? step : 0;
    return `Step ${idx + 1}/${TUTORIAL_TOTAL_STEPS}`;
}

export function isTutorialActionAllowed(actionType, payload, tutorialStep, tutorialActive) {
    if (!tutorialActive) return true;

    const axis = payload?.axis;
    switch (tutorialStep) {
        case 0:
            return actionType === 'editDimension' && axis === 'l';
        case 1:
            return actionType === 'editDimension' && axis === 'w';
        case 2:
            return actionType === 'editDimension' && axis === 'h';
        case 3:
            return actionType === 'addDivider' && axis === 'z';
        case 4:
            return actionType === 'addDivider' && axis === 'x';
        case 5:
            return actionType === 'moveDivider' && axis === 'x';
        case 6:
            return actionType === 'moveDivider' && axis === 'z';
        case 7:
            return actionType === 'deleteDividerSegment';
        default:
            return true;
    }
}
