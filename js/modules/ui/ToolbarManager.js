/**
 * ToolbarManager.js
 * مسؤول عن إدارة اللائحة العائمة (Floating Toolbar) التي تظهر فوق العقد المحددة
 * نمط Object.assign للتوافق الكامل
 */

Object.assign(App, {
    /**
     * عرض اللائحة الرئيسية
     */
    showMainToolbar() {
        // Explicitly hide all known sub-toolbars
        const ids = [
            "toolbar-formatting", "toolbar-headings",
            "toolbar-color-presets", "toolbar-custom-color",
            "toolbar-stroke",
            "toolbar-node-settings", "toolbar-container",
            "toolbar-child-layout", "toolbar-scroll-settings"
        ];

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        // Also cleanup common popups
        const popups = [
            "container-gap-popup", "container-padding-popup",
            "alignment-popup", "child-align-popup"
        ];
        popups.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        // Reset inline scroll if any
        const inlineScroll = document.getElementById('scroll-options-inline');
        if (inlineScroll) inlineScroll.style.display = 'none';

        document.getElementById("toolbar-main").style.display = "flex";

        // Re-render icons just in case
        const main = document.getElementById("toolbar-main");
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: main });
    },

    /**
     * عرض إعدادات الحدود (Stroke)
     */
    showStrokeSettings() {
        document.getElementById("toolbar-main").style.display = "none";
        const toolbar = document.getElementById("toolbar-stroke");
        toolbar.style.display = "flex";

        // Sync Values with Selection
        const node = App.nodes.get(Array.from(App.selected)[0]);
        if (node) {
            // Sync Color Dot
            const dot = toolbar.querySelector('.color-dot');
            if (dot) dot.style.background = node.styles.stroke || 'transparent';

            // Sync Capsule Inputs
            const setCapVal = (id, val) => {
                const el = document.getElementById(id);
                if (el && el._capsuleInstance) el._capsuleInstance.setValue(val);
            };

            setCapVal('stroke-opacity-input', node.styles.strokeOpacity !== undefined ? node.styles.strokeOpacity : 1);
            setCapVal('stroke-width-input', node.styles.strokeWidth || 0);
            setCapVal('curve-radius-input', node.styles.radius || 0);

            // Sync Stroke Alignment
            const alignBtn = document.getElementById('btn-stroke-align');
            if (alignBtn) {
                const align = node.styles.strokeAlignment || 'outside';
                const icon = alignBtn.querySelector('i');
                if (icon) {
                    let iconName = 'maximize';
                    let tooltip = 'خارجي (Outside)';

                    if (align === 'inside') {
                        iconName = 'minimize';
                        tooltip = 'داخلي (Inside)';
                    } else if (align === 'center') {
                        iconName = 'circle';
                        tooltip = 'وسط (Center)';
                    }

                    icon.setAttribute('data-lucide', iconName);
                    alignBtn.setAttribute('data-tooltip', tooltip);
                    if (typeof lucide !== 'undefined') lucide.createIcons({ root: alignBtn });
                }
            }
        }
    },



    /**
     * عرض إعدادات العقدة
     */
    showNodeSettings() {
        document.getElementById("toolbar-main").style.display = "none";
        document.getElementById("toolbar-node-settings").style.display = "flex";
    },

    /**
     * إعداد مستمعين لإخفاء التحديد عند التفاعل مع الخصائص
     */
    setupHideSelectionListeners() {
        const ids = [
            'toolbar-stroke',
            'toolbar-custom-color',
            'toolbar-color-presets',
            'workspace-settings',
            'minmax-popup',
            'alignment-popup',
            'container-alignment-popup',
            'toolbar-node-settings',
            'layout-popup' // Just in case
        ];

        const setHidden = (active) => {
            if (active) document.body.classList.add('hide-selection-active');
            else document.body.classList.remove('hide-selection-active');
        };

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            // Hover Entr
            el.addEventListener('mouseenter', () => setHidden(true));

            // Hover Leave
            el.addEventListener('mouseleave', () => {
                // If we are NOT dragging/adjusting, hide it.
                if (!document.body.classList.contains('property-adjusting')) {
                    setHidden(false);
                }
            });

            // Start Adjusting (MouseDown)
            el.addEventListener('mousedown', () => {
                document.body.classList.add('property-adjusting');
                setHidden(true); // Ensure hidden
            });
        });

        // Global Mouse Up to clear adjusting state
        window.addEventListener('mouseup', () => {
            if (document.body.classList.contains('property-adjusting')) {
                document.body.classList.remove('property-adjusting');

                // Check if we are still hovering any of the toolbars
                const isHovering = ids.some(id => {
                    const el = document.getElementById(id);
                    return el && el.matches(':hover');
                });

                if (!isHovering) {
                    setHidden(false);
                }
            }
        });
    }
});
