class FolderNode extends BaseNode {
    constructor(x, y, workspaceId = null, title = "مجلد جديد", src = null, aspectRatio = null) {
        super("folder", x, y, 300, 250);
        this.workspaceId = workspaceId || "ws-" + Date.now() + Math.random().toString(36).substr(2, 5);
        this.title = title;
        this.src = src;
        this.styles.fill = "transparent";
        this.aspectRatio = aspectRatio;
        this.autoResize = false; // Enable vertical resizing

        // Fix Clone Rendering:
        // super() -> createNodeElement() -> getHTML() executes BEFORE this.src is set.
        // So we must re-render if src is provided.
        if (this.src) {
            const inner = this.element.querySelector(".node-inner");
            if (inner) inner.innerHTML = this.getHTML();
        }
    }

    getHTML() {
        const imgContent = this.src ?
            `<img src="${this.src}" class="folder-img" draggable="false" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` :
            `<div class="folder-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#222;border-radius:inherit"><i data-lucide="folder" style="width:3rem;height:3rem;color:#444"></i></div>`;

        const btnOverlay = this.src ?
            `<div class="img-btn-overlay" onclick="App.navToWorkspace('${this.workspaceId}', '${this.title}')"><i data-lucide="arrow-right"></i></div>` :
            `<div class="img-btn-overlay" onclick="App.triggerUpload('${this.id}')"><i data-lucide="upload"></i></div>`;

        return `
            <div class="folder-content" style="width:100%;height:100%;position:relative;border-radius:inherit;overflow:hidden">
                ${imgContent}
                <div class="folder-overlay" style="position:absolute;bottom:0;left:0;right:0;height:70%;background:linear-gradient(to top, rgba(0,0,0,0.9), transparent);pointer-events:none"></div>
                <div class="folder-title" contenteditable="false" onblur="App.onFolderTitleBlur(this, '${this.id}')" onkeydown="if(event.key==='Enter'){this.blur();event.preventDefault();}" style="position:absolute;bottom:15px;right:15px;color:white;font-weight:bold;font-size:1.2rem;text-shadow:0 2px 4px rgba(0,0,0,0.5);z-index:10;min-width:50px;outline:none;cursor:text;pointer-events:none">${this.title}</div>
                ${btnOverlay}
            </div>
        `;
        // Ensure Lucide icons are rendered
        if (typeof lucide !== 'undefined') {
            setTimeout(() => lucide.createIcons(), 0);
        }
        return html;
    }

    setTitle(newTitle) {
        this.title = newTitle;
        const titleEl = this.element.querySelector(".folder-title");
        if (titleEl) titleEl.innerText = newTitle;
    }

    setSrc(src) {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const ratio = img.width / img.height;
            // User Request: Maintain node's current width, adjust height to match ratio
            // this.width is initialized to 300.
            let w = this.width;
            let h = w / ratio;

            // Optional: Clamp height if it gets too crazy? 
            // But usually for cards/folders w=300, h will be reasonable.

            this.width = w;
            this.height = h;
            this.src = src;
            this.aspectRatio = ratio;
            this.element.querySelector(".node-inner").innerHTML = this.getHTML();
            this.updateVisuals();
            if (App.selected.has(this.id)) App.updateToolbar();
        };
    }
}
