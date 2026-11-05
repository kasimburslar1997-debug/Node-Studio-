/**
 * App.js
 * الكائن الرئيسي للتطبيق مهيأ بنظام الأوامر (Command Pattern) والتكامل مع الوسائط
 */

const App = {
    nodes: new Map(),
    selected: new Set(),
    state: {
        scale: 1,
        panX: 0,
        panY: 0,
        magnet: true,
        theme: "dark",
        focusedNode: null,
        focusedNodes: new Set(),
        components: [],
        displayMode: 'normal',
        toolbarMode: 'floating',
        gridSize: 35,
        gridThickness: 1.5,
        gridStatic: true,
        gridVignette: true,
        gridType: 'dots'
    },
    workspaces: new Map(),
    currentWorkspaceId: "root",
    breadcrumbs: [],
    maxZIndex: 10,

    init() {
        this.ui = {
            viewport: document.getElementById("viewport"),
            content: document.getElementById("canvas-content"),
            toolbar: document.getElementById("node-toolbar"),
            bg: document.getElementById("infinite-bg"),
            tooltip: document.getElementById("tooltip")
        };

        // 1. مدير وسائط أدوبي (Embedded vs Linked)
        if (window.AssetManager) {
            this.assetManager = new window.AssetManager(this);
        }

        // 2. مدير التراجع والأوامر الحقيقي
        if (window.CommandManager) {
            this.commandManager = new window.CommandManager(this);
        }

        // 3. محرك العرض
        if (window.RenderManager) {
            this.renderManager = new window.RenderManager(this);
            this.renderManager.start();
        }

        // 4. مدير العقد والتخزين
        if (window.NodeManager) {
            this.nodeManager = new window.NodeManager(this);
            this.nodes = this.nodeManager.nodes;
        }

        if (window.PersistenceModule) {
            this.persistenceManager = new window.PersistenceModule(this);
            this.persistenceManager.init();
        }

        this.workspaces.set("root", {
            nodes: [],
            panX: window.innerWidth / 2,
            panY: window.innerHeight / 2,
            scale: 1
        });

        if (typeof this.bindEvents === 'function') this.bindEvents();
        if (typeof this.centerView === 'function') this.centerView();
        if (typeof this.updateBreadcrumbs === 'function') this.updateBreadcrumbs();

        if (typeof this.setGridType === 'function') this.setGridType("dots");
        if (typeof this.setGridOpacity === 'function') this.setGridOpacity(1);
        if (typeof this.toggleGridVignette === 'function') this.toggleGridVignette(this.state.gridVignette);

        document.body.setAttribute("data-theme", "dark");

        if (typeof this.initSidebarOverflowListener === 'function') {
            this.initSidebarOverflowListener();
        }

        // رسم الأيقونات فوراً
        this.refreshIcons();

        if (this.commandManager && typeof this.commandManager.updateUI === 'function') {
            this.commandManager.updateUI();
        }
    },

    refreshIcons() {
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
            try {
                lucide.createIcons();
            } catch (e) {
                console.warn("Lucide Icons rendering:", e);
            }
        }
    },

    toggleMagnet() {
        this.state.magnet = !this.state.magnet;
        const icon = document.getElementById("magnet-icon");
        if (icon) {
            icon.setAttribute("data-lucide", this.state.magnet ? "toggle-right" : "toggle-left");
            this.refreshIcons();
        }
    },

    undo() {
        if (this.commandManager) {
            this.commandManager.undo();
        }
    },

    redo() {
        if (this.commandManager) {
            this.commandManager.redo();
        }
    },

    pushHistory() {
        if (this.persistenceManager) {
            this.persistenceManager.saveToDB().catch(console.error);
        }
    },

    createNode(type, extraData = null) {
        if (!this.nodeManager) return null;
        const node = this.nodeManager.createNode(type, extraData);
        if (node && this.commandManager && window.CreateNodeCommand) {
            const serialized = this.serializeNode(node);
            this.commandManager.undoStack.push(new window.CreateNodeCommand(this, serialized));
            this.commandManager.updateUI();
        }
        return node;
    },

    createNodeAtPosition(type, x, y, extraData = null) {
        if (!this.nodeManager) return null;
        const node = this.nodeManager.createNodeAtPosition(type, x, y, extraData);
        if (node && this.commandManager && window.CreateNodeCommand) {
            const serialized = this.serializeNode(node);
            this.commandManager.undoStack.push(new window.CreateNodeCommand(this, serialized));
            this.commandManager.updateUI();
        }
        return node;
    },

    addNodeToCanvas(node) {
        if (this.nodeManager) {
            this.nodeManager.addNodeToCanvas(node);
        }
        if (this.renderManager && typeof this.renderManager.updateNodeInSpatialGrid === 'function') {
            this.renderManager.updateNodeInSpatialGrid(node);
        }
    },

    selectNode(id, multi = false) {
        if (!multi) this.deselectAll();
        const node = this.nodes.get(id);
        if (node) {
            this.selected.add(id);
            node.element.classList.add(this.selected.size > 1 ? "multi-selected" : "selected");
            this.bringToFront(id);
            this.updateToolbar();
        }
    },

    deselectAll() {
        this.selected.forEach(id => {
            const node = this.nodes.get(id);
            if (node) node.element.classList.remove("selected", "multi-selected", "editing");
        });
        this.selected.clear();
        this.updateToolbar();
        if (typeof this.setFocusedNode === 'function') this.setFocusedNode(null);
        document.body.classList.remove('focus-mode-active');
        this._isFocusMode = false;
        if (typeof this.showMainToolbar === 'function') this.showMainToolbar();
    },

    bringToFront(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            this.maxZIndex++;
            node.element.style.zIndex = this.maxZIndex;
        }
    },

    serializeNode(node) {
        if (!node) return null;
        const data = {
            id: node.id,
            type: node.type,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            rotation: node.rotation || 0,
            styles: Object.assign({}, node.styles || {}),
            flexModeWidth: node.flexModeWidth,
            flexModeHeight: node.flexModeHeight
        };

        if (node.type === 'text') {
            const editor = node.element.querySelector('.text-content-editor');
            data.text = editor ? editor.innerHTML : (node.text || '');
        } else if (node.type === 'text-with-title') {
            const editor = node.element.querySelector('.text-content-editor');
            const titleEl = node.element.querySelector('.text-node-title');
            data.text = editor ? editor.innerHTML : (node.text || '');
            data.title = titleEl ? titleEl.value : (node.title || '');
        } else if (node.type === 'icon') {
            data.icon = node.iconClass || 'star';
        } else if (node.type === 'image') {
            data.src = node.src;
            data.images = node.images;
            data.assetId = node.assetId || null;
            data.aspectRatio = node.aspectRatio;
        } else if (node.type === 'video') {
            data.src = node.src;
            data.assetId = node.assetId || null;
            data.aspectRatio = node.aspectRatio;
        } else if (node.type === 'folder') {
            data.title = node.title;
            data.workspaceId = node.workspaceId;
            data.src = node.src;
        } else if (node.type === 'code') {
            const textarea = node.element.querySelector('.code-content');
            data.content = textarea ? textarea.value : '';
        } else if (node.type === 'drawing') {
            data.previewUrl = node.previewUrl;
        } else if (node.type === 'number') {
            data.value = node.value;
        } else if (node.type === 'container') {
            data.layout = node.layout || 'vertical';
            data.gap = node.gap || 10;
            data.padding = node.padding || 0;
            data.alignItems = node.alignItems || 'start';
            data.justifyContent = node.justifyContent || 'start';
            data.flexWrap = node.flexWrap || 'nowrap';
            data.clipContent = node.clipContent || false;
            data.scrollBehavior = node.scrollBehavior || 'none';
            data.title = node.title || 'Container';
            data.children = Array.from(node.children).map(childId => {
                const childNode = this.nodes.get(childId);
                return childNode ? this.serializeNode(childNode) : null;
            }).filter(n => n !== null);
        }
        return data;
    },

    createNodeFromData(data, offsetX = 0, offsetY = 0) {
        let node;
        const absX = offsetX + (data.x || 0);
        const absY = offsetY + (data.y || 0);

        if (data.type === 'container') {
            node = new ContainerNode(absX, absY, data.width || 200, data.height || 200);
            node.layout = data.layout;
            node.gap = data.gap;
            node.padding = data.padding;
            node.alignItems = data.alignItems;
            node.justifyContent = data.justifyContent;
            node.flexWrap = data.flexWrap;
            node.clipContent = data.clipContent;
            node.scrollBehavior = data.scrollBehavior;
            node.title = data.title;

            if (data.children && Array.isArray(data.children)) {
                data.children.forEach(childData => {
                    const childNode = this.createNodeFromData(childData, 0, 0);
                    if (childNode) {
                        this.addNodeToCanvas(childNode);
                        node.addChild(childNode);
                    }
                });
            }
        } else if (data.type === 'video') {
            node = new VideoNode(absX, absY, data.assetId, data.src);
        } else if (data.type === 'text') {
            node = new TextNode(absX, absY);
            if (data.text) {
                setTimeout(() => {
                    const ed = node.element.querySelector('.text-content-editor');
                    if (ed) ed.innerHTML = data.text;
                }, 0);
            }
        } else if (data.type === 'text-with-title') {
            node = new TextWithTitleNode(absX, absY);
            node.title = data.title || '';
            if (data.text) {
                setTimeout(() => {
                    const ed = node.element.querySelector('.text-content-editor');
                    if (ed) ed.innerHTML = data.text;
                }, 0);
            }
        } else if (data.type === 'icon') {
            node = new IconNode(absX, absY, data.icon);
        } else if (data.type === 'image') {
            node = new ImageNode(absX, absY);
            node.assetId = data.assetId || null;
            if (data.images) node.images = data.images;
            if (data.src) node.setSrc(data.src, data.assetId);
            node.aspectRatio = data.aspectRatio;
        } else if (data.type === 'folder') {
            node = new FolderNode(absX, absY, data.workspaceId, data.title, data.src);
        } else if (data.type === 'empty') {
            node = new EmptyNode(absX, absY);
        } else if (data.type === 'code') {
            node = new CodeNode(absX, absY);
            if (data.content) {
                setTimeout(() => {
                    const tx = node.element.querySelector('.code-content');
                    if (tx) tx.value = data.content;
                }, 0);
            }
        } else if (data.type === 'drawing') {
            node = new DrawingNode(absX, absY);
            if (data.previewUrl) node.updatePreview(data.previewUrl);
        } else if (data.type === 'number') {
            node = new NumberNode(absX, absY, data.value);
        }

        if (node) {
            node.width = data.width;
            node.height = data.height;
            node.rotation = data.rotation || 0;
            if (data.styles) node.styles = Object.assign({}, data.styles);
            node.flexModeWidth = data.flexModeWidth;
            node.flexModeHeight = data.flexModeHeight;
        }
        return node;
    }
};