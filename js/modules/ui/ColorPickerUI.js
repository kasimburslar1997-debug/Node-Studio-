/**
 * ColorPickerUI.js
 * مسؤول عن واجهة اختيار الألوان (HSB + Alpha Picker + Presets)
 */

Object.assign(App, {
    // HSB State
    _hsbValues: { h: 0, s: 100, b: 100, a: 100 },
    _currentHSBMode: 'hue',
    currentColorType: null,

    /**
     * عرض منتقي الألوان
     * @param {string} type - نوع اللون ('fill', 'stroke', 'text')
     */
    showColorPicker(type) {
        this.currentColorType = type;

        // Hide all toolbars
        const toolbars = [
            'toolbar-main', 'toolbar-stroke', 'toolbar-curve',
            'toolbar-node-settings', 'toolbar-formatting', 'toolbar-headings'
        ];
        toolbars.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Sync Quick Opacity Slider
        const sliderEl = document.getElementById('quick-opacity-input');
        if (sliderEl && sliderEl._capsuleInstance) {
            let currentAlpha = 100;
            // Get from selection
            const targets = this.selected.size > 0 ? this.selected : (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set());
            if (targets.size > 0) {
                const node = this.nodes.get(Array.from(targets)[0]);
                if (node) {
                    let color = '#ffffff';
                    if (type === 'fill') color = node.styles.fill;
                    else if (type === 'text') color = node.styles.text;
                    else if (type === 'stroke') color = node.styles.stroke || '#ffffff';

                    const hsb = this.parseToHSB(color);
                    currentAlpha = hsb.a; // 0-100
                }
            }
            sliderEl._capsuleInstance.setValue(currentAlpha);
        }

        // Show color presets toolbar
        document.getElementById('toolbar-color-presets').style.display = 'flex';
    },

    setQuickOpacity(val) {
        const alpha = parseInt(val);
        const type = this.currentColorType;

        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));

        targets.forEach(id => {
            const node = this.nodes.get(id);
            if (node) {
                let color = '#ffffff';
                if (type === 'fill') color = node.styles.fill;
                else if (type === 'text') color = node.styles.text;
                else if (type === 'stroke') color = node.styles.stroke || '#ffffff';

                // Resolve CSS variables
                if (color && color.startsWith('var(')) {
                    const computed = window.getComputedStyle(node.element);
                    if (type === 'fill') color = computed.backgroundColor;
                    else if (type === 'text') color = computed.color;
                    else if (type === 'stroke') color = computed.borderColor || '#ffffff';
                }

                const hsb = this.parseToHSB(color);
                // Update Alpha
                const newColor = this.hsbToHex(hsb.h, hsb.s, hsb.b, alpha);

                if (type === 'fill') node.styles.fill = newColor;
                else if (type === 'text') node.styles.text = newColor;
                else if (type === 'stroke') node.styles.stroke = newColor;

                node.updateVisuals();
            }
        });
    },

    /**
     * تطبيق لون محدد مسبقاً
     * @param {string} color - قيمة اللون (hex)
     */
    applyPresetColor(color) {
        this.applyColorByType(color, this.currentColorType);
        // this.hideColorPicker();
    },

    /**
     * عرض منتقي الألوان المخصص (HSB)
     */
    showCustomColorPicker() {
        document.getElementById('toolbar-color-presets').style.display = 'none';
        document.getElementById('toolbar-custom-color').style.display = 'flex';

        // Initialize with Hue mode active
        this._currentHSBMode = 'hue';
        this.initHSBSliders();
    },

    /**
     * تهيئة منزلقات HSB
     */
    initHSBSliders() {
        // Get current color from selected/focused node
        let currentColor = '#ffffff';
        const targets = this.selected.size > 0 ? this.selected : (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set());
        if (targets.size > 0) {
            const node = this.nodes.get(Array.from(targets)[0]);
            if (node) {
                if (this.currentColorType === 'fill') currentColor = node.styles.fill;
                else if (this.currentColorType === 'text') currentColor = node.styles.text;
                else if (this.currentColorType === 'stroke') currentColor = node.styles.stroke || '#ffffff';
            }
        }

        // Convert to HSB and store values
        const hsb = this.parseToHSB(currentColor);
        this._hsbValues = {
            h: hsb.h,
            s: hsb.s,
            b: hsb.b,
            a: hsb.a
        };

        // Set slider based on current mode (default hue)
        this.setHSBMode(this._currentHSBMode || 'hue');
    },

    /**
     * تعيين وضع HSB النشط
     * @param {string} mode - 'hue', 'saturation', 'brightness', 'alpha'
     */
    setHSBMode(mode) {
        // Update active button
        document.querySelectorAll('.hsb-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        this._currentHSBMode = mode;
        const sliderContainer = document.getElementById('hsb-slider');
        const capsule = sliderContainer._capsuleInstance;

        // Reset classes
        sliderContainer.classList.remove('saturation-slider', 'brightness-slider', 'alpha-slider');
        sliderContainer.style.background = ''; // Remove manual background

        // Update CSS variables for gradients
        sliderContainer.style.setProperty('--current-hue', this._hsbValues.h);
        sliderContainer.style.setProperty('--current-saturation', this._hsbValues.s);
        // Note: Brightness/Alpha gradients are trickier with just CSS vars if we rely on static CSS classes,
        // so we might inject linear-gradient manually for them.

        // Configure slider based on mode
        let newValue, newMax;

        if (mode === 'hue') {
            newMax = 360;
            newValue = this._hsbValues.h;
            // CSS class 'color-slider' (default) handles hue gradient
        } else if (mode === 'saturation') {
            sliderContainer.classList.add('saturation-slider');
            newMax = 100;
            newValue = this._hsbValues.s;
        } else if (mode === 'brightness') {
            sliderContainer.classList.add('brightness-slider');
            newMax = 100;
            newValue = this._hsbValues.b;
            // Ensure end color matches current hue/sat
            const fullBright = this.hsbToHex(this._hsbValues.h, this._hsbValues.s, 100, 100);
            sliderContainer.style.setProperty('--full-brightness-color', fullBright);
        } else { // alpha
            sliderContainer.classList.add('alpha-slider');
            newMax = 100;
            newValue = this._hsbValues.a;
            // Manual Gradient for Alpha: transparent -> opaque current color
            const opaqueColor = this.hsbToHex(this._hsbValues.h, this._hsbValues.s, this._hsbValues.b, 100);
            sliderContainer.style.background = `linear-gradient(to right, transparent, ${opaqueColor})`;
        }

        // Update CapsuleInput settings
        if (capsule) {
            capsule.options.max = newMax;
            capsule.input.max = newMax;
            capsule.setValue(newValue);
            capsule.updateColorSlider(); // Force visual update
        }

        this.updateCustomColorPreview();
    },

    /**
     * تحديث معاينة اللون المخصص
     */
    updateCustomColorPreview() {
        const sliderContainer = document.getElementById('hsb-slider');
        const capsule = sliderContainer._capsuleInstance;

        // Get value from capsule
        const sliderValue = capsule ? capsule.getValue() : parseInt(document.getElementById('hsb-slider').querySelector('input').value);

        // Update stored values
        if (this._currentHSBMode === 'hue') {
            this._hsbValues.h = sliderValue;
            sliderContainer.style.setProperty('--current-hue', sliderValue);
        } else if (this._currentHSBMode === 'saturation') {
            this._hsbValues.s = sliderValue;
            sliderContainer.style.setProperty('--current-saturation', sliderValue);
        } else if (this._currentHSBMode === 'brightness') {
            this._hsbValues.b = sliderValue;
        } else { // alpha
            this._hsbValues.a = sliderValue;
        }

        // Update Brightness Gradient End-stop if needed
        if (this._currentHSBMode !== 'brightness' && document.querySelector('.brightness-slider')) {
            const fullBright = this.hsbToHex(this._hsbValues.h, this._hsbValues.s, 100, 100);
            sliderContainer.style.setProperty('--full-brightness-color', fullBright);
        }

        // Update Alpha Gradient if needed (if changing color while in alpha mode, weird but possible if we had multiple sliders)
        // Since we only have one slider, we don't need to update bg unless we switch modes.

        // Generate color and update preview
        const color = this.hsbToHex(this._hsbValues.h, this._hsbValues.s, this._hsbValues.b, this._hsbValues.a);
        document.getElementById('custom-color-preview').style.background = color;

        // Force update of slider handle color
        if (capsule) {
            capsule.updateColorSlider();
        }

        // Live update
        if (this.currentColorType) {
            this.applyColorByType(color, this.currentColorType, false);
        }
    },

    /**
     * تحويل HSB إلى Hex (Supports Alpha)
     * returns Hex6 or Hex8
     */
    hsbToHex(h, s, b, a = 100) {
        s /= 100;
        b /= 100;

        const k = (n) => (n + h / 60) % 6;
        const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));

        const r = Math.round(255 * f(5));
        const g = Math.round(255 * f(3));
        const b2 = Math.round(255 * f(1));

        const hex6 = '#' + [r, g, b2].map(x => x.toString(16).padStart(2, '0')).join('');

        if (a >= 100) return hex6;

        const alpha = Math.round((a / 100) * 255);
        return hex6 + alpha.toString(16).padStart(2, '0');
    },

    /**
     * تحويل CSS Color (Hex/RGB/RGBA) إلى HSB
     */
    parseToHSB(colorStr) {
        let r = 0, g = 0, b = 0, a = 1;

        // Handle Hex
        if (colorStr.startsWith('#')) {
            let hex = colorStr.slice(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('') + 'FF';
            else if (hex.length === 6) hex += 'FF';
            else if (hex.length === 4) hex = hex.split('').map(c => c + c).join(''); // #RGBA -> #RRGGBBAA

            if (hex.length === 8) {
                r = parseInt(hex.slice(0, 2), 16) / 255;
                g = parseInt(hex.slice(2, 4), 16) / 255;
                b = parseInt(hex.slice(4, 6), 16) / 255;
                a = parseInt(hex.slice(6, 8), 16) / 255;
            }
        }
        // Handle RGB/RGBA
        else if (colorStr.startsWith('rgb')) {
            const parts = colorStr.match(/[\d.]+/g);
            if (parts) {
                r = parseFloat(parts[0]) / 255;
                g = parseFloat(parts[1]) / 255;
                b = parseFloat(parts[2]) / 255;
                if (parts.length > 3) a = parseFloat(parts[3]);
            }
        }
        else if (colorStr === 'transparent') {
            return { h: 0, s: 0, b: 0, a: 0 };
        }

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        if (delta !== 0) {
            if (max === r) h = 60 * (((g - b) / delta) % 6);
            else if (max === g) h = 60 * ((b - r) / delta + 2);
            else h = 60 * ((r - g) / delta + 4);
        }
        if (h < 0) h += 360;

        const s = max === 0 ? 0 : (delta / max) * 100;
        const brightness = max * 100;
        const alpha = Math.round(a * 100);

        return { h: Math.round(h), s: Math.round(s), b: Math.round(brightness), a: Math.min(100, Math.max(0, alpha)) };
    },

    // Legacy alias
    hexToHSB(hex) {
        return this.parseToHSB(hex);
    },

    /**
     * تأكيد اللون المخصص
     */
    confirmCustomColor() {
        const color = document.getElementById('custom-color-preview').style.background;
        // background might be computed as rgb/rgba by browser
        // Convert to Hex8 for consistency if needed, OR just pass as is.
        // Let's pass as is (generic CSS string), assuming it's valid.
        // Actually, for consistency with 'applyColorByType' expecting a string, let's normalize.
        // Browsers return 'rgb(...)' or 'rgba(...)' for element.style.background.

        let finalColor = color;
        if (color.startsWith('rgb')) {
            // keep it, good for Alpha.
        } else if (color.startsWith('#')) {
            // keep it
        } else {
            // weird naming?
        }

        this.applyColorByType(finalColor, this.currentColorType);
        this.hideColorPicker();
    },

    // Helper: RGB to Hex (Updated)
    rgbToHex(rgb) {
        // Keep alpha if present
        if (rgb.includes('a')) return rgb; // Return rgba string as is, it's valid css

        const values = rgb.match(/\d+/g);
        if (!values || values.length < 3) return '#ffffff';
        return '#' + values.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    },

    /**
     * العودة إلى الألوان المحددة مسبقاً
     */
    backToColorPresets() {
        document.getElementById('toolbar-custom-color').style.display = 'none';
        document.getElementById('toolbar-color-presets').style.display = 'flex';
    },

    /**
     * إخفاء منتقي الألوان
     */
    hideColorPicker() {
        document.getElementById('toolbar-color-presets').style.display = 'none';
        document.getElementById('toolbar-custom-color').style.display = 'none';
        document.getElementById('toolbar-main').style.display = 'flex';
    },

    /**
     * تطبيق اللون حسب النوع
     */
    applyColorByType(color, type, saveHistory = true) {
        // Handle strict text editing inside editor (same as before)
        if (type === 'text') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('foreColor', false, color);
                if (saveHistory) this.pushHistory();
                return;
            }
        }

        const targets = this.state.focusedNodes.size > 0 ? this.state.focusedNodes :
            (this.selected.size > 0 ? this.selected :
                (this.state.focusedNode ? new Set([this.state.focusedNode]) : new Set()));

        targets.forEach(id => {
            const node = this.nodes.get(id);
            if (node) {
                if (type === 'fill') node.styles.fill = color;
                else if (type === 'text') node.styles.text = color;
                else if (type === 'stroke') node.styles.stroke = color;
                node.updateVisuals();
            }
        });

        if (saveHistory) {
            this.pushHistory();
        }
    },

    // Compatibility aliases
    showColors(mode) { this.showColorPicker(mode); },
    applyColor(color) { this.applyColorByType(color, this.currentColorType); }
});
