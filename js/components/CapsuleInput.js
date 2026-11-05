/**
 * CapsuleInput.js
 * مكون عالمي لحقول الإدخال العددية بشكل كبسولي مع وظيفة السحب
 * Universal draggable number input component with capsule design
 */

class CapsuleInput {
    constructor(container, options = {}) {
        this.container = container;
        // Save instance to element for external access
        this.container._capsuleInstance = this;

        this.options = {
            value: options.value || 0,
            min: options.min !== undefined ? options.min : -Infinity,
            max: options.max !== undefined ? options.max : Infinity,
            step: options.step || 1,
            unit: options.unit || '',
            precision: options.precision || 0,
            dragSpeed: options.dragSpeed || 1,
            onChange: options.onChange || (() => { }),
            onDragStart: options.onDragStart || (() => { }), // Added onDragStart
            onDragEnd: options.onDragEnd || (() => { }),
        };

        this.value = this.options.value;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartValue = 0;

        this.init();
    }

    init() {
        // Create capsule structure
        this.container.classList.add('capsule-input');
        this.container.innerHTML = `
            <span class="capsule-value">${this.formatValue(this.value)}</span>
            ${this.options.unit ? `<span class="capsule-unit">${this.options.unit}</span>` : ''}
            <input type="number" 
                   value="${this.value}" 
                   min="${this.options.min}" 
                   max="${this.options.max}" 
                   step="${this.options.step}">
        `;

        this.valueDisplay = this.container.querySelector('.capsule-value');
        this.input = this.container.querySelector('input');

        // Bind events
        this.bindEvents();
    }

    bindEvents() {
        // Drag to adjust
        this.container.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));

        // Double-click to edit directly
        this.container.addEventListener('dblclick', this.onDoubleClick.bind(this));

        // Input field changes
        this.input.addEventListener('input', this.onInputChange.bind(this));
        this.input.addEventListener('blur', this.onInputBlur.bind(this));
        this.input.addEventListener('keydown', this.onInputKeydown.bind(this));
    }

    onPointerDown(e) {
        if (this.container.classList.contains('editing')) return;

        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartValue = this.value;

        this.container.classList.add('dragging');
        this.container.setPointerCapture(e.pointerId);

        this.options.onDragStart(this.value);

        e.preventDefault();
    }

    onPointerMove(e) {
        if (!this.isDragging) return;

        const deltaX = e.clientX - this.dragStartX;
        const step = this.options.step * this.options.dragSpeed;
        const delta = Math.round(deltaX / 5) * step; // 5px = 1 step

        let newValue = this.dragStartValue + delta;
        newValue = this.clamp(newValue, this.options.min, this.options.max);

        if (newValue !== this.value) {
            this.setValue(newValue, true);
        }
    }

    onPointerUp(e) {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.container.classList.remove('dragging');

        this.options.onDragEnd(this.value);
    }

    onDoubleClick(e) {
        this.container.classList.add('editing');
        this.input.focus();
        this.input.select();
    }

    onInputChange(e) {
        let newValue = parseFloat(this.input.value);
        if (isNaN(newValue)) newValue = this.value;

        newValue = this.clamp(newValue, this.options.min, this.options.max);
        this.setValue(newValue);
    }

    onInputBlur(e) {
        this.container.classList.remove('editing');
    }

    onInputKeydown(e) {
        if (e.key === 'Enter') {
            this.input.blur();
        } else if (e.key === 'Escape') {
            this.input.value = this.value;
            this.input.blur();
        }
    }

    setValue(value, fromDrag = false) {
        const oldValue = this.value;
        this.value = this.clamp(value, this.options.min, this.options.max);

        // Update display
        this.valueDisplay.textContent = this.formatValue(this.value);
        this.input.value = this.value;

        // Update color slider if applicable
        if (this.container.classList.contains('color-slider')) {
            this.updateColorSlider();
        }

        // Visual feedback
        if (!fromDrag && oldValue !== this.value) {
            this.container.classList.add('value-changed');
            setTimeout(() => this.container.classList.remove('value-changed'), 300);
        }

        // Callback
        if (oldValue !== this.value) {
            this.options.onChange(this.value, oldValue);
        }
    }

    // Special update for color slider
    updateColorSlider() {
        const percentage = ((this.value - this.options.min) / (this.options.max - this.options.min)) * 100;

        // Update position
        this.container.style.setProperty('--slider-position', `${percentage}%`);

        // Determine color based on slider type
        let color;

        if (this.container.classList.contains('saturation-slider')) {
            // Saturation slider: gray to full color
            const saturation = this.value; // 0-100
            const hue = parseInt(this.container.style.getPropertyValue('--current-hue')) || 0;
            color = `hsl(${hue}, ${saturation}%, 50%)`;
        }
        else if (this.container.classList.contains('brightness-slider')) {
            // Brightness slider: black to color to white
            const brightness = this.value; // 0-100
            const hue = parseInt(this.container.style.getPropertyValue('--current-hue')) || 0;
            const saturation = parseInt(this.container.style.getPropertyValue('--current-saturation')) || 100;
            color = `hsl(${hue}, ${saturation}%, ${brightness}%)`;
        }
        else {
            // Hue slider (default): full rainbow
            const hue = this.value; // 0-360
            color = `hsl(${hue}, 100%, 50%)`;
        }

        // Update color
        this.container.style.setProperty('--selected-color', color);
    }

    getValue() {
        return this.value;
    }

    formatValue(value) {
        if (this.options.precision > 0) {
            return value.toFixed(this.options.precision);
        }
        return Math.round(value).toString();
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    destroy() {
        // Clean up event listeners
        this.container.classList.remove('capsule-input', 'dragging', 'editing');
        this.container.innerHTML = '';
    }
}

