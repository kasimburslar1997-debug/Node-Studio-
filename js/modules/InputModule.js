Object.assign(App, {
    // Helper to identify if event target is part of an active editor
    getEditorFromEvent(e) {
        const target = e.target;
        if (target.isContentEditable ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.closest('.text-content-editor') ||
            target.closest('.code-content')) {
            return target;
        }
        return null;
    },

    handleInput(el) {
        const nodeEl = el.closest(".node");
        if (!nodeEl) return;
        const node = this.nodes.get(nodeEl.id);
        if (node && node.autoResize && !node.collapsed) {
            // 1. Reset to minimal to measure natural height
            // Using 1px ensures we strictly measure content, avoiding flex/stretching artifacts
            el.style.height = "1px";

            // 2. Measure Height
            const contentHeight = el.scrollHeight;

            // 3. Update Node Height
            // Header is roughly 36px.
            const headerHeight = node.type === 'text-with-title' ? 44 : 0; // Increased header estimate
            const newNodeHeight = contentHeight + headerHeight;

            // Ensure min height (approx 1 line + padding)
            node.height = Math.max(50, newNodeHeight);

            // 4. Force Editor to fill the new node height
            // This eliminates any calculation mismatch/gap at the bottom
            el.style.height = "100%";

            node.updateVisuals();
        }
        this.updateOverflowIndicator(nodeEl.id);
    },

    updateOverflowIndicator(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        const editor = node.element.querySelector('.text-content-editor, .code-content');
        const indicator = node.element.querySelector('.overflow-indicator');

        if (editor && indicator) {
            const hasOverflow = editor.scrollHeight > editor.clientHeight;
            // Tolerance of 5px
            const isAtBottom = Math.abs((editor.scrollHeight - editor.clientHeight) - editor.scrollTop) < 5;

            if (hasOverflow && !isAtBottom) {
                indicator.classList.add('visible');
            } else {
                indicator.classList.remove('visible');
            }
        }
    },

    trimEditorContent(el) {
        if (!el) return;

        // Loop backwards removing empty ending nodes
        while (el.lastChild) {
            const node = el.lastChild;

            // 1. Empty Text Node (Whitespace)
            if (node.nodeType === 3 && node.nodeValue.trim() === '') {
                node.remove();
                continue;
            }
            // 2. BR Tag
            if (node.tagName === 'BR') {
                node.remove();
                continue;
            }
            // 3. Empty DIV (often created by Enter in some browsers: <div><br></div>)
            if (node.tagName === 'DIV') {
                // Be careful not to remove divs with images or other non-text content checking innerText implies text only
                if (node.innerText.trim() === '' && node.querySelectorAll('img, hr, canvas, svg').length === 0) {
                    node.remove();
                    continue;
                }
            }

            // Found real content
            break;
        }
    }
});
