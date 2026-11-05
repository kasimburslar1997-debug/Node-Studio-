Object.assign(App, {
    // Workspace Management
    saveCurrentWorkspace() {
        const nodesArr = [];
        this.nodes.forEach(node => {
            // Only serialize root-level nodes (non-children) to let recursive serialization handle container children!
            if (!node.parent) {
                const serialized = this.serializeNode(node);
                if (serialized) {
                    nodesArr.push(serialized);
                }
            }
        });

        this.workspaces.set(this.currentWorkspaceId, {
            nodes: nodesArr,
            panX: this.state.panX,
            panY: this.state.panY,
            scale: this.state.scale
        });
    },

    loadWorkspace(id) {
        this.saveCurrentWorkspace(); // Save current before switching

        // Clear current view
        this.ui.content.innerHTML = "";
        this.nodes.clear();
        this.selected.clear();
        this.updateToolbar();

        const ws = this.workspaces.get(id);
        if (!ws) return; // Should not happen

        this.currentWorkspaceId = id;
        this.state.panX = ws.panX;
        this.state.panY = ws.panY;
        this.state.scale = ws.scale;

        // Recreate nodes
        if (ws.nodes && Array.isArray(ws.nodes)) {
            ws.nodes.forEach(data => {
                const node = this.createNodeFromData(data, 0, 0);
                if (node) {
                    this.addNodeToCanvas(node);
                    if (typeof node.updateVisuals === 'function') node.updateVisuals();
                }
            });
        }

        this.updateView();
        this.updateBreadcrumbs();
    },

    navToWorkspace(id, title) {
        // Push the TARGET workspace to breadcrumbs (not the current one)
        this.breadcrumbs.push({ id: id, title: title });
        this.loadWorkspace(id);
    },

    navHome() {
        if (this.currentWorkspaceId === "root") return;
        this.breadcrumbs = [];
        this.loadWorkspace("root");
    },

    navBack() {
        if (this.breadcrumbs.length === 0) return;
        // Pop the last breadcrumb (current workspace)
        this.breadcrumbs.pop();
        // Load the previous workspace
        const targetId = this.breadcrumbs.length > 0 ? this.breadcrumbs[this.breadcrumbs.length - 1].id : "root";
        this.loadWorkspace(targetId);
    },

    updateBreadcrumbs() {
        const container = document.getElementById("breadcrumbs");
        // Home Icon
        let html = '<span class="icon-btn" style="width:auto;height:auto;font-size:1rem;padding:0;margin:0;background:none;color:inherit" onclick="App.navHome()" data-tooltip="الرئيسية"><i data-lucide="home"></i></span>';

        // Reverse order for display (Right to Left visual flow support or just user preference)
        // User requested: "Reverse order of elements in tabs list"
        // Fix Breadcrumb Order:
        // Use logic order (Home -> Child -> Grandchild). 
        // With CSS direction:rtl, this will render as [Grandchild] [Child] [Home] (visually reading Right-to-Left).
        this.breadcrumbs.forEach((crumb, index) => {
            html += ` <span class="breadcrumb-separator" style="opacity:0.5;margin:0 5px">/</span> <span class="breadcrumb-item" style="cursor:pointer;font-weight:500" onclick="App.navToCrumb(${index})">${crumb.title}</span>`;
        });

        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    },

    navToCrumb(index) {
        if (index === this.breadcrumbs.length - 1) return; // Already here

        // Target workspace is the one at this index
        const targetCrumb = this.breadcrumbs[index];

        // Keep breadcrumbs up to and including this index
        this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);

        // Load the workspace
        this.loadWorkspace(targetCrumb.id);
    },

    moveNodeToWorkspace(node, targetWorkspaceId) {
        if (!node || !targetWorkspaceId) return;

        // Get target workspace
        let ws = this.workspaces.get(targetWorkspaceId);
        if (!ws) {
            // Should not happen for valid folders, but just in case initialized empty
            ws = {
                nodes: [],
                panX: window.innerWidth / 2,
                panY: window.innerHeight / 2,
                scale: 1
            };
            this.workspaces.set(targetWorkspaceId, ws);
        }

        // Serialize Node
        const nodesArr = [];
        // Helper to serialize (using logic similar to saveCurrentWorkspace but single node)
        // Or we can just grab properties since we have the live node object
        const nodeData = {
            type: node.type,
            x: 0, // Reset position in new workspace (center?) or keep relative? Let's reset to center or slightly offset
            y: 0,
            width: node.width,
            height: node.height,
            rotation: node.rotation,
            locked: node.locked,
            collapsed: node.collapsed,
            styles: node.styles,
            content: node.type === "text" ? node.element.querySelector(".text-content-editor").innerHTML :
                node.type === "code" ? node.element.querySelector(".code-content").value : null,
            src: node.src,
            images: node.images,
            workspaceId: node.workspaceId,
            title: node.title,
            aspectRatio: node.aspectRatio,
            previewUrl: node.previewUrl
        };

        // Add to target workspace
        ws.nodes.push(nodeData);

        // Remove from current
        this.nodes.delete(node.id);
        node.element.remove();
        if (this.selected.has(node.id)) this.selected.delete(node.id);
        this.updateToolbar();

        this.pushHistory();
        this.saveCurrentWorkspace(); // Ensure current state is saved after removal
    }
});
