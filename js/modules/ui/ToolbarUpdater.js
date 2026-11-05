/**
 * ToolbarUpdater.js
 * مسؤول عن تحديث شريط الأدوات العائم وتحديد الحالات النشطة للأزرار بناءً على نوع العنصر المحدد.
 */

Object.assign(App, {
    updateToolbar() {
        let node = null;
        // Prioritize focusedNodes (Multi-Focus Mode) or fallback to selection
        if (this.state.focusedNodes.size > 0) {
            const lastId = Array.from(this.state.focusedNodes).pop();
            node = this.nodes.get(lastId);
        } else if (this.selected.size > 0) {
            const lastId = Array.from(this.selected).pop();
            node = this.nodes.get(lastId);
        } else if (this.state.focusedNode) {
            node = this.nodes.get(this.state.focusedNode);
        }

        // HIDE TOOLBAR DURING ACTIVE INTERACTION
        if (this._mode === 'focus-brush' || this._mode === 'focus-mode' ||
            this._mode === 'drag' || this._mode === 'pan' || this._mode === 'resize') {
            this.ui.toolbar.style.display = "none";
            return;
        }

        // Logic to support focusing children while parent is editing
        if (node && node.parent && node.parent.isEditing) {
            // Logic handled by child focus
        }

        if (node) {
            const rect = node.element.getBoundingClientRect();
            this.ui.toolbar.style.display = "flex";

            // DETERMINE ACTIVE TOOLBAR STATE
            // Check if any sub-toolbar is currently visible to preserve it
            const subMenus = ["toolbar-container", "toolbar-child-layout", "toolbar-formatting", "toolbar-headings", "toolbar-stroke", "toolbar-node-settings", "toolbar-color-presets", "toolbar-custom-color", "toolbar-scroll-settings"];

            let activeSubMenu = null;
            for (const id of subMenus) {
                const el = document.getElementById(id);
                if (el && el.style.display === "flex") {
                    activeSubMenu = id;
                    break;
                }
            }

            // Decide whether to reset to main or keep active sub-menu
            if (activeSubMenu) {
                // Keep the active sub-menu, ensure Main is hidden
                document.getElementById("toolbar-main").style.display = "none";
                // Ensure the active one stays flex (redundant but safe)
                document.getElementById(activeSubMenu).style.display = "flex";

                subMenus.forEach(id => {
                    if (id !== activeSubMenu) {
                        const el = document.getElementById(id);
                        if (el) el.style.display = "none";
                    }
                });

                // REFRESH ACTIVE SUB-MENU DATA
                if (activeSubMenu === 'toolbar-stroke' && typeof this.showStrokeSettings === 'function') {
                    this.showStrokeSettings();
                }
            } else {
                // No sub-menu active -> Show Main Toolbar
                document.getElementById("toolbar-main").style.display = "flex";
                subMenus.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = "none";
                });
            }

            // Position Calculation based on Mode
            const tbWidth = this.ui.toolbar.offsetWidth || 400;
            const mode = this.state.toolbarMode || 'floating';

            if (mode === 'top') {
                this.ui.toolbar.style.top = '20px';
                this.ui.toolbar.style.left = '50%';
                this.ui.toolbar.style.transform = 'translateX(-50%)';
                this.ui.toolbar.style.bottom = 'auto';
            } else if (mode === 'bottom') {
                this.ui.toolbar.style.bottom = '20px';
                this.ui.toolbar.style.left = '50%';
                this.ui.toolbar.style.transform = 'translateX(-50%)';
                this.ui.toolbar.style.top = 'auto'; // Reset top
            } else {
                // Floating (Default)
                const rect = node.element.getBoundingClientRect();
                let left = rect.left + rect.width / 2;
                let top = rect.top - 15;

                // Keep toolbar on screen horizontally
                const margin = 20;
                if (left - tbWidth / 2 < margin) left = tbWidth / 2 + margin;
                if (left + tbWidth / 2 > window.innerWidth - margin) left = window.innerWidth - tbWidth / 2 - margin;

                this.ui.toolbar.style.left = `${left}px`;
                this.ui.toolbar.style.top = `${Math.max(70, top)}px`;
                this.ui.toolbar.style.transform = "translateX(-50%) translateY(-100%)";
                this.ui.toolbar.style.bottom = 'auto';
            }
            const lockBtn = document.getElementById("lock-btn");
            lockBtn.innerHTML = node.locked ? '<i data-lucide="lock"></i>' : '<i data-lucide="unlock"></i>';
            lockBtn.className = node.locked ? "icon-btn active" : "icon-btn";
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: lockBtn });

            // Buttons visibility
            const isTextOrCode = node.type === 'text' || node.type === 'code' || node.type === 'text-with-title';
            const isFolder = node.type === 'folder';
            const isImage = node.type === "image";
            const isSprite = node.type === "sprite";
            const isEmpty = node.type === 'empty';
            const isIcon = node.type === 'icon';
            const isContainer = node.type === 'container';
            const isMultiple = this.selected.size > 1 || this.state.focusedNodes.size > 1;

            document.getElementById("btn-edit").style.display = (isTextOrCode && !isMultiple) ? "flex" : "none";
            document.getElementById("btn-rename-folder").style.display = isFolder ? "flex" : "none";
            document.getElementById("btn-change-image").style.display = (isImage || isFolder || isSprite) ? "flex" : "none";

            // Sprite Edit Button
            const btnSpriteEdit = document.getElementById("btn-sprite-edit");
            if (btnSpriteEdit) {
                btnSpriteEdit.style.display = (isSprite && !isMultiple) ? "flex" : "none";
            }

            // Container Controls
            document.getElementById("btn-layout-vertical").style.display = isContainer ? "flex" : "none";
            document.getElementById("btn-layout-horizontal").style.display = isContainer ? "flex" : "none";

            // Helper to highlight active layout
            if (isContainer) {
                document.getElementById("btn-layout-vertical").classList.toggle("active", node.layout === 'vertical');
                document.getElementById("btn-layout-horizontal").classList.toggle("active", node.layout === 'horizontal');

                const btnVisual = document.getElementById("btn-visual-layout");
                if (btnVisual) {
                    btnVisual.classList.toggle("active", node.visualLayoutMode);
                }
            }

            // Empty Node Conversion Buttons
            document.getElementById("btn-convert-text").style.display = isEmpty ? "flex" : "none";
            document.getElementById("btn-convert-image").style.display = isEmpty ? "flex" : "none";
            document.getElementById("btn-convert-icon").style.display = isEmpty ? "flex" : "none";

            // Icon Node Action
            document.getElementById("btn-change-icon").style.display = isIcon ? "flex" : "none";

            // Number Node Controls
            const isNumber = node.type === 'number';
            const numberControls = document.getElementById("toolbar-number-controls");
            if (numberControls) {
                numberControls.style.display = (isNumber && !isMultiple) ? "flex" : "none";
                if (isNumber) {
                    const slider = document.getElementById("number-value-slider");
                    if (slider) slider.value = node.value;
                    const display = document.getElementById("number-value-display");
                    if (display) display.textContent = node.value;
                }
            }

            // Image Edit (Pen) button logic
            const btnImageEdit = document.getElementById("btn-image-edit");
            if (btnImageEdit) {
                const isImage = node && node.type === 'image';
                const hasMultipleImages = isImage && node.images && node.images.length > 1;
                btnImageEdit.style.display = (isImage && !isMultiple && hasMultipleImages) ? "flex" : "none";
                if (isImage && node.isEditing) {
                    btnImageEdit.classList.add("active");
                } else {
                    btnImageEdit.classList.remove("active");
                }
            }

            // Container Button (Any Node)
            const btnCreateContainer = document.getElementById("btn-create-container");
            if (btnCreateContainer) {
                const canCreateContainer = this.selected.size > 0 || this.state.focusedNodes.size > 0 || this.state.focusedNode;
                btnCreateContainer.style.display = canCreateContainer ? "flex" : "none";
            }

            // Container Layout Controls + Settings Button
            const btnLayoutVertical = document.getElementById("btn-layout-vertical");
            const btnLayoutHorizontal = document.getElementById("btn-layout-horizontal");
            const btnLayoutSettings = document.getElementById("btn-layout-settings");
            if (btnLayoutSettings) {
                btnLayoutSettings.style.display = (isContainer && !isMultiple) ? "flex" : "none";
                if (btnLayoutVertical) btnLayoutVertical.style.display = "none";
                if (btnLayoutHorizontal) btnLayoutHorizontal.style.display = "none";
            }

            // Save Component Button
            const btnSaveComponent = document.getElementById("btn-save-component");
            if (btnSaveComponent) {
                const hasSelection = this.selected.size > 0 || this.state.focusedNodes.size > 0;
                btnSaveComponent.style.display = hasSelection ? "flex" : "none";
            }

            // Divider Edit visibility
            const showActionDivider = isTextOrCode || isFolder || isImage || isEmpty || isIcon;
            document.getElementById("divider-edit").style.display = showActionDivider ? "flex" : "none";

            // Color buttons visibility
            const showColors = !isImage && !isFolder && node.type !== "drawing";
            document.getElementById("btn-fill-color").style.display = showColors ? "flex" : "none";
            document.getElementById("btn-text-color").style.display = "none";

            // Colors Divider visibility
            const divColors = document.getElementById("divider-colors");
            if (divColors) divColors.style.display = showColors ? "block" : "none";

            // Enforce mutual exclusivity of toolbars
            const fmtToolbar = document.getElementById('toolbar-formatting');
            const headingsToolbar = document.getElementById('toolbar-headings');
            const colorPresets = document.getElementById('toolbar-color-presets');
            const customColor = document.getElementById('toolbar-custom-color');
            const strokeToolbar = document.getElementById('toolbar-stroke');
            const nodeSettings = document.getElementById('toolbar-node-settings');
            const containerToolbar = document.getElementById('toolbar-container');
            const childLayoutToolbar = document.getElementById('toolbar-child-layout');

            const isContainerChild = node && node.parent && node.parent.type === 'container';

            // Check if multiple selection consists ONLY of siblings within the same container
            let areAllSiblings = false;
            if (isMultiple) {
                const targets = this.state.focusedNodes.size > 0 ? Array.from(this.state.focusedNodes) : Array.from(this.selected);
                if (targets.length > 1) {
                    const first = this.nodes.get(targets[0]);
                    if (first && first.parent && first.parent.type === 'container') {
                        const parentId = first.parent.id;
                        areAllSiblings = targets.every(id => {
                            const n = this.nodes.get(id);
                            return n && n.parent && n.parent.id === parentId;
                        });
                    }
                }
            }

            if (node && node.type === 'container' && !isMultiple) {
                this.updateContainerPanelValues(node);
            }

            // Layout Settings Button Visibility
            if (btnLayoutSettings) {
                const show = (isContainer && !isMultiple) || (isContainerChild && (!isMultiple || areAllSiblings));
                btnLayoutSettings.style.display = show ? "flex" : "none";
            }

            // Extract from Container Button Visibility
            const btnExtractFromContainer = document.getElementById("btn-extract-from-container");
            if (btnExtractFromContainer) {
                const show = isContainerChild && (!isMultiple || areAllSiblings);
                btnExtractFromContainer.style.display = show ? "flex" : "none";
            }

            if (node && node.type === 'container') {
                const dirBtn = document.getElementById('btn-container-direction');
                if (dirBtn) {
                    const icon = dirBtn.querySelector('i');
                    if (icon) {
                        icon.setAttribute('data-lucide', node.layout === 'vertical' ? 'arrow-down' : 'arrow-right');
                    }
                }
            } else if (isContainerChild && (!isMultiple || areAllSiblings)) {
                ['width', 'height'].forEach(dim => {
                    ['fixed', 'fill', 'hug'].forEach(mode => {
                        const btn = document.getElementById(`btn-child-${dim}-${mode}`);
                        if (btn) {
                            const prop = dim === 'width' ? 'flexModeWidth' : 'flexModeHeight';
                            btn.classList.toggle('active', node[prop] === mode);
                        }
                    });
                });
            } else {
                containerToolbar.style.display = 'none';
                if (childLayoutToolbar) childLayoutToolbar.style.display = 'none';
            }

            const isSubToolbarVisible = (
                fmtToolbar.style.display === 'flex' ||
                headingsToolbar.style.display === 'flex' ||
                colorPresets.style.display === 'flex' ||
                customColor.style.display === 'flex' ||
                strokeToolbar.style.display === 'flex' ||
                nodeSettings.style.display === 'flex' ||
                containerToolbar.style.display === 'flex' ||
                (childLayoutToolbar && childLayoutToolbar.style.display === 'flex')
            );

            if (isSubToolbarVisible) {
                document.getElementById('toolbar-main').style.display = 'none';
                document.getElementById('toolbar-node-settings').style.display = 'none';
            } else {
                document.getElementById('toolbar-main').style.display = 'flex';
            }

        } else {
            this.ui.toolbar.style.display = "none";
        }
    }
});
