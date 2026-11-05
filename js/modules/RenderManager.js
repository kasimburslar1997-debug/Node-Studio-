/**
 * RenderManager.js
 * محرك العرض عالي الأداء مع نظام الحماية من الاختفاء العرضي للعقد
 */

class RenderManager {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.dirtyNodes = new Set();
        this.pendingViewUpdate = false;

        this.cellSize = 800; // حجم خلية واسع يغطي الشاشات دون أخطاء تقطيع
        this.grid = new Map();
        this.nodeCells = new Map();

        this._nodeTransformCache = new Map();
        this._viewportBuffer = 600;
        this._lastCullTime = 0;
        this._cullThrottle = 80;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.rebuildSpatialGrid();
        this.loop();
    }

    stop() {
        this.isRunning = false;
    }

    requestViewUpdate() {
        this.pendingViewUpdate = true;
    }

    markNodeDirty(node) {
        if (!node) return;
        this.dirtyNodes.add(node);
        this.updateNodeInSpatialGrid(node);
    }

    getCellKey(cx, cy) {
        return `${cx},${cy}`;
    }

    rebuildSpatialGrid() {
        this.grid.clear();
        this.nodeCells.clear();
        if (this.app.nodes) {
            this.app.nodes.forEach(node => {
                this.updateNodeInSpatialGrid(node);
            });
        }
    }

    updateNodeInSpatialGrid(node) {
        if (!node || node.parent) return;

        const oldCells = this.nodeCells.get(node.id);
        if (oldCells) {
            oldCells.forEach(cellKey => {
                const bucket = this.grid.get(cellKey);
                if (bucket) bucket.delete(node.id);
            });
        }

        const width = node.width || 200;
        const height = node.height || 100;

        const startX = Math.floor(node.x / this.cellSize);
        const endX = Math.floor((node.x + width) / this.cellSize);
        const startY = Math.floor(node.y / this.cellSize);
        const endY = Math.floor((node.y + height) / this.cellSize);

        const newCells = new Set();
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = this.getCellKey(x, y);
                if (!this.grid.has(key)) {
                    this.grid.set(key, new Set());
                }
                this.grid.get(key).add(node.id);
                newCells.add(key);
            }
        }
        this.nodeCells.set(node.id, newCells);
    }

    loop() {
        if (!this.isRunning) return;

        const now = Date.now();

        if (this.pendingViewUpdate) {
            this.updateViewDOM();
            this.pendingViewUpdate = false;
            this.cullOffScreenNodesSpatial();
        } else if (now - this._lastCullTime > this._cullThrottle) {
            this.cullOffScreenNodesSpatial();
            this._lastCullTime = now;
        }

        if (this.dirtyNodes.size > 0) {
            this.dirtyNodes.forEach(node => {
                if (node.element) {
                    this.updateNodeDOM(node);
                }
            });
            this.dirtyNodes.clear();
        }

        requestAnimationFrame(() => this.loop());
    }

    updateViewDOM() {
        const { panX, panY, scale } = this.app.state;
        const content = this.app.ui.content;
        const bg = this.app.ui.bg;

        if (content) {
            content.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
        }

        if (bg) {
            const { gridSize, gridStatic, gridType } = this.app.state;
            let size = gridStatic ? gridSize : gridSize * scale;
            if (gridType === 'random') size *= 5;

            bg.style.backgroundPosition = `${panX}px ${panY}px`;
            bg.style.backgroundSize = `${size}px ${size}px`;
        }
    }

    updateNodeDOM(node) {
        if (!node.parent || node.ignoreAutoLayout) {
            const transform = `translate3d(${node.x}px, ${node.y}px, 0) rotate(${node.rotation}deg)`;
            const cached = this._nodeTransformCache.get(node.id);

            if (cached !== transform) {
                node.element.style.transform = transform;
                this._nodeTransformCache.set(node.id, transform);
            }
        } else {
            if (node.element.style.transform !== '') {
                node.element.style.transform = '';
            }
        }

        const widthStr = node.width === 'auto' ? 'auto' : `${node.width}px`;
        const heightStr = node.height === 'auto' ? 'auto' : `${node.height}px`;

        if (node.element.style.width !== widthStr) node.element.style.width = widthStr;
        if (node.element.style.height !== heightStr) node.element.style.height = heightStr;
    }

    cullOffScreenNodesSpatial() {
        const { panX, panY, scale } = this.app.state;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const buf = this._viewportBuffer;

        const minWorldX = (-panX - buf) / scale;
        const maxWorldX = (vw - panX + buf) / scale;
        const minWorldY = (-panY - buf) / scale;
        const maxWorldY = (vh - panY + buf) / scale;

        const startCellX = Math.floor(minWorldX / this.cellSize);
        const endCellX = Math.floor(maxWorldX / this.cellSize);
        const startCellY = Math.floor(minWorldY / this.cellSize);
        const endCellY = Math.floor(maxWorldY / this.cellSize);

        const visibleCandidates = new Set();

        for (let cx = startCellX; cx <= endCellX; cx++) {
            for (let cy = startCellY; cy <= endCellY; cy++) {
                const cell = this.grid.get(this.getCellKey(cx, cy));
                if (cell) {
                    cell.forEach(id => visibleCandidates.add(id));
                }
            }
        }

        // إظهار العقد المرئية
        visibleCandidates.forEach(id => {
            const node = this.app.nodes.get(id);
            if (node && node.element && node.element.style.display === 'none') {
                node.element.style.display = '';
            }
        });

        // حماية أمان: إذا كانت العقد المحسوبة فارغة لا نخفي شيئاً لتفادي اختفاء اللوحة
        if (visibleCandidates.size > 0 && this.app.nodes.size > 0) {
            this.app.nodes.forEach(node => {
                if (!node.parent && !visibleCandidates.has(node.id)) {
                    // تحقق إضافي عبر الإحداثيات قبل الإخفاء
                    const isOutside = (node.x + node.width < minWorldX || node.x > maxWorldX || node.y + node.height < minWorldY || node.y > maxWorldY);
                    if (isOutside && node.element && node.element.style.display !== 'none') {
                        node.element.style.display = 'none';
                    }
                }
            });
        }
    }
}

window.RenderManager = RenderManager;