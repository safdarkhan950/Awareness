document.addEventListener("DOMContentLoaded", () => {
    console.log("Awareness Engine Booted: Multi-Tab Sandbox Mode Operational.");

    // 1. Force the Sandbox Open
    document.getElementById('lockscreen').classList.add('d-none');
    document.getElementById('dashboard-contents').classList.remove('d-none');

    // 2. Render core weight chart baseline
    if (typeof ChartComponents !== 'undefined') {
        ChartComponents.renderWeightChart('chart-weight');
    }
    if (typeof WellnessComponents !== 'undefined') {
        WellnessComponents.renderLogTable('table-wellness');
    }

    // 3. Tab Switching Architecture
    const tabs = ['wellness', 'budget', 'investment', 'dividends'];
    
    tabs.forEach(tabId => {
        const button = document.getElementById(`tab-${tabId}`);
        if (!button) return;

        button.addEventListener('click', () => {
            // Hide all view panels and strip button states
            tabs.forEach(id => {
                document.getElementById(`panel-${id}`).classList.add('d-none');
                
                const btn = document.getElementById(`tab-${id}`);
                btn.classList.remove('btn-success', 'active');
                btn.classList.add('btn-outline-secondary', 'text-light', 'border-0');
            });

            // Reveal the active target panel
            document.getElementById(`panel-${tabId}`).classList.remove('d-none');

            // Style the active button click highlight
            button.classList.remove('btn-outline-secondary', 'text-light', 'border-0');
            button.classList.add('btn-success', 'active');
        });
    });
});
