/**
 * NodeOperations.js
 * إدارة عمليات العقد (إنشاء، استنساخ، حذف، تغيير خصائص) المرتبطة كلياً بنظام التراجع والإعادة
 */

Object.assign(App, {
    cloneNode(node, offsetX = 25, offsetY = 25) {
        let newNode;
        if (node.type === "text-with-title") {
            newNode = new TextWithTitleNode(node.x + offsetX, node.y + offsetY, node.isSimple);
            if (node.title) newNode.title = node.title;
            newNode.collapsed = node.collapsed || false;
        } else if (node.type.startsWith("text")) {
            newNode = new TextNode(node.x + offsetX, node.y + offsetY, node.isSimple);
        } else if (node.type === "image") {
            newNode = new ImageNode(node.x + offsetX, node.y + offsetY);
            newNode.width = node.width;
            newNode.height = node.height;
            if (node.src) {
                newNode.src = node.src;
                newNode.aspectRatio = node.aspectRatio;
            }
            if (node.images && node.images.length > 0) {
                newNode.images = [...node.images];
                setTimeout(() => newNode.updateHTML(), 0);
            }
        } else if (node.type === "folder") {
            newNode = new FolderNode(node.x + offsetX, node.y + offsetY, null, node.title, node.src, node.aspectRatio);
        } else if (node.type === "container") {
            newNode = new ContainerNode(node.x + offsetX, node.y + offsetY, node.width, node.height);
            newNode.layout = node.layout;
            newNode.padding = node.padding;
            newNode.gap = node.gap;
            newNode.alignItems = node.alignItems || 'start';
            newNode.justifyContent = node.justifyContent || 'start';
            newNode.flexWrap = node.flexWrap || 'nowrap';
            newNode.flexModeWidth = node.flexModeWidth;
            newNode.flexModeHeight = node.flexModeHeight;
            newNode.autoResize = node.autoResize;
            newNode.clipContent = node.clipContent;
            newNode.scrollBehavior = node.scrollBehavior;
            newNode.title = node.title || 'Container';
            newNode._childrenToClone = Array.from(node.children || []);
        } else if (node.type === "code") {
            newNode = new CodeNode(node.x + offsetX, node.y + offsetY);
        } else if (node.type === "sprite") {
            newNode = new SpriteNode(node.x + offsetX, node.y + offsetY, node.width, node.height);
            if (node.src) newNode.setSrc(node.src);
            if (node.slice) newNode.slice = { ...node.slice };
            if (node.borderWidth) newNode.borderWidth = { ...node.borderWidth };
            if (node.repeat) newNode.repeat = node.repeat;
        } else if (node.type === "drawing") {
            newNode = new DrawingNode(node.x + offsetX, node.y + offsetY);
            if (node.previewUrl) newNode.updatePreview(node.previewUrl);
        } else if (node.type === "empty") {
            newNode = new EmptyNode(node.x + offsetX, node.y + offsetY);
        } else if (node.type === "icon") {
            newNode = new IconNode(node.x + offsetX, node.y + offsetY, node.iconClass || 'star');
        } else if (node.type === "number") {
            newNode = new NumberNode(node.x + offsetX, node.y + offsetY, node.value || 0);
        }

        if (newNode) {
            newNode.width = node.width;
            newNode.height = node.height;
            newNode.rotation = node.rotation || 0;
            newNode.styles = { ...node.styles };
            newNode.locked = node.locked || false;
            newNode.autoResize = node.autoResize !== undefined ? node.autoResize : true;

            const content = node.element.querySelector(".text-content-editor");
            const newContent = newNode.element.querySelector(".text-content-editor");
            if (content && newContent) {
                newContent.innerHTML = content.innerHTML;
            }
        }
        return newNode;
    },

    duplicateSelection() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));

        if (targets.size === 0) return;

        const targetIds = new Set(targets);
        const filteredTargets = Array.from(targets).filter(id => {
            let node = this.nodes.get(id);
            if (!node) return false;
            let parent = node.parent;
            while (parent) {
                if (targetIds.has(parent.id)) return false;
                parent = parent.parent;
            }
            return true;
        });

        if (this.commandManager) this.commandManager.beginBatch();

        const createdNodeIds = [];

        filteredTargets.forEach(id => {
            const original = this.nodes.get(id);
            if (original) {
                const cloned = this.cloneNode(original, 30, 30);
                if (cloned) {
                    const serialized = this.serializeNode(cloned);
                    const parentId = original.parent ? original.parent.id : null;

                    if (this.commandManager) {
                        this.commandManager.execute(new CreateNodeCommand(this, serialized, parentId));
                    } else {
                        this.addNodeToCanvas(cloned);
                    }
                    createdNodeIds.push(serialized.id);
                }
            }
        });

        if (this.commandManager) this.commandManager.endBatch();

        this.deselectAll();
        createdNodeIds.forEach(id => this.selectNode(id, createdNodeIds.length > 1));
        this.updateToolbar();
    },

    deleteSelection() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));

        if (targets.size === 0) return;

        const nodesDataToDelete = [];
        targets.forEach(id => {
            const node = this.nodes.get(id);
            if (node) {
                nodesDataToDelete.push({
                    serialized: this.serializeNode(node),
                    parentId: node.parent ? node.parent.id : null,
                    index: node.parent ? Array.from(node.parent.children).indexOf(node.id) : -1
                });
            }
        });

        if (this.commandManager) {
            this.commandManager.execute(new DeleteNodesCommand(this, nodesDataToDelete));
        } else {
            targets.forEach(id => {
                const node = this.nodes.get(id);
                if (node) {
                    if (node.element) node.element.remove();
                    this.nodes.delete(id);
                }
            });
            this.selected.clear();
            this.updateToolbar();
        }
    }
});