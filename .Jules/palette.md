## 2024-05-23 - Accessibility of Form Inputs
**Learning:** In projects without a formal build system or component library, standard semantic HTML (`label`, `aria-label`) is the most reliable way to ensure accessibility without introducing new dependencies or breaking existing styles.
**Action:** Always verify if visual labels are programmatically associated with inputs, especially in "dashboard" style interfaces where labels might be loosely placed `span` elements.