// Global helper to convert existing inputs to capsule inputs
window.CapsuleInput = CapsuleInput;

// Auto-initialize capsule inputs with data attributes
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-capsule-input]').forEach(element => {
        const options = {
            value: parseFloat(element.dataset.value) || 0,
            min: parseFloat(element.dataset.min),
            max: parseFloat(element.dataset.max),
            step: parseFloat(element.dataset.step) || 1,
            unit: element.dataset.unit || '',
            precision: parseInt(element.dataset.precision) || 0,
            dragSpeed: parseFloat(element.dataset.dragSpeed) || 1,
        };

        // Get the element ID to determine which App function to call
        const elementId = element.id;

        // Map element IDs to their corresponding App functions
        // Map element IDs to their corresponding App functions
        const functionMap = {
            'input-gap': (value) => {
                if (typeof App !== 'undefined' && App.setContainerGap) {
                    App.setContainerGap(value);
                }
            },
            'input-padding': (value) => {
                if (typeof App !== 'undefined' && App.setContainerPadding) {
                    App.setContainerPadding(value);
                }
            },
            'stroke-opacity-input': (value) => {
                if (typeof App !== 'undefined' && App.setNodeStrokeOpacity) {
                    App.setNodeStrokeOpacity(value);
                }
            },
            'stroke-width-input': (value) => {
                if (typeof App !== 'undefined' && App.setNodeStrokeWidth) {
                    App.setNodeStrokeWidth(value);
                }
            },
            'curve-radius-input': (value) => {
                if (typeof App !== 'undefined' && App.setNodeRadius) {
                    App.setNodeRadius(value);
                }
            },
            'hsb-slider': {
                onChange: (value) => {
                    if (typeof App !== 'undefined' && App.updateCustomColorPreview) {
                        App.updateCustomColorPreview();
                    }
                },
                onDragEnd: (value) => {
                    // Save history only when drag ends to avoid history spam
                    if (typeof App !== 'undefined' && App.pushHistory) {
                        App.pushHistory();
                    }
                }
            },
            'grid-opacity-input': (value) => {
                if (typeof App !== 'undefined' && App.setGridOpacity) {
                    App.setGridOpacity(value);
                }
            }
        };

        // Set callbacks
        const handler = functionMap[elementId];
        if (handler) {
            if (typeof handler === 'function') {
                options.onChange = handler;
            } else {
                options.onChange = handler.onChange;
                options.onDragEnd = handler.onDragEnd;
            }
        }

        new CapsuleInput(element, options);
    });
});
