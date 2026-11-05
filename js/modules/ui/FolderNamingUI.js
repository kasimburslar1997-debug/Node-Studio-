/**
 * FolderNamingUI.js
 * مسؤول عن إعادة تسمية المجلدات وتحميل الصور وعرضها في عارض الصور.
 */

Object.assign(App, {
    renameFolder() {
        if (this.selected.size !== 1) return;
        const id = Array.from(this.selected)[0];
        const node = this.nodes.get(id);
        if (node.type !== "folder") return;

        const titleEl = node.element.querySelector(".folder-title");
        if (titleEl) {
            titleEl.style.pointerEvents = "auto";
            titleEl.setAttribute("contenteditable", "true");
            titleEl.focus();
            const range = document.createRange();
            range.selectNodeContents(titleEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    },

    onFolderTitleBlur(el, id) {
        el.setAttribute("contenteditable", "false");
        el.style.pointerEvents = "none";
        const node = this.nodes.get(id);
        if (node) {
            node.title = el.innerText;
            this.saveCurrentWorkspace();
        }
    },

    triggerUpload(id) {
        this._pendingUpload = id;
        document.getElementById("file-input").click();
    },

    openViewer(src) {
        let nodeId = null;
        let imageIndex = 0;
        for (const [id, node] of this.nodes) {
            if (node.type === 'image' && node.images) {
                const index = node.images.indexOf(src);
                if (index !== -1) {
                    nodeId = id;
                    imageIndex = index;
                    break;
                }
            }
        }
        if (nodeId && window.ImageViewer) {
            window.ImageViewer.open(nodeId, imageIndex);
        } else {
            console.warn('ImageViewer fallback');
            const viewerImg = document.getElementById("viewer-img");
            const viewer = document.getElementById("image-viewer");
            if (viewerImg && viewer) {
                viewerImg.src = src;
                viewer.style.display = "flex";
            }
        }
    }
});
