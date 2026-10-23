const ChartComponents = {
    charts: new Map(),

    createChart(canvasId, type, labels, datasets, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        this.charts.get(canvasId)?.destroy();

        const chart = new Chart(canvas, {
            type,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: options.plugins || { legend: { display: false } },
                scales: options.scales || {}
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    },

    createLineChart(canvasId, labels, values, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        this.charts.get(canvasId)?.destroy();

        const chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: options.label || '',
                    data: values,
                    borderColor: options.borderColor || '#10b981',
                    backgroundColor: options.backgroundColor || 'rgba(16, 185, 129, 0.04)',
                    borderWidth: options.borderWidth || 3,
                    pointBackgroundColor: options.pointBackgroundColor || options.borderColor || '#10b981',
                    tension: options.tension ?? 0.25,
                    fill: options.fill ?? true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: options.scales || {}
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    },

    createBarChart(canvasId, labels, datasets, options = {}) {
        return this.createChart(canvasId, 'bar', labels, datasets, options);
    }
};
