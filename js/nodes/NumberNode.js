class NumberNode extends BaseNode {
    constructor(x, y, value = 0) {
        super('number', x, y, 50, 50);
        this.value = value;
        this.styles.radius = 16;
        this.styles.fill = "var(--bg-panel)";
        this.styles.strokeWidth = 0;
        this.autoResize = true; // Hug content width
        this.isEditing = false;

        this.updateWidth();
    }

    getHTML() {
        return `
            <div class="number-node-content" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                <span class="number-value" style="font-weight:bold;font-size:1.5rem;color:var(--text-primary);user-select:none;">${this.value}</span>
                <input type="text" class="number-input" style="display:none;width:100%;text-align:center;background:transparent;border:none;outline:none;font-weight:bold;font-size:1.5rem;color:var(--text-primary);" value="${this.value}">
            </div>
        `;
    }

    setValue(newValue) {
        // Parse and validate - only allow numbers
        const parsed = parseFloat(newValue);
        if (!isNaN(parsed)) {
            this.value = parsed;
            this.updateHTML();
            this.updateWidth();
        }
    }

    increment() {
        this.setValue(this.value + 1);
    }

    decrement() {
        this.setValue(this.value - 1);
    }

    updateWidth() {
        // Auto-hug: Calculate width based on number of digits
        const digits = String(this.value).length;
        const minWidth = 50;
        const charWidth = 18; // Approximate width per character
        const padding = 20;
        const newWidth = Math.max(minWidth, digits * charWidth + padding);

        this.width = newWidth;
        // Keep height the same (50px default)

        if (this.element) {
            this.element.style.width = `${this.width}px`;
        }
    }

    updateHTML() {
        const container = this.element?.querySelector('.number-node-content');
        if (!container) return;

        const valueSpan = container.querySelector('.number-value');
        const input = container.querySelector('.number-input');

        if (valueSpan) {
            valueSpan.textContent = this.value;
        }
        if (input) {
            input.value = this.value;
        }

        this.updateVisuals();
    }

    updateVisuals() {
        super.updateVisuals();
        this.updateWidth();

        // Scale font size based on node height
        const fontSize = Math.min(this.height * 0.5, 40);
        const valueSpan = this.element?.querySelector('.number-value');
        const input = this.element?.querySelector('.number-input');

        if (valueSpan) {
            valueSpan.style.fontSize = `${fontSize}px`;
        }
        if (input) {
            input.style.fontSize = `${fontSize}px`;
        }
    }

    enterEditMode() {
        this.isEditing = true;
        const valueSpan = this.element?.querySelector('.number-value');
        const input = this.element?.querySelector('.number-input');

        if (valueSpan) valueSpan.style.display = 'none';
        if (input) {
            input.style.display = 'block';
            input.value = this.value;
            input.focus();
            input.select();

            // Handle input - only allow numbers
            input.oninput = (e) => {
                // Remove non-numeric characters except minus and decimal
                e.target.value = e.target.value.replace(/[^0-9.\-]/g, '');
            };

            input.onblur = () => this.exitEditMode();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    this.exitEditMode();
                    e.preventDefault();
                }
                if (e.key === 'Escape') {
                    input.value = this.value; // Reset
                    this.exitEditMode();
                    e.preventDefault();
                }
            };
        }

        this.element?.classList.add('editing');
    }

    exitEditMode() {
        if (!this.isEditing) return;
        this.isEditing = false;

        const valueSpan = this.element?.querySelector('.number-value');
        const input = this.element?.querySelector('.number-input');

        if (input) {
            this.setValue(input.value);
            input.style.display = 'none';
        }
        if (valueSpan) {
            valueSpan.style.display = 'block';
        }

        this.element?.classList.remove('editing');

        if (App.pushHistory) App.pushHistory();
        if (App.updateToolbar) App.updateToolbar();
    }

    getConstrainedDimensions(w, h) {
        // Allow height resize, but width is auto-calculated
        return {
            w: this.width,
            h: Math.max(30, h)
        };
    }
}
