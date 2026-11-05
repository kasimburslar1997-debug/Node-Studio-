/**
 * SpriteEditor.js
 * محرر شرائح الـ 9-Slice مع حماية كاملة من انهيار الـ DOM
 */

class SpriteEditor {
    constructor(app) {
        this.app = app;
        this.node = null;

        this.overlay = document.getElementById('sprite-editor-overlay');
        this.canvasContainer = document.getElementById('se-canvas-container');
        this.imgEl = document.getElementById('se-image');
        this.placeholder = document.getElementById('se-placeholder');
        this.magnifier = document.getElementById('se-magnifier');

        this.inputs = {
            top: document.getElementById('se-input-top'),
            right: document.getElementById('se-input-right'),
            bottom: document.getElementById('se-input-bottom'),
            left: document.getElementById('se-input-left')
        };
        this.scaleSlider = document.getElementById('se-slice-scale');

        this.radioRepeatX = document.getElementById('se-repeat-x');
        this.radioRepeatY = document.getElementById('se-repeat-y');

        this.guides = {
            top: document.getElementById('guide-top'),
            bottom: document.getElementById('guide-bottom'),
            left: document.getElementById('guide-left'),
            right: document.getElementById('guide-right')
        };

        this.previewArea = document.getElementById('se-preview-area');
        this.previewWorld = document.getElementById('se-preview-world');
        this.previewBox = document.getElementById('se-preview-box');
        this.btnResetView = document.getElementById('se-btn-reset-view');

        this.slice = { top: 0, right: 0, bottom: 0, left: 0 };
        this.scale = 1;
        this.repeatX = 'stretch';
        this.repeatY = 'stretch';
        this.originalWidth = 0;
        this.originalHeight = 0;

        this.draggingGuide = null;
        this.resizingPreview = null;
        this.viewState = { x: 0, y: 0, scale: 1, isPanning: false, startX: 0, startY: 0 };

        this.bindEvents();
    }

    bindEvents() {
        const btnCancel = document.getElementById('se-btn-cancel');
        if (btnCancel) btnCancel.onclick = () => this.close();

        const btnSave = document.getElementById('se-btn-save');
        if (btnSave) btnSave.onclick = () => this.save();

        if (this.btnResetView) {
            this.btnResetView.onclick = () => this.resetPreviewView();
        }

        Object.keys(this.inputs).forEach(key => {
            if (this.inputs[key]) {
                this.inputs[key].addEventListener('input', () => this.updateFromInputs());
            }
        });

        if (this.scaleSlider) {
            this.scaleSlider.addEventListener('input', (e) => {
                this.scale = parseFloat(e.target.value);
                this.updatePreview();
            });
        }

        if (this.radioRepeatX) {
            this.radioRepeatX.addEventListener('change', (e) => {
                if (e.target.name === 'repeat-x') {
                    this.repeatX = e.target.value;
                    this.updatePreview();
                }
            });
        }
        if (this.radioRepeatY) {
            this.radioRepeatY.addEventListener('change', (e) => {
                if (e.target.name === 'repeat-y') {
                    this.repeatY = e.target.value;
                    this.updatePreview();
                }
            });
        }

        Object.entries(this.guides).forEach(([key, el]) => {
            if (el) {
                el.onpointerdown = (e) => {
                    this.startDragGuide(e, key);
                    el.setPointerCapture(e.pointerId);
                };
                el.onpointerup = (e) => {
                    this.endDragGuide(e);
                    el.releasePointerCapture(e.pointerId);
                };
            }
        });

        if (this.canvasContainer) {
            this.canvasContainer.addEventListener('pointermove', (e) => {
                if (this.draggingGuide) this.dragGuide(e);
            });
        }

        this.bindPreviewEvents();
    }

    bindPreviewEvents() {
        if (!this.previewBox) return;

        const handles = this.previewBox.querySelectorAll('.se-handle');
        handles.forEach(h => {
            h.onpointerdown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                h.setPointerCapture(e.pointerId);
                this.startResizePreview(e, h.dataset.dir);
            };
            h.onpointerup = (e) => {
                h.releasePointerCapture(e.pointerId);
                this.endResizePreview();
            };
        });

        if (this.previewArea) {
            this.previewArea.addEventListener('pointerdown', (e) => {
                this.viewState.isPanning = true;
                this.viewState.startX = e.clientX - this.viewState.x;
                this.viewState.startY = e.clientY - this.viewState.y;
                this.previewArea.setPointerCapture(e.pointerId);
            });

            this.previewArea.addEventListener('pointermove', (e) => {
                if (this.viewState.isPanning) {
                    this.viewState.x = e.clientX - this.viewState.startX;
                    this.viewState.y = e.clientY - this.viewState.startY;
                    this.updatePreviewTransform();
                }
            });

            this.previewArea.addEventListener('pointerup', (e) => {
                this.viewState.isPanning = false;
                this.previewArea.releasePointerCapture(e.pointerId);
            });

            this.previewArea.addEventListener('wheel', (e) => {
                e.preventDefault();
                const zoomSpeed = 0.001;
                const newScale = this.viewState.scale - e.deltaY * zoomSpeed;
                this.viewState.scale = Math.max(0.1, Math.min(5, newScale));
                this.updatePreviewTransform();
            }, { passive: false });
        }

