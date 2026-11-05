class TextWithTitleNode extends TextNode {
    constructor(x, y, isSimple = false) {
        super(x, y, isSimple);
        this.type = "text-with-title"; // Override type
        this.title = "";
        this.collapsed = true; // Ensure collapsed by default
        this.height = 50; // Default to visible height, handleInput will update it
        this.autoResize = true; // Default to auto-resize
    }

    toggleCollapse() {
        this.collapsed = !this.collapsed;

        // Update DOM classes
        const btn = this.element.querySelector(".text-toggle-btn");
        const content = this.element.querySelector(".text-node-content");

        if (btn) btn.classList.toggle("collapsed", this.collapsed);

        if (content) {
            this.collapsed ? content.classList.add("collapsed") : content.classList.remove("collapsed");
        }

        // Handle physical height resize
        if (this.collapsed) {
            this.styles.lastHeight = this.height; // Save height
            this.element.style.height = "auto";
        } else {
            if (this.styles.lastHeight) {
                this.height = this.styles.lastHeight;
                this.element.style.height = this.height + "px";
            } else {
                this.element.style.height = "auto";
            }
            this.updateVisuals();
        }
    }

    getHTML() {
        // Re-use text-node css classes
        const titleValue = this.title || "";

        return `
            <div class="text-node-header" style="margin-bottom: 0;">
                <button class="text-toggle-btn ${this.collapsed ? 'collapsed' : ''}" onclick="App.toggleNodeCollapse('${this.id}')" onpointerdown="event.stopPropagation()">
                     <i data-lucide="chevron-down"></i>
                </button>
                <input class="text-node-title" placeholder="عنوان العقدة" value="${titleValue}" oninput="App.updateNodeTitle('${this.id}', this.value)" onblur="App.handleEditorBlur('${this.id}')" onkeydown="if(event.key==='Enter') this.blur()">
            </div>
            <div class="text-node-content ${this.collapsed ? 'collapsed' : ''}" style="flex:1; display:flex; flex-direction:column;">
                <div class="text-content-editor" contenteditable="false" data-placeholder="اكتب هنا..." oninput="App.handleInput(this)" onblur="App.handleEditorBlur('${this.id}')" onscroll="App.updateOverflowIndicator('${this.id}')" style="flex:1; height:100%;"></div>
                <div class="overflow-indicator"></div>
            </div>
        `;
    }

    updateVisuals() {
        // Don't call parent updateVisuals if collapsed, to prevent expansion
        if (this.collapsed) {
            // Only update visual styles (colors, etc.) without touching layout
            if (!this.parent) {
                this.element.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.rotation}deg)`;
                // Keep width but don't reset height
                this.element.style.width = `${this.width}px`;
                // Don't touch height - CSS handles it via collapsed class
            }

            // Update colors/styles only
            this.element.style.backgroundColor = this.styles.fill;
            this.element.style.color = this.styles.text;
            this.element.style.borderRadius = `${this.styles.radius}px`;
            this.element.style.setProperty("--current-radius", `${this.styles.radius}px`);

            // Apply stroke styles
            let finalStrokeColor = this.styles.stroke || 'var(--border-color)';
            if (this.styles.strokeWidth !== undefined) {
                this.element.style.borderWidth = `${this.styles.strokeWidth}px`;
            }
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
        } else {
            // When not collapsed, use parent's updateVisuals normally
            super.updateVisuals();
        }
    }
}
