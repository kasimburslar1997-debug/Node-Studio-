// DragDropEvents.js - External file drag-and-drop (images, text files, sidebar node creation)
Object.assign(App, {
    _bindDragDropEvents() {
        const vp = this.ui.viewport;

        // Sidebar Drag-Drop for Node Creation
        const sidebarTools = document.getElementById("sidebar-tools");
        if (sidebarTools) {
            sidebarTools.addEventListener("dragstart", (e) => {
                const btn = e.target.closest("[data-node-type]");
                if (btn) {
                    e.dataTransfer.setData("node-type", btn.dataset.nodeType);
                    e.dataTransfer.effectAllowed = "copy";
                }
            });
        }

        // Allow drop on viewport
        vp.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";

            // Visual Feedback for Drop Target
            const worldX = (e.clientX - this.state.panX) / this.state.scale;
            const worldY = (e.clientY - this.state.panY) / this.state.scale;

            let targetContainer = null;
            if (this.nodeManager && typeof this.nodeManager.getContainerAt === 'function') {
                targetContainer = this.nodeManager.getContainerAt(worldX, worldY);
            }

            if (this._lastDropTarget && this._lastDropTarget !== targetContainer) {
                this._lastDropTarget.element.classList.remove('drop-target');
            }

            if (targetContainer) {
                targetContainer.element.classList.add('drop-target');
                this._lastDropTarget = targetContainer;
            } else {
                this._lastDropTarget = null;
            }
        });

        vp.addEventListener("dragleave", (e) => {
            if (this._lastDropTarget) {
                this._lastDropTarget.element.classList.remove('drop-target');
                this._lastDropTarget = null;
            }
        });

        vp.addEventListener("drop", (e) => {
            e.preventDefault();

            // Cleanup visual feedback
            if (this._lastDropTarget) {
                this._lastDropTarget.element.classList.remove('drop-target');
                this._lastDropTarget = null;
            }

            const nodeType = e.dataTransfer.getData("node-type");
            if (nodeType) {
                // Convert screen coordinates to world coordinates
                const worldX = (e.clientX - this.state.panX) / this.state.scale;
                const worldY = (e.clientY - this.state.panY) / this.state.scale;
                this.createNodeAtPosition(nodeType, worldX, worldY);
            }
        });

        // File input change handler
        document.getElementById("file-input").addEventListener("change", e => {
            if (this._pendingUpload && e.target.files.length > 0) {
                const node = this.nodes.get(this._pendingUpload);
                if (!node) return;

                const files = Array.from(e.target.files);
                const readers = files.map(file => {
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = evt => resolve(evt.target.result);
                        reader.readAsDataURL(file);
                    });
                });

                Promise.all(readers).then(results => {
                    if (typeof node.addImages === 'function') {
                        node.addImages(results);
                    } else if (typeof node.setSrc === 'function') {
                        // Fallback for FolderNode or legacy
                        node.setSrc(results[0]);
                    }
                });
            }
        });

        // ==== Drag and Drop Support ====
        const container = document.body;

        // Mark internal drags (from text editors within nodes)
        document.addEventListener('dragstart', e => {
            const isInternalEditor = e.target.closest('.text-content-editor') ||
                e.target.closest('.code-content') ||
                e.target.closest('.title-editor');

            if (isInternalEditor) {
                // Mark this as an internal drag
                e.dataTransfer.setData('application/x-internal-drag', 'true');
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        container.addEventListener("drop", e => {
            const x = (e.clientX - this.state.panX) / this.state.scale;
            const y = (e.clientY - this.state.panY) / this.state.scale;

            const files = Array.from(e.dataTransfer.files);

            // 1. Handle Images
            const imageFiles = files.filter(f => f.type.startsWith("image/"));
            if (imageFiles.length > 0) {
                // Check if dropped ONTO an existing ImageNode
                const targetEl = e.target.closest('.node');
                if (targetEl) {
                    const targetNode = this.nodes.get(targetEl.id);
                    if (targetNode && targetNode.type === 'image') {
                        // Max 20 images total? or add all?
                        const limit = Math.min(imageFiles.length, 20); // Safety limit
                        const readers = [];

                        for (let i = 0; i < limit; i++) {
                            readers.push(new Promise(resolve => {
                                const reader = new FileReader();
                                reader.onload = evt => resolve(evt.target.result);
                                reader.readAsDataURL(imageFiles[i]);
                            }));
                        }

                        Promise.all(readers).then(results => {
                            if (targetNode) { // check existence again just in case
                                targetNode.addImages(results);
                                this.pushHistory();
                            }
                        });
                        return;
                    }
                }

                // If not dropped on a node, create ONE image node with all images
                const limit = Math.min(imageFiles.length, 20);

                if (limit === 1) {
                    // Single image - use old behavior
                    const reader = new FileReader();
                    reader.onload = evt => {
                        const node = new ImageNode(x - 150, y - 100);
                        node.setSrc(evt.target.result);
                        this.addNodeToCanvas(node);
                        this.bringToFront(node.id);
                        this.deselectAll();
                        // User Request: Drop Image -> Selection (Gray)
                        this.selectNode(node.id);
                    };
                    reader.readAsDataURL(imageFiles[0]);
                } else {
                    // Multiple images - create one node with all images
                    const readers = [];

                    for (let i = 0; i < limit; i++) {
                        readers.push(new Promise(resolve => {
                            const reader = new FileReader();
                            reader.onload = evt => resolve(evt.target.result);
                            reader.readAsDataURL(imageFiles[i]);
                        }));
                    }

                    Promise.all(readers).then(results => {
                        const node = new ImageNode(x - 150, y - 100);
                        node.addImages(results);

                        // Calculate total width of all images to set node width
                        // Width = sum of image widths / 2
                        let totalWidth = 0;
                        let loadedCount = 0;

                        results.forEach(src => {
                            const img = new Image();
                            img.onload = () => {
                                totalWidth += img.width;
                                loadedCount++;

                                if (loadedCount === results.length) {
                                    // All images loaded, set node width
                                    const calculatedWidth = totalWidth / 2;
                                    node.width = Math.max(200, Math.min(calculatedWidth, 800)); // Min 200, Max 800
                                    node.updateVisuals();
                                }
                            };
                            img.src = src;
                        });

                        this.addNodeToCanvas(node);
                        this.bringToFront(node.id);
                        this.deselectAll();
                        // User Request: Drop Image -> Selection (Gray)
                        this.selectNode(node.id);
                    });
                }
                return;
            }

            // 2. Handle Text Files
            const textFiles = files.filter(f => f.type.startsWith("text/"));
            if (textFiles.length > 0) {
                textFiles.forEach((file, i) => {
                    const reader = new FileReader();
                    reader.onload = evt => {
                        const offsetX = i * 20;
                        const node = new TextNode(x + offsetX - 160, y + offsetX - 100);
                        // Wait for DOM
                        setTimeout(() => {
                            const editor = node.element.querySelector(".text-content-editor");
                            if (editor) editor.innerText = evt.target.result;
                        }, 0);

                        this.addNodeToCanvas(node);
                        this.bringToFront(node.id);

                        if (i === 0) {
                            this.deselectAll();
                            // User Request: Drop Text File -> Selection (Gray)
                            this.selectNode(node.id);
                        }
                    };
                    reader.readAsText(file);
                });
                return;
            }

            // 3. Handle Plain Text (Draggable text from other apps/browser)
            // Check if this is an internal drag (from text editors within nodes)
            const isInternalDrag = e.dataTransfer.types.includes('application/x-internal-drag');

            // Only create text node if drag is from external source
            if (!isInternalDrag) {
                const textData = e.dataTransfer.getData("text");
                if (textData) {
                    const node = new TextNode(x - 160, y - 100);
                    setTimeout(() => {
                        const editor = node.element.querySelector(".text-content-editor");
                        if (editor) editor.innerText = textData;
                    }, 0);

                    this.addNodeToCanvas(node);
                    this.bringToFront(node.id);

                    this.deselectAll();
                    // User Request: Drop Text -> Selection Mode (Gray)
                    this.selectNode(node.id);
                }
            }
        });
    }
});
