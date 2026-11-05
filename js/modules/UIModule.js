/**
 * UIModule.js
 * مسؤول عن إعدادات الواجهة الأساسية والتحكم في إعدادات اللوحة والسمات والتحرير العام.
 */

Object.assign(App, {
    toggleSettings() {
        const menu = document.getElementById("settings-menu");
        menu.style.display = menu.style.display === "flex" ? "none" : "flex";
        if (menu.style.display === "flex") {
            document.getElementById("sidebar-extra-popup").style.display = "none";
            document.getElementById("sidebar-more-btn").classList.remove("active");

            // Update UI state for toolbar buttons
            const currentMode = this.state.toolbarMode || 'floating';
            ['floating', 'top', 'bottom'].forEach(m => {
                const btn = document.getElementById(`btn-toolbar-${m}`);
                if (btn) btn.classList.toggle('active', m === currentMode);
            });
        }
    },

    setToolbarMode(mode) {
        this.state.toolbarMode = mode;

        // Update Buttons
        ['floating', 'top', 'bottom'].forEach(m => {
            const btn = document.getElementById(`btn-toolbar-${m}`);
            if (btn) btn.classList.toggle('active', m === mode);
        });

        // Force update toolbar position if visible
        this.updateToolbar();
    },

    toggleVisualLayoutMode() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));

        if (targets.size > 0) {
            targets.forEach(id => {
                const node = this.nodes.get(id);
                if (node && node.type === 'container') {
                    node.setVisualLayoutMode(!node.visualLayoutMode);
                }
            });
            this.updateToolbar();
        }
    },

    toggleLock() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));
        targets.forEach(id => {
            const node = this.nodes.get(id);
            if (node) {
                node.locked = !node.locked;
                node.locked ? node.element.classList.add("locked") : node.element.classList.remove("locked");
            }
        });
        this.updateToolbar();
        this.pushHistory();
    },

    openWorkspaceSettings() {
        document.getElementById("workspace-settings").style.display = "flex";
    },

    setBgColor(c) {
        document.body.style.backgroundColor = c;
    },

    setBgImage(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = e => {
                document.body.style.backgroundImage = `url(${e.target.result})`;
                document.body.style.backgroundSize = "cover";
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    toggleTheme() {
        this.state.theme = this.state.theme === "dark" ? "light" : "dark";
        document.body.setAttribute("data-theme", this.state.theme);
        document.getElementById("theme-text").innerText = this.state.theme === "dark" ? "داكن" : "فاتح";
    },

    setInteracting(isInteracting) {
        if (isInteracting) document.body.classList.add("interacting");
        else document.body.classList.remove("interacting");
    },

    toggleEditing() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected : new Set());

        if (targets.size > 0) {
            const id = Array.from(targets)[0];
            const node = this.nodes.get(id);
            if (node && (node.type === "text" || node.type === "code" || node.type === "text-with-title")) {
                const editor = node.element.querySelector(".text-content-editor, .code-content");
                const isEditing = node.element.classList.contains("editing");

                if (isEditing) {
                    // Disable editing
                    if (editor) {
                        if (editor.tagName === "TEXTAREA") {
                            editor.setAttribute("readonly", "true");
                        } else {
                            editor.setAttribute("contenteditable", "false");
                        }
                        editor.blur();
                    }
                    node.element.classList.remove("editing");
                    this.hideFormattingToolbar();
                    document.getElementById('btn-edit').classList.remove('active');
                } else {
                    // Enable editing
                    node.element.classList.add("editing");
                    this.showInlineFormattingToolbar(id);

                    if (editor) {
                        if (editor.tagName === "TEXTAREA") {
                            editor.removeAttribute("readonly");
                        } else {
                            editor.setAttribute("contenteditable", "true");
                        }
                        editor.focus();
                    }
                    document.getElementById('btn-edit').classList.add('active');
                }
            }
        }
    },

    toggleHeightMode() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));
        if (targets.size > 0) {
            const btn = document.getElementById('btn-height-toggle');
            targets.forEach(id => {
                const node = this.nodes.get(id);
                if (node && (node.type === "text" || node.type === "text-with-title")) {
                    node.setAutoResize(!node.autoResize);
                    if (!node.autoResize) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                }
            });
            this.pushHistory();
        }
    },

    toggleGroupEditMode() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));
        if (targets.size > 0) {
            const btn = document.getElementById('btn-group-edit');
            targets.forEach(id => {
                const node = this.nodes.get(id);
                if (node && node.type === 'group') {
                    if (node.element.classList.contains('group-editing')) {
                        node.element.classList.remove('group-editing');
                        node.isEditing = false;
                        if (btn) btn.classList.remove('active');
                    } else {
                        node.element.classList.add('group-editing');
                        node.isEditing = true;
                        if (btn) btn.classList.add('active');
                    }
                }
            });
            this.updateToolbar();
        }
    }
});
