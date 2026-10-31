const BudgetComponents = {
    records: [],
    selectedPeriod: 'all',
    selectedCategory: null,
    sortField: 'date',
    sortDirection: 'desc',

    init() {
        this.render([]);
        document.getElementById('budget-period-filter').addEventListener('change', event => {
            this.selectedPeriod = event.target.value;
            this.selectedCategory = null;
            this.renderFilteredState();
        });
        document.getElementById('budget-category-clear').addEventListener('click', () => {
            this.selectedCategory = null;
            this.renderFilteredState();
        });
        document.querySelectorAll('[data-budget-sort]').forEach(button => {
            button.addEventListener('click', () => this.toggleSort(button.dataset.budgetSort));
        });
        document.addEventListener('awareness:data-ready', event => {
            this.records = this.sanitizeRows(event.detail.budget || []);
            this.populatePeriodFilter();
            this.render(event.detail.budget || []);
        });
    },

    parseSheetDate(dateText) {
        const match = dateText.match(/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/);
        if (!match) return null;

        const [day, monthText, year] = dateText.split(/\s+/);
        const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            .findIndex(month => month.toLowerCase() === monthText.toLowerCase());
        if (monthIndex === -1) return null;

        const date = new Date(Date.UTC(Number(year), monthIndex, Number(day)));
        return Number.isNaN(date.getTime()) ? null : date;
    },

    parseAmount(value) {
        const normalized = String(value || '')
            .replace(/[^\d,.-]/g, '')
            .replace(/,(?=\d{3}(?:\D|$))/g, '')
            .trim();
        const amount = Number(normalized);
        return normalized && Number.isFinite(amount) && amount > 0 ? amount : null;
    },

    sanitizeRows(rows) {
        return rows.slice(1).map(row => {
            const dateText = String(row[0] || '').trim();
            const date = this.parseSheetDate(dateText);
            const category = String(row[1] || '').trim() || 'Uncategorized';
            const expense = this.parseAmount(row[2]);
            const income = this.parseAmount(row[3]);

            return { date, dateText, category, expense, income };
        }).filter(row => row.date && (row.expense !== null || row.income !== null));
    },

    periodKey(record) {
        return `${record.date.getUTCFullYear()}-${String(record.date.getUTCMonth() + 1).padStart(2, '0')}`;
    },

    periodLabel(recordOrKey) {
        const date = typeof recordOrKey === 'string'
            ? new Date(`${recordOrKey}-01T00:00:00Z`)
            : recordOrKey.date;
        return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
    },

    formatMoney(value) {
        return window.formatCurrencyValue
            ? window.formatCurrencyValue(value, window.appConfig?.currency || 'USD', 2)
            : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
    },

    populatePeriodFilter() {
        const select = document.getElementById('budget-period-filter');
        const periods = [...new Set(this.records.map(record => this.periodKey(record)))].sort().reverse();
        select.innerHTML = '<option value="all">All</option>' + periods
            .map(period => `<option value="${period}">${this.periodLabel(period)}</option>`).join('');
        select.value = this.selectedPeriod;
    },

    render(records) {
        this.records = this.sanitizeRows(records);
        this.populatePeriodFilter();
        this.renderSummaries();
        this.renderMonthlyChart();
        this.renderFilteredState();
    },

    renderSummaries() {
        const totalIncome = this.records.reduce((sum, record) => sum + (record.income || 0), 0);
        const totalExpenses = this.records.reduce((sum, record) => sum + (record.expense || 0), 0);
        const monthCount = new Set(this.records.map(record => this.periodKey(record))).size || (this.records.length ? 1 : 0);
        const averageIncome = monthCount ? totalIncome / monthCount : 0;
        const averageExpenses = monthCount ? totalExpenses / monthCount : 0;

        document.getElementById('budget-total-income').textContent = this.formatMoney(totalIncome);
        document.getElementById('budget-total-expenses').textContent = this.formatMoney(totalExpenses);

        const netSavings = totalIncome - totalExpenses;
        const netElement = document.getElementById('budget-net-savings');
        netElement.textContent = this.formatMoney(netSavings);
        netElement.className = `mt-2 mb-0 fw-bold ${netSavings >= 0 ? 'text-success' : 'text-danger'}`;

        document.getElementById('budget-month-income').textContent = this.formatMoney(averageIncome);
        document.getElementById('budget-month-expenses').textContent = this.formatMoney(averageExpenses);
    },

    renderMonthlyChart() {
        const monthly = new Map();
        this.records.forEach(record => {
            const key = this.periodKey(record);
            if (!monthly.has(key)) monthly.set(key, { date: record.date, income: 0, expense: 0 });
            const totals = monthly.get(key);
            totals.income += record.income || 0;
            totals.expense += record.expense || 0;
        });

        const periods = [...monthly.values()]
            .sort((first, second) => first.date - second.date)
            .slice(-12);

        ChartComponents.createBarChart(
            'chart-budget-monthly',
            periods.map(period => this.periodLabel(period)),
            [
                { label: 'Income', data: periods.map(period => period.income), backgroundColor: '#22c55e', borderColor: '#22c55e' },
                { label: 'Expenses', data: periods.map(period => period.expense), backgroundColor: '#ef4444', borderColor: '#ef4444' }
            ],
            {
                plugins: { legend: { display: true, labels: { color: '#94a3b8' } } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        );
    },

    getFilteredExpenses() {
        return this.records.filter(record =>
            record.expense !== null
            && (this.selectedPeriod === 'all' || this.periodKey(record) === this.selectedPeriod)
            && (!this.selectedCategory || record.category === this.selectedCategory)
        );
    },

    renderFilteredState() {
        const periodRecords = this.records.filter(record =>
            this.selectedPeriod === 'all' || this.periodKey(record) === this.selectedPeriod
        );
        const categoryTotals = new Map();
        periodRecords.filter(record => record.expense !== null).forEach(record => {
            categoryTotals.set(record.category, (categoryTotals.get(record.category) || 0) + record.expense);
        });

        const sortedCategories = [...categoryTotals.entries()].sort((first, second) => second[1] - first[1]);
        ChartComponents.createPieChart(
            'chart-budget-categories',
            sortedCategories.map(([category]) => category),
            sortedCategories.map(([, amount]) => amount),
            { plugins: { legend: { display: true, position: 'right', labels: { color: '#94a3b8' } } } }
        );

        const pieChart = ChartComponents.charts.get('chart-budget-categories');
        if (pieChart) {
            pieChart.options.onClick = (_event, elements) => {
                if (!elements.length) return;
                this.selectedCategory = sortedCategories[elements[0].index][0];
                this.renderExpenseList();
                document.getElementById('budget-category-clear').classList.remove('d-none');
            };
        }

        this.renderExpenseList();
        document.getElementById('budget-category-clear').classList.toggle('d-none', !this.selectedCategory);
    },

    toggleSort(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = field === 'date' ? 'desc' : 'asc';
        }

        this.renderExpenseList();
    },

    sortExpenses(expenses) {
        return [...expenses].sort((first, second) => {
            let comparison;
            if (this.sortField === 'amount') {
                comparison = first.expense - second.expense;
            } else if (this.sortField === 'category') {
                comparison = first.category.localeCompare(second.category, undefined, { sensitivity: 'base' });
            } else {
                comparison = first.date - second.date;
            }

            if (comparison === 0) {
                comparison = first.dateText.localeCompare(second.dateText);
            }
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
    },

    updateSortIndicators() {
        document.querySelectorAll('[data-budget-sort]').forEach(button => {
            const active = button.dataset.budgetSort === this.sortField;
            button.querySelector('[data-budget-sort-indicator]').textContent = active
                ? (this.sortDirection === 'asc' ? ' ▲' : ' ▼')
                : '';
        });
    },

    renderExpenseList() {
        const expenses = this.sortExpenses(this.getFilteredExpenses());
        this.updateSortIndicators();
        document.getElementById('budget-expense-list').innerHTML = expenses.length
            ? expenses.map(record => `
                <tr>
                    <td>${record.dateText}</td>
                    <td>${this.escapeHtml(record.category)}</td>
                    <td class="text-end">${this.formatMoney(record.expense)}</td>
                </tr>`).join('')
            : '<tr><td colspan="3" class="text-center text-secondary py-4">No expenses for this selection</td></tr>';
    },

    escapeHtml(value) {
        const element = document.createElement('div');
        element.textContent = value;
        return element.innerHTML;
    }
};
