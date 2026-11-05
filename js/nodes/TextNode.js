class TextNode extends BaseNode {
    constructor(x, y, isSimple = false) {
        super("text", x, y, 200, 52);
        this.currentColor = "#3b82f6";
        this.autoResize = true; // Default to auto-resize for text nodes
        this.height = 50; // Initialize with visible height, handleInput will adjust later
    }

    getHTML() {
        return '<div class="text-content-editor" contenteditable="false" data-placeholder="اكتب هنا..." oninput="App.handleInput(this)" onblur="App.handleEditorBlur(\'' + this.id + '\')" onscroll="App.updateOverflowIndicator(\'' + this.id + '\')"></div><div class="overflow-indicator"></div>';
    }
}
