const WellnessComponents = {
    renderLogTable(tableId) {
        const table = document.getElementById(tableId);
        
        // Mocking how a spreadsheet table translates to HTML rows
        const mockData = [
            ['Date', 'Weight', 'Gym Workout', 'Diet Log'],
            ['Oct 20', '247 lbs', 'Yes (Legs)', 'On Track'],
            ['Oct 19', '248 lbs', 'No Rest', 'On Track'],
            ['Oct 18', '249 lbs', 'Yes (Cardio)', 'Over Calorie'],
            ['Oct 17', '250 lbs', 'Yes (Chest)', 'On Track']
        ];

        let html = '';
        mockData.forEach((row, rowIndex) => {
            if (rowIndex === 0) {
                // Header style
                html += `<thead class="bg-slate-800 text-slate-400 border-b border-slate-700 uppercase tracking-wider text-[10px]"><tr>`;
                row.forEach(cell => html += `<th class="p-3 font-semibold">${cell}</th>`);
                html += `</tr></thead><tbody class="divide-y divide-slate-800">`;
            } else {
                // Body style
                html += `<tr class="hover:bg-slate-800/40 text-slate-300">`;
                row.forEach(cell => html += `<td class="p-3">${cell}</td>`);
                html += `</tr>`;
            }
        });
        html += '</tbody>';
        table.innerHTML = html;
    }
};
