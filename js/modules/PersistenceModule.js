/**
 * PersistenceModule.js
 * وحدة الربط بين واجهة التطبيق ومحرك التخزين المحلي StorageEngine وقاعدة البيانات IndexedDB
 */

class PersistenceModule {
    constructor(app) {
        this.app = app;
        this.dbName = 'AntigravityDB';
        this.storeName = 'workspace_state';
        this.db = null;
        this.autoSaveInterval = null;
        this.activeProjectId = localStorage.getItem('antigravity_active_project_id') || 'current_session';
        this.storageEngine = window.StorageEngine;
    }

    async init() {
        try {
            await this.openDB();
            await this.loadActiveProject();
            this.startAutoSave();
            this.updateDirectoryUI();
        } catch (e) {
            console.error("PersistenceModule Init Error:", e);
        }
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2);

            request.onerror = (event) => reject("IndexedDB error: " + event.target.errorCode);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
        });
    }

    async getRawProjectData(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve(null);
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (e) => reject(e);
        });
    }

    async saveRawProjectData(data) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    async loadActiveProject() {
        try {
            let data = await this.getRawProjectData(this.activeProjectId);
            if (!data) {
                this.activeProjectId = 'current_session';
                localStorage.setItem('antigravity_active_project_id', 'current_session');
                data = await this.getRawProjectData('current_session');
            }

            if (data) {
                this.restoreState(data);
                this.updateActiveProjectNameUI(data.name || "المشروع الرئيسي");
            } else {
                await this.createInitialDefaultProject();
            }
        } catch (e) {
            console.error("Load Active Project Error:", e);
        }
    }

    async createInitialDefaultProject() {
        this.activeProjectId = 'current_session';
        localStorage.setItem('antigravity_active_project_id', 'current_session');

        if (this.app.saveCurrentWorkspace) this.app.saveCurrentWorkspace();
        const workspaces = Array.from(this.app.workspaces.entries());

        const data = {
            id: 'current_session',
            name: "المشروع الرئيسي (الافتراضي)",
            createdAt: Date.now(),
            timestamp: Date.now(),
            workspaces: workspaces,
            currentWorkspaceId: this.app.currentWorkspaceId || "root",
            panX: this.app.state.panX,
            panY: this.app.state.panY,
            scale: this.app.state.scale,
            theme: document.body.getAttribute('data-theme') || 'dark'
        };

        await this.saveRawProjectData(data);
        this.updateActiveProjectNameUI(data.name);
    }

    updateActiveProjectNameUI(name) {
        const display = document.getElementById('active-project-name-display');
        if (display) display.textContent = name;
    }

    async updateDirectoryUI() {
        const dirDisplay = document.getElementById('active-dir-name-display');
        if (dirDisplay) {
            const dirName = await this.storageEngine.getActiveDirectoryName();
            dirDisplay.textContent = dirName ? `المجلد المختار: ${dirName}` : "مجلد التخزين: الذاكرة المحلية للتطبيق (OPFS)";
        }
    }

    // ==== الحفظ التلقائي والسريع ====

    async saveToDB() {
        if (!this.db) return;

        if (this.app.saveCurrentWorkspace) this.app.saveCurrentWorkspace();

        let projectName = "مشروع تابلت";
        let createdAt = Date.now();

        try {
            const currentProj = await this.getRawProjectData(this.activeProjectId);
            if (currentProj) {
                projectName = currentProj.name || projectName;
                createdAt = currentProj.createdAt || createdAt;
            }
        } catch (e) { }

        const projectPayload = {
            id: this.activeProjectId,
            name: projectName,
            createdAt: createdAt,
            timestamp: Date.now(),
            workspaces: Array.from(this.app.workspaces.entries()),
            currentWorkspaceId: this.app.currentWorkspaceId,
            panX: this.app.state.panX,
            panY: this.app.state.panY,
            scale: this.app.state.scale,
            theme: document.body.getAttribute('data-theme') || 'dark'
        };

        // 1. الحفظ في IndexedDB
        await this.saveRawProjectData(projectPayload);

        // 2. الحفظ عبر StorageEngine في المجلد المختار أو الـ OPFS
        await this.storageEngine.saveProjectToDisk(projectPayload);

        this.updateActiveProjectNameUI(projectName);
    }

    startAutoSave() {
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = setInterval(() => {
            this.saveToDB().catch(console.error);
        }, 5000);
    }

    // ==== اختيار مجلد الحفظ المباشر على التابلت ====

    async promptSelectDirectory() {
        const dirName = await this.storageEngine.pickDirectory();
        if (dirName) {
            await this.updateDirectoryUI();
            await this.saveToDB();
            alert(`تم تعيين المجلد "${dirName}" بنجاح! سيتم حفظ ومزامنة مشروعك فيه بصيغة .agp.`);
        }
    }

    // ==== تصدير واستيراد بصيغة التطبيق .agp ====

    async exportActiveProjectPackage() {
        await this.saveToDB();
        const currentProj = await this.getRawProjectData(this.activeProjectId);
        if (currentProj) {
            this.storageEngine.exportProjectAsFile(currentProj);
        }
    }

    async handleImportFile(input) {
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];

        try {
            const projectData = await this.storageEngine.loadProjectFromFile(file);
            const newId = 'proj-' + Date.now();
            projectData.id = newId;

            await this.saveRawProjectData(projectData);
            await this.loadProject(newId);

            input.value = '';
            alert(`تم استيراد وفتح مشروع "${projectData.name}" بنجاح!`);
        } catch (err) {
            alert("حدث خطأ أثناء قراءة الحزمة: " + err.message);
        }
    }

    restoreState(data) {
        if (data.workspaces) {
            this.app.workspaces = new Map(data.workspaces);
        }

        if (data.settings && data.settings.theme) {
            document.body.setAttribute('data-theme', data.settings.theme);
        } else if (data.theme) {
            document.body.setAttribute('data-theme', data.theme);
        }

        const canvasContent = document.getElementById("canvas-content");
        if (canvasContent) canvasContent.innerHTML = "";
        if (this.app.nodes) this.app.nodes.clear();
        if (this.app.selected) this.app.selected.clear();

        const targetWorkspace = (data.settings && data.settings.currentWorkspaceId) || data.currentWorkspaceId || "root";

        if (this.app.loadWorkspace) {
            this.app.currentWorkspaceId = targetWorkspace;
            if (data.panX !== undefined) this.app.state.panX = data.panX;
            if (data.panY !== undefined) this.app.state.panY = data.panY;
            if (data.scale !== undefined) this.app.state.scale = data.scale;

            this.app.loadWorkspace(targetWorkspace);
        }

        if (this.app.refreshIcons) setTimeout(() => this.app.refreshIcons(), 50);
    }

    // ==== مدير المشاريع بالواجهة ====

    async showProjectsManager() {
        const modal = document.getElementById('projects-modal');
        if (!modal) return;
        await this.saveToDB().catch(console.error);
        await this.updateDirectoryUI();
        modal.style.display = 'flex';
        modal.classList.add('visible');
        await this.renderProjectsList();
    }

    hideProjectsManager() {
        const modal = document.getElementById('projects-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('visible');
        }
    }

    async renderProjectsList(filterQuery = '') {
        const listContainer = document.getElementById('projects-list-container');
        if (!listContainer) return;

        try {
            const projects = await this.getAllProjects();
            const query = filterQuery.trim().toLowerCase();
            const filtered = projects.filter(p => (p.name || '').toLowerCase().includes(query));

            if (filtered.length === 0) {
                listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">لا توجد مشاريع مطابقة.</div>`;
                return;
            }

            let html = '';
            filtered.forEach(proj => {
                const isActive = proj.id === this.activeProjectId;
                html += `
                    <div class="project-item ${isActive ? 'active' : ''}" style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.03); border:1px solid ${isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.06)'}; border-radius:10px; margin-bottom:8px;">
                        <div>
                            <strong style="color:${isActive ? 'var(--accent-color)' : 'inherit'}">${proj.name || 'بدون اسم'}</strong>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">تاريخ التعديل: ${new Date(proj.timestamp || Date.now()).toLocaleDateString('ar-EG')}</div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            ${!isActive ? `<button class="btn btn-primary" onclick="App.persistenceManager.loadProject('${proj.id}')" style="padding:4px 10px; font-size:0.8rem;">فتح</button>` : '<span style="font-size:0.8rem; color:var(--accent-color); padding:4px 8px;">النشط حالياً</span>'}
                            <button class="btn btn-secondary" onclick="App.persistenceManager.exportProjectDirect('${proj.id}')" style="padding:4px 10px; font-size:0.8rem;">تصدير .agp</button>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
        } catch (e) {
            console.error(e);
        }
    }

    async getAllProjects() {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction([this.storeName], 'readonly');
            const req = tx.objectStore(this.storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async loadProject(id) {
        if (id === this.activeProjectId) return;
        await this.saveToDB();
        const data = await this.getRawProjectData(id);
        if (data) {
            this.activeProjectId = id;
            localStorage.setItem('antigravity_active_project_id', id);
            this.restoreState(data);
            this.updateActiveProjectNameUI(data.name || 'مشروع تابلت');
            this.hideProjectsManager();
        }
    }

    async promptNewProject() {
        const name = prompt("أدخل اسم المشروع الجديد:");
        if (name === null) return;

        const cleanName = name.trim() || `مشروع جديد (${new Date().toLocaleDateString('ar-EG')})`;
        await this.saveToDB();

        this.app.workspaces.clear();
        this.app.nodes.clear();
        if (this.app.selected) this.app.selected.clear();
        this.app.currentWorkspaceId = "root";

        this.app.state.scale = 1;
        this.app.state.panX = window.innerWidth / 2;
        this.app.state.panY = window.innerHeight / 2;

        this.app.workspaces.set("root", {
            nodes: [],
            panX: window.innerWidth / 2,
            panY: window.innerHeight / 2,
            scale: 1
        });

        this.activeProjectId = 'proj-' + Date.now();
        localStorage.setItem('antigravity_active_project_id', this.activeProjectId);

        await this.saveToDB();
        this.updateActiveProjectNameUI(cleanName);
        this.hideProjectsManager();
        if (this.app.centerView) this.app.centerView();
    }

    async exportProjectDirect(id) {
        const proj = await this.getRawProjectData(id);
        if (proj) {
            this.storageEngine.exportProjectAsFile(proj);
        }
    }
}