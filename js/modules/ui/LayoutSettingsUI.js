/**
 * LayoutSettingsUI.js
 * مسؤول عن إعدادات التخطيط للحاويات (Containers)
 */

Object.assign(App, {

    // --- SHOW PANEL & UPDATE VALUES ---

    showLayoutSettings() {
        // Hide Main Toolbar
        document.getElementById("toolbar-main").style.display = "none";

        // Hide Scroll Settings Sub-menu
        const scrollTb = document.getElementById("toolbar-scroll-settings");
        if (scrollTb) scrollTb.style.display = "none";

        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (!node) return;

        if (node.type === 'container') {
            const layoutSettings = document.getElementById("toolbar-container");
            if (layoutSettings) {
                layoutSettings.style.display = "flex";
                this.updateContainerPanelValues(node);
                if (typeof lucide !== 'undefined') lucide.createIcons({ root: layoutSettings });
            }
        } else if (node.parent && node.parent.type === 'container') {
            const childSettings = document.getElementById("toolbar-child-layout");
            if (childSettings) {
                childSettings.style.display = "flex";
                this.updateChildPanelValues(node);
                if (typeof lucide !== 'undefined') lucide.createIcons({ root: childSettings });
            }
        }
    },

    updateContainerPanelValues(node) {
        // Direction & Wrap Mode (Mutually Exclusive Toggle)
        const isWrap = node.flexWrap === 'wrap';
        const isVert = node.layout === 'vertical';

        const btnHor = document.getElementById('btn-dir-horizontal');
        const btnVert = document.getElementById('btn-dir-vertical');
        const btnWrap = document.getElementById('btn-dir-wrap');

        // Reset all
        if (btnHor) btnHor.classList.remove('active');
        if (btnVert) btnVert.classList.remove('active');
        if (btnWrap) btnWrap.classList.remove('active');

        if (isWrap) {
            if (btnWrap) btnWrap.classList.add('active');
        } else if (isVert) {
            if (btnVert) btnVert.classList.add('active');
        } else {
            // Horizontal & NoWrap
            if (btnHor) btnHor.classList.add('active');
        }

        // Width Sourcing
        const wModeSelect = document.getElementById('select-width-mode');
        if (wModeSelect) wModeSelect.value = node.flexModeWidth || 'fixed';

        // Height Sourcing
        const hModeSelect = document.getElementById('select-height-mode');
        if (hModeSelect) hModeSelect.value = node.flexModeHeight || 'fixed';

        // Inputs (standard inputs)
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

        // Capsule Input Helper
        const setCapsuleVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && el._capsuleInstance) {
                el._capsuleInstance.setValue(val);
            } else if (el) {
                el.value = val; // Fallback
            }
        };

        setVal('input-width-val', Math.round(node.width));
        setVal('input-height-val', Math.round(node.height));
        setVal('input-min-w', node.styles.minWidth || '');
        setVal('input-max-w', node.styles.maxWidth || '');
        setVal('input-min-h', node.styles.minHeight || '');
        setVal('input-max-h', node.styles.maxHeight || '');

        // Use Capsule Helper for Gap and Padding
        setCapsuleVal('input-gap', node.gap || 0);
        setCapsuleVal('input-padding', node.padding || 0);

        // Clip toggle
        const btnClip = document.getElementById('btn-clip-content');
        if (btnClip) btnClip.classList.toggle('active', !!node.clipContent);
    },

    updateChildPanelValues(node) {
        // Width Sourcing
        const wModeSelect = document.getElementById('child-select-width-mode');
        if (wModeSelect) wModeSelect.value = node.flexModeWidth || 'fixed';

        // Height Sourcing
        const hModeSelect = document.getElementById('child-select-height-mode');
        if (hModeSelect) hModeSelect.value = node.flexModeHeight || 'fixed';

        // Inputs
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

        setVal('child-input-width-val', Math.round(node.width));
        setVal('child-input-height-val', Math.round(node.height));
        setVal('child-input-min-w', node.styles.minWidth || '');
        setVal('child-input-max-w', node.styles.maxWidth || '');
        setVal('child-input-min-h', node.styles.minHeight || '');
        setVal('child-input-max-h', node.styles.maxHeight || '');

        // Absolute Position Toggle
        const btnIgnore = document.getElementById('btn-ignore-layout');
        if (btnIgnore) btnIgnore.classList.toggle('active', !!node.ignoreAutoLayout);

        // Alignment Section Visibility (conditional)
        // User Request: alignment should show ONLY when ignoring auto layout is active.
        const alignSection = document.getElementById('child-alignment-section');
        if (alignSection) {
            alignSection.style.display = node.ignoreAutoLayout ? 'flex' : 'none';
        }

        // Align Sourcing
        const selAlign = document.getElementById('child-select-align');
        if (selAlign) selAlign.value = node.element.style.alignSelf || 'auto';
    },

    // --- ACTIONS ---

    setContainerMode(mode) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node) {
                if (mode === 'horizontal') {
                    node.layout = 'horizontal';
                    node.flexWrap = 'nowrap';
                } else if (mode === 'vertical') {
                    node.layout = 'vertical';
                    node.flexWrap = 'nowrap';
                } else if (mode === 'wrap') {
                    // Flex Layout usually means Horizontal Wrap (Flow)
                    node.layout = 'horizontal';
                    node.flexWrap = 'wrap';
                }
                node.updateVisuals();
            }
        });
        // Update UI
        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (node) this.updateContainerPanelValues(node);
        App.pushHistory();
    },

    setFlexMode(dim, mode) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node) {
                const parent = node.parent;

                // === CASCADING LOGIC: Fill Mode Validation ===
                // A child can only be "fill" if parent is NOT "hug" on that axis.
                if (mode === 'fill' && parent && parent.type === 'container') {
                    const parentMode = dim === 'width' ? parent.flexModeWidth : parent.flexModeHeight;
                    if (parentMode === 'hug') {
                        // Auto-switch parent to 'fixed' to allow fill
                        if (dim === 'width') {
                            parent.flexModeWidth = 'fixed';
                            parent.width = parent.element.offsetWidth || parent.width;
                        } else {
                            parent.flexModeHeight = 'fixed';
                            parent.height = parent.element.offsetHeight || parent.height;
                        }
                        console.log(`[Layout Cascade] Parent ${parent.id} switched to 'fixed' to allow child 'fill'`);
                    }
                }

                // Apply the mode
                if (dim === 'width') node.flexModeWidth = mode;
                if (dim === 'height') node.flexModeHeight = mode;

                // If switching TO hug, ensure parent recalculates if it's also hug
                if (mode === 'hug' && parent && parent.type === 'container') {
                    parent.updateVisuals(); // Triggers fitToContent if parent is hug
                }

                node.updateVisuals();
                if (parent) parent.updateVisuals();
            }
        });

        // Update UI panel for first selected node
        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (node && node.type === 'container') {
            this.updateContainerPanelValues(node);
        } else if (node && node.parent) {
            this.updateChildPanelValues(node);
        }

        App.pushHistory();
    },

    setNodeSize(dim, val) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node) {
                const px = parseInt(val);
                if (!isNaN(px)) {
                    if (dim === 'width') node.width = px;
                    if (dim === 'height') node.height = px;

                    if (dim === 'width') node.flexModeWidth = 'fixed';
                    if (dim === 'height') node.flexModeHeight = 'fixed';

                    node.updateVisuals();
                    if (node.parent) node.parent.updateVisuals();
                }
            }
        });
        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (node) {
            if (node.type === 'container') this.updateContainerPanelValues(node);
            else this.updateChildPanelValues(node);
        }
        App.pushHistory();
    },

    setConstraint(prop, val) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node) {
                const px = val === '' ? undefined : parseInt(val);
                node.styles[prop] = isNaN(px) ? undefined : px;
                node.updateVisuals();
                if (node.parent) node.parent.updateVisuals();
            }
        });
        App.pushHistory();
    },

    setContainerGap(val) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node && node.type === 'container') {
                node.gap = parseInt(val) || 0;
                node.updateVisuals();
            }
        });
        App.pushHistory();
    },

    setContainerPadding(val) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node && node.type === 'container') {
                node.padding = parseInt(val) || 0;
                node.updateVisuals();
            }
        });
        App.pushHistory();
    },

    toggleIgnoreAutoLayout() {
        const firstId = Array.from(App.selected)[0];
        const node = App.nodes.get(firstId);
        if (node) {
            this.setIgnoreAutoLayout(!node.ignoreAutoLayout);
        }
    },

    setIgnoreAutoLayout(ignored) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node) {
                // Fix "Jump": If enabling absolute mode, calculate relative offset
                if (ignored && !node.ignoreAutoLayout && node.parent && node.element) {
                    const rect = node.element.getBoundingClientRect();
                    const parentRect = node.parent.innerElement.getBoundingClientRect();

                    // World coordinates relative to parent
                    node.x = (rect.left - parentRect.left) / App.state.scale;
                    node.y = (rect.top - parentRect.top) / App.state.scale;
                }

                node.ignoreAutoLayout = ignored;
                node.element.style.position = ignored ? 'absolute' : 'relative';
                node.updateVisuals();
                if (node.parent) node.parent.updateVisuals();
            }
        });

        // Update UI
        const firstNode = App.nodes.get(Array.from(App.selected)[0]);
        if (firstNode) this.updateChildPanelValues(firstNode);

        App.pushHistory();
    },

    setChildAlignSelf(align) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node) {
                if (node.ignoreAutoLayout && node.parent) {
                    // Absolute alignment logic
                    const parent = node.parent;
                    const s = App.state.scale;

                    // Use actual DOM dimensions for accuracy if possible, fallback to model
                    const parentRect = parent.innerElement ? parent.innerElement.getBoundingClientRect() : { width: parent.width * s, height: parent.height * s };
                    const availW = parentRect.width / s;
                    const availH = parentRect.height / s;

                    if (align === 'center') {
                        node.x = (availW - node.width) / 2;
                        node.y = (availH - node.height) / 2;
                    } else if (align === 'start') {
                        node.x = 0;
                        node.y = 0;
                    } else if (align === 'end') {
                        node.x = availW - node.width;
                        node.y = availH - node.height;
                    } else if (align === 'stretch') {
                        node.x = 0;
                        node.y = 0;
                        node.width = availW;
                        node.height = availH;
                    }
                } else {
                    node.element.style.alignSelf = align;
                }

                node.updateVisuals();
                if (node.parent) node.parent.updateVisuals();

                // Update UI if coordinates were modified
                this.updateChildPanelValues(node);
            }
        });
        App.pushHistory();
    },

    toggleContainerClipContent() {
        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (node && node.type === 'container') {
            node.clipContent = !node.clipContent;
            node.updateVisuals();
            this.updateContainerPanelValues(node);
            App.pushHistory();
        }
    },

    showScrollSettings() {
        const containerToolbar = document.getElementById("toolbar-container");
        const scrollToolbar = document.getElementById("toolbar-scroll-settings");

        if (containerToolbar) containerToolbar.style.display = "none";
        if (scrollToolbar) {
            scrollToolbar.style.display = "flex";
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: scrollToolbar });

            const node = App.nodes.get(Array.from(App.selected)[0]);
            if (node) {
                const current = node.scrollBehavior || 'none';
                const mapping = ['none', 'vertical', 'horizontal', 'both'];
                const idx = mapping.indexOf(current);
                const buttons = scrollToolbar.querySelectorAll('button.icon-btn');
                buttons.forEach((btn, i) => {
                    if (i > 0) btn.classList.toggle('active', (i - 1) === idx);
                });
            }
        }
    },

    setContainerScrollBehavior(mode) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node && node.type === 'container') {
                node.scrollBehavior = mode;
                node.updateVisuals();
            }
        });
        const scrollToolbar = document.getElementById("toolbar-scroll-settings");
        if (scrollToolbar && scrollToolbar.style.display === 'flex') {
            const mapping = ['none', 'vertical', 'horizontal', 'both'];
            const idx = mapping.indexOf(mode);
            const buttons = scrollToolbar.querySelectorAll('button.icon-btn');
            buttons.forEach((btn, i) => {
                if (i > 0) btn.classList.toggle('active', (i - 1) === idx);
            });
        }
        App.pushHistory();
    },


    // --- ALIGNMENT POPUP ---

    toggleAlignmentPopup() {
        const popup = document.getElementById('container-alignment-popup');
        const btn = document.getElementById('btn-align-popup');
        if (!popup) return;

        if (popup.style.display === 'flex' || popup.style.display === 'grid') {
            popup.style.display = 'none';
        } else {
            popup.style.display = 'grid'; // Force grid

            // Positioning Logic
            // Positioning Logic
            if (btn) {
                const rect = btn.getBoundingClientRect();
                popup.style.position = 'fixed'; // Ensure fixed is used
                // Center horizontally relative to button
                const popupWidth = 140; // Defined in CSS
                const left = rect.left + (rect.width / 2) - (popupWidth / 2);
                popup.style.left = `${left}px`;

                // Smart Vertical Positioning
                const spaceAbove = rect.top;
                const spaceBelow = window.innerHeight - rect.bottom;
                const popupHeight = 160; // Approximate height

                if (spaceAbove > popupHeight + 20) {
                    // Show Above
                    popup.style.bottom = `${window.innerHeight - rect.top + 10}px`;
                    popup.style.top = 'auto';
                } else {
                    // Show Below
                    popup.style.top = `${rect.bottom + 10}px`;
                    popup.style.bottom = 'auto';
                }

                popup.style.transform = 'none'; // Remove centering transform if any
            }

            // Re-bind clicks if needed
            if (!popup.hasAttribute('data-initialized')) {
                popup.querySelectorAll('.align-grid-btn').forEach(b => {
                    b.onclick = (e) => {
                        const r = parseInt(b.dataset.r);
                        const c = parseInt(b.dataset.c);
                        this.setContainerAlignmentGrid(r, c);
                    };
                });
                popup.querySelectorAll('.align-dist-btn').forEach(b => {
                    b.onclick = (e) => {
                        this.setContainerDistribution(e.currentTarget.dataset.action);
                    };
                });
                popup.setAttribute('data-initialized', 'true');

                // Initialize icons
                if (typeof lucide !== 'undefined') lucide.createIcons({ root: popup });
            }

            const node = App.nodes.get(Array.from(App.selected)[0]);
            if (node) this.updateAlignmentPopupVisuals(node);
        }
    },

    updateAlignmentPopupVisuals(node) {
        const popup = document.getElementById('container-alignment-popup');
        if (!popup) return;

        // 1. Determine Layout Mode for Icons
        popup.classList.remove('mode-horizontal', 'mode-vertical', 'mode-wrap');
        const isVert = node.layout === 'vertical';
        const isWrap = node.flexWrap === 'wrap';

        let mode = 'horizontal';
        if (isWrap) mode = 'wrap';
        else if (isVert) mode = 'vertical';

        popup.classList.add(`mode-${mode}`);

        // 2. Determine Active Button based on justify/align
        // Vertical: Main=Height (Justify), Cross=Width (Align)
        // Horizontal: Main=Width (Justify), Cross=Height (Align)

        // Map Align/Justify properties to Grid Coordinates (r, c)
        // r = 0 (Start), 1 (Center), 2 (End) -> Align Items (Cross Axis usually, but depends on direction?)
        // Wait, standard UI: 
        // Horizontal: X-axis is Main (Justify), Y-axis is Cross (Align)
        // Vertical: Y-axis is Main (Justify), X-axis is Cross (Align)

        // Let's assume the Grid represents the container visually:
        // Columns (c): 0=Left, 1=Center, 2=Right
        // Rows (r): 0=Top, 1=Center, 2=Bottom

        // If Horizontal:
        // Left/Center/Right corresponds to Justify Content (Start/Center/End)
        // Top/Center/Bottom corresponds to Align Items (Start/Center/End)

        // If Vertical:
        // Left/Center/Right corresponds to Align Items (Start/Center/End) -> Cross Axis
        // Top/Center/Bottom corresponds to Justify Content (Start/Center/End) -> Main Axis

        const mapValToIdx = (val) => {
            if (val === 'center') return 1;
            if (val === 'end' || val === 'flex-end') return 2;
            return 0; // start
        };

        const jIdx = mapValToIdx(node.justifyContent);
        const aIdx = mapValToIdx(node.alignItems);

        let activeR, activeC;

        if (isVert) {
            // Vertical: Justify is Y (Rows), Align is X (Cols)
            activeR = jIdx;
            activeC = aIdx;
        } else {
            // Horizontal: Justify is X (Cols), Align is Y (Rows)
            activeR = aIdx;
            activeC = jIdx;
        }

        // Update Buttons
        popup.querySelectorAll('.align-grid-btn').forEach(b => {
            const r = parseInt(b.dataset.r);
            const c = parseInt(b.dataset.c);
            b.classList.toggle('active', r === activeR && c === activeC);
        });

        // Update Distribute Buttons
        popup.querySelectorAll('.align-dist-btn').forEach(b => {
            const action = b.dataset.action;
            b.classList.toggle('active', node.justifyContent === action);
        });
    },

    setContainerAlignmentGrid(r, c) {
        const targets = App.selected;
        const mapping = ['start', 'center', 'end'];

        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node) {
                const isVert = node.layout === 'vertical';

                // If Horizontal: r=Align(Y), c=Justify(X)
                // If Vertical: r=Justify(Y), c=Align(X)

                let newJustify, newAlign;

                if (isVert) {
                    newJustify = mapping[r];
                    newAlign = mapping[c];
                } else {
                    newJustify = mapping[c];
                    newAlign = mapping[r];
                }

                node.justifyContent = newJustify;
                node.alignItems = newAlign;
                node.updateVisuals();
            }
        });

        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (node) this.updateAlignmentPopupVisuals(node);
        App.pushHistory();
    },

    setContainerDistribution(action) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node) {
                node.justifyContent = action;
                node.updateVisuals();
            }
        });
        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (node) this.updateAlignmentPopupVisuals(node);
        App.pushHistory();
    },

    toggleMinMaxPopup() {
        const popup = document.getElementById('container-minmax-popup');
        const btn = document.getElementById('btn-minmax-popup'); // Ensure button has this ID
        if (!popup) return;

        if (popup.style.display === 'flex') {
            popup.style.display = 'none';
        } else {
            // Show
            popup.style.display = 'flex';

            // Positioning Logic (Simple relative to button or center)
            if (btn) {
                const rect = btn.getBoundingClientRect();
                popup.style.position = 'absolute';
                popup.style.left = `${rect.left}px`;
                popup.style.bottom = `${window.innerHeight - rect.top + 10}px`; // Above button
            }

            // Sync Values
            const node = App.nodes.get(Array.from(App.selected)[0]);
            if (node) this.updateMinMaxPopupValues(node);
        }
    },

    hideMinMaxPopup() {
        const popup = document.getElementById('container-minmax-popup');
        if (popup) popup.style.display = 'none';
    },

    updateMinMaxPopupValues(node) {
        if (!node) return;

        // Auto Toggle
        const chk = document.getElementById('chk-auto-minmax');
        if (chk) chk.checked = !!node.isAutoMinMax;

        // Capsule Inputs
        const setVal = (id, val) => {
            // Helper since capsule input might be complicated to interface with purely via .value depending on implementation
            // Assuming capsule inputs listen to 'data-value' attribute updates or we re-render them?
            // Usually we assume similar logic to updateContainerPanelValues
            const el = document.getElementById(id);
            if (el) {
                el.setAttribute('data-value', val || '');
                // If use Component logic, might need triggering update
                if (el.input) el.input.value = val || '';
                if (el.display) el.display.textContent = val ? val + (el.dataset.unit || '') : '';
            }
        };

        setVal('input-min-w', node.minWidth || '');
        setVal('input-max-w', node.maxWidth || '');
        setVal('input-min-h', node.minHeight || '');
        setVal('input-max-h', node.maxHeight || '');
    },

    setContainerAutoMinMax(enabled) {
        const targets = App.selected;
        targets.forEach(id => {
            const node = App.nodes.get(id);
            if (node && node.type === 'container') {
                node.isAutoMinMax = enabled;
                node.updateVisuals(); // Triggers calculation
            }
        });

        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (node) this.updateMinMaxPopupValues(node);

        App.pushHistory();
    }
});
