/**
 * VideoNode.js
 * عقدة الفيديو المصممة لشاشات اللمس والتابلت
 * تدعم:
 * 1. تشغيل الفيديو عبر الرابط المباشر أو الـ Blobs المخزنة
 * 2. التبديل بين الشاشات والتحكم باللمس (Play / Pause / Mute / Loop)
 * 3. حفظ النسبة الباعية (Aspect Ratio) تلقائياً عند تغيير الحجم
 */

class VideoNode extends BaseNode {
    constructor(x, y, assetId = null, videoSrc = null) {
        super("video", x, y, 360, 240);
        this.assetId = assetId;
        this.src = videoSrc;
        this.isPlaying = false;
        this.isMuted = true; // صامت افتراضياً لضمان التوافق مع متصفحات التابلت
        this.isLooping = true;
        this.aspectRatio = 16 / 9;
        this.autoResize = false;
        this.styles.fill = "#000000";

        if (this.assetId && window.App && window.App.assetManager) {
            this.src = window.App.assetManager.getAssetUrl(this.assetId);
        }

        this.initVideoEvents();
    }

    getHTML() {
        const videoSrc = this.src || '';
        const hasSource = Boolean(videoSrc);

        if (!hasSource) {
            return `
                <div class="video-placeholder" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);color:var(--text-secondary);gap:10px;cursor:pointer;" onclick="App.triggerUpload('${this.id}', 'video')">
                    <i data-lucide="video" style="width:36px;height:36px;opacity:0.6;"></i>
                    <span style="font-size:0.85rem;">انقر لإضافة فيديو (مضمن أو مرتبط)</span>
                </div>
            `;
        }

        return `
            <div class="video-container" style="width:100%;height:100%;position:relative;background:#000;overflow:hidden;border-radius:inherit;">
                <video class="video-element" src="${videoSrc}" playsinline webkit-playsinline ${this.isMuted ? 'muted' : ''} ${this.isLooping ? 'loop' : ''} style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>
                <div class="video-touch-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);opacity:0;transition:opacity 0.2s;" onpointerdown="event.stopPropagation()">
                    <button class="icon-btn video-play-btn" style="width:48px;height:48px;background:rgba(0,0,0,0.7);color:white;border-radius:50%;" onclick="App.nodes.get('${this.id}').togglePlay()">
                        <i data-lucide="${this.isPlaying ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="icon-btn video-mute-btn" style="position:absolute;bottom:10px;right:10px;width:36px;height:36px;background:rgba(0,0,0,0.7);color:white;" onclick="App.nodes.get('${this.id}').toggleMute()">
                        <i data-lucide="${this.isMuted ? 'volume-x' : 'volume-2'}"></i>
                    </button>
                </div>
            </div>
        `;
    }

    initVideoEvents() {
        const el = this.element;
        if (!el) return;

        el.addEventListener('pointerenter', () => {
            const overlay = el.querySelector('.video-touch-overlay');
            if (overlay) overlay.style.opacity = '1';
        });

        el.addEventListener('pointerleave', () => {
            const overlay = el.querySelector('.video-touch-overlay');
            if (overlay) overlay.style.opacity = '0';
        });
    }

    setSrc(src, assetId = null) {
        this.src = src;
        this.assetId = assetId;
        const inner = this.element.querySelector('.node-inner');
        if (inner) {
            inner.innerHTML = this.getHTML();
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: inner });
            this.initVideoEvents();

            const video = inner.querySelector('video');
            if (video) {
                video.onloadedmetadata = () => {
                    if (video.videoWidth && video.videoHeight) {
                        this.aspectRatio = video.videoWidth / video.videoHeight;
                        this.height = this.width / this.aspectRatio;
                        this.updateVisuals();
                    }
                };
            }
        }
    }

    togglePlay() {
        const video = this.element.querySelector('video');
        if (!video) return;

        if (video.paused) {
            video.play().then(() => {
                this.isPlaying = true;
                this.updatePlayIcon();
            }).catch(console.warn);
        } else {
            video.pause();
            this.isPlaying = false;
            this.updatePlayIcon();
        }
    }

    toggleMute() {
        const video = this.element.querySelector('video');
        if (!video) return;
        this.isMuted = !this.isMuted;
        video.muted = this.isMuted;
        const muteBtn = this.element.querySelector('.video-mute-btn');
        if (muteBtn) {
            muteBtn.innerHTML = `<i data-lucide="${this.isMuted ? 'volume-x' : 'volume-2'}"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: muteBtn });
        }
    }

    updatePlayIcon() {
        const playBtn = this.element.querySelector('.video-play-btn');
        if (playBtn) {
            playBtn.innerHTML = `<i data-lucide="${this.isPlaying ? 'pause' : 'play'}"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: playBtn });
        }
    }

    onAssetUpdated() {
        if (this.assetId && window.App && window.App.assetManager) {
            const newUrl = window.App.assetManager.getAssetUrl(this.assetId);
            if (newUrl) this.setSrc(newUrl, this.assetId);
        }
    }

    resize(w, h, x, y) {
        if (this.aspectRatio) {
            if (Math.abs(w - this.width) > 0.5) {
                this.width = Math.max(100, w);
                this.height = this.width / this.aspectRatio;
            } else {
                this.height = Math.max(60, h);
                this.width = this.height * this.aspectRatio;
            }
            this.x = x;
            this.y = y;
        } else {
            super.resize(w, h, x, y);
        }
        this.updateVisuals();
    }
}

window.VideoNode = VideoNode;