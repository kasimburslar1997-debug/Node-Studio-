/**
 * CommandManager.js
 * محرك التراجع والإعادة بنمط الأوامر (Command Pattern) الاحترافي
 * يدعم:
 * 1. تراجع وإعادة غير محدودة مع حد أقصى للذاكرة لمنع استهلاك رامات التابلت
 * 2. تجميع العمليات المتعددة في أمر واحد (Batch / Transaction Commands)
 * 3. أوامر النقل، التحجيم، الحذف، التلوين، وإعادة ترتيب الحاويات
 */

class Command {
    execute() {}
    undo() {}
}

// 1. أمر تحريك عقدة أو مجموعة عقد
class MoveNodesCommand extends Command {
    constructor(app, movements) {
        super();
        this.app = app;
        // movements: Array of { id, fromX, fromY, toX, toY }
        this.movements = movements;
    }

    execute() {
        this.movements.forEach(m => {
            const node = this.app.nodes.get(m.id);
            if (node) {
                node.x = m.toX;
                node.y = m.toY;
                node.updateVisuals();
            }
        });
        if (this.app.renderManager) this.app.renderManager.requestViewUpdate();
    }

    undo() {
        this.movements.forEach(m => {
            const node = this.app.nodes.get(m.id);
            if (node) {
                node.x = m.fromX;
                node.y = m.fromY;
                node.updateVisuals();
            }
        });
        if (this.app.renderManager) this.app.renderManager.requestViewUpdate();
    }
}

// 2. أمر تغيير أبعاد ومكان العقدة (Resize)
class ResizeNodeCommand extends Command {
    constructor(app, nodeId, fromRect, toRect) {
        super();
        this.app = app;
        this.nodeId = nodeId;
        this.fromRect = { ...fromRect };
        this.toRect = { ...toRect };
    }

    execute() {
        const node = this.app.nodes.get(this.nodeId);
        if (node) {
            node.resize(this.toRect.w, this.toRect.h, this.toRect.x, this.toRect.y);
            node.updateVisuals();
        }
    }

    undo() {
        const node = this.app.nodes.get(this.nodeId);
        if (node) {
            node.resize(this.fromRect.w, this.fromRect.h, this.fromRect.x, this.fromRect.y);
            node.updateVisuals();
        }
    }
}

// 3. أمر إنشاء عقدة جديدة
class CreateNodeCommand extends Command {
    constructor(app, serializedData, parentId = null, index = -1) {
        super();
        this.app = app;
        this.serializedData = serializedData;
        this.nodeId = serializedData.id;
        this.parentId = parentId;
        this.index = index;
    }

    execute() {
        const node = this.app.createNodeFromData(this.serializedData);
        if (node) {
            if (this.parentId) {
                const parent = this.app.nodes.get(this.parentId);
                if (parent && parent.addChildAt) {
                    parent.addChildAt(node, this.index);
                } else if (parent) {
                    parent.addChild(node);
                }
            } else {
                this.app.addNodeToCanvas(node);
            }
            node.updateVisuals();
            this.app.deselectAll();
            this.app.selectNode(node.id);
        }
    }

    undo() {
        const node = this.app.nodes.get(this.nodeId);
        if (node) {
            if (node.parent) {
                node.parent.removeChild(node);
            }
            if (node.element) node.element.remove();
            this.app.nodes.delete(this.nodeId);
            this.app.selected.delete(this.nodeId);
            this.app.updateToolbar();
        }
    }
}

// 4. أمر حذف عقدة أو مجموعة عقد مع أطفالها
class DeleteNodesCommand extends Command {
    constructor(app, nodesData) {
        super();
        this.app = app;
        // nodesData: Array of { serialized, parentId, index }
        this.nodesData = nodesData;
    }

    execute() {
        this.nodesData.forEach(item => {
            const node = this.app.nodes.get(item.serialized.id);
            if (node) {
                if (node.parent) {
                    node.parent.removeChild(node);
                }
                if (node.element) node.element.remove();
                this.app.nodes.delete(node.id);
                this.app.selected.delete(node.id);
            }
        });
        this.app.deselectAll();
        this.app.updateToolbar();
    }

