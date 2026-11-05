/**
 * SidebarManager.js
 * إدارة الشريط الجانبي وأزرار الأدوات لشاشات التابلت دون إخفائها قسراً
 */

Object.assign(App, {
    toggleSidebarPopup() {
        const popup = document.getElementById('sidebar-extra-popup');
        const btn = document.getElementById('sidebar-more-btn');
        if (!popup) return;

        if (popup.style.display === 'none' || !popup.style.display) {
            popup.style.display = 'flex';
            if (btn) btn.classList.add('active');

            if (typeof this.renderComponentsList === 'function') {
                this.renderComponentsList();
            }
        } else {
            popup.style.display = 'none';
            if (btn) btn.classList.remove('active');
        }
        App.refreshIcons();
    },

    checkSidebarOverflow() {
        const toolsContainer = document.getElementById('sidebar-tools');
        const overflowContainer = document.getElementById('sidebar-overflow-tools');
        const moreBtn = document.getElementById('sidebar-more-btn');

        if (!toolsContainer || !overflowContainer || !moreBtn) return;

        // إرجاع كافة الأدوات للشريط الجانبي دائماً لضمان عدم اختفائها
        const overflowItems = Array.from(overflowContainer.children);
        if (overflowItems.length > 0) {
            overflowItems.forEach(item => {
                toolsContainer.appendChild(item);
            });
        }

        overflowContainer.style.display = 'none';
        const divider = document.getElementById('sidebar-popup-divider');
        if (divider) divider.style.display = 'none';

        // حساب الارتفاع المتاح بدقة متساهلة جداً تمنع الاختفاء إلا في الشاشات فائقة الصغر (أقل من 400px)
        const windowHeight = window.innerHeight;
        const availableHeight = windowHeight - 180;

        const tools = Array.from(toolsContainer.children);
        let totalHeight = tools.length * 48;

        if (totalHeight > availableHeight && availableHeight > 200) {
            let currentHeight = 0;
            const itemsToMove = [];

            tools.forEach(tool => {
                currentHeight += 48;
                if (currentHeight > availableHeight) {
                    itemsToMove.push(tool);
                }
            });

            if (itemsToMove.length > 0) {
                overflowContainer.style.display = 'flex';
                itemsToMove.forEach(tool => overflowContainer.appendChild(tool));
                if (divider) divider.style.display = 'block';
            }
        }

        App.refreshIcons();
    },

    initSidebarOverflowListener() {
        window.addEventListener('resize', () => {
            this.checkSidebarOverflow();
        });
        setTimeout(() => this.checkSidebarOverflow(), 200);
    }
});