/**
 * GridManager.js
 * مسؤول عن التحكم وتصميم الشبكة (Grid) في خلفية اللوحة اللانهائية.
 */

Object.assign(App, {
    setGridType(type) {
        const bg = document.getElementById("infinite-bg");
        this.state.gridType = type;

        // Update UI Tabs
        document.querySelectorAll('.grid-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
            if (btn.classList.contains('active')) {
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.color = 'var(--text-primary)';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-secondary)';
            }
        });

        if (type === "none") {
            bg.style.display = "none";
        } else {
            bg.style.display = "block";

            if (type === "dots") {
                bg.style.backgroundImage = "radial-gradient(var(--grid-dot) var(--grid-thickness), transparent var(--grid-thickness))";
            } else if (type === "lines") {
                bg.style.backgroundImage = "linear-gradient(var(--grid-dot) var(--grid-thickness), transparent var(--grid-thickness)), linear-gradient(90deg, var(--grid-dot) var(--grid-thickness), transparent var(--grid-thickness))";
            } else if (type === "random") {
                // Generate Canvas Pattern for Random Opacity
                const pattern = this.generateRandomGridPattern();
                bg.style.backgroundImage = `url(${pattern})`;
            }
        }
    },

    generateRandomGridPattern() {
        // Create small tileable canvas
        const size = this.state.gridSize ? parseInt(this.state.gridSize) * 5 : 200; // 5x5 tile based on grid size
        const gridSize = this.state.gridSize ? parseInt(this.state.gridSize) : 40;
        const thickness = this.state.gridThickness || 1.5;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const rawColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-dot').trim() || '#444444';
        const tileCount = 5;

        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                // Random Opacity between 0.1 and 1.0
                const opacity = 0.1 + Math.random() * 0.9;
                ctx.fillStyle = rawColor;
                ctx.globalAlpha = opacity;

                ctx.beginPath();
                // Dot center
                ctx.arc(x * gridSize + gridSize / 2, y * gridSize + gridSize / 2, thickness, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        return canvas.toDataURL();
    },

    toggleGridVignette(active) {
        const bg = document.getElementById("infinite-bg");
        if (active) {
            bg.style.maskImage = "radial-gradient(circle, black 30%, transparent 100%)";
            bg.style.webkitMaskImage = "radial-gradient(circle, black 30%, transparent 100%)";
        } else {
            bg.style.maskImage = "none";
            bg.style.webkitMaskImage = "none";
        }
    },

    setGridColor(c) {
        document.documentElement.style.setProperty("--grid-dot", c);
        // If random, we need to regenerate the pattern to apply new color
        if (this.state.gridType === 'random') {
            this.setGridType('random');
        }
    },

    setGridThickness(val) {
        this.state.gridThickness = parseFloat(val);
        document.documentElement.style.setProperty("--grid-thickness", `${val}px`);
        if (this.state.gridType === 'random') {
            this.setGridType('random');
        }
    },

    setGridOpacity(val) {
        document.getElementById("infinite-bg").style.opacity = val;
    },

    setGridSize(val) {
        this.state.gridSize = parseInt(val);
        // If random, regenerate pattern first
        if (this.state.gridType === 'random') {
            this.setGridType('random');
        }
        // Always update view to apply new background size
        if (this.renderManager) {
            this.renderManager.requestViewUpdate();
        }
    },

    setGridStatic(val) {
        this.state.gridStatic = val;
        this.renderManager.requestViewUpdate();
    }
});
