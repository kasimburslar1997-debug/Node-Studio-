class EmptyNode extends BaseNode {
    constructor(x, y) {
        // Default size 60x60 (Small circle)
        super('empty', x, y, 60, 60);
        // Default circle
        this.styles.radius = 30;
        this.styles.fill = "var(--bg-panel)";
        this.styles.stroke = "transparent";
        this.styles.strokeWidth = 0;
        this.autoResize = false;
    }

    getHTML() {
        return `
            <div class="empty-node-content" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.3;pointer-events:none;">
                <!-- No Icon -->
            </div>
        `;
    }
}
