/**
 * CapsuleEditUI.js
 * مسؤول عن كبسولة الخيارات السريعة (قص، نسخ، لصق، حذف) المتاحة عند النقر بالزر الأيمن على محرر النصوص.
 */

Object.assign(App, {
    showEditCapsule(x, y) {
        const capsule = document.getElementById('edit-capsule');
        if (!capsule) return;
        capsule.style.display = 'flex';
        const rect = capsule.getBoundingClientRect();
        let left = x - rect.width / 2;
        let top = y - rect.height - 10;
        if (left < 10) left = 10;
        if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
        if (top < 10) top = y + 20;
        capsule.style.left = `${left}px`;
        capsule.style.top = `${top}px`;
        const hideHandler = (e) => {
            if (!capsule.contains(e.target)) {
                this.hideEditCapsule();
                window.removeEventListener('pointerdown', hideHandler);
            }
        };
        setTimeout(() => window.addEventListener('pointerdown', hideHandler), 100);
    },

    hideEditCapsule() {
        const capsule = document.getElementById('edit-capsule');
        if (capsule) capsule.style.display = 'none';
    },

    handleCapsuleAction(action) {
        this.hideEditCapsule();
        let activeEl = document.activeElement;
        if (!activeEl || (!activeEl.isContentEditable && activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA')) {
            if (this._activeEditorNode) {
                const node = this.nodes.get(this._activeEditorNode);
                if (node) {
                    const editor = node.element.querySelector(".text-content-editor, .code-content");
                    if (editor) {
                        editor.focus();
                        activeEl = editor;
                    }
                }
            }
        }
        switch (action) {
            case 'copy': document.execCommand('copy'); break;
            case 'cut': document.execCommand('cut'); break;
            case 'paste':
                if (navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText().then(text => {
                        if (activeEl) {
                            activeEl.focus();
                            if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
                                if (activeEl.setRangeText) {
                                    activeEl.setRangeText(text, activeEl.selectionStart, activeEl.selectionEnd, 'end');
                                    activeEl.dispatchEvent(new Event('input', { bubbles: true }));
                                } else {
                                    document.execCommand('insertText', false, text);
                                }
                            } else {
                                document.execCommand('insertText', false, text);
                            }
                        }
                    }).catch(err => {
                        document.execCommand('paste');
                    });
                } else {
                    document.execCommand('paste');
                }
                break;
            case 'delete': document.execCommand('delete'); break;
        }
    }
});
