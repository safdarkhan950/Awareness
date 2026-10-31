const InvestmentsComponents = {
    records: [],

    init() {
        this.render([]);
        document.addEventListener('awareness:data-ready', event => {
            this.render(event.detail.investment || []);
        });
    },

    parseSheetDate(dateText) {
        const match = dateText.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
        if (!match) return null;

        const [monthText, dayText, yearText] = dateText.split('/');
        const month = Number(monthText);
        const day = Number(dayText);
        const year = Number(yearText);
        const date = new Date(Date.UTC(year, month - 1, day));

        if (
            date.getUTCFullYear() !== year
            || date.getUTCMonth() !== month - 1
            || date.getUTCDate() !== day
        ) return null;

        return date;
    },

    parseAmount(value) {
        const normalized = String(value || '')
            .replace(/[^\d,.-]/g, '')
            .replace(/,(?=\d{3}(?:\D|$))/g, '')
            .trim();
        const amount = Number(normalized);
        return normalized && Number.isFinite(amount) ? amount : 0;
    },

    getColumnLabel(headers, index, fallback) {
        const value = String(headers[index] || '').trim();
        return value || fallback;
    },

    sanitizeRows(rows) {
        const headers = rows[0] || [];

        return rows.slice(1).map(row => {
            const dateText = String(row[0] || '').trim();
            const date = this.parseSheetDate(dateText);
            const brokerageEntries = [1, 2].map(index => {
                const rawHeader = String(headers[index] || '').trim();
                const value = this.parseAmount(row[index]);
                const fallbackName = index === 1 ? 'Brokerage 1' : 'Brokerage 2';
                return {
                    name: rawHeader || (value !== 0 ? fallbackName : ''),
                    value
                };
            }).filter(item => item.name || item.value !== 0);
            const retirementEntries = [3, 4, 5, 6].map((index, position) => {
                const rawHeader = String(headers[index] || '').trim();
                const value = this.parseAmount(row[index]);
                return {
                    name: rawHeader || (value !== 0 ? `Retirement ${position + 1}` : ''),
                    value
                };
            }).filter(item => item.name || item.value !== 0);

            const schd = this.parseAmount(row[1]);
            const spyi = this.parseAmount(row[2]);
            const rothIra = this.parseAmount(row[3]);
            const roth401k = this.parseAmount(row[4]);
            const employerMatch = this.parseAmount(row[5]);
            const pension = this.parseAmount(row[6]);

            return {
                date,
                dateText,
                headers,
                brokerage: brokerageEntries,
                retirement: retirementEntries,
                schd,
                spyi,
                rothIra,
                roth401k,
                employerMatch,
                pension
            };
        }).filter(record => record.date);
    },

    formatMoney(value) {
        return window.formatCurrencyValue
            ? window.formatCurrencyValue(value, window.appConfig?.currency || 'USD', 0)
            : new Intl.NumberFormat(undefined, {
                style: 'currency', currency: 'USD', maximumFractionDigits: 0
            }).format(value);
    },

    getMonthCount(records) {
        const months = new Set(records.map(record =>
            `${record.date.getUTCFullYear()}-${record.date.getUTCMonth()}`
        ));
        return months.size;
    },

    taxableTotal(record) {
        return (record.brokerage || []).reduce((sum, item) => sum + (item.value || 0), 0) || record.schd + record.spyi;
    },

    retirementTotal(record) {
        return (record.retirement || []).reduce((sum, item) => sum + (item.value || 0), 0)
            || record.rothIra + record.roth401k + record.employerMatch + record.pension;
    },

    render(records) {
        this.records = this.sanitizeRows(records).sort((first, second) => first.date - second.date);
        const latest = this.records.at(-1);
        if (!latest) {
            this.renderEmptyState();
            return;
        }

        const elapsedMonths = this.getMonthCount(this.records);
        const fireYears = Math.max(0, 17 - elapsedMonths / 12);
        const retirementYears = Math.max(0, 30 - elapsedMonths / 12);
        const taxable = this.taxableTotal(latest);
        const retirement = this.retirementTotal(latest);
        const fireValue = this.projectTaxable(latest, fireYears);
        const retirementValue = this.projectRetirement(latest, retirementYears);

        document.getElementById('investment-net-worth').textContent = this.formatMoney(taxable + retirement);
        document.getElementById('investment-brokerage-total').textContent = this.formatMoney(taxable);
        document.getElementById('investment-retirement-total').textContent = this.formatMoney(retirement);
        document.getElementById('investment-fire-projection').textContent = this.formatMoney(fireValue);
        document.getElementById('investment-retirement-projection').textContent = this.formatMoney(retirementValue);
        document.getElementById('investment-current-date').textContent = `Latest snapshot: ${latest.dateText}`;
        document.getElementById('investment-fire-duration').textContent =
            `${fireYears.toFixed(1)} years remaining after ${elapsedMonths} recorded month(s)`;
        document.getElementById('investment-retirement-duration').textContent =
            `${retirementYears.toFixed(1)} years remaining after ${elapsedMonths} recorded month(s)`;

        this.renderAllocation(latest);
        this.renderHistory();
        this.renderFireProjection(taxable, fireYears);
        this.renderRetirementProjection(latest, retirementYears);
    },

    renderEmptyState() {
        ['investment-net-worth', 'investment-brokerage-total', 'investment-retirement-total',
            'investment-fire-projection', 'investment-retirement-projection'].forEach(id => {
            document.getElementById(id).textContent = '--';
        });
    },

    renderAllocation(latest) {
        const entries = [...(latest.brokerage || []), ...(latest.retirement || [])];
        if (!entries.length) {
            return;
        }

        ChartComponents.createPieChart(
            'chart-investment-allocation',
            entries.map(entry => entry.name),
            entries.map(entry => entry.value),
            {
                plugins: { legend: { display: true, position: 'right', labels: { color: '#94a3b8' } } }
            }
        );
    },

    renderHistory() {
        const accountColors = [
            '#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#ec4899', '#94a3b8'
        ];
        const entries = [
            ...(this.records.at(-1)?.brokerage || []),
            ...(this.records.at(-1)?.retirement || [])
        ];

        ChartComponents.createChart(
            'chart-investment-history',
            'line',
            this.records.map(record => record.dateText),
            entries.map((entry, index) => ({
                label: entry.name,
                data: this.records.map(record => {
                    const series = [...(record.brokerage || []), ...(record.retirement || [])];
                    return series[index]?.value || 0;
                }),
                borderColor: accountColors[index % accountColors.length],
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.2,
                pointRadius: 2,
                fill: false
            })),
            {
                plugins: { legend: { display: true, labels: { color: '#94a3b8' } } },
                scales: {
                    y: { beginAtZero: false, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 }, grid: { display: false } }
                }
            }
        );
    },

    projectTaxable(latest, years) {
        const nonGrowing = latest.schd;
        const growing = latest.spyi;
        return nonGrowing + growing * Math.pow(1.05, years);
    },

    projectRetirement(latest, years) {
        const pension = latest.pension;
        const growingRetirement = latest.rothIra + latest.roth401k + latest.employerMatch;
        return pension + growingRetirement * Math.pow(1.05, years);
    },

    renderFireProjection(taxable, years) {
        const latest = this.records.at(-1);
        const annualPoints = this.createAnnualProjection(taxable, years, false, latest);
        const historicalValues = this.records.map(record => this.taxableTotal(record));
        this.renderProjectionChart(
            'chart-investment-fire',
            [...this.records.map(record => record.dateText), ...annualPoints.labels],
            [...historicalValues, ...annualPoints.values]
        );
    },

    renderRetirementProjection(latest, years) {
        const annualPoints = this.createAnnualProjection(
            this.retirementTotal(latest),
            years,
            true,
            latest
        );
        const historicalValues = this.records.map(record =>
            record.rothIra + record.roth401k + record.employerMatch + record.pension
        );
        this.renderProjectionChart(
            'chart-investment-retirement',
            [...this.records.map(record => record.dateText), ...annualPoints.labels],
            [...historicalValues, ...annualPoints.values]
        );
    },

    createAnnualProjection(total, years, includesCash, latest) {
        const labels = [];
        const values = [];
        let projection = total;
        const wholeYears = Math.ceil(years);

        for (let year = 1; year <= wholeYears; year += 1) {
            const completedFraction = Math.min(1, years - (year - 1));
            if (includesCash) {
                const pension = latest.pension;
                const growingRetirement = latest.rothIra + latest.roth401k + latest.employerMatch;
                projection = pension + growingRetirement * Math.pow(1.05, year - 1 + completedFraction);
            } else {
                projection = latest.schd + latest.spyi * Math.pow(1.05, year - 1 + completedFraction);
            }
            labels.push(`Year ${year}`);
            values.push(projection);
        }

        return { labels, values };
    },

    renderProjectionChart(canvasId, labels, values) {
        ChartComponents.createLineChart(canvasId, labels, values, {
            label: 'Projected value',
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            scales: {
                y: { beginAtZero: false, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { ticks: { color: '#94a3b8', maxTicksLimit: 14 }, grid: { display: false } }
            }
        });
    }
};
