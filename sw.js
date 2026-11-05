const CACHE_NAME = 'antigravity-tablet-v2';

const STATIC_ASSETS = [
    './',
    './nods%20app.html',
    './nods app.html',
    './manifest.json',
    './css/base.css',
    './css/components/node.css',
    './css/components/text-node.css',
    './css/components/ui.css',
    './css/components/drawing.css',
    './css/components/image.css',
    './css/components/image-viewer.css',
    './css/components/folder.css',
    './css/components/sprite-editor.css',
    './css/components/empty-node.css',
    './css/new-styles.css',
    './css/components/container.css',
    './css/components/properties-panel.css',
    './css/components/capsule-input.css',
    './css/components/number-node.css',
    './asset/icons/node_modules/lucide/dist/umd/lucide.min.js',
    './js/icon-data.js',
    './js/components/CapsuleInput.js',
    './js/DrawingEditor.js',
    './js/ImageViewer.js',
    './js/nodes/BaseNode.js',
    './js/nodes/EmptyNode.js',
    './js/nodes/IconNode.js',
    './js/nodes/NumberNode.js',
    './js/nodes/SpriteNode.js',
    './js/nodes/TextNode.js',
    './js/nodes/TextWithTitleNode.js',
    './js/nodes/CodeNode.js',
    './js/nodes/ImageNode.js',
    './js/nodes/VideoNode.js',
    './js/nodes/DrawingNode.js',
    './js/nodes/FolderNode.js',
    './js/nodes/ContainerNode.js',
    './js/modules/media/AssetManager.js',
    './js/modules/storage/StorageEngine.js',
    './js/modules/PersistenceModule.js',
    './js/modules/tablet/TabletGestureEngine.js',
    './js/modules/history/CommandManager.js',
    './js/modules/NodeManager.js',
    './js/modules/RenderManager.js',
    './js/modules/WorkspaceModule.js',
    './js/modules/SnapModule.js',
    './js/modules/UIModule.js',
    './js/modules/InputModule.js',
    './js/modules/EventModule.js',
    './js/modules/SpriteEditor.js',
    './js/modules/actions/NodeOperations.js',
    './js/modules/actions/ContainerOperations.js',
    './js/modules/events/ViewportEvents.js',
    './js/modules/events/DragDropEvents.js',
    './js/modules/events/PointerEvents.js',
    './js/modules/events/ShortcutEvents.js',
    './js/modules/events/TooltipEvents.js',
    './js/modules/ui/ComponentsUI.js',
    './js/modules/ui/LayoutSettingsUI.js',
    './js/modules/ui/SidebarManager.js',
    './js/modules/ui/ToolbarManager.js',
    './js/modules/ui/ToolbarUpdater.js',
    './js/modules/ui/FocusManager.js',
    './js/modules/ui/GridManager.js',
    './js/modules/ui/TextEditorUI.js',
    './js/modules/ui/CapsuleEditUI.js',
    './js/modules/ui/FolderNamingUI.js',
    './js/modules/ui/ColorPickerUI.js',
    './js/App.js',
    './js/main.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('بعض الملفات لم تخزن تلقائياً، ستخزن عند أول طلب:', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
                fetch(e.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
                    }
                }).catch(() => { });
                return cachedResponse;
            }

            return fetch(e.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                if (e.request.destination === 'document') {
                    return caches.match('./nods app.html') || caches.match('./nods%20app.html');
                }
            });
        })
    );
});