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
        const normalized = String(value || '').replace(/[$£€¥,\s]/g, '').trim();
        const amount = Number(normalized);
        return normalized && Number.isFinite(amount) ? amount : 0;
    },

    sanitizeRows(rows) {
        return rows.slice(1).map(row => {
            const dateText = String(row[0] || '').trim();
            const date = this.parseSheetDate(dateText);

            return {
                date,
                dateText,
                schd: this.parseAmount(row[1]),
                spyi: this.parseAmount(row[2]),
                rothIra: this.parseAmount(row[3]),
                roth401k: this.parseAmount(row[4]),
                employerMatch: this.parseAmount(row[5]),
                pension: this.parseAmount(row[6])
            };
        }).filter(record => record.date);
    },

    formatMoney(value) {
        return new Intl.NumberFormat(undefined, {
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
        return record.schd + record.spyi;
    },

    retirementTotal(record) {
        return record.rothIra + record.roth401k + record.employerMatch + record.pension;
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
        ChartComponents.createPieChart(
            'chart-investment-allocation',
            ['SCHD', 'SPYI', 'Roth IRA', 'Roth 401k', 'Employer Match', 'Pension'],
            [latest.schd, latest.spyi, latest.rothIra, latest.roth401k, latest.employerMatch, latest.pension],
            {
                plugins: { legend: { display: true, position: 'right', labels: { color: '#94a3b8' } } }
            }
        );
    },

    renderHistory() {
        const accountColors = [
            '#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#ec4899', '#94a3b8'
        ];
        const fields = [
            ['schd', 'SCHD'], ['spyi', 'SPYI'], ['rothIra', 'Roth IRA'],
            ['roth401k', 'Roth 401k'], ['employerMatch', 'Employer Match'], ['pension', 'Pension']
        ];

        ChartComponents.createChart(
            'chart-investment-history',
            'line',
            this.records.map(record => record.dateText),
            fields.map(([field, label], index) => ({
                label,
                data: this.records.map(record => record[field]),
                borderColor: accountColors[index],
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
