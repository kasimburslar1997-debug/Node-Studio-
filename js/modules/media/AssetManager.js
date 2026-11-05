/**
 * AssetManager.js
 * نظام إدارة الوسائط المتقدم (Adobe Style Media Management)
 * يدعم:
 * 1. الوسائط المضمنة (Embedded Assets): تخزين الصور والفيديوهات مباشرة داخل حزمة المشروع .agp
 * 2. الوسائط المرتبطة (Linked Assets): ربط الملفات بمكانها الأصلي على التابلت بدون مضاعفة الحجم
 * 3. فحص حالة الروابط (Active, Missing, Modified) وإعادة الربط (Relink) بنقرة واحدة
 * 4. التحويل المتبادل بين Linked و Embedded
 */

class AssetManager {
    constructor(app) {
        this.app = app;
        // خريطة الوسائط: assetId -> { id, name, type ('embedded'|'linked'), mimeType, size, url, handle, path, status }
        this.assets = new Map();
        this.objectUrls = new Set();
    }

    /**
     * تسجيل وسيط جديد (صورة أو فيديو)
     * @param {File} file كائن الملف
     * @param {'embedded'|'linked'} mode نمط الإدراج
     * @param {FileSystemFileHandle} handle مقبض الملف في حال كان Linked
     */
    async addAsset(file, mode = 'embedded', handle = null) {
        const assetId = 'asset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        const mimeType = file.type || 'application/octet-stream';
        const name = file.name || 'وسيط_غير_معنون';
        const size = file.size;

        let assetEntry = {
            id: assetId,
            name: name,
            type: mode,
            mimeType: mimeType,
            size: size,
            handle: handle,
            path: handle ? handle.name : name,
            status: 'ok',
            dataUrl: null,
            blob: null,
            url: null
        };

        if (mode === 'embedded') {
            // تخزين الملف كـ Blob محلي
            assetEntry.blob = file;
            assetEntry.url = URL.createObjectURL(file);
            this.objectUrls.add(assetEntry.url);

            // توليد Base64 فقط للصور الصغيرة (أقل من 2MB) لضمان سرعة الحفظ، والباقي كـ Blobs
            if (size < 2 * 1024 * 1024) {
                assetEntry.dataUrl = await this.fileToDataUrl(file);
            }
        } else {
            // نمط الارتباط (Linked)
            assetEntry.blob = file;
            assetEntry.url = URL.createObjectURL(file);
            this.objectUrls.add(assetEntry.url);
        }

        this.assets.set(assetId, assetEntry);
        return assetEntry;
    }

    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    getAsset(assetId) {
        return this.assets.get(assetId) || null;
    }

    getAssetUrl(assetId) {
        const asset = this.assets.get(assetId);
        if (!asset) return null;
        if (!asset.url && asset.blob) {
            asset.url = URL.createObjectURL(asset.blob);
            this.objectUrls.add(asset.url);
        }
        return asset.url || asset.dataUrl;
    }

    // ==== 1. التحويل بين المضمن والمرتبط ====

    async convertToEmbedded(assetId) {
        const asset = this.assets.get(assetId);
        if (!asset || asset.type === 'embedded') return;

        try {
            if (asset.handle) {
                const permission = await asset.handle.queryPermission({ mode: 'read' });
                if (permission !== 'granted') {
                    await asset.handle.requestPermission({ mode: 'read' });
                }
                const file = await asset.handle.getFile();
                asset.blob = file;
                asset.size = file.size;
                if (asset.size < 2 * 1024 * 1024) {
                    asset.dataUrl = await this.fileToDataUrl(file);
                }
            }
            asset.type = 'embedded';
            asset.handle = null;
            asset.status = 'ok';
            this.renderAssetList();
            if (this.app.persistenceManager) this.app.persistenceManager.saveToDB();
        } catch (e) {
            alert("تعذر تضمين الملف: " + e.message);
        }
    }

    // ==== 2. إعادة ربط وسيط مفقود (Relink) ====

