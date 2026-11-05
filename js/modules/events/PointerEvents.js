// PointerEvents.js - إدارة تفاعلات النقر، السحب، التحجيم، مع معايرة دقيقة لأصابع اليد وقلم التابلت
Object.assign(App, {
    _bindPointerEvents() {
        const vp = this.ui.viewport;

        // إغلاق القوائم عند النقر خارجها
        document.addEventListener("pointerdown", e => {
            const settingsMenu = document.getElementById("settings-menu");
            const settingsBtn = document.getElementById("settings-btn");
            if (settingsMenu && settingsMenu.style.display === "flex") {
                if (!e.target.closest("#settings-menu") && !e.target.closest("#settings-btn")) {
                    settingsMenu.style.display = "none";
                }
            }

            const sidebarPopup = document.getElementById("sidebar-extra-popup");
            const sidebarBtn = document.getElementById("sidebar-more-btn");
            if (sidebarPopup && sidebarPopup.style.display === "flex") {
                if (!e.target.closest("#sidebar-extra-popup") && !e.target.closest("#sidebar-more-btn")) {
                    sidebarPopup.style.display = "none";
                    if (sidebarBtn) sidebarBtn.classList.remove("active");
                }
            }
        });

        vp.addEventListener("pointerdown", e => {
            // التحقق من رفض لمسة راحة اليد (Palm Rejection)
            if (this.tabletEngine && this.tabletEngine.shouldRejectPointer(e)) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            // إذا كان هناك إصبعان على الشاشة (إيماءة تكبير/تصغير)، لا نبدأ سحب العقد
            if (this.tabletEngine && this.tabletEngine.activePointers.size >= 2) {
                return;
            }

            if (e.target.closest(".floating-panel") || e.target.closest("#drawing-editor")) return;
            const nodeEl = e.target.closest(".node");

            // فحص المقابض المقفلة
            if (e.target.classList.contains('locked-handle') ||
                (e.target.parentElement && e.target.parentElement.classList.contains('locked-handle'))) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            // 1. بدء عملية التحجيم (Resize) عبر المقابض
            if (e.target.closest(".handle")) {
                const handleEl = e.target.closest(".handle");
                e.stopPropagation();
                e.preventDefault();
                this._mode = "resize";
                this._handle = handleEl.dataset.pos;
                handleEl.classList.add("active");
                this._activeHandleEl = handleEl;
                this._activeId = nodeEl.id;

                const node = this.nodes.get(nodeEl.id);
                this._startRect = {
                    w: node.width,
                    h: node.height,
                    x: node.x,
                    y: node.y,
                    rot: node.rotation
                };

                const r = nodeEl.getBoundingClientRect();
                this._center = {
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2
                };
                this._startPos = { x: e.clientX, y: e.clientY };
                return;
            }

            // 2. النقر على العقدة
            if (nodeEl) {
                if (document.activeElement &&
                    (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.isContentEditable) &&
                    e.target !== document.activeElement) {
                    document.activeElement.blur();
                }

                const now = Date.now();
                if (now - (this._lastTap || 0) < 320) {
                    this.handleDBL(nodeEl, e.target);
                    return;
                }
                this._lastTap = now;

                if (e.button !== 0 && e.pointerType === 'mouse') return;

                if (nodeEl.classList.contains("editing")) {
                    const clickedEditable = e.target.classList.contains('text-content-editor') ||
                        e.target.closest('.text-content-editor') ||
                        e.target.classList.contains('text-node-title');
                    if (clickedEditable) return;
                    this.hideFormattingToolbar();
                }

                let node = this.nodes.get(nodeEl.id);

                if (node.locked) {
                    if (!this.selected.has(node.id)) this.selectNode(node.id);
                    return;
                }

                // التدقيق الهرمي (Drill-Down Selection للتابلت)
                let targetId = node.id;
                let current = node;
                let ancestors = [];
                while (current.parent) {
                    ancestors.push(current.parent);
                    current = current.parent;
                }

                if (ancestors.length > 0 && this.selected.size === 0 && !this._isFocusMode) {
                    targetId = ancestors[ancestors.length - 1].id; // تحديد الحاوية العليا أولاً
                }

                const finalTargetNode = this.nodes.get(targetId);
                if (finalTargetNode) {
                    this._activeId = finalTargetNode.id;
                    node = finalTargetNode;
                }

                e.stopPropagation();

                this._startPos = { x: e.clientX, y: e.clientY };
                this._mode = "await-drag";
                this._didDrag = false;

                // توقيت الضغطة المطولة للتابلت (Long Press)
                this._longPressTimer = setTimeout(() => {
                    if (this._mode === "await-drag" && !this._didDrag) {
                        this.handleLongPress(this._activeId);
                    }
                }, 450);

            } else {
                // 3. النقر على خلفية اللوحة (Pan Canvas)
                this._mode = "pan";

                const toolbars = document.querySelectorAll('#node-toolbar, .formatting-toolbar');
                toolbars.forEach(tb => {
                    if (tb) tb.style.display = 'none';
                });

                this._startPos = { x: e.clientX, y: e.clientY };
                this._isPanning = false;

                if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.isContentEditable)) {
                    document.activeElement.blur();
                }
            }
        });

        window.addEventListener("pointermove", e => {
            if (this.tabletEngine && this.tabletEngine.shouldRejectPointer(e)) return;
            if (!this._mode) return;

            const dx = e.clientX - this._startPos.x;
            const dy = e.clientY - this._startPos.y;
            // عتبة الحركة للشاشات اللمسية أكبر قليلاً لمنع الاهتزاز العرضي
            const moveThreshold = (e.pointerType === 'touch') ? 14 : 6;

            if (this._mode === "pan") {
                if (Math.hypot(dx, dy) > moveThreshold) {
                    this._isPanning = true;
                }
                this.state.panX += dx;
                this.state.panY += dy;
                this._startPos = { x: e.clientX, y: e.clientY };
                this.renderManager.requestViewUpdate();
            } else if (this._mode === "await-drag") {
                if (Math.hypot(dx, dy) > moveThreshold) {
                    clearTimeout(this._longPressTimer);
                    this._mode = "drag";
                    this._didDrag = true;

                    const targets = this.selected.has(this._activeId) ? this.selected : new Set([this._activeId]);
                    targets.forEach(id => {
                        this.bringToFront(id);
                        const n = this.nodes.get(id);
                        if (n) {
                            n.element.classList.add("dragging");
                            n._sx = n.x;
                            n._sy = n.y;
                        }
                    });
                }
            } else if (this._mode === "drag") {
                this._handleDragMove(e, dx, dy);
            } else if (this._mode === "resize" && this._activeId) {
                this._handleResizeMove(e);
            }
        });

        window.addEventListener("pointerup", e => {
            this._handlePointerUp(e);
        });
    },

    _handleDragMove(e, dx, dy) {
        const ddx = (e.clientX - this._startPos.x) / this.state.scale;
        const ddy = (e.clientY - this._startPos.y) / this.state.scale;

        let draggingNode = this.nodes.get(this._activeId);
        if (!draggingNode && this.selected.size > 0) {
            draggingNode = this.nodes.get(this.selected.values().next().value);
        }

        let targetContainer = null;
        if (draggingNode && this.nodeManager) {
            const predX = draggingNode._sx + ddx;
            const predY = draggingNode._sy + ddy;
            const predRect = { x: predX, y: predY, width: draggingNode.width, height: draggingNode.height };
            targetContainer = this.nodeManager.getContainerIntersecting(predRect, draggingNode);
        }

        if (this._lastHoverContainer && this._lastHoverContainer !== targetContainer) {
            this._lastHoverContainer.element.classList.remove('drop-target');
            this._hideInsertionGuide();
        }

        if (targetContainer) {
            targetContainer.element.classList.add('drop-target');
            this._lastHoverContainer = targetContainer;
            this.state.dropTarget = targetContainer.id;

            const idx = this._calculateInsertionIndex(targetContainer, e.clientX, e.clientY);
            this._insertionIndex = idx;
            this._showInsertionGuide(targetContainer, idx);
        } else {
            if (this._lastHoverContainer) {
                this._lastHoverContainer.element.classList.remove('drop-target');
            }
            this._lastHoverContainer = null;
            this.state.dropTarget = null;
            this._hideInsertionGuide();
        }

        const activeId = this._activeId;
        const activeNode = this.nodes.get(activeId);
        if (!activeNode) return;

        let nx = activeNode._sx + ddx;
        let ny = activeNode._sy + ddy;

        if (this.state.magnet) {
            const snapResult = this.calculateSnaps(activeNode, nx, ny);
            nx = snapResult.x;
            ny = snapResult.y;
        } else {
            this.clearGuides();
        }

        const targets = (this.state.focusedNodes && this.state.focusedNodes.size > 0)
            ? this.state.focusedNodes
            : (this.selected.has(activeId) ? this.selected : new Set([activeId]));

        targets.forEach(id => {
            const n = this.nodes.get(id);
            if (!n) return;
            if (id === activeId) {
                n.move(nx - n.x, ny - n.y);
            } else {
                const shiftX = nx - (activeNode._sx + ddx);
                const shiftY = ny - (activeNode._sy + ddy);
                const otherNx = n._sx + ddx + shiftX;
                const otherNy = n._sy + ddy + shiftY;
                n.move(otherNx - n.x, otherNy - n.y);
            }
        });
    },

    _handleResizeMove(e) {
        this._didDrag = true;
        const node = this.nodes.get(this._activeId);
        if (!node || !this._handle) return;

        const s = this.state.scale;
        const h = this._handle;

        const dx = e.clientX - this._startPos.x;
        const dy = e.clientY - this._startPos.y;

        const mx = dx / s;
        const my = dy / s;

        if (node.locked) return;

        if (node.autoResize) {
            if (node.type === 'container') {
                node.autoResize = false;
                if (h.includes('e') || h.includes('w')) node.flexModeWidth = 'fixed';
                if (h.includes('n') || h.includes('s')) node.flexModeHeight = 'fixed';
            } else if (node.type === 'text' || node.type === 'text-with-title') {
                node.autoResize = false;
            }
        }

        const { w: startW, h: startH, x: startX, y: startY } = this._startRect;
        let proposedW = startW;
        let proposedH = startH;

        if (h.includes("e")) proposedW = Math.max(30, startW + mx);
        if (h.includes("w")) proposedW = Math.max(30, startW - mx);
        if (h.includes("s")) proposedH = Math.max(30, startH + my);
        if (h.includes("n")) proposedH = Math.max(30, startH - my);

        if (typeof node.getConstrainedDimensions === 'function') {
            const constrained = node.getConstrainedDimensions(proposedW, proposedH);
            proposedW = constrained.w;
            proposedH = constrained.h;
        }

        let newX = startX;
        let newY = startY;

        if (h.includes("w")) newX = startX + (startW - proposedW);
        if (h.includes("n")) newY = startY + (startH - proposedH);

        node.resize(proposedW, proposedH, newX, newY);

        if (this.renderManager) this.renderManager.requestViewUpdate();
        this.updateToolbar();
    },

    _handlePointerUp(e) {
        clearTimeout(this._longPressTimer);

        if (this.state.dropTarget && this._mode === 'drag') {
            const container = this.nodes.get(this.state.dropTarget);
            if (container) {
                let insertIdx = (this._insertionIndex !== undefined && this._insertionIndex !== -1) ? this._insertionIndex : container.children.size;

                this.selected.forEach(id => {
                    const node = this.nodes.get(id);
                    if (node && node.id !== container.id) {
                        let p = container;
                        let isCircular = false;
                        while (p) {
                            if (p.id === node.id) { isCircular = true; break; }
                            p = p.parent;
                        }
                        if (isCircular) return;

                        if (node.parent) node.parent.removeChild(node);
                        if (container.addChildAt) {
                            container.addChildAt(node, insertIdx++);
                        } else {
                            container.addChild(node);
                        }
                        node.updateVisuals();
                    }
                });
            }

            if (container && container.element) {
                container.element.classList.remove('drop-target');
            }
            this._lastHoverContainer = null;
            this.state.dropTarget = null;
            this._hideInsertionGuide();
        }

        if (this._mode === "await-drag") {
            if (!this._didDrag) {
                this.handleTap(this._activeId);
            }
            this._didDrag = false;
            this._mode = null;
        } else if (this._mode === "pan") {
            if (!this._isPanning) {
                const clickedNode = e.target.closest('.node');
                const clickedToolbar = e.target.closest('#node-toolbar');

                if (!clickedNode && !clickedToolbar) {
                    if (this._isFocusMode) {
                        this.exitFocusMode();
                        this.clearFocusedNodes();
                    }
                    this.deselectAll();
                    this.hideFormattingToolbar();
                }
            }
        }

        this.nodes.forEach(n => {
            if (n.element) n.element.classList.remove("dragging", "drag-over");
        });

        this._mode = null;
        this._handle = null;
        if (this._activeHandleEl) {
            this._activeHandleEl.classList.remove("active");
            this._activeHandleEl = null;
        }

        this.updateToolbar();
    },

    _calculateInsertionIndex(container, pointerScreenX, pointerScreenY) {
        const inner = container.element.querySelector('.container-inner');
        if (!inner) return 0;

        const childEls = Array.from(inner.querySelectorAll(':scope > .node'));
        const activeIds = this.selected.has(this._activeId) ? this.selected : new Set([this._activeId]);
        const visibleChildren = childEls.filter(el => !activeIds.has(el.id));

        const isHorizontal = container.layout === 'horizontal';

        for (let i = 0; i < visibleChildren.length; i++) {
            const rect = visibleChildren[i].getBoundingClientRect();
            if (isHorizontal) {
                if (pointerScreenX < rect.left + rect.width / 2) return i;
            } else {
                if (pointerScreenY < rect.top + rect.height / 2) return i;
            }
        }

        return visibleChildren.length;
    },

    _showInsertionGuide(container, index) {
        const inner = container.element.querySelector('.container-inner');
        if (!inner) return;

        if (!this._insertionGuide) {
            this._insertionGuide = document.createElement('div');
            this._insertionGuide.className = 'insertion-guide';
        }

        if (this._insertionGuide.parentElement !== inner) {
            inner.appendChild(this._insertionGuide);
        }

        const childEls = Array.from(inner.querySelectorAll(':scope > .node'));
        const activeIds = this.selected.has(this._activeId) ? this.selected : new Set([this._activeId]);
        const visibleChildren = childEls.filter(el => !activeIds.has(el.id));

        const innerRect = inner.getBoundingClientRect();
        const scale = this.state.scale || 1;
        const padding = container.padding || 0;
        const isHorizontal = container.layout === 'horizontal';

        this._insertionGuide.classList.remove('guide-horizontal', 'guide-vertical');

        if (isHorizontal) {
            this._insertionGuide.classList.add('guide-vertical');
            this._insertionGuide.style.width = '3px';
            this._insertionGuide.style.height = `${(innerRect.height / scale) - padding * 2}px`;
            this._insertionGuide.style.top = `${padding}px`;

            let left = 0;
            if (visibleChildren.length === 0) {
                left = (innerRect.width / scale) / 2;
            } else if (index === 0) {
                left = (visibleChildren[0].getBoundingClientRect().left - innerRect.left) / scale;
            } else if (index === visibleChildren.length) {
                left = (visibleChildren[visibleChildren.length - 1].getBoundingClientRect().right - innerRect.left) / scale;
            } else {
                left = ((visibleChildren[index - 1].getBoundingClientRect().right + visibleChildren[index].getBoundingClientRect().left) / 2 - innerRect.left) / scale;
            }
            this._insertionGuide.style.left = `${left}px`;
        } else {
            this._insertionGuide.classList.add('guide-horizontal');
            this._insertionGuide.style.height = '3px';
            this._insertionGuide.style.width = `${(innerRect.width / scale) - padding * 2}px`;
            this._insertionGuide.style.left = `${padding}px`;

            let top = 0;
            if (visibleChildren.length === 0) {
                top = (innerRect.height / scale) / 2;
            } else if (index === 0) {
                top = (visibleChildren[0].getBoundingClientRect().top - innerRect.top) / scale;
            } else if (index === visibleChildren.length) {
                top = (visibleChildren[visibleChildren.length - 1].getBoundingClientRect().bottom - innerRect.top) / scale;
            } else {
                top = ((visibleChildren[index - 1].getBoundingClientRect().bottom + visibleChildren[index].getBoundingClientRect().top) / 2 - innerRect.top) / scale;
            }
            this._insertionGuide.style.top = `${top}px`;
        }

        this._insertionGuide.style.display = 'block';
    },

    _hideInsertionGuide() {
        if (this._insertionGuide && this._insertionGuide.parentNode) {
            this._insertionGuide.parentNode.removeChild(this._insertionGuide);
        }
        this._insertionIndex = -1;
    }
});