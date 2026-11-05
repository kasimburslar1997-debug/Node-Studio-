class CodeNode extends BaseNode {
    constructor(x, y) {
        super("code", x, y, 400, 300);
    }
    getHTML() {
        return '<textarea class="code-content" readonly placeholder="// اكتب الكود هنا..." oninput="App.handleInput(this)" onblur="App.handleEditorBlur(\'' + this.id + '\')" onclick="event.stopPropagation()" onscroll="App.updateOverflowIndicator(\'' + this.id + '\')"></textarea><div class="overflow-indicator"></div>';
    }
}
