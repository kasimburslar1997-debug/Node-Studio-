/**
 * ImageNode.js
 * عقدة الصور المتوافقة مع نظام الوسائط المزدوج (Linked vs Embedded)
 */

class ImageNode extends BaseNode {
    constructor(x, y) {
        super("image", x, y, 300, 200);
        this.src = null;
        this.images = [];
        this.assetId = null;
        this.styles.fill = "transparent";
        this.styles.fillOpacity = 0;
        this.isEditing = false;
        this.autoResize = false;
    }

    getHTML() {
        let imageSrc = this.src;

        // استخراج الرابط الحقيقي من مدير الوسائط
        if (this.assetId && window.App && window.App.assetManager) {
            imageSrc = window.App.assetManager.getAssetUrl(this.assetId);
            const asset = window.App.assetManager.getAsset(this.assetId);

            if (asset && asset.status === 'missing') {
                return `
                    <div class="image-missing-placeholder" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(239,68,68,0.08);border:2px dashed #ef4444;border-radius:inherit;padding:12px;text-align:center;color:#ef4444;">
                        <i data-lucide="unlink" style="width:32px;height:32px;margin-bottom:6px;"></i>
                        <span style="font-size:0.8rem;font-weight:600;">رابط الصورة مفقود</span>
                        <span style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:8px;">${asset.name}</span>
                        <button class="btn btn-primary" onclick="App.assetManager.relinkAsset('${this.assetId}')" style="font-size:0.75rem;padding:4px 10px;">إعادة ربط</button>
                    </div>
                `;
            }
        }

        if (!imageSrc && (!this.images || this.images.length === 0)) {
            return `<div class="image-placeholder"><i data-lucide="image" style="width:2.2rem;height:2.2rem"></i><span>نقرتين لإدراج صورة</span></div>`;
        }

        return this.renderImages(imageSrc);
    }

    renderImages(activeSrc) {
        if (!this.images || this.images.length <= 1) {
            const src = activeSrc || (this.images && this.images[0]) || this.src;
            return `
                <div class="img-floating-btn" onclick="App.openViewer('${src}')"><i data-lucide="expand"></i></div>
                <img src="${src}" class="node-img" draggable="false" style="width:100%;height:100%;object-fit:contain;">
            `;
        }

        // نمط المعرض (Grid) لعدة صور
        let itemsHTML = '';
        this.images.forEach((src, index) => {
            itemsHTML += `
                <div class="grid-item" data-index="${index}">
                    <img src="${src}" draggable="false" style="pointer-events:none;">
                    <div class="grid-expand-btn" onclick="App.openViewer('${src}')"><i data-lucide="expand"></i></div>
                </div>
            `;
        });

        const columns = Math.ceil(this.images.length / 2);
        return `<div class="image-grid" style="grid-template-columns: repeat(${columns}, 1fr);">${itemsHTML}</div>`;
    }

    setAsset(assetId) {
        this.assetId = assetId;
        if (window.App && window.App.assetManager) {
            this.src = window.App.assetManager.getAssetUrl(assetId);
        }
        this.updateHTML();
    }

    setSrc(src, assetId = null) {
        this.src = src;
        this.assetId = assetId;
        this.images = [src];

        const img = new Image();
        img.onload = () => {
            this.aspectRatio = img.width / img.height;
            this.updateHTML();
            this.updateVisuals();
        };
        img.src = src;
    }

    addImages(srcList) {
        if (!srcList || srcList.length === 0) return;
        this.images.push(...srcList);
        this.src = this.images[0];
        this.updateHTML();
    }

    onAssetUpdated() {
        if (this.assetId && window.App && window.App.assetManager) {
            this.src = window.App.assetManager.getAssetUrl(this.assetId);
            this.updateHTML();
        }
    }

    updateHTML() {
        const inner = this.element?.querySelector(".node-inner");
        if (!inner) return;
        inner.innerHTML = this.getHTML();
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: inner });
        this.updateVisuals();
    }

    resize(w, h, x, y) {
        if (this.aspectRatio) {
            if (Math.abs(w - this.width) > 0.5) {
                this.width = Math.max(50, w);
                this.height = this.width / this.aspectRatio;
            } else {
                this.height = Math.max(50, h);
                this.width = this.height * this.aspectRatio;
            }
            this.x = x;
            this.y = y;
        } else {
            super.resize(w, h, x, y);
        }
        this.updateVisuals();
    }
}

window.ImageNode = ImageNode;