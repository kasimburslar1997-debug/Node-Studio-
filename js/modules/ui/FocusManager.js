/**
 * FocusManager.js
 * مسؤول عن إدارة التركيز والتركيز المتعدد على العقد في واجهة التطبيق.
 */

Object.assign(App, {
    setFocusedNode(id) {
        if (this.state.focusedNode) {
            const node = this.nodes.get(this.state.focusedNode);
            if (node) node.element.classList.remove("focused");
        }
        this.state.focusedNode = id;
        if (id) {
            const node = this.nodes.get(id);
            if (node) node.element.classList.add("focused");
        }
        this.updateToolbar();
    },

    // Multi-Focus Management
    addToFocusedNodes(id) {
        this.state.focusedNodes.add(id);
        const node = this.nodes.get(id);
        if (node) {
            node.element.classList.add("focused");
        }
        this.state.focusedNode = id;
        this.updateToolbar();
    },

    removeFromFocusedNodes(id) {
        this.state.focusedNodes.delete(id);
        const node = this.nodes.get(id);
        if (node) {
            node.element.classList.remove("focused");
        }
        if (this.state.focusedNode === id) {
            this.state.focusedNode = this.state.focusedNodes.size > 0 ?
                Array.from(this.state.focusedNodes).pop() : null;
        }

        if (this.state.focusedNodes.size === 0) {
            this.exitFocusMode();
        }

        this.updateToolbar();
    },

    clearFocusedNodes() {
        this.state.focusedNodes.forEach(id => {
            const node = this.nodes.get(id);
            if (node) node.element.classList.remove("focused");
        });
        this.state.focusedNodes.clear();
        this.state.focusedNode = null;
        this.updateToolbar();
    },

    exitFocusMode() {
        this._isFocusMode = false;
        this._focusBrushActive = false;
        document.body.classList.remove('focus-mode-active');
    }
});
