/**
 * ComponentsUI.js
 * مسؤول عن عرض وإدارة قائمة المكونات المحفوظة
 * استخدام نمط Object.assign للتوافق الكامل
 */

Object.assign(App, {
    /**
     * عرض قائمة المكونات في النافذة المنبثقة
     */
    renderComponentsList() {
        const popup = document.getElementById('sidebar-extra-popup');
        if (!popup) return;

        // Create or get container for components
        let compContainer = document.getElementById('sidebar-components-container');
        if (!compContainer) {
            // Add divider if popup has content
            if (popup.children.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'divider';
                divider.style.gridColumn = '1 / -1'; // Span full width
                divider.style.width = '100%';
                divider.style.margin = '5px 0';
                popup.appendChild(divider);
            }

            compContainer = document.createElement('div');
            compContainer.id = 'sidebar-components-container';
            // Use sub-grid or display contents?
            // Since parent is grid 3-columns, we want components to flow in it.
            // But 'div' wrapper breaks grid flow unless display: contents.
            // OR we just append children directly and track them.
            // Safer to use display: contents to keep grid layout
            compContainer.style.display = 'contents';
            popup.appendChild(compContainer);
        }

        compContainer.innerHTML = '';

        if (!this.state.components || this.state.components.length === 0) {
            // Optional: Show nothing or a placeholder
            // For icon grid, usually show nothing if empty
            return;
        }

        this.state.components.forEach((comp) => {
            const btn = document.createElement('button');
            btn.className = 'icon-btn';
            btn.setAttribute('data-tooltip', comp.name); // Tooltip

            // Icon
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', comp.icon || 'box');
            btn.appendChild(icon);

            // Click handler
            // Click handler
            btn.onclick = () => {
                // Fix: Access App global directly since 'this' might be UIModule
                if (typeof App.createComponentInstance === 'function') {
                    App.createComponentInstance(comp.id);
                } else {
                    console.error("App.createComponentInstance not found");
                }
            };

            // Context menu for delete
            btn.oncontextmenu = (e) => {
                e.preventDefault();
                if (this.showComponentMenu) this.showComponentMenu(comp.id, e);
            };

            compContainer.appendChild(btn);
        });

        // Refresh icons
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: compContainer });
    }
});
