/**
 * NodeManager.js
 * مدير العقد في لوحة العمل مع دعم كامل لأنواع الوسائط الجديدة (الفيديو والصور المزدوجة)
 */

class NodeManager {
    constructor(app) {
        this.app = app;
        this.nodes = new Map();
    }

    get(id) {
        return this.nodes.get(id);
    }

    has(id) {
        return this.nodes.has(id);
    }

    set(id, node) {
        this.nodes.set(id, node);
    }

    delete(id) {
        const node = this.nodes.get(id);
        if (node) {
            if (node.element) node.element.remove();
            this.nodes.delete(id);
        }
    }

    forEach(callback) {
        this.nodes.forEach(callback);
    }

    clear() {
        this.nodes.forEach(node => {
            if (node.element) node.element.remove();
        });
        this.nodes.clear();
    }

    createNode(type, extraData = null) {
        const state = this.app.state;
        const viewportCenterX = (window.innerWidth / 2 - state.panX) / state.scale;
        const viewportCenterY = (window.innerHeight / 2 - state.panY) / state.scale;

        let node;
        let defaultW = 220;
        let defaultH = 120;

        if (type === "icon" || type === "number" || type === "empty") { defaultW = 50; defaultH = 50; }
        if (type === "folder") { defaultW = 300; defaultH = 250; }
        if (type === "image") { defaultW = 300; defaultH = 200; }
        if (type === "video") { defaultW = 360; defaultH = 240; }
        if (type === "drawing" || type === "code") { defaultW = 380; defaultH = 260; }
        if (type === "sprite" || type === "container") { defaultW = 240; defaultH = 200; }

        const x = viewportCenterX - defaultW / 2;
        const y = viewportCenterY - defaultH / 2;

        if (type === "video") node = new VideoNode(x, y);
        else if (type === "code") node = new CodeNode(x, y);
        else if (type === "drawing") node = new DrawingNode(x, y);
        else if (type === "text-with-title") node = new TextWithTitleNode(x, y);
        else if (type.startsWith("text")) node = new TextNode(x, y);
        else if (type === "image") node = new ImageNode(x, y);
        else if (type === "sprite") node = new SpriteNode(x, y);
        else if (type === "empty") node = new EmptyNode(x, y);
        else if (type === "icon") node = new IconNode(x, y, extraData || 'star');
        else if (type === "number") node = new NumberNode(x, y, extraData || 0);
        else if (type === "folder") {
            let maxIndex = 0;
            this.nodes.forEach(n => {
                if (n.type === 'folder' && n.title && n.title.startsWith("مجلد ")) {
                    const num = parseInt(n.title.replace("مجلد ", ""));
                    if (!isNaN(num) && num > maxIndex) maxIndex = num;
                }
            });
            node = new FolderNode(x, y, null, `مجلد ${maxIndex + 1}`);
            if (this.app.workspaces) {
                this.app.workspaces.set(node.workspaceId, {
                    nodes: [],
                    panX: window.innerWidth / 2,
                    panY: window.innerHeight / 2,
                    scale: 1
                });
            }
        } else if (type === "container") {
            node = new ContainerNode(x, y);
        }

        if (!node) return null;

        this.addNodeToCanvas(node);
        node.updateVisuals();

        this.app.bringToFront(node.id);
        this.app.deselectAll();
        this.app.selectNode(node.id);
        this.app.pushHistory();

        if (this.app.refreshIcons) this.app.refreshIcons();
        return node;
    }

    createNodeAtPosition(type, x, y, extraData = null) {
        let node;
        let offsetX = 100;
        let offsetY = 60;

        if (type === "icon" || type === "number" || type === "empty") { offsetX = 25; offsetY = 25; }
        if (type === "video") { offsetX = 180; offsetY = 120; }

        const nodeX = x - offsetX;
        const nodeY = y - offsetY;

        if (type === "video") node = new VideoNode(nodeX, nodeY);
        else if (type === "code") node = new CodeNode(nodeX, nodeY);
        else if (type === "drawing") node = new DrawingNode(nodeX, nodeY);
        else if (type === "text-with-title") node = new TextWithTitleNode(nodeX, nodeY);
        else if (type.startsWith("text")) node = new TextNode(nodeX, nodeY);
        else if (type === "image") node = new ImageNode(nodeX, nodeY);
        else if (type === "sprite") node = new SpriteNode(nodeX, nodeY);
        else if (type === "empty") node = new EmptyNode(nodeX, nodeY);
        else if (type === "icon") node = new IconNode(nodeX, nodeY, extraData || 'star');
        else if (type === "number") node = new NumberNode(nodeX, nodeY, extraData || 0);
        else if (type === "folder") {
            node = new FolderNode(nodeX, nodeY, null, 'مجلد جديد');
        } else if (type === "container") {
            node = new ContainerNode(nodeX, nodeY);
        }

        if (!node) return null;

        this.addNodeToCanvas(node);
        node.updateVisuals();

        const parentContainer = this.getContainerIntersecting(node, node);
        if (parentContainer) parentContainer.addChild(node);

        this.app.bringToFront(node.id);
        this.app.deselectAll();
        this.app.selectNode(node.id);
        this.app.pushHistory();

        if (this.app.refreshIcons) this.app.refreshIcons();
        return node;
    }

    addNodeToCanvas(node) {
        this.nodes.set(node.id, node);
        if (this.app.ui && this.app.ui.content) {
            this.app.ui.content.appendChild(node.element);
        }
    }

    getContainerAt(x, y, excludeNode = null) {
        return this.getContainerIntersecting({ x: x, y: y, width: 0, height: 0 }, excludeNode);
    }

    getContainerIntersecting(rect, excludeNode = null) {
        let candidates = [];
        this.nodes.forEach(n => {
            if (n.type === 'container' && (!excludeNode || n.id !== excludeNode.id) && !n.locked) {
                const r1 = { left: rect.x, right: rect.x + rect.width, top: rect.y, bottom: rect.y + rect.height };
                const HIT_INSET = 5;
                const r2 = {
                    left: n.x + HIT_INSET,
                    right: n.x + n.width - HIT_INSET,
                    top: n.y + HIT_INSET,
                    bottom: n.y + n.height - HIT_INSET
                };

                const intersects = !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);

                if (intersects) {
                    let isDescendant = false;
                    if (excludeNode) {
                        let p = n.parent;
                        while (p) {
                            if (p.id === excludeNode.id) { isDescendant = true; break; }
                            p = p.parent;
                        }
                    }
                    if (!isDescendant) candidates.push(n);
                }
            }
        });

        if (candidates.length > 0) {
            candidates.sort((a, b) => (a.width * a.height) - (b.width * b.height));
            return candidates[0];
        }
        return null;
    }
}

window.NodeManager = NodeManager;