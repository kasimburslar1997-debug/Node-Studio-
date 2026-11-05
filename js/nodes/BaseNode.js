/**
 * BaseNode.js
 * الكلاس الأساسي لجميع العقد مع تحسينات الأداء الفائقة للتابلت:
 * 1. معالج موحد مركزي (Shared Static ResizeObserver) لجميع العقد
 * 2. تجميع عمليات القياس عبر requestAnimationFrame لمنع Layout Thrashing
 * 3. آلية تنظيف دورية للذاكرة (Memory Cleanup & WeakMap Registry)
 */

const DRAG_THRESHOLD = 10;

class BaseNode {
    // مراقب موحد ثابت على مستوى النظام بدلاً من إنشاء مراقب لكل عقدة
    static _sharedObserver = null;
    static _nodeRegistry = new WeakMap();
    static _pendingResizeNodes = new Set();
    static _rafScheduled = false;

    static getSharedObserver() {
        if (!BaseNode._sharedObserver && typeof ResizeObserver !== 'undefined') {
            BaseNode._sharedObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const node = BaseNode._nodeRegistry.get(entry.target);
                    if (node) {
                        BaseNode._pendingResizeNodes.add({ node, entry });
                    }
                }

                if (!BaseNode._rafScheduled) {
                    BaseNode._rafScheduled = true;
                    requestAnimationFrame(() => {
                        BaseNode._pendingResizeNodes.forEach(({ node, entry }) => {
                            node._handleObservedResize(entry);
                        });
                        BaseNode._pendingResizeNodes.clear();
                        BaseNode._rafScheduled = false;
                    });
                }
            });
        }
        return BaseNode._sharedObserver;
    }

    constructor(type, x, y, width, height) {
        this.id = "node-" + Date.now() + Math.random().toString(36).substr(2, 5);
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.rotation = 0;
        this.locked = false;
        this.collapsed = false;
        this.autoResize = true;
        this.parent = null;

        this.flexModeWidth = 'hug';
        this.flexModeHeight = 'hug';

        this.styles = {
            fill: "var(--bg-panel)",
            text: "inherit",
            radius: 16,
            stroke: "transparent",
            strokeWidth: 0,
            strokeAlignment: 'outside'
        };

        this.element = this.createDOM();
        this.updateVisuals();

        // تسجيل العنصر في المراقب الموحد
        BaseNode._nodeRegistry.set(this.element, this);
        const observer = BaseNode.getSharedObserver();
        if (observer && this.element) {
            observer.observe(this.element);
        }
    }

    createDOM() {
        const el = document.createElement("div");
        el.id = this.id;
        el.className = "node";
        const inner = document.createElement("div");
        inner.className = "node-inner";
        inner.innerHTML = this.getHTML();
        el.appendChild(inner);
        this.addHandles(el);
        return el;
    }

    addHandles(el) {
        ["n", "s", "e", "w"].forEach(pos => {
            const h = document.createElement("div");
            h.className = `handle h-${pos}`;
            h.dataset.pos = pos;
            h.innerHTML = '<div class="handle-vis"></div>';
            el.appendChild(h);
        });
        ["nw", "ne", "sw", "se"].forEach(pos => {
            const h = document.createElement("div");
            h.className = `handle h-rot h-rot-${pos}`;
            h.dataset.pos = pos;
            h.innerHTML = '<div class="handle-vis"></div>';
            el.appendChild(h);
        });
    }

    getHTML() {
        return "";
    }

    _handleObservedResize(entry) {
        if (!this.element) return;
        const rect = entry.contentRect;

        let newW = rect.width;
        let newH = rect.height;

        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
            newW = entry.borderBoxSize[0].inlineSize;
            newH = entry.borderBoxSize[0].blockSize;
        }

        let changed = false;

        if (this.flexModeWidth === 'fill' || this.flexModeWidth === 'hug') {
            if (Math.abs(this.width - newW) > 0.8) {
                this.width = newW;
                changed = true;
            }
        }

        if (this.flexModeHeight === 'fill' || this.flexModeHeight === 'hug') {
            if (Math.abs(this.height - newH) > 0.8) {
                this.height = newH;
                changed = true;
            }
        }

        if (changed && this.parent && typeof this.parent.onChildResize === 'function') {
            this.parent.onChildResize();
        }
    }

    updateVisuals() {
        if (!this.parent) {
            this.element.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.rotation}deg)`;
            this.element.style.width = `${this.width}px`;
            this.element.style.height = `${this.height}px`;
            this.element.style.position = '';
            this.element.style.flex = '';
            this.element.style.alignSelf = '';
        } else {
            if (this.ignoreAutoLayout) {
                this.element.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.rotation}deg)`;
                this.element.style.width = `${this.width}px`;
                this.element.style.height = `${this.height}px`;
                this.element.style.position = 'absolute';
            } else {
                this.element.style.transform = '';
                this.element.style.position = 'relative';

                const parentLayout = (this.parent && this.parent.layout) ? this.parent.layout : 'vertical';
                const isRow = parentLayout === 'horizontal';

                this.element.style.flex = '';
                this.element.style.alignSelf = '';
                this.element.style.width = '';
                this.element.style.height = '';
                this.element.style.minWidth = `${this.minWidth || 40}px`;
                this.element.style.minHeight = `${this.minHeight || 40}px`;

                if (isRow) {
                    if (this.flexModeWidth === 'fill') {
                        this.element.style.flex = '1 0 0px';
                        this.element.style.width = 'auto';
                    } else if (this.flexModeWidth === 'hug') {
                        this.element.style.width = 'fit-content';
                        this.element.style.flex = '0 0 auto';
                    } else {
                        this.element.style.width = `${this.width}px`;
                        this.element.style.flex = '0 0 auto';
                    }

                    if (this.flexModeHeight === 'fill') {
                        this.element.style.alignSelf = 'stretch';
                        this.element.style.height = 'auto';
                    } else if (this.flexModeHeight === 'hug') {
                        this.element.style.height = 'fit-content';
                    } else {
                        this.element.style.height = `${this.height}px`;
                    }
                } else {
                    if (this.flexModeWidth === 'fill') {
                        this.element.style.alignSelf = 'stretch';
                        this.element.style.width = 'auto';
                    } else if (this.flexModeWidth === 'hug') {
                        this.element.style.width = 'fit-content';
                        this.element.style.alignSelf = 'flex-start';
                    } else {
                        this.element.style.width = `${this.width}px`;
                        this.element.style.alignSelf = 'flex-start';
                    }

                    if (this.flexModeHeight === 'fill') {
                        this.element.style.flex = '1 0 0px';
                        this.element.style.height = 'auto';
                    } else if (this.flexModeHeight === 'hug') {
                        this.element.style.height = 'fit-content';
                        this.element.style.flex = '0 0 auto';
                    } else {
                        this.element.style.height = `${this.height}px`;
                        this.element.style.flex = '0 0 auto';
                    }
                }
            }

            this.element.classList.remove('flex-width-fixed', 'flex-width-hug', 'flex-width-fill',
                'flex-height-fixed', 'flex-height-hug', 'flex-height-fill');
            this.element.classList.add(`flex-width-${this.flexModeWidth}`);
            this.element.classList.add(`flex-height-${this.flexModeHeight}`);
        }

        this.element.style.backgroundColor = this.styles.fill;
        this.element.style.color = this.styles.text;
        this.element.style.borderRadius = `${this.styles.radius}px`;
        this.element.style.setProperty("--current-radius", `${this.styles.radius}px`);

        let finalStrokeColor = this.styles.stroke || 'transparent';
        let strokeWidth = this.styles.strokeWidth !== undefined ? this.styles.strokeWidth : 0;

        if (strokeWidth > 0 && finalStrokeColor !== 'transparent') {
            const align = this.styles.strokeAlignment || 'outside';
            let shadow = '';
            if (align === 'inside') {
                shadow = `inset 0 0 0 ${strokeWidth}px ${finalStrokeColor}`;
            } else if (align === 'center') {
                const half = strokeWidth / 2;
                shadow = `0 0 0 ${half}px ${finalStrokeColor}, inset 0 0 0 ${half}px ${finalStrokeColor}`;
            } else {
                shadow = `0 0 0 ${strokeWidth}px ${finalStrokeColor}`;
            }
            this.element.style.boxShadow = shadow;
        } else {
            this.element.style.boxShadow = '';
        }
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        if (typeof App !== 'undefined' && App.renderManager) {
            App.renderManager.markNodeDirty(this);
        } else {
            this.updateVisuals();
        }
    }

    resize(w, h, x, y) {
        this.width = Math.max(30, w);
        this.height = Math.max(30, h);
        this.x = x;
        this.y = y;
        if (typeof App !== 'undefined' && App.renderManager) {
            App.renderManager.markNodeDirty(this);
        } else {
            this.updateVisuals();
        }
    }

    rotate(deg) {
        this.rotation = deg;
        this.updateVisuals();
    }

    destroy() {
        const observer = BaseNode.getSharedObserver();
        if (observer && this.element) {
            observer.unobserve(this.element);
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

window.BaseNode = BaseNode;