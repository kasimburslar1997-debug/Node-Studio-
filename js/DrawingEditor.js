/**
 * DrawingEditor.js
 * محرر الرسم الاحترافي المخصص لأجهزة التابلت والقلم الذكي
 * المزايا:
 * 1. دعم حساسية ضغط القلم (Pressure Sensitivity) وتعديل سمك الخط ديناميكياً
 * 2. تنعيم انحناءات الخطوط (Quadratic Bezier Interpolation) لمنع التعرج الحركي
 * 3. دعم الشاشات عالية الدقة (High-DPI / Retina Canvas Scaling)
 * 4. إدارة الطبقات بدون تسريب للذاكرة
 */

const DrawingEditor = {
    nodeId: null,
    layers: [],
    activeIdx: 0,
    width: 900,
    height: 650,
    tool: "brush",
    color: "#000000",
    size: 6,
    isDrawing: false,
    points: [],

    ui: {
        editor: null,
        container: null,
        list: null
    },

    initUI() {
        this.ui.editor = document.getElementById("drawing-editor");
        this.ui.container = document.getElementById("drawing-layers");
        this.ui.list = document.getElementById("layers-list");
    },

    open(id) {
        this.initUI();
        this.nodeId = id;
        const node = App.nodes.get(id);
        this.layers = [];
        this.ui.container.innerHTML = "";

        if (node.previewUrl) {
            this.addLayer("الخلفية", node.previewUrl);
        } else {
            this.addLayer("الطبقة 1");
            const ctx = this.layers[0].ctx;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, this.width, this.height);
        }

        this.ui.editor.style.display = "flex";
        this.renderList();
        this.bindTabletDrawEvents();
    },

    addLayer(name, src = null) {
        const canvas = document.createElement("canvas");
        const dpr = window.devicePixelRatio || 1;

        // دقة عالية متناسبة مع شاشة التابلت
        canvas.width = this.width * dpr;
        canvas.height = this.height * dpr;
        canvas.style.width = `${this.width}px`;
        canvas.style.height = `${this.height}px`;

        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (src) {
            const img = new Image();
            img.src = src;
            img.onload = () => ctx.drawImage(img, 0, 0, this.width, this.height);
        }

        const layer = {
            id: Date.now() + Math.random(),
            canvas: canvas,
            ctx: ctx,
            visible: true,
            name: name || `طبقة ${this.layers.length + 1}`
        };

        this.layers.push(layer);
        this.ui.container.appendChild(canvas);
        this.activeIdx = this.layers.length - 1;
        this.renderList();
    },

    bindTabletDrawEvents() {
        const canvasArea = document.getElementById("canvas-area");
        if (this._eventsBound) return;

        canvasArea.addEventListener("pointerdown", e => this.start(e), { passive: false });
        window.addEventListener("pointermove", e => this.draw(e), { passive: false });
        window.addEventListener("pointerup", e => this.end(e));
        window.addEventListener("pointercancel", e => this.end(e));

        this._eventsBound = true;
    },

    getPos(e) {
        const rect = this.ui.container.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure || (e.pointerType === 'pen' ? 0.5 : 1)
        };
    },

    start(e) {
        if (this.activeIdx < 0 || !this.layers[this.activeIdx]) return;
        if (e.target.closest("#tools-column") || e.target.closest("#layers-column")) return;

        this.isDrawing = true;
        this.points = [];
        const pos = this.getPos(e);
        this.points.push(pos);

        const ctx = this.layers[this.activeIdx].ctx;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        e.preventDefault();
    },

    draw(e) {
        if (!this.isDrawing || this.activeIdx < 0) return;
        const pos = this.getPos(e);
        this.points.push(pos);

        const ctx = this.layers[this.activeIdx].ctx;
        const pts = this.points;

        if (pts.length > 2) {
            // تنعيم المنحنى عبر حساب النقطة المتوسطة (Bezier Curve Smoothing)
            const xc = (pts[pts.length - 1].x + pts[pts.length - 2].x) / 2;
            const yc = (pts[pts.length - 1].y + pts[pts.length - 2].y) / 2;

            // حساب السمك بحسب قوة ضغط القلم على الشاشة
            const currentPressure = pos.pressure > 0 ? pos.pressure : 0.5;
            const dynamicSize = this.tool === "eraser"
                ? this.size * 2.5
                : Math.max(1.5, this.size * (currentPressure * 1.6));

            ctx.lineWidth = dynamicSize;
            ctx.strokeStyle = this.tool === "eraser" ? "#ffffff" : this.color;
            ctx.globalCompositeOperation = this.tool === "eraser" ? "destination-out" : "source-over";

            ctx.quadraticCurveTo(pts[pts.length - 2].x, pts[pts.length - 2].y, xc, yc);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(xc, yc);
        }
        e.preventDefault();
    },

    end(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.points = [];
    },

    save() {
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = this.width;
        exportCanvas.height = this.height;
        const ctx = exportCanvas.getContext("2d");

        this.layers.forEach(l => {
            if (l.visible) {
                ctx.drawImage(l.canvas, 0, 0, this.width, this.height);
            }
        });

        const dataUrl = exportCanvas.toDataURL("image/png");
        const node = App.nodes.get(this.nodeId);
        if (node && typeof node.updatePreview === 'function') {
            node.updatePreview(dataUrl);
            App.pushHistory();
        }
        this.close();
    },

    close() {
        this.ui.editor.style.display = "none";
        this.nodeId = null;
    },

    setTool(t) {
        this.tool = t;
        document.querySelectorAll("#tools-column .icon-btn").forEach(b => b.classList.remove("active"));
        const btn = document.getElementById("tool-" + t);
        if (btn) btn.classList.add("active");
    },

    setColor(c) {
        this.color = c;
    },

    setSize(s) {
        this.size = parseFloat(s);
    },

    renderList() {
        this.ui.list.innerHTML = "";
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const l = this.layers[i];
            const item = document.createElement("div");
            item.className = `layer-item ${i === this.activeIdx ? "active" : ""}`;
            item.innerHTML = `
                <i data-lucide="${l.visible ? 'eye' : 'eye-off'}" style="cursor:pointer;" onclick="DrawingEditor.toggleVis(${i})"></i>
                <span style="flex:1;margin:0 10px;font-size:0.85rem;">${l.name}</span>
            `;
            item.addEventListener('click', (e) => {
                if (!e.target.hasAttribute('data-lucide')) {
                    this.activeIdx = i;
                    this.renderList();
                }
            });
            this.ui.list.appendChild(item);
            l.canvas.style.display = l.visible ? "block" : "none";
            l.canvas.style.zIndex = i;
        }
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: this.ui.list });
    },

    toggleVis(i) {
        if (this.layers[i]) {
            this.layers[i].visible = !this.layers[i].visible;
            this.renderList();
        }
    }
};

window.DrawingEditor = DrawingEditor;