// EventModule.js - Main event orchestrator coordinating sub-module event bindings
Object.assign(App, {
    bindEvents() {
        this._bindViewportEvents();
        this._bindDragDropEvents();
        this._bindPointerEvents();
        this._bindShortcutEvents();
        this._bindTooltipEvents();
    },

    handleLongPress(id) {
        // Ensure no conflicting selection state
        this.deselectAll();

        // Enter Multi-Focus Mode
        this._isFocusMode = true;

        // Visual feedback
        document.body.classList.add('focus-mode-active');

        // TOGGLE START NODE
        if (this.state.focusedNodes.has(id)) {
            this.removeFromFocusedNodes(id);
        } else {
            this.addToFocusedNodes(id);
        }

        this.updateToolbar();
        if (navigator.vibrate) navigator.vibrate(50);

        // Initialize Brush Mode immediately so subsequent moves trigger selection
        this._mode = "focus-brush";
        this._focusBrushActive = true;
        this._brushedNodes = new Set();
        this._brushedNodes.add(id);

        // STRICT HIERARCHY SCOPE
        const startNode = this.nodes.get(id);
        this._brushScopeParent = startNode ? startNode.parent : null;
    },

    toggleSelection(id) {
        if (this.selected.has(id)) {
            this.selected.delete(id);
            const node = this.nodes.get(id);
            if (node && node.element) node.element.classList.remove("selected", "focused");
        } else {
            this.selected.add(id);
            const node = this.nodes.get(id);
            if (node && node.element) {
                node.element.classList.add("selected");
                // In multi-select, maybe don't focus individually, but we keep the visual consistency
            }
        }
        this.updateToolbar();
    },

    handleTap(id) {
        let node = this.nodes.get(id);

        if (this._isMultiSelectMode) {
            // In multi-select mode, tap toggles selection
            this.toggleSelection(id);
            return;
        }

        // Standard Single Select Logic
        // Handle Child Node Interaction
        if (node && node.parent) {
            const parent = node.parent;

            // If parent is NOT focused/selected, select the parent group first
            // NEW: Also check if any sibling is selected (Drill-down peer support)
            let isSiblingSelected = false;
            // Iterate selected nodes to see if any share the same parent
            for (const selId of this.selected) {
                const selNode = this.nodes.get(selId);
                if (selNode && selNode.parent === parent) {
                    isSiblingSelected = true;
                    break;
                }
            }

            const isParentActive = this.state.focusedNode === parent.id ||
                this.selected.has(parent.id) ||
                isSiblingSelected;

            if (!isParentActive) {
                this.deselectAll();
                this.selectNode(parent.id); // Tap now selects
                return;
            }

            // If parent IS active (or sibling), allow selecting the child (Drill-down behavior)
            // This replaces the old check for 'isEditing'
            this.deselectAll();
            this.selectNode(node.id);
            return;
        }

        const isTextOrCode = node && (node.type === "text" || node.type === "code" || node.type === "text-with-title");
        const isContentTap = isTextOrCode && (
            event.target.classList.contains("text-content-editor") ||
            event.target.classList.contains("code-content") ||
            event.target.classList.contains("text-node-content") ||
            event.target.classList.contains("text-node-title") ||
            event.target.closest(".text-content-editor") ||
            event.target.closest(".code-content") ||
            event.target.closest(".text-node-content")
        );

        // If simply tapping a node
        if (!node.parent) {
            this.deselectAll();
            this.selectNode(id);
        } else {
            if (!node.parent.isEditing) {
                this.deselectAll();
                this.selectNode(node.parent.id);
            }
        }
    },

    handleDBL(el, clickedTarget = null) {
        const node = this.nodes.get(el.id);
        if (!node || node.locked) return;

        // Check if double-clicking on text editor or node body - show formatting toolbar
        const clickedElement = clickedTarget || event.target;
        const clickedEditor = clickedElement.classList.contains('text-content-editor') ||
            clickedElement.classList.contains('code-content') ||
            clickedElement.classList.contains('title-input');


        // Number Node Double Click - enter edit mode
        if (node.type === 'number') {
            if (typeof node.enterEditMode === 'function') {
                node.enterEditMode();
            }
            return;
        }

        // Sprite Node Double Click
        if (node.type === 'sprite') {
            if (node.src) {
                App.spriteEditor.open(node);
            } else {
                App.triggerUpload(node.id);
            }
            return;
        }

        // User Request: Title Focus for TextWithTitleNode
        if (node.type === 'text-with-title') {
            if (clickedElement && (clickedElement.closest('.text-node-header') || clickedElement.classList.contains('text-node-title'))) {
                const titleInput = node.element.querySelector('.text-node-title');
                if (titleInput) {
                    node.element.classList.add('editing'); // CSS handles pointer-events
                    titleInput.focus();
                    titleInput.select();
                    return;
                }
            }
        }

        if (node.type === 'text' || node.type === 'code' || node.type === 'text-with-title') {
            // Enable editing and show formatting toolbar
            this.showInlineFormattingToolbar(el.id);
            return;
        }

        // Existing double-click behavior for other elements
        if (node.type === "folder") {
            this.navToWorkspace(node.workspaceId, node.title);
            return;
        }

        if (node.type === "image") {
            // Check if clicked on a specific image in grid
            if (clickedElement) {
                const gridItem = clickedElement.closest('.grid-item');
                if (gridItem) {
                    // Get the image src from the clicked grid item
                    const img = gridItem.querySelector('img');
                    if (img && img.src) {
                        this.openViewer(img.src);
                        return;
                    }
                }
            }

            // Fallback to legacy behavior (single image or placeholder)
            if (node.src) {
                this.openViewer(node.src);
            } else {
                App.triggerUpload(node.id);
            }
        }
    }
});
