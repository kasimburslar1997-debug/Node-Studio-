/**
 * TabletGestureEngine.js
 * محرك مخصص للأجهزة اللوحية (Tablets) وشاشات اللمس:
 * 1. دعم Apple Pencil و S-Pen مع حساسية الضغط وزاوية الميلان
 * 2. رفض لمس راحة اليد (Palm Rejection) أثناء استخدام القلم
 * 3. إيماءات الإصبعين (Pinch Zoom & Pan) مع التكبير المتمحور حول نقطة اللمس
 * 4. إيماءات التراجع والإعادة بأطراف الأصابع (نقرة بإصبعين للتراجع، نقرة بثلاثة أصابع للإعادة)
 * 5. التكيف مع لوحة المفاتيح الافتراضية للتابلت عبر VisualViewport API
 */

class TabletGestureEngine {
    constructor(app) {
        this.app = app;
        this.activePointers = new Map(); // pointerId -> PointerData
        this.isPenActive = false;
        this.lastPenTime = 0;
        this.tapTimers = new Map();

        // إحصائيات الإيماءات
        this.gestureMode = null; // 'pinch', 'pan', 'draw', 'none'
        this.initialDistance = 0;
        this.initialScale = 1;
        this.initialMidpoint = { x: 0, y: 0 };
        this.initialPan = { x: 0, y: 0 };

        // كشف النقر المتعدد (Undo/Redo)
        this.tapHistory = [];
        this.lastTapCount = 0;

        this.init();
    }

    init() {
        this.bindViewportResize();
    }

