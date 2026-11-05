/**
 * main.js
 * نقطة الانطلاق الأساسية للتطبيق مع نظام حماية الإقلاع الذاتي
 */

window.onload = () => {
    // 1. تشغيل محرر الشرائح مع حماية من الأخطاء
    try {
        if (typeof SpriteEditor !== 'undefined') {
            App.spriteEditor = new SpriteEditor(App);
        }
    } catch (err) {
        console.warn("تنبيه محرر الشرائح:", err);
    }

    // 2. تشغيل التطبيق الأساسي (مضمون العمل دائماً)
    try {
        App.init();
    } catch (err) {
        console.error("خطأ حرج أثناء تشغيل App.init:", err);
    }

    // 3. إعداد مستمعي إخفاء التحديد
    try {
        if (typeof App.setupHideSelectionListeners === 'function') {
            App.setupHideSelectionListeners();
        }
    } catch (err) {
        console.warn("تنبيه setupHideSelectionListeners:", err);
    }
};