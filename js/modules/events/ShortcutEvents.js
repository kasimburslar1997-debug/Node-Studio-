// ShortcutEvents.js - Keyboard shortcuts, context menu, and selection change events
Object.assign(App, {
    _bindShortcutEvents() {
        // ==== Keydown (Shortcuts) ====
        window.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                if (this._isFocusMode) {
                    this.exitFocusMode();
                    this.clearFocusedNodes();
                }
                this.deselectAll();
                this.hideFormattingToolbar();
            } else if (e.key === "Delete" || e.key === "Backspace") {
                // Prevent backspace from navigating back if not in input
                if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && !e.target.isContentEditable) {
                    this.deleteSelection();
                }
            }
        });

        // ==== Context Menu (Right Click) ====
        window.addEventListener("contextmenu", e => {
            // Check if clicking inside an editable area
            const editorData = this.getEditorFromEvent(e);
            if (editorData) {
                e.preventDefault();
                const { x, y } = e;
                App.showEditCapsule(x, y);
                return;
            }
            // Allow default for other areas if needed, or prevent globally 
            // The body has oncontextmenu="return false;" so this listener specifically targets overrides
        });

        // ==== Touch Context (Long Press on Text) ====
        // Handled via standard long press logic or specialized touch handling
        // Since iOS/Android handle selection menus natively, we try to hook into the selection
        document.addEventListener("selectionchange", () => {
            // Optional: Show menu near selection if we want to override system behavior completely
            // But for now, we rely on manual trigger via right-click or long-press simulation
        });
    }
});
