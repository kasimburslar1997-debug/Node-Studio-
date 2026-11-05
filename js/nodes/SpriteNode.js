class SpriteNode extends BaseNode {
    constructor(x, y, width = 200, height = 200) {
        super("sprite", x, y, width, height);
        this.src = null;

        // 9-Slice Properties
        this.slice = { top: 20, right: 20, bottom: 20, left: 20 };
        this.borderWidth = { top: 20, right: 20, bottom: 20, left: 20 };
        this.repeat = 'stretch'; // 'stretch', 'repeat', 'round', 'space'

        this.styles.fill = "transparent";
        this.styles.strokeWidth = 0;
        this.autoResize = false;

        // Disable clipping for 9-slice sprites
        const inner = this.element.querySelector('.node-inner');
        if (inner) inner.style.overflow = 'visible';
    }

    getHTML() {
        if (!this.src) {
            return `<div class="sprite-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.05);color:var(--text-secondary);flex-direction:column;gap:8px;border-radius:var(--radius-md);border:1px dashed var(--border-color);">
                <i data-lucide="image" style="width:24px;height:24px;opacity:0.5"></i>
                <span style="font-size:12px;opacity:0.7">Double click to add Sprite</span>
            </div>`;
        }
        return `<div class="sprite-content" style="width:100%;height:100%;box-sizing:border-box;"></div>`;
    }

    updateVisuals() {
        // Call BaseNode updateVisuals to handle position/size
        super.updateVisuals();

        const inner = this.element.querySelector('.node-inner');
        if (!inner) return;

        // Ensure inner fills the node
        inner.style.width = '100%';
        inner.style.height = '100%';

        const content = inner.querySelector('.sprite-content');
        if (content && this.src) {
            content.style.borderStyle = 'solid';
            content.style.borderImageSource = `url("${this.src}")`;

            // "fill" keyword is important to show the center of the image
            content.style.borderImageSlice = `${this.slice.top} ${this.slice.right} ${this.slice.bottom} ${this.slice.left} fill`;

            content.style.borderImageWidth = `${this.borderWidth.top}px ${this.borderWidth.right}px ${this.borderWidth.bottom}px ${this.borderWidth.left}px`;

            content.style.borderImageRepeat = this.repeat;

            // Set physical border width to match (or 0 if we want it purely visual, but for 9-slice usually we want the space)
            // Actually for a sprite node, the border IS the visual. 
            content.style.borderWidth = `${this.borderWidth.top}px ${this.borderWidth.right}px ${this.borderWidth.bottom}px ${this.borderWidth.left}px`;
        }
    }

    setSrc(url) {
        this.src = url;
        this.updateHTML();
    }

    updateHTML() {
        const inner = this.element.querySelector('.node-inner');
        if (inner) {
            inner.innerHTML = this.getHTML();
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: inner });
            this.updateVisuals();
        }
    }

    setSlice(top, right, bottom, left) {
        this.slice = { top, right, bottom, left };
        // Usually border width matches slice for 1:1 pixel mapping, but can be scaled.
        // For simplicity, let's keep them synced by default or let editor handle it.
        this.borderWidth = { top, right, bottom, left };
        this.updateVisuals();
    }
}