        document.addEventListener('pointermove', (e) => {
            if (this.resizingPreview) this.resizePreview(e);
        });
        document.addEventListener('pointerup', () => {
            if (this.resizingPreview) this.endResizePreview();
        });
    }

    resetPreviewView() {
        this.viewState = { x: 0, y: 0, scale: 1, isPanning: false, startX: 0, startY: 0 };
        this.updatePreviewTransform();
    }

    updatePreviewTransform() {
        if (this.previewWorld) {
            this.previewWorld.style.transform = `translate(${this.viewState.x}px, ${this.viewState.y}px) scale(${this.viewState.scale})`;
        }
    }

    open(nodeOrId) {
        let node = nodeOrId;
        if (typeof nodeOrId === 'string') {
            node = this.app.nodes.get(nodeOrId);
        }

        if (!node || node.type !== 'sprite') return;
        this.node = node;

        if (!node.src) {
            this.app.triggerUpload(node.id);
            return;
        }

        if (this.imgEl) {
            this.imgEl.src = node.src;
            this.imgEl.style.display = 'block';
        }
        if (this.placeholder) this.placeholder.style.display = 'none';

        this.slice = node.slice ? { ...node.slice } : { top: 0, right: 0, bottom: 0, left: 0 };
        this.scale = node.borderScale || 1;

        const repeatVal = node.repeat || 'stretch';
        if (repeatVal.includes(' ')) {
            const parts = repeatVal.split(' ');
            this.repeatX = parts[0];
            this.repeatY = parts[1] || parts[0];
        } else {
            this.repeatX = repeatVal;
            this.repeatY = repeatVal;
        }

        this.setRadioValue(this.radioRepeatX, this.repeatX);
        this.setRadioValue(this.radioRepeatY, this.repeatY);

        if (this.inputs.top) this.inputs.top.value = this.slice.top;
        if (this.inputs.right) this.inputs.right.value = this.slice.right;
        if (this.inputs.bottom) this.inputs.bottom.value = this.slice.bottom;
        if (this.inputs.left) this.inputs.left.value = this.slice.left;
        if (this.scaleSlider) this.scaleSlider.value = this.scale;

        if (this.overlay) this.overlay.style.display = 'flex';
        this.resetPreviewView();

        if (this.imgEl) {
            if (this.imgEl.complete) {
                this.onImageLoad();
            } else {
                this.imgEl.onload = () => this.onImageLoad();
            }
        }
    }

    setRadioValue(groupIn, value) {
        if (!groupIn) return;
        const input = groupIn.querySelector(`input[value="${value}"]`);
        if (input) input.checked = true;
    }

    onImageLoad() {
        if (!this.imgEl) return;
        this.originalWidth = this.imgEl.naturalWidth;
        this.originalHeight = this.imgEl.naturalHeight;

        if (this.magnifier) {
            this.magnifier.style.backgroundImage = `url(${this.imgEl.src})`;
        }

        this.updateGuidesVisuals();
        this.updatePreview();
    }

    close() {
        if (this.overlay) this.overlay.style.display = 'none';
        this.node = null;
    }

    save() {
        if (this.node) {
            this.node.slice = { ...this.slice };
            this.node.borderScale = this.scale;

            const bw = {
                top: this.slice.top * this.scale,
                right: this.slice.right * this.scale,
                bottom: this.slice.bottom * this.scale,
                left: this.slice.left * this.scale
            };
            this.node.borderWidth = bw;
            this.node.repeat = `${this.repeatX} ${this.repeatY}`;
            this.node.updateVisuals();

            if (typeof this.app.pushHistory === 'function') this.app.pushHistory();
        }
        this.close();
    }

    updateFromInputs() {
        if (!this.originalWidth) return;
        this.slice.top = parseInt(this.inputs.top?.value || 0);
        this.slice.right = parseInt(this.inputs.right?.value || 0);
        this.slice.bottom = parseInt(this.inputs.bottom?.value || 0);
        this.slice.left = parseInt(this.inputs.left?.value || 0);

        this.updateGuidesVisuals(true);
        this.updatePreview();
    }

    updateGuidesVisuals(skipInputs = false) {
        if (!this.originalWidth) return;

        if (this.guides.top) this.guides.top.style.top = (this.slice.top / this.originalHeight * 100) + '%';
        if (this.guides.bottom) {
            const bottomPos = (this.originalHeight - this.slice.bottom) / this.originalHeight * 100;
            this.guides.bottom.style.top = bottomPos + '%';
        }

        if (this.guides.left) this.guides.left.style.left = (this.slice.left / this.originalWidth * 100) + '%';
        if (this.guides.right) {
            const rightPos = (this.originalWidth - this.slice.right) / this.originalWidth * 100;
            this.guides.right.style.left = rightPos + '%';
        }

        if (!skipInputs) {
            if (this.inputs.top && document.activeElement !== this.inputs.top) this.inputs.top.value = this.slice.top;
            if (this.inputs.right && document.activeElement !== this.inputs.right) this.inputs.right.value = this.slice.right;
            if (this.inputs.bottom && document.activeElement !== this.inputs.bottom) this.inputs.bottom.value = this.slice.bottom;
            if (this.inputs.left && document.activeElement !== this.inputs.left) this.inputs.left.value = this.slice.left;
        }
    }

    startDragGuide(e, key) {
        this.draggingGuide = key;
        if (e.target) e.target.classList.add('dragging');
        if (this.magnifier) this.magnifier.style.display = 'block';
        this.updateMagnifier(e);
        e.stopPropagation();
    }

    dragGuide(e) {
        if (!this.draggingGuide || !this.originalWidth || !this.imgEl) return;

        const rect = this.imgEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const cx = Math.max(0, Math.min(rect.width, x));
        const cy = Math.max(0, Math.min(rect.height, y));

        const pxX = Math.round((cx / rect.width) * this.originalWidth);
        const pxY = Math.round((cy / rect.height) * this.originalHeight);

        if (this.draggingGuide === 'top') {
            const max = this.originalHeight - this.slice.bottom;
            this.slice.top = Math.min(Math.max(0, pxY), max);
        } else if (this.draggingGuide === 'bottom') {
            const max = this.originalHeight - this.slice.top;
            const valFromBottom = this.originalHeight - pxY;
            this.slice.bottom = Math.min(Math.max(0, valFromBottom), max);
        } else if (this.draggingGuide === 'left') {
            const max = this.originalWidth - this.slice.right;
            this.slice.left = Math.min(Math.max(0, pxX), max);
        } else if (this.draggingGuide === 'right') {
            const max = this.originalWidth - this.slice.left;
            const valFromRight = this.originalWidth - pxX;
            this.slice.right = Math.min(Math.max(0, valFromRight), max);
        }

        this.updateGuidesVisuals();
        this.updateMagnifier(e);
        this.updatePreview();
    }

    endDragGuide() {
        if (this.draggingGuide) {
            const el = this.guides[this.draggingGuide];
            if (el) el.classList.remove('dragging');
        }
        this.draggingGuide = null;
        if (this.magnifier) this.magnifier.style.display = 'none';
        this.updateGuidesVisuals();
    }

    updateMagnifier(e) {
        if (!this.canvasContainer || !this.imgEl || !this.magnifier) return;
        const imgRect = this.imgEl.getBoundingClientRect();
        const x = e.clientX - imgRect.left;
        const y = e.clientY - imgRect.top;

        this.magnifier.style.left = (x - 50) + 'px';
        this.magnifier.style.top = (y - 120) + 'px';

        const zoom = 2;
        this.magnifier.style.backgroundSize = `${imgRect.width * zoom}px ${imgRect.height * zoom}px`;
        this.magnifier.style.backgroundPosition = `-${x * zoom - 50}px -${y * zoom - 50}px`;
    }

    updatePreview() {
        if (!this.previewBox || !this.imgEl) return;
        this.previewBox.style.borderImageSource = `url("${this.imgEl.src}")`;

        const s = this.slice;
        this.previewBox.style.borderImageSlice = `${s.top} ${s.right} ${s.bottom} ${s.left} fill`;
        const sc = this.scale;
        this.previewBox.style.borderImageWidth = `${s.top * sc}px ${s.right * sc}px ${s.bottom * sc}px ${s.left * sc}px`;
        this.previewBox.style.borderWidth = `${s.top * sc}px ${s.right * sc}px ${s.bottom * sc}px ${s.left * sc}px`;
        this.previewBox.style.borderImageRepeat = `${this.repeatX} ${this.repeatY}`;
    }

    startResizePreview(e, handle) {
        if (!this.previewBox) return;
        this.resizingPreview = {
            handle: handle,
            startX: e.clientX,
            startY: e.clientY,
            startW: this.previewBox.offsetWidth,
            startH: this.previewBox.offsetHeight
        };
    }

    resizePreview(e) {
        if (!this.resizingPreview || !this.previewBox) return;
        const zoom = this.viewState.scale;
        const dx = (e.clientX - this.resizingPreview.startX) / zoom;
        const dy = (e.clientY - this.resizingPreview.startY) / zoom;
        const h = this.resizingPreview.handle;

        let newW = this.resizingPreview.startW;
        let newH = this.resizingPreview.startH;

        if (h.includes('e')) newW += dx;
        if (h.includes('w')) newW -= dx;
        if (h.includes('s')) newH += dy;
        if (h.includes('n')) newH -= dy;

        this.previewBox.style.width = Math.max(20, newW) + 'px';
        this.previewBox.style.height = Math.max(20, newH) + 'px';
    }

    endResizePreview() {
        this.resizingPreview = null;
    }
}

window.SpriteEditor = SpriteEditor;