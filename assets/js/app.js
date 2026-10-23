/* Global Application Runtime Config Cache */
window.appConfig = {
    "awareness_id": "",
    "dividend_id": "",
    "client_id": "",
    "developer_key": "",
    "wellness_sheet_name": "",
    "budget_sheet_name": "",
    "investment_sheet_name": "",
    "dividend_schd_sheet_name": "",
    "dividend_spyi_sheet_name": ""
};

document.addEventListener("DOMContentLoaded", () => {
    console.log("Awareness Engine Booted: Multi-Tab Sandbox Mode Operational.");

    /* ====================================================================== */
    /* CONFIGURATION PARSING AND REGISTRY SUBSYSTEM                          */
    /* ====================================================================== */
    const cachedRules = localStorage.getItem('dividendAppConfig');
    const jsonTextArea = document.getElementById('jsonConfigInput');
    
    if (cachedRules) {
        /* Parse local raw string variables into the active configuration layer */
        window.appConfig = JSON.parse(cachedRules);
        
        /* Render normalized configuration inside the administration editor window */
        if (jsonTextArea) {
            jsonTextArea.value = JSON.stringify(window.appConfig, null, 4);
        }
        console.log("Awareness Engine: Connection schemas safely pulled from local storage cache.");
    } else {
        /* Populates the structure mapping interface boilerplate if storage record is null */
        if (jsonTextArea) {
            jsonTextArea.value = JSON.stringify(window.appConfig, null, 4);
        }
    }

    /* ====================================================================== */
    /* RUNTIME INITIALIZATION LAYER                                           */
    /* ====================================================================== */
    /* Force client interface execution boundaries open */
    document.getElementById('lockscreen').classList.add('d-none');
    document.getElementById('dashboard-contents').classList.remove('d-none');

    /* Build layout dependencies */
    if (typeof ChartComponents !== 'undefined') {
        ChartComponents.renderWeightChart('chart-weight');
    }
    if (typeof WellnessComponents !== 'undefined') {
        WellnessComponents.renderLogTable('table-wellness');
    }

    /* ====================================================================== */
    /* NAVIGATION VIEW ROUTING SUBROUTINE                                     */
    /* ====================================================================== */
    const tabs = ['wellness', 'budget', 'investment', 'dividends'];
    
    tabs.forEach(tabId => {
        const button = document.getElementById(`tab-${tabId}`);
        if (!button) return;

        button.addEventListener('click', () => {
            /* Deactivate concurrent view panels and reset tracking states */
            tabs.forEach(id => {
                document.getElementById(`panel-${id}`).classList.add('d-none');
                
                const btn = document.getElementById(`tab-${id}`);
                btn.classList.remove('btn-success', 'active');
                btn.classList.add('btn-outline-secondary', 'text-light', 'border-0');
            });

            /* Activate targeted view panel */
            document.getElementById(`panel-${tabId}`).classList.remove('d-none');

            /* Commit structural display class rules to selection targets */
            button.classList.remove('btn-outline-secondary', 'text-light', 'border-0');
            button.classList.add('btn-success', 'active');

            /* Log internal target resolution metadata context */
            const dynamicTarget = (tabId === 'dividends') ? window.appConfig.dividend_id : window.appConfig.awareness_id;
            console.log(`Switched to workspace: [${tabId}]. Active Target DB: ${dynamicTarget}`);
        });
    });
});

/* ====================================================================== */
/* CONFIGURATION SYNCHRONIZATION RUNTIME CONTROLLER                       */
/* ====================================================================== */
function saveAppConfiguration() {
    const rawTextData = document.getElementById('jsonConfigInput').value.trim();
    const contextStatus = document.getElementById('configStatusMessage');

    try {
        /* Parse editor string block data layout against target syntax schemas */
        const parsedJsonObj = JSON.parse(rawTextData);
        
        /* Map evaluated attributes strictly to application memory boundaries */
        window.appConfig = {
            "awareness_id": parsedJsonObj.awareness_id || "",
            "dividend_id": parsedJsonObj.dividend_id || "",
            "client_id": parsedJsonObj.client_id || "",
            "developer_key": parsedJsonObj.developer_key || "",
            "wellness_sheet_name": parsedJsonObj.wellness_sheet_name || "",
            "budget_sheet_name": parsedJsonObj.budget_sheet_name || "",
            "investment_sheet_name": parsedJsonObj.investment_sheet_name || "",
            "dividend_schd_sheet_name": parsedJsonObj.dividend_schd_sheet_name || "",
            "dividend_spyi_sheet_name": parsedJsonObj.dividend_spyi_sheet_name || ""
        };

        /* Commit validated dictionary parameters down to persistent local records */
        localStorage.setItem('dividendAppConfig', JSON.stringify(window.appConfig));

        /* Format code block workspace elements to normalize white-space parameters */
        document.getElementById('jsonConfigInput').value = JSON.stringify(window.appConfig, null, 4);

        /* Trigger confirmation visual execution flags */
        if (contextStatus) {
            contextStatus.className = "small mt-3 text-center text-success fw-bold";
            contextStatus.innerHTML = 'Ingestion map updated successfully!';
            setTimeout(() => { contextStatus.innerHTML = ""; }, 3000);
        }
        console.log("Awareness Engine: JSON state parsed and synchronized.", window.appConfig);

    } catch (error) {
        /* Handle structural code translation faults gracefully */
        console.error("Awareness Engine Validation Error: Missing comma, quotes or bad brackets.", error);
        if (contextStatus) {
            contextStatus.className = "small mt-3 text-center text-danger fw-bold";
            contextStatus.innerHTML = 'Invalid JSON! Check bracket pairing / commas.';
        }
    }
}
