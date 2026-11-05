/**
 * TextEditorUI.js
 * محرر وتنسيق النصوص الحديث الخالي من ثغرات الحقن (XSS Safe Text Engine)
 * المزايا:
 * 1. استبدال document.execCommand البائدة بنظام DOM Range & Selection API
 * 2. فلترة شاملة للمدخلات (Built-in HTML Sanitizer) لمنع حقن السكربتات الخبيثة في ملفات .agp
 * 3. دعم مريح لشاشات اللمس والتابلت
 */

Object.assign(App, {
    _activeEditorNode: null,

    // ==== 1. مطهر ومفلتر الأكواد الخبيثة (Lightweight XSS Sanitizer) ====
    sanitizeHTML(dirtyHtml) {
        if (!dirtyHtml) return '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(dirtyHtml, 'text/html');

        // قائمة الوسوم المسموح بها لتنسيق النصوص فقط
        const allowedTags = new Set([
            'P', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
            'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'UL', 'OL', 'LI', 'BR', 'SPAN', 'DIV'
        ]);

        const sanitizeNode = (node) => {
            const children = Array.from(node.childNodes);
            for (let child of children) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    if (!allowedTags.has(child.tagName)) {
                        child.replaceWith(...Array.from(child.childNodes));
                    } else {
                        // إزالة كافة خصائص الـ JavaScript والـ Event Handlers
                        const attrs = Array.from(child.attributes);
                        for (let attr of attrs) {
                            const name = attr.name.toLowerCase();
                            const val = attr.value.toLowerCase();
                            if (name.startsWith('on') || val.includes('javascript:') || val.includes('data:text/html')) {
                                child.removeAttribute(attr.name);
                            }
                        }
                        sanitizeNode(child);
                    }
                }
            }
        };

        sanitizeNode(doc.body);
        return doc.body.innerHTML;
    },

    // ==== 2. تطبيق التنسيقات باستخدام Range API الحديثة بدلاً من execCommand ====

    applyFormat(formatType, value = null) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const editor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer.closest('.text-content-editor')
            : range.commonAncestorContainer.parentElement.closest('.text-content-editor');

        if (!editor) return;

        // التنسيقات المتكررة
        if (formatType === 'bold') {
            this._toggleInlineTag(range, 'strong');
        } else if (formatType === 'italic') {
            this._toggleInlineTag(range, 'em');
        } else if (formatType === 'underline') {
            this._toggleInlineTag(range, 'u');
        } else if (formatType === 'insertUnorderedList') {
            this._wrapInList(range, 'ul');
        } else if (formatType === 'insertOrderedList') {
            this._wrapInList(range, 'ol');
        } else if (formatType.startsWith('justify')) {
            const align = formatType.replace('justify', '').toLowerCase();
            this._applyAlignment(range, align);
        }

        if (this._activeEditorNode) {
            const node = this.nodes.get(this._activeEditorNode);
            if (node) App.handleInput(editor);
        }
    },

    _toggleInlineTag(range, tagName) {
        if (range.collapsed) return;
        const parent = range.commonAncestorContainer.parentElement;

        if (parent && parent.tagName.toLowerCase() === tagName) {
            // إزالة التنسيق
            const parentContent = Array.from(parent.childNodes);
            parent.replaceWith(...parentContent);
        } else {
            // تطبيق التنسيق
            const wrapper = document.createElement(tagName);
            try {
                wrapper.appendChild(range.extractContents());
                range.insertNode(wrapper);
            } catch (e) {
                console.warn("Formatting range error:", e);
            }
        }
    },

    _wrapInList(range, listType) {
        const list = document.createElement(listType);
        const li = document.createElement('li');
        if (range.collapsed) {
            li.innerHTML = '<br>';
        } else {
            li.appendChild(range.extractContents());
        }
        list.appendChild(li);
        range.insertNode(list);
    },

    _applyAlignment(range, align) {
        let block = range.commonAncestorContainer;
        while (block && block.nodeType !== Node.ELEMENT_NODE) {
            block = block.parentElement;
        }
        if (block && !block.classList.contains('text-content-editor')) {
            block.style.textAlign = align;
        } else {
            const div = document.createElement('div');
            div.style.textAlign = align;
            div.appendChild(range.extractContents());
            range.insertNode(div);
        }
    },

    applyHeading(level) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const h = document.createElement(`h${level}`);
        h.style.margin = '4px 0';

        if (range.collapsed) {
            h.innerHTML = '<br>';
        } else {
            h.appendChild(range.extractContents());
        }
        range.insertNode(h);
    },

    applyTextColor(color) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);

        if (!range.collapsed) {
            const span = document.createElement('span');
            span.style.color = color === 'inherit' ? '' : color;
            span.appendChild(range.extractContents());
            range.insertNode(span);
        }

        const indicator = document.getElementById('text-color-indicator');
        if (indicator) indicator.style.background = color === 'inherit' ? 'var(--text-primary)' : color;
        const picker = document.getElementById('text-color-picker');
        if (picker) picker.style.display = 'none';
    },

    // ==== 3. التحكم في شريط الأدوات العائم للنصوص ====

    showHeadingSelector() {
        document.getElementById('toolbar-formatting').style.display = 'none';
        document.getElementById('toolbar-headings').style.display = 'flex';
    },

    backToFormatting() {
        document.getElementById('toolbar-headings').style.display = 'none';
        document.getElementById('toolbar-formatting').style.display = 'flex';
    },

    applyHeadingAndReturn(level) {
        this.applyHeading(level);
        const btn = document.getElementById('heading-selector-btn');
        if (btn) btn.textContent = `H${level}`;
        this.backToFormatting();
    },

    showInlineFormattingToolbar(nodeId, autoFocus = true) {
        this._activeEditorNode = nodeId;
        const node = this.nodes.get(nodeId);
        if (!node) return;

        if (typeof this.selectNode === 'function') {
            this.selectNode(nodeId);
        }

        node.element.classList.add("editing");

        const editor = node.element.querySelector(".text-content-editor, .code-content");
        if (editor) {
            if (editor.tagName === "TEXTAREA") {
                editor.removeAttribute("readonly");
            } else {
                editor.setAttribute("contenteditable", "true");
            }

            if (autoFocus) {
                setTimeout(() => editor.focus(), 50);
            }
        }

        const subbars = ['toolbar-main', 'toolbar-stroke', 'toolbar-node-settings', 'toolbar-color-presets', 'toolbar-custom-color', 'toolbar-headings'];
        subbars.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        const fmtToolbar = document.getElementById('toolbar-formatting');
        if (fmtToolbar) {
            fmtToolbar.style.display = 'flex';
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: fmtToolbar });
            this.updateToolbar();
        }
    },

    hideFormattingToolbar() {
        const toolbar = document.getElementById("toolbar-formatting");
        const headingsToolbar = document.getElementById("toolbar-headings");

        if (toolbar) toolbar.style.display = 'none';
        if (headingsToolbar) headingsToolbar.style.display = 'none';

        if (this._activeEditorNode) {
            const node = this.nodes.get(this._activeEditorNode);
            if (node) {
                node.element.classList.remove("editing");

                const editor = node.element.querySelector(".text-content-editor");
                if (editor) {
                    // تطهير النص قبل التخزين النهائي
                    editor.innerHTML = this.sanitizeHTML(editor.innerHTML);
                    editor.setAttribute("contenteditable", "false");
                }
            }
        }
        this._activeEditorNode = null;
    },

    handleEditorBlur(nodeId) {
        setTimeout(() => {
            const activeElement = document.activeElement;
            const toolbar = document.getElementById('toolbar-formatting');
            if (toolbar && toolbar.contains(activeElement)) return;

            const node = this.nodes.get(nodeId);
            if (node) {
                if (node.element.contains(activeElement)) return;
                node.element.classList.remove("editing");
                const editor = node.element.querySelector(".text-content-editor");
                if (editor) {
                    editor.innerHTML = App.sanitizeHTML(editor.innerHTML);
                    editor.setAttribute("contenteditable", "false");
                }
                App.hideFormattingToolbar();
                App.updateToolbar();
            }
        }, 180);
    },

    toggleTextColorPicker() {
        const picker = document.getElementById('text-color-picker');
        if (!picker) return;
        picker.style.display = picker.style.display === 'grid' ? 'none' : 'grid';
    }
});