    // ==== 1. التكيف مع لوحة المفاتيح الافتراضية للتابلت ====
    bindViewportResize() {
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                const heightDiff = window.innerHeight - window.visualViewport.height;
                const bottomBar = document.getElementById('bottom-bar-container');
                const nodeToolbar = document.getElementById('node-toolbar');

                if (heightDiff > 150) {
                    // لوحة المفاتيح الافتراضية مفتوحة
                    document.body.classList.add('virtual-keyboard-open');
                    if (bottomBar) bottomBar.style.transform = `translateY(-${heightDiff}px)`;
                    if (nodeToolbar && nodeToolbar.style.display === 'flex') {
                        nodeToolbar.style.bottom = `${heightDiff + 20}px`;
                    }
                } else {
                    // لوحة المفاتيح مغلقة
                    document.body.classList.remove('virtual-keyboard-open');
                    if (bottomBar) bottomBar.style.transform = '';
                    if (nodeToolbar) nodeToolbar.style.bottom = '';
                }
            });
        }
    }

    // ==== 2. التحقق من القلم ورفض لمس راحة اليد (Palm Rejection) ====
    shouldRejectPointer(e) {
        // إذا كان هناك قلم يلمس الشاشة حالياً
        if (this.isPenActive && e.pointerType === 'touch') {
            return true; // تجاهل كل لمسات الأصابع أثناء الرسم بالقلم
        }

        // إذا كان اللمس تم بمساحة سطح عريضة جداً (راحة اليد Palm)
        if (e.pointerType === 'touch') {
            const contactArea = (e.width || 0) * (e.height || 0);
            if (contactArea > 2500 || (e.width > 50 && e.height > 50)) {
                return true; // تجاهل راحة اليد المرتكزة على الشاشة
            }
        }

        // حماية مؤقتة بعد رفع القلم بـ 300ms لمنع نقرات اليد العرضية
        if (e.pointerType === 'touch' && (Date.now() - this.lastPenTime < 300)) {
            return true;
        }

        return false;
    }

    onPointerDown(e) {
        if (e.pointerType === 'pen') {
            this.isPenActive = true;
            this.lastPenTime = Date.now();
        }

        if (this.shouldRejectPointer(e)) {
            return { handled: true, reject: true };
        }

        this.activePointers.set(e.pointerId, {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            startX: e.clientX,
            startY: e.clientY,
            type: e.pointerType,
            pressure: e.pressure || 0.5,
            tiltX: e.tiltX || 0,
            tiltY: e.tiltY || 0,
            time: Date.now()
        });

        const pointerCount = this.activePointers.size;

        // إيماءة الإصبعين (Pinch Zoom & Pan)
        if (pointerCount === 2) {
            const pointers = Array.from(this.activePointers.values());
            this.gestureMode = 'pinch';
            this.initialDistance = Math.hypot(
                pointers[0].x - pointers[1].x,
                pointers[0].y - pointers[1].y
            );
            this.initialScale = this.app.state.scale;
            this.initialMidpoint = {
                x: (pointers[0].x + pointers[1].x) / 2,
                y: (pointers[0].y + pointers[1].y) / 2
            };
            this.initialPan = {
                x: this.app.state.panX,
                y: this.app.state.panY
            };
            return { handled: true, gesture: 'pinch-start' };
        }

        return { handled: false, pointerCount: pointerCount, type: e.pointerType };
    }

    onPointerMove(e) {
        if (!this.activePointers.has(e.pointerId)) return { handled: false };

        if (this.shouldRejectPointer(e)) {
            return { handled: true, reject: true };
        }

        const ptr = this.activePointers.get(e.pointerId);
        ptr.x = e.clientX;
        ptr.y = e.clientY;
        ptr.pressure = e.pressure || ptr.pressure;
        ptr.tiltX = e.tiltX || ptr.tiltX;
        ptr.tiltY = e.tiltY || ptr.tiltY;

        // معالجة تكبير وتصغير اللوحة بإصبعين
        if (this.gestureMode === 'pinch' && this.activePointers.size === 2) {
            const pointers = Array.from(this.activePointers.values());
            const currentDist = Math.hypot(
                pointers[0].x - pointers[1].x,
                pointers[0].y - pointers[1].y
            );

            if (this.initialDistance > 0) {
                const scaleFactor = currentDist / this.initialDistance;
                let newScale = Math.max(0.1, Math.min(5.0, this.initialScale * scaleFactor));

                const currentMidpoint = {
                    x: (pointers[0].x + pointers[1].x) / 2,
                    y: (pointers[0].y + pointers[1].y) / 2
                };

                // حساب الإزاحة نسبة لنقطة التكبير
                const worldMidX = (this.initialMidpoint.x - this.initialPan.x) / this.initialScale;
                const worldMidY = (this.initialMidpoint.y - this.initialPan.y) / this.initialScale;

                this.app.state.scale = newScale;
                this.app.state.panX = currentMidpoint.x - (worldMidX * newScale);
                this.app.state.panY = currentMidpoint.y - (worldMidY * newScale);

                // تحديث مؤشر الزووم واللوحة
                const zoomLabel = document.getElementById("zoom-label");
                if (zoomLabel) zoomLabel.innerText = Math.round(newScale * 100) + "%";

                if (this.app.renderManager) {
                    this.app.renderManager.requestViewUpdate();
                }

                return { handled: true, gesture: 'pinching' };
            }
        }

        return { handled: false, gesture: this.gestureMode };
    }

    onPointerUp(e) {
        const ptr = this.activePointers.get(e.pointerId);
        const duration = ptr ? (Date.now() - ptr.time) : 0;
        const distMoved = ptr ? Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY) : 0;

        if (e.pointerType === 'pen') {
            this.isPenActive = false;
            this.lastPenTime = Date.now();
        }

        this.activePointers.delete(e.pointerId);

        // انتهاء إيماءة الإصبعين
        if (this.gestureMode === 'pinch' && this.activePointers.size < 2) {
            this.gestureMode = null;

            // كشف نقرة الإصبعين السريعة للتراجع (Two-finger Tap = Undo)
            if (duration < 250 && distMoved < 15) {
                if (typeof this.app.undo === 'function') {
                    this.app.undo();
                    this.showTabletGestureFeedback("تراجع (إصبعين)");
                }
                return { handled: true, gesture: 'two-finger-tap-undo' };
            }

            return { handled: true, gesture: 'pinch-end' };
        }

        // كشف نقرة ثلاثة أصابع للإعادة (Three-finger Tap = Redo)
        if (distMoved < 20 && duration < 300) {
            this.tapHistory.push({ time: Date.now() });
            this.tapHistory = this.tapHistory.filter(t => Date.now() - t.time < 400);

            if (this.tapHistory.length === 3) {
                this.tapHistory = [];
                if (typeof this.app.redo === 'function') {
                    this.app.redo();
                    this.showTabletGestureFeedback("إعادة (3 أصابع)");
                }
                return { handled: true, gesture: 'three-finger-tap-redo' };
            }
        }

        return { handled: false };
    }

    showTabletGestureFeedback(text) {
        let toast = document.getElementById('tablet-gesture-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'tablet-gesture-toast';
            toast.style.cssText = `
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(30, 30, 30, 0.9);
                color: #3b82f6;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 0.85rem;
                font-weight: 600;
                border: 1px solid rgba(59, 130, 246, 0.3);
                backdrop-filter: blur(10px);
                z-index: 10000;
                pointer-events: none;
                transition: opacity 0.2s, transform 0.2s;
                opacity: 0;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = text;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
        }, 1200);
    }
}

window.TabletGestureEngine = TabletGestureEngine;