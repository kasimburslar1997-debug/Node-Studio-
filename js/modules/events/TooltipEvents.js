// TooltipEvents.js - Tooltip and hover display logic
Object.assign(App, {
    _bindTooltipEvents() {
        document.addEventListener("mouseover", e => {
            const t = e.target.closest("[data-tooltip]");
            if (t) {
                this.ui.tooltip.textContent = t.dataset.tooltip;
                this.ui.tooltip.style.opacity = 1;

                const r = t.getBoundingClientRect();
                const tooltipWidth = this.ui.tooltip.offsetWidth || 100; // Est if not rendered yet
                const tooltipHeight = this.ui.tooltip.offsetHeight || 30;

                let left = r.left + r.width / 2;
                let top = r.top;

                // Vertical Check: If off top, show below
                if (top < tooltipHeight + 10) {
                    top = r.bottom + tooltipHeight + 10; // +10 margin
                    // We need to change transform too if we flip?
                    // CSS has `transform: translate(-50%, -100%)` which moves it UP.
                    // If we want to show BELOW, we should cancel the -100% Y translate.
                    // Instead of mess with classes, let's just adjust TOP calculation.
                    // Default: top = r.top. CSS moves it up 100%.
                    // If we set top = r.bottom + Height, CSS moves it up 100% -> it lands on r.bottom.
                    // No. `translate(-50%, -100%)` means the element's bottom anchor is at `top`.
                    // So if we put `top` at `r.top`, the tooltip sits above `r.top`.
                    // If we want it BELOW:
                    // We want the tooltip's TOP to be at `r.bottom`.
                    // So we need to offset the CSS translation.
                    // Let's rely on adding a class for "bottom" styling, or override transform inline.
                    this.ui.tooltip.style.transform = "translate(-50%, 0)";
                    this.ui.tooltip.style.marginTop = "8px";
                    top = r.bottom;
                } else {
                    // Default Top
                    this.ui.tooltip.style.transform = "translate(-50%, -100%)";
                    this.ui.tooltip.style.marginTop = "-8px";
                    top = r.top;
                }

                // Horizontal Check
                const margin = 10;
                if (left - tooltipWidth / 2 < margin) {
                    // Too far left
                    // Instead of changing `left`, which is the anchor, we can shift transform?
                    // Easiest is to keep center anchor but clamp `left`?
                    // But if we clamp `left`, the arrow (if any) won't point to element.
                    // This tooltip seems simple (no arrow).
                    left = Math.max(left, tooltipWidth / 2 + margin);
                } else if (left + tooltipWidth / 2 > window.innerWidth - margin) {
                    // Too far right
                    left = Math.min(left, window.innerWidth - tooltipWidth / 2 - margin);
                }

                this.ui.tooltip.style.left = `${left}px`;
                this.ui.tooltip.style.top = `${top}px`;
            } else {
                this.ui.tooltip.style.opacity = 0;
            }
        });
    }
});
