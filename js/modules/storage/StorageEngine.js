/**
 * StorageEngine.js
 * المحرك المركزي لإدارة نظام الملفات المحلي لأجهزة التابلت وحزم الوسائط .agp
 */

class StorageEngine {
    constructor() {
        this.dirHandle = null;
        this.opfsRoot = null;
        this.isFSAAvailable = 'showDirectoryPicker' in window;
        this.db = null;
        this.init();
    }

    async init() {
        try {
            if (navigator.storage && navigator.storage.getDirectory) {
                this.opfsRoot = await navigator.storage.getDirectory();
            }
            await this.initIndexedDB();
            await this.restoreDirectoryHandle();
        } catch (e) {
            console.error("StorageEngine Init Failed:", e);
        }
    }

    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('AntiGravity_StorageRegistry', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles', { keyPath: 'key' });
                }
            };
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    }

    async pickDirectory() {
        if (!this.isFSAAvailable) {
            alert("متصفح هذا الجهاز لا يدعم اختيار المجلدات المباشرة. سيتم استخدام التخزين المحلي الآمن OPFS مع إمكانية التصدير كملف .agp.");
            return null;
        }

        try {
            this.dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                id: 'antigravity_workspace'
            });

            await this.saveDirectoryHandle(this.dirHandle);
            return this.dirHandle.name;
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error("خطأ أثناء اختيار المجلد:", e);
            }
            return null;
        }
    }

    async saveDirectoryHandle(handle) {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put({ key: 'current_dir', handle: handle });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async restoreDirectoryHandle() {
        if (!this.db || !this.isFSAAvailable) return;
        return new Promise((resolve) => {
            const tx = this.db.transaction('handles', 'readonly');
            const req = tx.objectStore('handles').get('current_dir');
            req.onsuccess = async () => {
                if (req.result && req.result.handle) {
                    const handle = req.result.handle;
                    const permission = await handle.queryPermission({ mode: 'readwrite' });
                    if (permission === 'granted') {
                        this.dirHandle = handle;
                    }
                }
                resolve();
            };
            req.onerror = () => resolve();
        });
    }

    async getActiveDirectoryName() {
        if (this.dirHandle) return this.dirHandle.name;
        return null;
    }

    // ==== 1. بناء حزمة المشروع مع الوسائط المضمنة والمرتبطة ====

    createPackagePayload(projectData) {
        let assetsPayload = { embedded: {}, linked: {} };
        if (window.App && window.App.assetManager) {
            assetsPayload = window.App.assetManager.exportAssetsPackage();
        }

        return {
            format: "antigravity-project",
            version: 2,
            id: projectData.id || ('proj-' + Date.now()),
            name: projectData.name || 'مشروع تابلت',
            createdAt: projectData.createdAt || Date.now(),
            modifiedAt: Date.now(),
            settings: {
                theme: projectData.theme || 'dark',
                panX: projectData.panX || 0,
                panY: projectData.panY || 0,
                scale: projectData.scale || 1,
                currentWorkspaceId: projectData.currentWorkspaceId || 'root'
            },
            workspaces: projectData.workspaces || [],
            assets: assetsPayload
        };
    }

    // ==== 2. الحفظ في القرص أو OPFS ====

    async saveProjectToDisk(projectData) {
        const payload = this.createPackagePayload(projectData);
        const fileName = `${payload.name.replace(/[\\/:*?"<>|]/g, '_')}.agp`;
        const jsonContent = JSON.stringify(payload, null, 2);

        if (this.dirHandle) {
            try {
                const permission = await this.dirHandle.requestPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    const fileHandle = await this.dirHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(jsonContent);
                    await writable.close();
                    return { success: true, destination: 'directory', path: `${this.dirHandle.name}/${fileName}` };
                }
            } catch (err) {
                console.warn("تعذر الحفظ في المجلد المختار:", err);
            }
        }

        if (this.opfsRoot) {
            try {
                const projectsDir = await this.opfsRoot.getDirectoryHandle('projects', { create: true });
                const fileHandle = await projectsDir.getFileHandle(`${payload.id}.agp`, { create: true });
                const accessHandle = await fileHandle.createWritable();
                await accessHandle.write(jsonContent);
                await accessHandle.close();
            } catch (err) {
                console.warn("OPFS write error:", err);
            }
        }

        return { success: true, destination: 'internal', fileName: fileName, payload: payload };
    }

    // ==== 3. قراءة الحزمة واستعادة الوسائط ====

    async loadProjectFromFile(file) {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.format || data.format !== 'antigravity-project') {
            if (data.workspaces) return this.createPackagePayload(data);
            throw new Error("صيغة الملف غير مدعومة أو غير صالحة.");
        }

        // استعادة روابط ومحتويات الوسائط داخل مدير الوسائط
        if (data.assets && window.App && window.App.assetManager) {
            window.App.assetManager.importAssetsPackage(data.assets);
        }

        return data;
    }

    exportProjectAsFile(projectData) {
        const payload = this.createPackagePayload(projectData);
        const jsonContent = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${payload.name || 'project'}.agp`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

window.StorageEngine = new StorageEngine();