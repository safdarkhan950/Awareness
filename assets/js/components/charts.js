const ChartComponents = {
    renderWeightChart(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        // Static mock arrays mapping your weight journey
        const mockDates = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
        
        // Bypassing bracket limitations with Array.of
        const mockWeights = Array.of(265, 261, 256, 252, 249, 247);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: mockDates,
                datasets: [{
                    label: 'Weight (lbs)',
                    data: mockWeights,
                    borderColor: '#10b981', 
                    backgroundColor: 'rgba(16, 185, 129, 0.04)',
                    borderWidth: 3,
                    pointBackgroundColor: '#10b981',
                    tension: 0.25,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }
};
