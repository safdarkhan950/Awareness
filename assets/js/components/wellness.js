const WellnessComponents = {
    weightRange: 30,
    sourceRows: [],

    init() {
        this.render([]);
        document.getElementById('wellness-weight-range').addEventListener('change', event => {
            this.weightRange = event.target.value === 'all' ? null : Number(event.target.value);
            this.render(this.sourceRows);
        });
        document.addEventListener('awareness:data-ready', event => {
            this.sourceRows = event.detail.wellness || [];
            this.render(this.sourceRows);
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

    getWeightMetadata(rows) {
        let weightIndex = 3;
        let weightUnit = 'lbs';

        const headerRows = rows.slice(0, 10);
        for (const row of headerRows) {
            for (let index = 0; index < row.length; index += 1) {
                const cellText = String(row[index] || '').trim().toLowerCase();
                if (!cellText.includes('weight')) continue;

                weightIndex = index;
                if (cellText.includes('kg')) weightUnit = 'kg';
                else if (cellText.includes('lb')) weightUnit = 'lbs';
                return { weightIndex, weightUnit };
            }
        }

        return { weightIndex, weightUnit };
    },

    parseWeightValue(rawValue) {
        const normalized = String(rawValue || '').replace(/,/g, '').trim();
        if (!normalized) return null;

        const match = normalized.match(/-?\d+(?:\.\d+)?/);
        if (!match) return null;

        const numericValue = Number(match[0]);
        return Number.isFinite(numericValue) ? numericValue : null;
    },

    sanitizeRows(rows) {
        const { weightIndex } = this.getWeightMetadata(rows);

        return rows
            .slice(2)
            .map(row => {
                const dateText = String(row[0] || '').trim();
                const date = this.parseSheetDate(dateText);
                const weightText = this.parseWeightValue(row[weightIndex]);

                return {
                    date,
                    dateText,
                    weight: weightText,
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

    filterWeightRows(weightedRows) {
        if (this.weightRange === null) return weightedRows;

        const latestDate = weightedRows.at(-1)?.date;
        if (!latestDate) return [];

        const cutoff = new Date(latestDate);
        cutoff.setUTCDate(cutoff.getUTCDate() - this.weightRange);
        return weightedRows.filter(row => row.date >= cutoff);
    },

    render(rows) {
        const wellnessRows = this.sanitizeRows(rows);
        const weightMeta = this.getWeightMetadata(rows);
        const weightedRows = this.filterWeightRows(wellnessRows.filter(row => row.weight !== null));
        const currentWeightElement = document.getElementById('wellness-current-weight');
        const netLossElement = document.getElementById('wellness-net-loss');
        const weightUnit = weightMeta.weightUnit;

        this.renderSummary(wellnessRows);
        this.renderActivityChart(wellnessRows);

        if (currentWeightElement) {
            currentWeightElement.innerHTML = weightedRows.length
                ? `${weightedRows.at(-1).weight.toLocaleString()} <span class="fs-6 fw-normal" style="color: #cbd5e1;">${weightUnit}</span>`
                : `-- <span class="fs-6 fw-normal" style="color: #cbd5e1;">${weightUnit}</span>`;
        }

        if (netLossElement) {
            if (weightedRows.length) {
                const startingWeight = weightedRows[0].weight;
                const currentWeight = weightedRows.at(-1).weight;
                const netChange = currentWeight - startingWeight;
                const changeSign = netChange > 0 ? '+' : '';
                netLossElement.innerHTML = `${changeSign}${netChange.toLocaleString()} <span class="fs-6 fw-normal" style="color: #cbd5e1;">${weightUnit}</span>`;
                netLossElement.className = `mt-2 mb-0 fw-bold ${netChange < 0 ? 'text-success' : 'text-danger'}`;
            } else {
                netLossElement.innerHTML = `-- <span class="fs-6 fw-normal" style="color: #cbd5e1;">${weightUnit}</span>`;
                netLossElement.className = 'mt-2 mb-0 fw-bold text-success';
            }
        }

        if (typeof ChartComponents === 'undefined') return;

        const lowestWeight = Math.min(...weightedRows.map(row => row.weight));
        ChartComponents.createLineChart(
            'chart-weight',
            weightedRows.map(row => row.dateText),
            weightedRows.map(row => row.weight),
            {
                label: `Weight (${weightUnit})`,
                scales: {
                    y: {
                        beginAtZero: false,
                        min: Number.isFinite(lowestWeight) ? lowestWeight - 5 : undefined,
                        title: { display: true, text: `Weight (${weightUnit})`, color: '#94a3b8' },
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