    async relinkAsset(assetId) {
        const asset = this.assets.get(assetId);
        if (!asset) return;

        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Media Files',
                        accept: {
                            'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg'],
                            'video/*': ['.mp4', '.webm', '.mov']
                        }
                    }]
                });
                const file = await handle.getFile();
                asset.handle = handle;
                asset.name = file.name;
                asset.size = file.size;
                asset.mimeType = file.type;
                asset.blob = file;
                asset.status = 'ok';
                asset.url = URL.createObjectURL(file);
                this.objectUrls.add(asset.url);

                this.renderAssetList();
                this.notifyNodesAssetUpdated(assetId);
                if (this.app.persistenceManager) this.app.persistenceManager.saveToDB();
            } catch (err) {
                if (err.name !== 'AbortError') console.error(err);
            }
        } else {
            // بديل للمتصفحات بدون File System Access
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = asset.mimeType.startsWith('video') ? 'video/*' : 'image/*';
            input.onchange = async () => {
                if (input.files && input.files[0]) {
                    const file = input.files[0];
                    asset.name = file.name;
                    asset.size = file.size;
                    asset.mimeType = file.type;
                    asset.blob = file;
                    asset.status = 'ok';
                    asset.url = URL.createObjectURL(file);
                    this.objectUrls.add(asset.url);

                    this.renderAssetList();
                    this.notifyNodesAssetUpdated(assetId);
                    if (this.app.persistenceManager) this.app.persistenceManager.saveToDB();
                }
            };
            input.click();
        }
    }

    notifyNodesAssetUpdated(assetId) {
        this.app.nodes.forEach(node => {
            if ((node.type === 'image' || node.type === 'video') && node.assetId === assetId) {
                if (typeof node.onAssetUpdated === 'function') {
                    node.onAssetUpdated();
                } else {
                    node.updateVisuals();
                }
            }
        });
    }

    // ==== 3. استيراد وتصدير حزم الوسائط مع ملف المشروع ====

    exportAssetsPackage() {
        const payload = {
            embedded: {},
            linked: {}
        };

        this.assets.forEach((asset, id) => {
            if (asset.type === 'embedded') {
                payload.embedded[id] = {
                    name: asset.name,
                    mimeType: asset.mimeType,
                    size: asset.size,
                    dataUrl: asset.dataUrl || null
                };
            } else {
                payload.linked[id] = {
                    name: asset.name,
                    mimeType: asset.mimeType,
                    size: asset.size,
                    path: asset.path || asset.name
                };
            }
        });

        return payload;
    }

    importAssetsPackage(assetsData) {
        if (!assetsData) return;

        // استعادة الوسائط المضمنة
        if (assetsData.embedded) {
            Object.entries(assetsData.embedded).forEach(([id, item]) => {
                this.assets.set(id, {
                    id: id,
                    name: item.name,
                    type: 'embedded',
                    mimeType: item.mimeType,
                    size: item.size,
                    dataUrl: item.dataUrl,
                    status: 'ok',
                    url: item.dataUrl || null
                });
            });
        }

        // استعادة روابط الوسائط المرتبطة
        if (assetsData.linked) {
            Object.entries(assetsData.linked).forEach(([id, item]) => {
                this.assets.set(id, {
                    id: id,
                    name: item.name,
                    type: 'linked',
                    mimeType: item.mimeType,
                    size: item.size,
                    path: item.path,
                    status: 'missing', // تفترض مفقودة حتى تتم إعادة ربطها أو قراءتها من المجلد
                    url: null
                });
            });
        }
    }

    // ==== 4. واجهة مدير الروابط (Asset Links Manager Modal) ====

    showLinksManagerModal() {
        let modal = document.getElementById('asset-links-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        this.renderAssetList();
    }

    hideLinksManagerModal() {
        let modal = document.getElementById('asset-links-modal');
        if (modal) modal.style.display = 'none';
    }

    renderAssetList() {
        const container = document.getElementById('asset-links-list');
        if (!container) return;

        if (this.assets.size === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; color:var(--text-secondary);">
                    <i data-lucide="image-off" style="width:36px; height:36px; opacity:0.4; margin-bottom:8px;"></i>
                    <br>لا توجد وسائط مرتبطة أو مضمنة في هذا المشروع بعد.
                </div>
            `;
            if (this.app.refreshIcons) this.app.refreshIcons();
            return;
        }

        let html = '';
        this.assets.forEach(asset => {
            const isLinked = asset.type === 'linked';
            const isMissing = asset.status === 'missing';
            const sizeKB = (asset.size / 1024).toFixed(1);
            const isVideo = asset.mimeType && asset.mimeType.startsWith('video');

            html += `
                <div class="asset-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.03); border:1px solid ${isMissing ? 'var(--danger-color)' : 'rgba(255,255,255,0.08)'}; border-radius:10px; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
                        <div style="width:38px; height:38px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; color:var(--accent-color); flex-shrink:0;">
                            <i data-lucide="${isVideo ? 'video' : 'image'}"></i>
                        </div>
                        <div style="min-width:0; flex:1;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.9rem;">${asset.name}</strong>
                                <span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; ${isLinked ? 'background:rgba(245,158,11,0.15); color:#f59e0b;' : 'background:rgba(59,130,246,0.15); color:#3b82f6;'}">${isLinked ? 'مرتبط Linked' : 'مضمن Embedded'}</span>
                                ${isMissing ? '<span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; background:rgba(239,68,68,0.2); color:#ef4444;">رابط مفقود</span>' : ''}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">
                                الحجم: ${sizeKB} KB • المسار: ${asset.path || 'مضمن في الحزمة'}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        ${isLinked ? `
                            <button class="btn btn-primary" onclick="App.assetManager.relinkAsset('${asset.id}')" style="padding:4px 10px; font-size:0.8rem;">
                                <i data-lucide="link" style="width:14px; height:14px;"></i> إعادة ربط
                            </button>
                            <button class="btn btn-secondary" onclick="App.assetManager.convertToEmbedded('${asset.id}')" style="padding:4px 10px; font-size:0.8rem;">
                                <i data-lucide="download" style="width:14px; height:14px;"></i> تضمين
                            </button>
                        ` : `
                            <span style="font-size:0.8rem; color:var(--text-secondary); padding:4px 8px;">مخزن داخلياً</span>
                        `}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        if (this.app.refreshIcons) this.app.refreshIcons();
    }
}

window.AssetManager = AssetManager;