    undo() {
        this.nodesData.forEach(item => {
            const node = this.app.createNodeFromData(item.serialized);
            if (node) {
                if (item.parentId) {
                    const parent = this.app.nodes.get(item.parentId);
                    if (parent && parent.addChildAt) {
                        parent.addChildAt(node, item.index);
                    } else if (parent) {
                        parent.addChild(node);
                    }
                } else {
                    this.app.addNodeToCanvas(node);
                }
                node.updateVisuals();
            }
        });
        this.app.updateToolbar();
    }
}

// 5. أمر تغيير خصائص التنسيق والألوان
class StylePropertyCommand extends Command {
    constructor(app, nodeIds, propertyPath, oldValues, newValues) {
        super();
        this.app = app;
        this.nodeIds = [...nodeIds];
        this.propertyPath = propertyPath; // e.g., 'styles.fill' or 'styles.radius'
        this.oldValues = new Map(oldValues); // id -> value
        this.newValues = new Map(newValues); // id -> value
    }

    applyVal(id, val) {
        const node = this.app.nodes.get(id);
        if (!node) return;
        const parts = this.propertyPath.split('.');
        if (parts.length === 2) {
            node[parts[0]][parts[1]] = val;
        } else {
            node[this.propertyPath] = val;
        }
        node.updateVisuals();
    }

    execute() {
        this.nodeIds.forEach(id => {
            if (this.newValues.has(id)) this.applyVal(id, this.newValues.get(id));
        });
    }

    undo() {
        this.nodeIds.forEach(id => {
            if (this.oldValues.has(id)) this.applyVal(id, this.oldValues.get(id));
        });
    }
}

// ==== مدير التاريخ والأوامر (Command Manager) ====

class CommandManager {
    constructor(app, maxHistory = 60) {
        this.app = app;
        this.maxHistory = maxHistory;
        this.undoStack = [];
        this.redoStack = [];
        this.batchDepth = 0;
        this.currentBatch = [];
    }

    execute(command) {
        if (!command) return;

        if (this.batchDepth > 0) {
            command.execute();
            this.currentBatch.push(command);
            return;
        }

        command.execute();
        this.undoStack.push(command);
        this.redoStack = []; // إفراغ الـ Redo عند تنفيذ أمر جديد

        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift(); // الحفاظ على حجم الذاكرة
        }

        this.updateUI();
        if (this.app.persistenceManager) {
            this.app.persistenceManager.saveToDB().catch(console.error);
        }
    }

    beginBatch() {
        this.batchDepth++;
    }

    endBatch() {
        if (this.batchDepth <= 0) return;
        this.batchDepth--;

        if (this.batchDepth === 0 && this.currentBatch.length > 0) {
            const batchCommands = [...this.currentBatch];
            this.currentBatch = [];

            const compositeCommand = {
                execute: () => batchCommands.forEach(c => c.execute()),
                undo: () => {
                    for (let i = batchCommands.length - 1; i >= 0; i--) {
                        batchCommands[i].undo();
                    }
                }
            };

            this.undoStack.push(compositeCommand);
            this.redoStack = [];

            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
            }

            this.updateUI();
            if (this.app.persistenceManager) {
                this.app.persistenceManager.saveToDB().catch(console.error);
            }
        }
    }

    undo() {
        if (!this.canUndo()) return;
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        this.updateUI();
        if (this.app.persistenceManager) {
            this.app.persistenceManager.saveToDB().catch(console.error);
        }
    }

    redo() {
        if (!this.canRedo()) return;
        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);
        this.updateUI();
        if (this.app.persistenceManager) {
            this.app.persistenceManager.saveToDB().catch(console.error);
        }
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.updateUI();
    }

    updateUI() {
        const undoBtns = document.querySelectorAll('button[onclick*="undo"]');
        const redoBtns = document.querySelectorAll('button[onclick*="redo"]');

        undoBtns.forEach(btn => {
            btn.style.opacity = this.canUndo() ? '1' : '0.35';
            btn.style.pointerEvents = this.canUndo() ? 'auto' : 'none';
        });

        redoBtns.forEach(btn => {
            btn.style.opacity = this.canRedo() ? '1' : '0.35';
            btn.style.pointerEvents = this.canRedo() ? 'auto' : 'none';
        });
    }
}

// ربط الأوامر بالنافذة العالمية
window.CommandManager = CommandManager;
window.MoveNodesCommand = MoveNodesCommand;
window.ResizeNodeCommand = ResizeNodeCommand;
window.CreateNodeCommand = CreateNodeCommand;
window.DeleteNodesCommand = DeleteNodesCommand;
window.StylePropertyCommand = StylePropertyCommand;