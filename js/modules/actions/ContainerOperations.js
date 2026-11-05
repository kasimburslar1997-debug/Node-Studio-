/**
 * ContainerOperations.js
 * يحتوي على العمليات المتقدمة الخاصة بتجميع العقد داخل حاويات (Containers) ومجلدات (Folders) وفك التجميع والتداخل الذكي.
 */

Object.assign(App, {
    groupSelection() {
        const isFocusMode = this.selected.size === 0 && (this.state.focusedNodes.size > 0 || this.state.focusedNode);
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));
        if (targets.size === 0) return;

        // Calculate bounding box
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        targets.forEach(id => {
            const n = this.nodes.get(id);
            if (n) {
                minX = Math.min(minX, n.x);
                minY = Math.min(minY, n.y);
                maxX = Math.max(maxX, n.x + n.width);
                maxY = Math.max(maxY, n.y + n.height);
            }
        });

        // Create folder with padding
        const padding = 40;
        const folder = new FolderNode(minX - padding, minY - padding);
        folder.resize(maxX - minX + padding * 2, maxY - minY + padding * 2, minX - padding, minY - padding);

        // Initialize workspace for this folder
        this.workspaces.set(folder.workspaceId, {
            nodes: [],
            panX: window.innerWidth / 2,
            panY: window.innerHeight / 2,
            scale: 1
        });

        // Move selected nodes into folder's workspace
        const selectedNodes = [];
        targets.forEach(id => {
            const node = this.nodes.get(id);
            if (node) {
                const relativeX = node.x - folder.x;
                const relativeY = node.y - folder.y;

                selectedNodes.push({
                    type: node.type,
                    x: relativeX,
                    y: relativeY,
                    width: node.width,
                    height: node.height,
                    rotation: node.rotation,
                    locked: node.locked,
                    collapsed: node.collapsed,
                    styles: node.styles,
                    content: node.type === "text" ? node.element.querySelector(".text-content-editor")?.innerHTML :
                        node.type === "code" ? node.element.querySelector(".code-content")?.value : null,
                    src: node.src,
                    images: node.images,
                    workspaceId: node.workspaceId,
                    title: node.title,
                    aspectRatio: node.aspectRatio,
                    previewUrl: node.previewUrl
                });

                node.element.remove();
                this.nodes.delete(id);
            }
        });

        // Save nodes to folder's workspace
        const folderWorkspace = this.workspaces.get(folder.workspaceId);
        folderWorkspace.nodes = selectedNodes;

        // Add folder to current workspace
        this.addNodeToCanvas(folder);
        this.ui.content.insertBefore(folder.element, this.ui.content.firstChild);

        // Select the folder
        this.deselectAll();
        this.selectNode(folder.id);

        this.pushHistory();
        this.saveCurrentWorkspace();
    },

    extractSelection() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));

        if (targets.size === 0) return;
        if (this.breadcrumbs.length === 0) return;

        const currentWsId = this.currentWorkspaceId;
        let parentId = "root";
        if (this.breadcrumbs.length > 1) {
            parentId = this.breadcrumbs[this.breadcrumbs.length - 2].id;
        }

        const parentWs = this.workspaces.get(parentId);
        if (!parentWs) return;

        const folderInData = parentWs.nodes.find(n => (n.type === "folder" || n.type === "card") && n.workspaceId === currentWsId);

        if (!folderInData) {
            console.error("Parent folder not found!");
            return;
        }

        const folderX = folderInData.x;
        const folderY = folderInData.y;

        targets.forEach(id => {
            const node = this.nodes.get(id);
            if (node) {
                const newNodeData = {
                    type: node.type,
                    x: folderX + node.x + 20,
                    y: folderY + node.y + 20,
                    width: node.width,
                    height: node.height,
                    rotation: node.rotation,
                    locked: node.locked,
                    collapsed: node.collapsed,
                    styles: node.styles,
                    content: node.type === "text" ? node.element.querySelector(".text-content-editor")?.innerHTML :
                        node.type === "code" ? node.element.querySelector(".code-content")?.value : null,
                    src: node.src,
                    images: node.images,
                    workspaceId: node.workspaceId,
                    title: node.title,
                    aspectRatio: node.aspectRatio,
                    previewUrl: node.previewUrl
                };

                parentWs.nodes.push(newNodeData);

                node.element.remove();
                this.nodes.delete(id);
            }
        });

        this.selected.clear();
        this.setFocusedNode(null);
        this.updateToolbar();
        this.saveCurrentWorkspace();
    },

    handleFolderButton() {
        if (this.selected.size > 0 || this.state.focusedNodes.size > 0 || this.state.focusedNode) {
            this.groupSelection();
        } else {
            this.createNode("folder");
        }
    },

    createContainerFromSelection() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));

        if (targets.size === 0) {
            this.createNode("container");
            return;
        }

        // 1. Gather nodes, filter out children of other selected nodes (prevent double-nesting)
        const targetIds = new Set(targets);
        let nodesToMove = [];
        targets.forEach(id => {
            const node = this.nodes.get(id);
            if (!node) return;
            // Skip if an ancestor is also selected
            let ancestor = node.parent;
            while (ancestor) {
                if (targetIds.has(ancestor.id)) return;
                ancestor = ancestor.parent;
            }
            nodesToMove.push(node);
        });

        if (nodesToMove.length === 0) return;

        // 2. Detect common parent container
        let commonParent = null;
        const firstParent = nodesToMove[0].parent;
        const allShareParent = nodesToMove.every(n => n.parent && n.parent.id === firstParent?.id);
        if (allShareParent && firstParent && firstParent.type === 'container') {
            commonParent = firstParent;
        }

        // 3. Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodesToMove.forEach(n => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
        });

        // 4. Smart Layout Detection
        const totalW = nodesToMove.reduce((acc, n) => acc + n.width, 0);
        const totalH = nodesToMove.reduce((acc, n) => acc + n.height, 0);
        const avgW = totalW / nodesToMove.length;
        const avgH = totalH / nodesToMove.length;
        const widthSpan = maxX - minX;
        const heightSpan = maxY - minY;

        let detectedLayout = 'vertical';
        let detectedWrap = false;

        if (nodesToMove.length > 1) {
            if (heightSpan < avgH * 1.5) {
                detectedLayout = 'horizontal';
            } else if (widthSpan < avgW * 1.5) {
                detectedLayout = 'vertical';
            } else {
                detectedLayout = 'horizontal';
                detectedWrap = true;
            }
        }

        // 5. Sort nodes based on detected layout before adding
        nodesToMove.sort((a, b) => {
            if (detectedLayout === 'vertical') {
                const yDiff = a.y - b.y;
                if (Math.abs(yDiff) > 10) return yDiff;
                return a.x - b.x;
            } else {
                if (!detectedWrap) {
                    return a.x - b.x;
                } else {
                    const yDiff = a.y - b.y;
                    if (Math.abs(yDiff) > (avgH * 0.5)) return yDiff;
                    return a.x - b.x;
                }
            }
        });

        // 6. Create new container (manually, not via createNode to avoid side effects)
        const container = new ContainerNode(minX - 10, minY - 10);
        container.element.classList.add("container-node");
        this.nodes.set(container.id, container);

        container.layout = detectedLayout;
        container.flexWrap = detectedWrap ? 'wrap' : 'nowrap';

        // Default: Always hug content in both axes
        container.flexModeWidth = 'hug';
        container.flexModeHeight = 'hug';
        container.autoResize = true;
        container.padding = commonParent ? 0 : 10;
        container.gap = 10;

        // 7. Place container into the hierarchy
        if (commonParent) {
            const parentChildrenArr = Array.from(commonParent.children);
            const firstNodeIndex = parentChildrenArr.indexOf(nodesToMove[0].id);
            if (firstNodeIndex !== -1) {
                commonParent.addChildAt(container, firstNodeIndex);
            } else {
                commonParent.addChild(container);
            }
        } else {
            // Root level - add to canvas
            this.ui.content.appendChild(container.element);
        }

        // 8. Reparent nodes directly into new container (no clone+delete)
        nodesToMove.forEach(node => {
            // Remove from old parent if applicable
            if (node.parent) {
                node.parent.removeChild(node);
            }

            // Set flex modes based on node type
            if (node.type === 'text' || node.type === 'text-with-title') {
                node.flexModeWidth = 'fixed';
                node.flexModeHeight = node.autoResize ? 'hug' : 'fixed';
            } else if (node.type === 'image' || node.type === 'drawing') {
                node.flexModeWidth = 'fixed';
                node.flexModeHeight = 'fixed';
            } else if (node.type === 'code') {
                node.flexModeWidth = 'fixed';
                node.flexModeHeight = 'hug';
            } else if (node.type === 'container') {
                node.flexModeWidth = 'fixed';
                node.flexModeHeight = node.autoResize ? 'hug' : 'fixed';
            } else {
                node.flexModeWidth = 'fixed';
                node.flexModeHeight = 'fixed';
            }

            // Add to the new container using the class method which updates layout & triggers size calculation
            container.addChild(node);
        });

        // 9. Update old parent if nodes were removed from it
        if (commonParent) {
            commonParent.updateVisuals();
        }

        // 10. Finalize container
        container.updateVisuals();

        this.deselectAll();
        this.clearFocusedNodes();
        this.selectNode(container.id);
        this.pushHistory();
        this.updateToolbar();
    },

    moveNodesToContainer(nodes, container) {
        if (!container || !nodes || nodes.length === 0) return;

        nodes.forEach(node => {
            if (node.id === container.id) return;
            if (node.parent && node.parent.id === container.id) return;

            if (node.parent) {
                const nodeRect = node.element.getBoundingClientRect();
                const contRect = container.element.getBoundingClientRect();
                const scale = App.state.scale;
                const zoomRelX = (nodeRect.left - contRect.left) / scale;
                const zoomRelY = (nodeRect.top - contRect.top) / scale;

                node.x = zoomRelX - container.padding;
                node.y = zoomRelY - container.padding;
            } else {
                node.x = node.x - container.x - container.padding;
                node.y = node.y - container.y - container.padding;
            }

            if (node.parent) {
                node.parent.removeChild(node);
            }

            container.addChild(node);

            if (!node.flexModeWidth) node.flexModeWidth = 'fixed';
            if (!node.flexModeHeight) node.flexModeHeight = 'fixed';

            node.updateVisuals();
        });

        container.updateVisuals();
        this.updateToolbar();
        this.pushHistory();
    },

    extractFromContainer() {
        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));

        if (targets.size === 0) return;

        const extractedNodes = [];

        targets.forEach(id => {
            const node = this.nodes.get(id);
            if (node && node.parent && node.parent.type === 'container') {
                const parent = node.parent;
                const rect = node.element.getBoundingClientRect();
                const panX = App.state.panX;
                const panY = App.state.panY;
                const scale = App.state.scale;

                const worldX = (rect.left - panX) / scale;
                const worldY = (rect.top - panY) / scale;

                parent.removeChild(node);
                parent.updateVisuals();

                node.x = worldX;
                node.y = worldY;
                node.parent = null;

                App.ui.content.appendChild(node.element);
                node.updateVisuals();

                extractedNodes.push(node);
            }
        });

        if (extractedNodes.length > 0) {
            this.deselectAll();
            this.clearFocusedNodes();
            extractedNodes.forEach(n => this.selectNode(n.id, extractedNodes.length > 1));
            this.updateToolbar();
            this.pushHistory();
        }
    }
});
