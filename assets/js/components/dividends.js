const DividendsComponents = {
    tickers: {},

    init() {
        this.render({});
        document.getElementById('dividend-ticker-filter').addEventListener('change', event => {
            this.renderTicker(event.target.value);
        });
        document.addEventListener('awareness:data-ready', event => {
            this.tickers = {
                SCHD: this.normalizeTicker(event.detail.dividend_schd || [], 'SCHD'),
                SPYI: this.normalizeTicker(event.detail.dividend_spyi || [], 'SPYI')
            };
            this.render(this.tickers);
        });
    },

    parseSheetDate(dateText) {
        const match = dateText.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
        if (!match) return null;
        const [monthText, dayText, yearText] = dateText.split('/');
        const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
        return date.getUTCFullYear() === Number(yearText)
            && date.getUTCMonth() === Number(monthText) - 1
            && date.getUTCDate() === Number(dayText) ? date : null;
    },

    parseAmount(value) {
        const normalized = String(value || '').replace(/[$£€¥,%\s]/g, '').trim();
        const amount = Number(normalized);
        return normalized && Number.isFinite(amount) ? amount : 0;
    },

    normalizeTicker(rows, fallbackTicker) {
        const ticker = String(rows[0]?.[1] || fallbackTicker).trim() || fallbackTicker;
        const transactions = rows.slice(8).map(row => {
            const dateText = String(row[0] || '').trim();
            const date = this.parseSheetDate(dateText);
            return {
                date,
                dateText,
                type: String(row[1] || '').trim(),
                sharesAdded: this.parseAmount(row[2]),
                sharePrice: this.parseAmount(row[3]),
                cashTransacted: this.parseAmount(row[4])
            };
        }).filter(transaction => transaction.date);

        return {
            ticker,
            livePrice: this.parseAmount(rows[1]?.[1]),
            dollarGrowth: this.parseAmount(rows[1]?.[2]),
            percentageGrowth: this.parseAmount(rows[1]?.[3]),
            averageCost: this.parseAmount(rows[1]?.[4]),
            personalYield: this.parseAmount(rows[1]?.[5]),
            reinvested: this.parseAmount(rows[4]?.[1]),
            sharesOwned: this.parseAmount(rows[4]?.[2]),
            marketValue: this.parseAmount(rows[4]?.[3]),
            yearlyDividend: this.parseAmount(rows[4]?.[4]),
            monthlyDividend: this.parseAmount(rows[4]?.[5]),
            transactions
        };
    },

    formatMoney(value) {
        return new Intl.NumberFormat(undefined, {
            style: 'currency', currency: 'USD', maximumFractionDigits: 2
        }).format(value);
    },

    formatPercent(value) {
        return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    },

    render(tickers) {
        this.tickers = tickers;
        const knownTickers = ['SCHD', 'SPYI'].map(key => tickers[key]).filter(Boolean);
        const yearly = knownTickers.reduce((sum, ticker) => sum + ticker.yearlyDividend, 0);
        const monthly = knownTickers.reduce((sum, ticker) => sum + ticker.monthlyDividend, 0);

        document.getElementById('dividend-total-yearly').textContent = this.formatMoney(yearly);
        document.getElementById('dividend-total-monthly').textContent = this.formatMoney(monthly);
        this.renderGoal('fire', yearly, 50000);
        this.renderGoal('income', monthly, 2000);
        this.renderMonthlyPayoutChart();
        this.renderTicker(document.getElementById('dividend-ticker-filter').value);
    },

    renderGoal(key, current, goal) {
        const percentage = goal ? Math.min(100, current / goal * 100) : 0;
        document.getElementById(`dividend-${key}-percent`).textContent = this.formatPercent(percentage);
        document.getElementById(`dividend-${key}-progress`).style.width = `${percentage}%`;
        document.getElementById(`dividend-${key}-caption`).textContent =
            `${this.formatMoney(current)} of ${this.formatMoney(goal)} (${this.formatPercent(percentage)})`;
    },

    renderMonthlyPayoutChart() {
        const payouts = new Map();
        ['SCHD', 'SPYI'].forEach(tickerName => {
            (this.tickers[tickerName]?.transactions || []).forEach(transaction => {
                if (transaction.type.toLowerCase() !== 'dividend') return;
                const key = `${transaction.date.getUTCFullYear()}-${String(transaction.date.getUTCMonth() + 1).padStart(2, '0')}`;
                if (!payouts.has(key)) payouts.set(key, { date: transaction.date, SCHD: [], SPYI: [] });
                payouts.get(key)[tickerName].push(transaction.cashTransacted);
            });
        });

        const periods = [...payouts.entries()]
            .sort(([first], [second]) => first.localeCompare(second))
            .map(([, period]) => period);
        const labels = periods.map(period =>
            new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(period.date)
        );
        const maxPayoutCount = Math.max(
            1,
            ...periods.flatMap(period => [period.SCHD.length, period.SPYI.length])
        );
        const tickerColors = {
            SCHD: ['#38bdf8', '#7dd3fc', '#0ea5e9', '#0369a1'],
            SPYI: ['#22c55e', '#86efac', '#16a34a', '#15803d']
        };
        const datasets = [];

        for (let index = 0; index < maxPayoutCount; index += 1) {
            ['SCHD', 'SPYI'].forEach(tickerName => {
                datasets.push({
                    label: tickerName,
                    stack: 'dividend-payouts',
                    data: periods.map(period => period[tickerName][index] || 0),
                    backgroundColor: tickerColors[tickerName][index % tickerColors[tickerName].length],
                    borderColor: '#0b0f19',
                    borderWidth: 1
                });
            });
        }

        ChartComponents.createBarChart(
            'chart-dividend-monthly',
            labels,
            datasets,
            {
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#94a3b8' },
                        filter: (legendItem, chartData) => {
                            const previousLabels = chartData.datasets
                                .slice(0, legendItem.datasetIndex)
                                .map(dataset => dataset.label);
                            return !previousLabels.includes(legendItem.text);
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        );
    },

    renderTicker(tickerName) {
        const ticker = this.tickers[tickerName];
        const fields = {
            'dividend-live-price': ticker ? this.formatMoney(ticker.livePrice) : '--',
            'dividend-yearly-income': ticker ? this.formatMoney(ticker.yearlyDividend) : '--',
            'dividend-monthly-income': ticker ? this.formatMoney(ticker.monthlyDividend) : '--',
            'dividend-reinvested': ticker ? this.formatMoney(ticker.reinvested) : '--',
            'dividend-yield': ticker ? this.formatPercent(ticker.personalYield) : '--',
            'dividend-dollar-growth': ticker ? this.formatMoney(ticker.dollarGrowth) : '--',
            'dividend-percent-growth': ticker ? this.formatPercent(ticker.percentageGrowth) : '--',
            'dividend-average-cost': ticker ? this.formatMoney(ticker.averageCost) : '--',
            'dividend-shares-owned': ticker ? ticker.sharesOwned.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '--',
            'dividend-market-value': ticker ? this.formatMoney(ticker.marketValue) : '--'
        };

        Object.entries(fields).forEach(([id, value]) => {
            document.getElementById(id).textContent = value;
        });
        this.setPositiveColor('dividend-monthly-income', ticker?.monthlyDividend || 0);
        this.setPositiveColor('dividend-reinvested', ticker?.reinvested || 0);
        this.setSignedColor('dividend-dollar-growth', ticker?.dollarGrowth || 0);
        this.setSignedColor('dividend-percent-growth', ticker?.percentageGrowth || 0);
        this.setCostComparisonColor('dividend-average-cost', ticker?.averageCost || 0, ticker?.livePrice || 0);
        this.renderTransactions(ticker);
    },

    setPositiveColor(elementId, value) {
        const element = document.getElementById(elementId);
        element.classList.remove('text-success', 'text-danger', 'text-light');
        element.classList.add(value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-light');
    },

    setSignedColor(elementId, value) {
        this.setPositiveColor(elementId, value);
    },

    setCostComparisonColor(elementId, cost, livePrice) {
        const element = document.getElementById(elementId);
        element.classList.remove('text-success', 'text-danger', 'text-light');
        element.classList.add(livePrice > 0 && cost > livePrice ? 'text-danger' : 'text-success');
    },

    renderTransactions(ticker) {
        const transactions = (ticker?.transactions || []).sort((first, second) => second.date - first.date);
        document.getElementById('dividend-transaction-count').textContent =
            `${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`;
        document.getElementById('dividend-transaction-list').innerHTML = transactions.length
            ? transactions.map(transaction => `
                <tr>
                    <td>${transaction.dateText}</td>
                    <td>${this.escapeHtml(transaction.type)}</td>
                    <td class="text-end">${transaction.sharesAdded.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td class="text-end">${this.formatMoney(transaction.sharePrice)}</td>
                    <td class="text-end">${this.formatMoney(transaction.cashTransacted)}</td>
                </tr>`).join('')
            : '<tr><td colspan="5" class="text-center text-secondary py-4">No transactions available</td></tr>';
    },

    escapeHtml(value) {
        const element = document.createElement('div');
        element.textContent = value;
        return element.innerHTML;
    }
};
