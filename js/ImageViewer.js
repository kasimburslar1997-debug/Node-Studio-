// Image Viewer Module - Advanced Image Gallery Viewer
class ImageViewer {
    constructor() {
        this.currentNode = null;
        this.currentIndex = 0;
        this.isStripVisible = false;
        this.viewerElement = null;
        this.transform = { x: 0, y: 0, scale: 1 };
        this.wasDragging = false; // Flag to prevent click toggle after drag
        this.init();
    }

    init() {
        // Wait for DOM if not ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupViewer());
        } else {
            this.setupViewer();
        }
    }

    setupViewer() {
        this.viewerElement = document.getElementById('image-viewer');
        if (!this.viewerElement) {
            console.error('ImageViewer: #image-viewer element not found');
            return;
        }
        this.setupKeyboardNavigation();
        this.setupBackgroundClick();
    }

    setupBackgroundClick() {
        this.viewerElement.addEventListener('click', (e) => {
            // Prevent toggle if we just finished dragging
            if (this.wasDragging) return;

            if (e.target === this.viewerElement || e.target.id === 'viewer-img') {
                this.toggleThumbnailStrip();
            }
        });
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (this.viewerElement.style.display === 'flex') {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.showNext(); // Right arrow -> Next image
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.showPrevious(); // Left arrow -> Previous image
                } else if (e.key === 'Escape') {
                    this.close();
                }
            }
        });
    }

    open(nodeId, imageIndex = 0) {
        const node = App.nodes.get(nodeId);
        if (!node || node.type !== 'image') return;

        this.currentNode = node;
        this.currentIndex = imageIndex;
        this.transform = { x: 0, y: 0, scale: 1 }; // Reset zoom

        this.render();
        this.viewerElement.style.display = 'flex';
        // Add class for animation
        requestAnimationFrame(() => {
            this.viewerElement.classList.add('open');
        });
    }

    close() {
        this.viewerElement.style.display = 'none';
        this.viewerElement.classList.remove('open', 'strip-visible');
        this.isStripVisible = false;
        this.currentNode = null;
        this.transform = { x: 0, y: 0, scale: 1 };
    }

    showNext() {
        if (!this.currentNode || !this.currentNode.images) return;
        this.currentIndex = (this.currentIndex + 1) % this.currentNode.images.length;
        this.updateImage();
    }

    showPrevious() {
        if (!this.currentNode || !this.currentNode.images) return;
        this.currentIndex = (this.currentIndex - 1 + this.currentNode.images.length) % this.currentNode.images.length;
        this.updateImage();
    }

    showImageAtIndex(index) {
        if (!this.currentNode || !this.currentNode.images) return;
        if (index >= 0 && index < this.currentNode.images.length) {
            this.currentIndex = index;
            this.updateImage();
        }
    }

    toggleThumbnailStrip() {
        this.isStripVisible = !this.isStripVisible;
        if (this.viewerElement) {
            this.viewerElement.classList.toggle('strip-visible', this.isStripVisible);
        }

        const strip = document.getElementById('viewer-thumbnail-strip');
        if (strip) {
            strip.classList.toggle('visible', this.isStripVisible);
            if (this.isStripVisible) {
                this.scrollThumbnailToCenter();
                this.resetZoom();
            }
        }
    }

    scrollThumbnailToCenter() {
        const strip = document.getElementById('viewer-thumbnail-strip');
        const currentThumb = strip?.querySelector('.viewer-thumb.active');
        if (currentThumb && strip) {
            const stripWidth = strip.offsetWidth;
            const thumbLeft = currentThumb.offsetLeft;
            const thumbWidth = currentThumb.offsetWidth;
            const scrollPosition = thumbLeft - (stripWidth / 2) + (thumbWidth / 2);
            strip.scrollTo({ left: scrollPosition, behavior: 'smooth' });
        }
    }

    deleteCurrentImage() {
        if (!this.currentNode || !this.currentNode.images) return;
        this.currentNode.removeImage(this.currentIndex);
        if (this.currentNode.images.length === 0) {
            this.close();
        } else {
            if (this.currentIndex >= this.currentNode.images.length) {
                this.currentIndex = this.currentNode.images.length - 1;
            }
            this.render();
        }
    }

    downloadCurrentImage() {
        if (!this.currentNode || !this.currentNode.images) return;
        const imageSrc = this.currentNode.images[this.currentIndex];
        if (!imageSrc) return;
        const link = document.createElement('a');
        link.href = imageSrc;
        link.download = `image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    cropCurrentImage() {
        if (!this.currentNode || !this.currentNode.images) return;
        const imageSrc = this.currentNode.images[this.currentIndex];
        if (!imageSrc) return;
        this.viewerElement.style.display = 'none';
        this.showCropInterface(imageSrc);
    }

    showCropInterface(imageSrc) {
        const cropModal = document.createElement('div');
        cropModal.id = 'crop-modal';
        cropModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.95); display: flex; flex-direction: column;
            align-items: center; justify-content: center; z-index: 100000;
        `;
        cropModal.innerHTML = `
            <div style="position: relative; max-width: 90vw; max-height: 80vh;">
                <img id="crop-image" src="${imageSrc}" style="max-width: 100%; max-height: 80vh; display: block;">
                <div id="crop-overlay" style="
                    position: absolute; border: 2px dashed #fff;
                    background: rgba(59, 130, 246, 0.2); cursor: move;
                    top: 10%; left: 10%; width: 80%; height: 80%; box-sizing: border-box;
                "></div>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button id="crop-apply" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                    <i data-lucide="check"></i> تطبيق
                </button>
                <button id="crop-cancel" style="padding: 12px 24px; background: #666; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                    <i data-lucide="x"></i> إلغاء
                </button>
            </div>
        `;
        document.body.appendChild(cropModal);
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        this.setupCropControls(cropModal, imageSrc);
    }

    setupCropControls(modal, imageSrc) {
        const overlay = modal.querySelector('#crop-overlay');
        const img = modal.querySelector('#crop-image');
        const applyBtn = modal.querySelector('#crop-apply');
        const cancelBtn = modal.querySelector('#crop-cancel');
        let isDragging = false;
        let startX, startY;

        const onMouseDown = (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const currentLeft = parseInt(overlay.style.left) || 0;
            const currentTop = parseInt(overlay.style.top) || 0;
            overlay.style.left = `${currentLeft + dx}%`;
            overlay.style.top = `${currentTop + dy}%`;
            startX = e.clientX;
            startY = e.clientY;
        };

        const onMouseUp = () => { isDragging = false; };

        overlay.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        applyBtn.addEventListener('click', () => {
            this.applyCrop(img, overlay, imageSrc);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            modal.remove();
        });

        cancelBtn.addEventListener('click', () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            modal.remove();
            this.viewerElement.style.display = 'flex';
        });
    }

    applyCrop(imgElement, overlay, originalSrc) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const imgRect = imgElement.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        const scaleX = imgElement.naturalWidth / imgRect.width;
        const scaleY = imgElement.naturalHeight / imgRect.height;
        const cropX = Math.max(0, (overlayRect.left - imgRect.left) * scaleX);
        const cropY = Math.max(0, (overlayRect.top - imgRect.top) * scaleY);
        const cropW = Math.min(imgElement.naturalWidth - cropX, overlayRect.width * scaleX);
        const cropH = Math.min(imgElement.naturalHeight - cropY, overlayRect.height * scaleY);

        canvas.width = cropW;
        canvas.height = cropH;

        const tempImg = new Image();
        tempImg.onload = () => {
            ctx.drawImage(tempImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const croppedDataUrl = canvas.toDataURL('image/png');
            if (this.currentNode && this.currentNode.images) {
                this.currentNode.images[this.currentIndex] = croppedDataUrl;
                this.currentNode.render();
                App.pushHistory();
            }
            this.viewerElement.style.display = 'flex';
            this.render();
        };
        tempImg.src = originalSrc;
    }

    resetZoom() {
        this.transform = { x: 0, y: 0, scale: 1 };
        const img = document.getElementById('viewer-img');
        if (img) img.style.transform = `translate(0px, 0px) scale(1)`;
    }

    updateImage() {
        const img = document.getElementById('viewer-img');
        if (img && this.currentNode && this.currentNode.images[this.currentIndex]) {
            img.src = this.currentNode.images[this.currentIndex];
            this.resetZoom();
        }
        this.updateThumbnailStrip();
    }

    updateThumbnailStrip() {
        const strip = document.getElementById('viewer-thumbnail-strip');
        if (!strip || !this.currentNode) return;
        const thumbs = strip.querySelectorAll('.viewer-thumb');
        thumbs.forEach((thumb, index) => {
            thumb.classList.toggle('active', index === this.currentIndex);
        });
        if (this.isStripVisible) {
            this.scrollThumbnailToCenter();
        }
    }

    // --- Interaction Logic (Zoom, Pan, Swipe) ---
    setupInteractions() {
        const img = document.getElementById('viewer-img');
        const container = this.viewerElement;

        if (!img) return;

        let startX = 0, startY = 0;
        let isDragging = false;
        let initialDistance = 0;
        let initialScale = 1;

        // Helper to disable/enable transition for performance
        const setTransition = (enable) => {
            img.style.transition = enable ? '' : 'none';
        };

        // Mouse Wheel Zoom
        img.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.applyZoom(delta);
        });

        // Touch Start
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Pinch start
                setTransition(false); // No transition during drag
                initialDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialScale = this.transform.scale;
            } else if (e.touches.length === 1) {
                // Pan/Swipe start
                setTransition(false);
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                isDragging = true;
            }
        });

        // Touch Move
        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                // Pinch Zoom
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = dist / initialDistance;
                this.setZoom(initialScale * delta);
            } else if (isDragging && e.touches.length === 1) {
                // Pan or Swipe
                const deltaX = e.touches[0].clientX - startX;
                const deltaY = e.touches[0].clientY - startY;

                // Mark as dragging if moved significantly
                if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                    this.wasDragging = true;
                }

                if (this.transform.scale > 1) {
                    // Pan
                    e.preventDefault();
                    this.transform.x += deltaX;
                    this.transform.y += deltaY;
                    this.updateTransform();
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                } else {
                    // Standard swipe logic handled in touchend
                }
            }
        });

        // Touch End
        container.addEventListener('touchend', (e) => {
            setTransition(true); // Restore transition

            if (isDragging && e.changedTouches.length > 0 && this.transform.scale === 1) {
                const endX = e.changedTouches[0].clientX;
                const dist = endX - startX;
                if (Math.abs(dist) > 50) { // Swipe Threshold
                    if (dist > 0) this.showPrevious();
                    else this.showNext();
                    this.wasDragging = true; // Ensure swipe counts as drag
                }
            }
            isDragging = false;
            // Clear drag flag after a short delay
            setTimeout(() => this.wasDragging = false, 100);
        });

        // Mouse Drag (Pan only if zoomed)
        img.addEventListener('mousedown', (e) => {
            if (this.transform.scale > 1) {
                setTransition(false);
                isDragging = true;
                this.wasDragging = false;
                startX = e.clientX;
                startY = e.clientY;
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging && this.transform.scale > 1) {
                e.preventDefault();
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                    this.wasDragging = true;
                }

                this.transform.x += deltaX;
                this.transform.y += deltaY;
                this.updateTransform();
                startX = e.clientX;
                startY = e.clientY;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                setTransition(true);
                isDragging = false;
                setTimeout(() => this.wasDragging = false, 100);
            }
        });

        // Strip Horizontal Scroll Drag
        const strip = document.getElementById('viewer-thumbnail-strip');
        if (strip) {
            let isDown = false;
            let stripStartX;
            let scrollLeft;

            strip.addEventListener('mousedown', (e) => {
                isDown = true;
                stripStartX = e.pageX - strip.offsetLeft;
                scrollLeft = strip.scrollLeft;
            });
            strip.addEventListener('mouseleave', () => { isDown = false; });
            strip.addEventListener('mouseup', () => { isDown = false; });
            strip.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - strip.offsetLeft;
                const walk = (x - stripStartX) * 2;
                strip.scrollLeft = scrollLeft - walk;
            });
        }
    }

    applyZoom(delta) {
        this.setZoom(this.transform.scale * delta);
    }

    setZoom(scale) {
        const minScale = 1;
        const maxScale = 5;
        this.transform.scale = Math.min(Math.max(scale, minScale), maxScale);
        if (this.transform.scale === 1) {
            this.transform.x = 0;
            this.transform.y = 0;
        }
        this.updateTransform();
    }

    updateTransform() {
        const img = document.getElementById('viewer-img');
        if (img) {
            img.style.transform = `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.transform.scale})`;
        }
    }

    render() {
        if (!this.currentNode || !this.currentNode.images) return;
        const images = this.currentNode.images;
        const currentImageSrc = images[this.currentIndex] || '';

        const html = `
            <button id="viewer-close" class="viewer-btn viewer-btn-close" onclick="window.ImageViewer.close()">
                <i data-lucide="x"></i>
            </button>
            <div class="viewer-actions-top">
                <button class="viewer-btn viewer-btn-action" onclick="window.ImageViewer.downloadCurrentImage()" data-tooltip="تحميل الصورة">
                    <i data-lucide="download"></i>
                </button>
                <button class="viewer-btn viewer-btn-action" onclick="window.ImageViewer.deleteCurrentImage()" data-tooltip="حذف الصورة">
                    <i data-lucide="trash-2"></i>
                </button>
                <button class="viewer-btn viewer-btn-action" onclick="window.ImageViewer.cropCurrentImage()" data-tooltip="قص الصورة">
                    <i data-lucide="crop"></i>
                </button>
            </div>
            ${images.length > 1 ? `
                <button class="viewer-btn viewer-nav-btn viewer-nav-left" onclick="window.ImageViewer.showPrevious()">
                    <i data-lucide="chevron-left"></i>
                </button>
                <button class="viewer-btn viewer-nav-btn viewer-nav-right" onclick="window.ImageViewer.showNext()">
                    <i data-lucide="chevron-right"></i>
                </button>
            ` : ''}
            <img id="viewer-img" src="${currentImageSrc}">
            ${images.length > 1 ? `
                <div id="viewer-thumbnail-strip" class="${this.isStripVisible ? 'visible' : ''}">
                    ${images.map((src, index) => `
                        <div class="viewer-thumb ${index === this.currentIndex ? 'active' : ''}" 
                             onclick="window.ImageViewer.showImageAtIndex(${index})">
                            <img src="${src}">
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;

        this.viewerElement.innerHTML = html;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        this.setupInteractions();
    }
}

// Create global instance
window.ImageViewer = new ImageViewer();
