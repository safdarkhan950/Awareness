const WellnessComponents = {
    init() {
        this.render([]);
        document.addEventListener('awareness:data-ready', event => {
            this.render(event.detail.wellness || []);
        });
    },

    parseSheetDate(dateText) {
        const match = dateText.match(/^\d{1,2}\s+([A-Za-z]{3})\s+\d{4}$/);
        if (!match) return null;

        const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            .findIndex(month => month.toLowerCase() === match[1].toLowerCase());
        if (monthIndex === -1) return null;

        const [day, , year] = dateText.split(/\s+/);
        const date = new Date(Date.UTC(Number(year), monthIndex, Number(day)));
        return Number.isNaN(date.getTime()) ? null : date;
    },

    sanitizeRows(rows) {
        return rows
            .slice(2)
            .map(row => {
                const dateText = String(row[0] || '').trim();
                const date = this.parseSheetDate(dateText);
                const weightText = String(row[3] || '').replace(/,/g, '').trim();

                return {
                    date,
                    dateText,
                    weight: weightText ? Number(weightText) : null,
                    diet: String(row[2] || '').trim().toUpperCase(),
                    gym: String(row[4] || '').trim().toUpperCase()
                };
            })
            .filter(row => row.date !== null)
            .filter(row => row.weight === null || Number.isFinite(row.weight));
    },

    aggregateMonthlyActivity(rows) {
        const monthly = new Map();

        rows.forEach(row => {
            const key = `${row.date.getUTCFullYear()}-${String(row.date.getUTCMonth() + 1).padStart(2, '0')}`;
            if (!monthly.has(key)) monthly.set(key, { diet: 0, gym: 0, date: row.date });

            const totals = monthly.get(key);
            if (row.diet === 'Y') totals.diet += 1;
            if (row.gym === 'Y') totals.gym += 1;
        });

        return [...monthly.entries()]
            .filter(([, totals]) => totals.diet > 0 || totals.gym > 0)
            .sort(([first], [second]) => first.localeCompare(second));
    },

    renderSummary(rows) {
        const now = new Date();
        const currentRows = rows.filter(row =>
            row.date.getUTCMonth() === now.getUTCMonth()
            && row.date.getUTCFullYear() === now.getUTCFullYear()
        );
        const dietDays = currentRows.filter(row => row.diet === 'Y').length;
        const gymDays = currentRows.filter(row => row.gym === 'Y').length;

        const dietElement = document.getElementById('wellness-diet-days');
        const gymElement = document.getElementById('wellness-gym-days');
        dietElement.innerHTML = `${dietDays} <span class="fs-6 fw-normal" style="color: #cbd5e1;">days</span>`;
        gymElement.innerHTML = `${gymDays} <span class="fs-6 fw-normal" style="color: #cbd5e1;">days</span>`;
        dietElement.className = `mt-2 mb-0 fw-bold ${dietDays >= 20 ? 'text-success' : 'text-danger'}`;
        gymElement.className = `mt-2 mb-0 fw-bold ${gymDays >= 20 ? 'text-success' : 'text-danger'}`;
    },

    renderActivityChart(rows) {
        const monthlyRows = this.aggregateMonthlyActivity(rows);
        const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });

        ChartComponents.createBarChart(
            'chart-diet-gym',
            monthlyRows.map(([, totals]) => monthFormatter.format(totals.date)),
            [
                {
                    label: 'Diet',
                    data: monthlyRows.map(([, totals]) => totals.diet),
                    backgroundColor: '#38bdf8',
                    borderColor: '#38bdf8',
                    borderWidth: 1
                },
                {
                    label: 'Gym',
                    data: monthlyRows.map(([, totals]) => totals.gym),
                    backgroundColor: '#22c55e',
                    borderColor: '#22c55e',
                    borderWidth: 1
                }
            ],
            {
                plugins: { legend: { display: true, labels: { color: '#94a3b8' } } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        );
    },

    render(rows) {
        const wellnessRows = this.sanitizeRows(rows);
        const weightedRows = wellnessRows.filter(row => row.weight !== null);
        const currentWeightElement = document.getElementById('wellness-current-weight');
        const netLossElement = document.getElementById('wellness-net-loss');

        this.renderSummary(wellnessRows);
        this.renderActivityChart(wellnessRows);

        if (weightedRows.length) {
            const startingWeight = weightedRows[0].weight;
            const currentWeight = weightedRows.at(-1).weight;
            const netLoss = currentWeight - startingWeight;

            if (currentWeightElement) {
                currentWeightElement.innerHTML = `${currentWeight.toLocaleString()} <span class="fs-6 fw-normal" style="color: #cbd5e1;">lbs</span>`;
            }
            if (netLossElement) {
                const lossSign = netLoss > 0 ? '+' : '';
                netLossElement.innerHTML = `${lossSign}${netLoss.toLocaleString()} <span class="fs-6 fw-normal" style="color: #cbd5e1;">lbs</span>`;
            }
        }

        if (typeof ChartComponents === 'undefined') return;

        ChartComponents.createLineChart(
            'chart-weight',
            weightedRows.map(row => row.dateText),
            weightedRows.map(row => row.weight),
            {
                label: 'Weight (lbs)',
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 170,
                        title: { display: true, text: 'Weight (lbs)', color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        title: { display: true, text: 'Date', color: '#94a3b8' },
                        grid: { display: false },
                        ticks: { color: '#94a3b8', maxTicksLimit: 12 }
                    }
                }
            }
        );
    }
};
