class IconNode extends BaseNode {
    constructor(x, y, iconClass = 'star') {
        super('icon', x, y, 50, 50);
        this.iconClass = iconClass;
        this.styles.radius = 16;
        this.styles.fill = "var(--bg-panel)";
        this.styles.strokeWidth = 0;
        this.autoResize = false;

        this.setIcon(this.iconClass);
    }

    getHTML() {
        return `
            <div class="icon-node-content" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                <i data-lucide="${this.iconClass}"></i>
            </div>
        `;
    }

    setIcon(iconClass) {
        this.iconClass = iconClass;
        const div = this.element.querySelector('.icon-node-content');
        if (div) {
            div.innerHTML = `<i data-lucide="${iconClass}"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: div });
        }
    }

    updateVisuals() {
        super.updateVisuals();

        if (this.width !== this.height) {
            const size = Math.max(this.width, this.height);
            this.width = size;
            this.height = size;
            this.element.style.width = `${this.width}px`;
            this.element.style.height = `${this.height}px`;
        }

        // Scale icon (SVG)
        const size = Math.min(this.width, this.height) * 0.6;
        const svg = this.element.querySelector('.icon-node-content svg');
        if (svg) {
            svg.style.width = `${size}px`;
            svg.style.height = `${size}px`;
        }
    }

    getConstrainedDimensions(w, h) {
        const size = Math.max(20, Math.max(w, h));
        return { w: size, h: size };
    }
}
