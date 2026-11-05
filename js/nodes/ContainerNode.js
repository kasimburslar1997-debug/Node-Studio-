class ContainerNode extends BaseNode {
    constructor(x, y, width = 200, height = 200) {
        super("container", x, y, width, height);
        this.layout = 'vertical'; // vertical, horizontal
        this.padding = 0; // User Request: Default padding 0
        this.gap = 10;
        this.clipContent = false; // Default: overflow visible
        this.children = new Set();
        this.styles.fill = "transparent";
        this.styles.stroke = "transparent";
        this.styles.strokeWidth = 0;
        this.title = "Container";

        // Auto Layout Properties (Figma-style)
        this.alignItems = 'start';      // start, center, end, stretch
        this.justifyContent = 'start';  // start, center, end, space-between, space-around, space-evenly
        this.flexWrap = 'nowrap';       // nowrap, wrap

        // Auto-resize (Hug Content) is default
        this.autoResize = true;

        // Clip Content (Default false)
        this.clipContent = false;

        // Scroll Behavior (none, vertical, horizontal, both)
        this.scrollBehavior = 'none';

        // Auto Min/Max Calculation (Dynamic constraints)
        this.isAutoMinMax = false;

        // Cache inner element to avoid repeated querySelector calls
        this.innerElement = null;
        this.visualLayoutMode = false;
        this.visualLayoutOverlays = {
            padding: [],
            gaps: [],
            reorderHandles: new Map()
        };



        // Use requestAnimationFrame to defer observation start to avoid initial load thrashing
        requestAnimationFrame(() => {
            if (this.element) {
                this.resizeObserver.observe(this.element);
                this.updateVisuals(); // Trigger initial overflow state
            }
        });
    }

    createDOM() {
        const el = super.createDOM();
        el.classList.add('container-node');
        this.innerElement = el.querySelector('.container-inner');
        return el;
    }

    getHTML() {
        return `
            <div class="container-label">${this.title || "Container"}</div>
            <div class="container-inner" style="padding:${this.padding}px; gap:${this.gap}px; flex-direction:${this.layout === 'horizontal' ? 'row' : 'column'}">
                <!-- Children will be moved here -->
            </div>
        `;
    }

    updateDimensions() {
        // ...
    }

    // Override base updateVisuals to handle container-specifics
    updateVisuals() {
        if (this.isAutoMinMax) {
            const calc = this.calculateMinDimensions();
            // Directly set properties? Or just styles?
            // User requested "min... automatically becomes sum".
            // Setting the properties allows it to persist and be respected by BaseNode logic.
            this.minWidth = calc.minWidth;
            this.minHeight = calc.minHeight;
            this.styles.minWidth = calc.minWidth;
            this.styles.minHeight = calc.minHeight;
        }

        super.updateVisuals();

        if (this.element) {
            // Reset styles first
            this.element.style.overflow = '';
            this.element.style.overflowX = '';
            this.element.style.overflowY = '';

            if (this.scrollBehavior === 'vertical') {
                this.element.style.overflowY = 'auto';
                this.element.style.overflowX = 'hidden';
            } else if (this.scrollBehavior === 'horizontal') {
                this.element.style.overflowX = 'auto';
                this.element.style.overflowY = 'hidden';
            } else if (this.scrollBehavior === 'both') {
                this.element.style.overflow = 'auto';
            } else {
                // 'none' - Use CSS class for pure visibility control
                this.element.classList.toggle('clip-content', this.clipContent);
                // Remove inline overflow to let CSS !important take over default visibility
                this.element.style.overflow = '';
            }
        }

        // OPTIMIZED: Do NOT call super.updateVisuals() to avoid layout thrashing (setting px then fit-content)

        // 1. Handle Layout (Transform & Size)
        // 1. Handle Layout (Transform & Size)
        if (!this.parent) {
            this.element.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.rotation}deg)`;

            // Handle Width
            if (this.flexModeWidth === 'hug') {
                if (this.element.style.width !== "fit-content") {
                    this.element.style.width = "fit-content";
                    this.element.style.minWidth = this.minWidth ? `${this.minWidth}px` : "";
                    this.element.style.maxWidth = this.maxWidth ? `${this.maxWidth}px` : "";
                }
            } else {
                // Fixed or Fill (if root, Fill acts as Fixed)
                this.element.style.width = `${this.width}px`;
                this.element.style.minWidth = this.minWidth ? `${this.minWidth}px` : "";
                this.element.style.maxWidth = this.maxWidth ? `${this.maxWidth}px` : "";
            }

            // Handle Height
            if (this.flexModeHeight === 'hug') {
                if (this.element.style.height !== "fit-content") {
                    this.element.style.height = "fit-content";
                    this.element.style.minHeight = this.minHeight ? `${this.minHeight}px` : "";
                    this.element.style.maxHeight = this.maxHeight ? `${this.maxHeight}px` : "";
                }
            } else {
                this.element.style.height = `${this.height}px`;
                this.element.style.minHeight = this.minHeight ? `${this.minHeight}px` : "";
                this.element.style.maxHeight = this.maxHeight ? `${this.maxHeight}px` : "";

                // Fix: Reset inline layout styles applied when it was a child
                this.element.style.position = '';
                this.element.style.flex = '';
                this.element.style.alignSelf = '';
            }

        } else {
            // Child of another group/container
            // We trust the CSS classes (flex-width-hug, etc) to handle the layout flow
            // BUT, if we are 'hug', we still want the DOM to reflect fit-content purely for internal sizing?
            // Actually, BaseNode updateVisuals adds the classes. 
            // Here we might just ensure we don't accidentally set a fixed px width if we are hugging.

            if (this.flexModeWidth === 'hug' && this.element.style.width !== "fit-content") {
                this.element.style.width = "fit-content";
            }
            if (this.flexModeHeight === 'hug' && this.element.style.height !== "fit-content") {
                this.element.style.height = "fit-content";
            }
        }

        // 2. Handle Styles (Colors, Stroke, Radius) - Copied from BaseNode optimization
        // Use variable if exists, or direct value
        this.element.style.backgroundColor = this.styles.fill;
        this.element.style.color = this.styles.text;
        this.element.style.borderRadius = `${this.styles.radius}px`;
        this.element.style.setProperty("--current-radius", `${this.styles.radius}px`);

        // Apply stroke styles
        let finalStrokeColor = this.styles.stroke || 'var(--border-color)';
        if (this.styles.strokeWidth !== undefined) {
            this.element.style.borderWidth = `${this.styles.strokeWidth}px`;
        }

        // Apply opacity to stroke color if set
        if (this.styles.strokeOpacity !== undefined && !finalStrokeColor.startsWith('var')) {
            if (finalStrokeColor.startsWith('#')) {
                const r = parseInt(finalStrokeColor.slice(1, 3), 16);
                const g = parseInt(finalStrokeColor.slice(3, 5), 16);
                const b = parseInt(finalStrokeColor.slice(5, 7), 16);
                finalStrokeColor = `rgba(${r}, ${g}, ${b}, ${this.styles.strokeOpacity})`;
            } else if (finalStrokeColor.startsWith('rgb(')) {
                finalStrokeColor = finalStrokeColor.replace('rgb(', 'rgba(').replace(')', `, ${this.styles.strokeOpacity})`);
            }
        }
        this.element.style.borderColor = finalStrokeColor;


        // 3. Update Inner Layout Styles (Cached)
        if (!this.innerElement) {
            this.innerElement = this.element.querySelector('.container-inner');
        }

        if (this.innerElement) {
            this.innerElement.style.flexDirection = this.layout === 'horizontal' ? 'row' : 'column';
            this.innerElement.style.padding = `${this.padding}px`;
            this.innerElement.style.gap = `${this.gap}px`;

            // Apply Auto Layout alignment
            this.innerElement.style.alignItems = this.alignItems;
            this.innerElement.style.justifyContent = this.justifyContent;
            this.innerElement.style.flexWrap = this.flexWrap || 'nowrap';

            // === AUTO-OVERFLOW for Fixed Containers (User Request) ===
            // If width is fixed and content overflows horizontally -> overflow-x: auto
            // If height is fixed and content overflows vertically -> overflow-y: auto
            let overflowX = 'visible';
            let overflowY = 'visible';

            if (this.flexModeWidth === 'fixed' || (this.parent && this.flexModeWidth !== 'hug')) {
                overflowX = 'auto';
            }
            if (this.flexModeHeight === 'fixed' || (this.parent && this.flexModeHeight !== 'hug')) {
                overflowY = 'auto';
            }

            // Apply to inner element (which holds children)
            this.innerElement.style.overflowX = overflowX;
            this.innerElement.style.overflowY = overflowY;

            // Handle Visual Layout Overlays
            if (this.visualLayoutMode) {
                this.renderVisualLayoutControls();
            } else if (this.visualLayoutOverlays) {
                this.clearVisualLayoutControls();
            }
        }
    }

    setVisualLayoutMode(enabled) {
        this.visualLayoutMode = enabled;
        this.element.classList.toggle('visual-layout-active', enabled);
        document.body.classList.toggle('visual-layout-active', enabled);
        this.updateVisuals();
    }

    clearVisualLayoutControls() {
        if (!this.visualLayoutOverlays) return;
        this.visualLayoutOverlays.padding.forEach(el => el.remove());
        this.visualLayoutOverlays.gaps.forEach(el => el.remove());
        this.visualLayoutOverlays.reorderHandles.forEach(el => el.remove());
        this.visualLayoutOverlays.padding = [];
        this.visualLayoutOverlays.gaps = [];
        this.visualLayoutOverlays.reorderHandles.clear();
    }

    renderVisualLayoutControls() {
        if (!this.innerElement) return;
        this.clearVisualLayoutControls();

        // 1. Reorder Handles for Children
        const childrenArr = Array.from(this.children).map(id => window.App.nodes.get(id)).filter(n => n);
        childrenArr.forEach((child, index) => {
            const handle = document.createElement('div');
            handle.className = 'reorder-handle';
            handle.title = 'اسحب لإعادة الترتيب';
            child.element.appendChild(handle);
            this.visualLayoutOverlays.reorderHandles.set(child.id, handle);

            // Drag Logic for Reordering
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startReorderDrag(child, index, e);
            });
        });

        // 2. Padding Visualizers (Blue)
        ['top', 'bottom', 'left', 'right'].forEach(side => {
            const pad = document.createElement('div');
            pad.className = `padding-visualizer side-${side} diagonal-shade`;

            const grip = document.createElement('div');
            grip.className = 'layout-grip';
            pad.appendChild(grip);

            this.innerElement.appendChild(pad);
            this.visualLayoutOverlays.padding.push(pad);

            // Ensure a minimum visual area even if padding is 0
            const displayPadding = Math.max(8, this.padding);
            if (side === 'top' || side === 'bottom') pad.style.height = `${displayPadding}px`;
            else pad.style.width = `${displayPadding}px`;

            grip.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startPaddingDrag(e);
            });
        });

        // 3. Gap Visualizers (Pink)
        if (childrenArr.length > 1) {
            for (let i = 0; i < childrenArr.length - 1; i++) {
                const gap = document.createElement('div');
                gap.className = 'gap-visualizer diagonal-shade';
                const grip = document.createElement('div');
                grip.className = 'layout-grip';
                gap.appendChild(grip);

                const c1 = childrenArr[i].element.getBoundingClientRect();
                const c2 = childrenArr[i + 1].element.getBoundingClientRect();
                const parentRect = this.innerElement.getBoundingClientRect();

                if (this.layout === 'horizontal') {
                    gap.classList.add('horizontal');
                    const displayGap = Math.max(12, this.gap);
                    gap.style.left = `${c1.right - parentRect.left}px`;
                    gap.style.width = `${displayGap}px`;
                    gap.style.height = '100%';
                    gap.style.top = '0';
                } else {
                    gap.classList.add('vertical');
                    const displayGap = Math.max(12, this.gap);
                    gap.style.top = `${c1.bottom - parentRect.top}px`;
                    gap.style.height = `${displayGap}px`;
                    gap.style.width = '100%';
                    gap.style.left = '0';
                }

                this.innerElement.appendChild(gap);
                this.visualLayoutOverlays.gaps.push(gap);

                grip.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.startGapDrag(e);
                });
            }
        }
    }

    startReorderDrag(child, startIndex, e) {
        const initialX = e.clientX;
        const initialY = e.clientY;
        const childrenArr = Array.from(this.children);
        let currentIndex = startIndex;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - initialX;
            const dy = moveEvent.clientY - initialY;

            // Reorder based on relative movement and siblings' rects
            const siblings = Array.from(this.children).map(id => window.App.nodes.get(id)).filter(n => n);
            const myRect = child.element.getBoundingClientRect();

            for (let i = 0; i < siblings.length; i++) {
                if (siblings[i].id === child.id) continue;
                const sibRect = siblings[i].element.getBoundingClientRect();

                let shouldSwap = false;
                if (this.layout === 'horizontal') {
                    if (i < currentIndex && myRect.left < sibRect.left + sibRect.width / 2) shouldSwap = true;
                    if (i > currentIndex && myRect.right > sibRect.left + sibRect.width / 2) shouldSwap = true;
                } else {
                    if (i < currentIndex && myRect.top < sibRect.top + sibRect.height / 2) shouldSwap = true;
                    if (i > currentIndex && myRect.bottom > sibRect.top + sibRect.height / 2) shouldSwap = true;
                }

                if (shouldSwap) {
                    // Swap in array
                    const temp = childrenArr[currentIndex];
                    childrenArr.splice(currentIndex, 1);
                    childrenArr.splice(i, 0, temp);

                    this.children = new Set(childrenArr);
                    currentIndex = i;

                    // DOM Swap
                    if (i < currentIndex) {
                        this.innerElement.insertBefore(child.element, siblings[i].element);
                    } else {
                        this.innerElement.insertBefore(child.element, siblings[i].element.nextSibling);
                    }
                    this.renderVisualLayoutControls(); // Update gap positions
                    break;
                }
            }
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (window.App) window.App.pushHistory();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    startPaddingDrag(e) {
        const initialValue = this.padding;
        const initialX = e.clientX;
        const initialY = e.clientY;

        const onMouseMove = (moveEvent) => {
            const dx = Math.abs(moveEvent.clientX - initialX);
            const dy = Math.abs(moveEvent.clientY - initialY);
            const delta = Math.max(dx, dy) * (moveEvent.clientX < initialX || moveEvent.clientY < initialY ? -1 : 1);

            this.padding = Math.max(0, initialValue + delta);
            this.updateVisuals();
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (window.App) window.App.pushHistory();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    startGapDrag(e) {
        const initialValue = this.gap;
        const initialX = e.clientX;
        const initialY = e.clientY;

        const onMouseMove = (moveEvent) => {
            const delta = (this.layout === 'horizontal' ? (moveEvent.clientX - initialX) : (moveEvent.clientY - initialY));
            this.gap = Math.max(0, initialValue + delta);
            this.updateVisuals();
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (window.App) window.App.pushHistory();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    updateLayout(layoutMode) {
        if (layoutMode) this.layout = layoutMode;

        // Removed autoResize reset to preserve user choice (Fixed vs Hug)
        this.updateVisuals();
    }

    // Override manual resize to disable Auto Hug
    resize(w, h, x, y) {
        // If dimensions changed, switch off Hug mode
        if (w !== this.width) this.flexModeWidth = 'fixed';
        if (h !== this.height) this.flexModeHeight = 'fixed';

        super.resize(w, h, x, y);

        // Remove fit-content styles if we are now fixed
        if (this.flexModeWidth === 'fixed') this.element.style.minWidth = "";
        if (this.flexModeHeight === 'fixed') this.element.style.minHeight = "";
    }

    addChild(node) {
        if (this.children.has(node.id)) return;

        this.children.add(node.id);
        node.parent = this;

        // Reset absolute positioning for flex layout
        node.x = 0;
        node.y = 0;

        // Move DOM element
        const inner = this.element.querySelector('.container-inner');
        inner.appendChild(node.element);

        // Update child visuals to remove absolute positioning
        node.updateVisuals();

        // Trigger updates
        this.onChildResize();
    }

    /**
     * Insert a child at a specific index in the children order.
     * Used by drag-and-drop insertion guides.
     * @param {BaseNode} node - The node to insert
     * @param {number} index - The insertion index (0 = first child)
     */
    addChildAt(node, index) {
        if (this.children.has(node.id)) return;

        // Convert Set to Array, insert at index, recreate Set
        const arr = Array.from(this.children);
        const clampedIndex = Math.max(0, Math.min(index, arr.length));
        arr.splice(clampedIndex, 0, node.id);
        this.children = new Set(arr);

        node.parent = this;

        // Reset absolute positioning for flex layout
        node.x = 0;
        node.y = 0;

        // Move DOM element at the correct position
        const inner = this.element.querySelector('.container-inner');
        // Get only direct node children (skip overlays like gap-visualizer, etc.)
        const existingChildren = inner.querySelectorAll(':scope > .node');

        if (clampedIndex < existingChildren.length) {
            inner.insertBefore(node.element, existingChildren[clampedIndex]);
        } else {
            inner.appendChild(node.element);
        }

        // Update child visuals to remove absolute positioning
        node.updateVisuals();

        // Trigger updates
        this.onChildResize();
    }

    removeChild(node) {
        if (this.children.has(node.id)) {
            this.children.delete(node.id);
            node.parent = null;
            // DOM move handled by caller
            this.onChildResize();
        }
    }

    fitToContent() {
        this.autoResize = true;
        this.updateVisuals();
    }

    // New Bubble-Up Handler
    onChildResize() {
        if (this.isAutoMinMax) {
            const calc = this.calculateMinDimensions();
            this.minWidth = calc.minWidth;
            this.minHeight = calc.minHeight;
            this.styles.minWidth = calc.minWidth;
            this.styles.minHeight = calc.minHeight;
        }

        // If we are auto-resizing (Hug), updateVisuals will handle the new size
        // If we are Fixed, updateVisuals ensures we respect Min/Max
        this.updateVisuals();

        // Propagate up to parent if it exists
        if (this.parent && typeof this.parent.onChildResize === 'function') {
            this.parent.onChildResize();
        }
    }

    calculateMinDimensions() {
        if (!this.children || this.children.size === 0) return { width: 50, height: 50 };

        let totalMain = 0;
        let maxCross = 0;
        const isHorizontal = this.layout === 'horizontal';

        // Padding is added to both ends of main axis and cross axis
        const paddingTotal = (this.padding * 2);

        // Convert set to array for iteration
        const childNodes = [];
        this.children.forEach(id => {
            const node = (window.App && window.App.nodes) ? window.App.nodes.get(id) : null;
            if (node) childNodes.push(node);
        });

        if (childNodes.length === 0) return { width: 50 + paddingTotal, height: 50 + paddingTotal };

        // Account for Gaps (N-1 gaps)
        const totalGap = Math.max(0, childNodes.length - 1) * this.gap;
        totalMain += totalGap;

        childNodes.forEach(child => {
            // Smart Sizing Calculation based on Child's Flex Mode
            let effectiveW = child.width || 50;
            let effectiveH = child.height || 50;

            // If child is 'fill', it shouldn't dictate parent size beyond its minConstraint
            // unless the parent is also fill/fixed, in which case this calc determines min-content.
            if (child.flexModeWidth === 'fill') {
                effectiveW = child.minWidth || 50; // Use minWidth for Fill children
            }
            if (child.flexModeHeight === 'fill') {
                effectiveH = child.minHeight || 50;
            }

            // If child is 'hug', trust its current size (which should be fitted to its own content)
            // If child is 'fixed', trust its explicit size.

            const childW = effectiveW;
            const childH = effectiveH;

            if (isHorizontal) {
                totalMain += childW;
                maxCross = Math.max(maxCross, childH);
            } else {
                totalMain += childH;
                maxCross = Math.max(maxCross, childW);
            }
        });

        totalMain += paddingTotal;
        maxCross += paddingTotal;

        return {
            minWidth: isHorizontal ? totalMain : maxCross,
            minHeight: isHorizontal ? maxCross : totalMain
        };
    }
}
