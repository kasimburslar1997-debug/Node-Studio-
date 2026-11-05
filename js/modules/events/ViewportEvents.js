// ViewportEvents.js - إدارة حركة وتكبير اللوحة اللانهائية بدعم كامل للتابلت واللمس
Object.assign(App, {
    _bindViewportEvents() {
        const vp = this.ui.viewport;

        // تهيئة محرك التابلت المتقدم
        if (!this.tabletEngine && window.TabletGestureEngine) {
            this.tabletEngine = new window.TabletGestureEngine(this);
        }

        // أحداث اللمس للقلم والأصابع عبر TabletGestureEngine
        vp.addEventListener("pointerdown", e => {
            if (this.tabletEngine) {
                const res = this.tabletEngine.onPointerDown(e);
                if (res.handled) {
                    e.preventDefault();
                    return;
                }
            }
        }, { passive: false });

        vp.addEventListener("pointermove", e => {
            if (this.tabletEngine) {
                const res = this.tabletEngine.onPointerMove(e);
                if (res.handled) {
                    e.preventDefault();
                    return;
                }
            }
        }, { passive: false });

        vp.addEventListener("pointerup", e => {
            if (this.tabletEngine) {
                const res = this.tabletEngine.onPointerUp(e);
                if (res.handled) {
                    e.preventDefault();
                    return;
                }
            }
        }, { passive: false });

        vp.addEventListener("pointercancel", e => {
            if (this.tabletEngine) {
                this.tabletEngine.onPointerUp(e);
            }
        });

        // دعم عجلة الماوس كبديل عند وصل ماوس بالتابلت
        vp.addEventListener("wheel", e => {
            if (e.target.closest('.text-content-editor') || e.target.closest('.code-content')) {
                e.stopPropagation();
                return;
            }

            const containerInner = e.target.closest('.container-inner');
            if (containerInner) {
                const hasHorizontalScroll = containerInner.scrollWidth > containerInner.clientWidth;
                const hasVerticalScroll = containerInner.scrollHeight > containerInner.clientHeight;

                if (hasVerticalScroll || hasHorizontalScroll) {
                    e.stopPropagation();
                    if (hasVerticalScroll && !e.shiftKey) {
                        containerInner.scrollTop += e.deltaY;
                    }
                    if (hasHorizontalScroll && (e.shiftKey || !hasVerticalScroll)) {
                        containerInner.scrollLeft += e.deltaX || e.deltaY;
                    }
                    return;
                }
            }

            e.preventDefault();

            // إخفاء أشرطة الأدوات أثناء التقريب السريع
            const toolbars = document.querySelectorAll('#node-toolbar, .formatting-toolbar');
            toolbars.forEach(tb => {
                if (tb) tb.style.display = 'none';
            });

            if (this._zoomDebounce) clearTimeout(this._zoomDebounce);
            this._zoomDebounce = setTimeout(() => {
                this.updateToolbar();
            }, 250);

            const zoomSpeed = 0.0015;
            const delta = e.deltaY * -zoomSpeed;

            const mouseX = e.clientX;
            const mouseY = e.clientY;
            const worldX = (mouseX - this.state.panX) / this.state.scale;
            const worldY = (mouseY - this.state.panY) / this.state.scale;

            let newScale = this.state.scale + delta;
            newScale = Math.max(0.1, Math.min(5, newScale));

            this.state.scale = newScale;
            this.state.panX = mouseX - worldX * newScale;
            this.state.panY = mouseY - worldY * newScale;

            const zoomLabel = document.getElementById("zoom-label");
            if (zoomLabel) zoomLabel.innerText = Math.round(100 * this.state.scale) + "%";

            this.renderManager.requestViewUpdate();
        }, { passive: false });
    },

    updateView() {
        this.renderManager.requestViewUpdate();
        document.documentElement.style.setProperty('--zoom-scale', this.state.scale);
        this.updateToolbar();
    },

    centerView() {
        this.state.panX = window.innerWidth / 2;
        this.state.panY = window.innerHeight / 2;
        this.updateView();
    },

    resetView() {
        let targets = [];
        if (this.selected.size > 0) {
            targets = Array.from(this.selected).map(id => this.nodes.get(id)).filter(n => n);
        } else if (this.state.focusedNodes.size > 0) {
            targets = Array.from(this.state.focusedNodes).map(id => this.nodes.get(id)).filter(n => n);
        } else if (this.state.focusedNode) {
            const n = this.nodes.get(this.state.focusedNode);
            if (n) targets = [n];
        } else {
            targets = Array.from(this.nodes.values());
        }

        if (targets.length === 0) {
            this.state.scale = 1;
            const zoomLabel = document.getElementById("zoom-label");
            if (zoomLabel) zoomLabel.innerText = "100%";
            this.centerView();
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        targets.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.width);
            maxY = Math.max(maxY, node.y + node.height);
        });

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const centerX = minX + contentW / 2;
        const centerY = minY + contentH / 2;

        const vpW = this.ui.viewport.clientWidth;
        const vpH = this.ui.viewport.clientHeight;
        const padding = 120; // متسع ومريح للتابلت

        const availW = Math.max(100, vpW - padding);
        const availH = Math.max(100, vpH - padding);

        const scaleX = availW / contentW;
        const scaleY = availH / contentH;

        let newScale = Math.min(scaleX, scaleY);
        newScale = Math.max(0.15, Math.min(3.0, newScale));

        this.state.scale = newScale;
        const zoomLabel = document.getElementById("zoom-label");
        if (zoomLabel) zoomLabel.innerText = Math.round(newScale * 100) + "%";

        this.state.panX = vpW / 2 - centerX * newScale;
        this.state.panY = vpH / 2 - centerY * newScale;

        this.updateView();
    },

    zoom(delta) {
        this.state.scale = Math.max(.1, Math.min(5, this.state.scale + delta));
        const zoomLabel = document.getElementById("zoom-label");
        if (zoomLabel) zoomLabel.innerText = Math.round(100 * this.state.scale) + "%";
        this.updateView();
    }
});