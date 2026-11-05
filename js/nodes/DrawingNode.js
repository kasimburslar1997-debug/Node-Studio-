class DrawingNode extends BaseNode {
    constructor(x, y) {
        super("drawing", x, y, 300, 250);
        this.previewUrl = null;
        this.autoResize = false; // Enable vertical resizing
    }
    getHTML() {
        return `<div class="drawing-preview" style="border:1px solid var(--border-color)"><span style="color:#aaa">لوحة رسم</span></div><div class="draw-btn" onclick="DrawingEditor.open('${this.id}')" data-tooltip="فتح المحرر"><i data-lucide="pen"></i></div>`;
    }
    updatePreview(url) {
        this.previewUrl = url;
        this.element.querySelector(".drawing-preview").innerHTML = `<img src="${url}">`;
    }
}
