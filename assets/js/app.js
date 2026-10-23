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

const SHEET_DATA_CACHE_KEY = 'awarenessSheetData';
const SHEET_REQUEST_TIMEOUT_MS = 20000;
const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

window.sheetData = {};
let googleTokenClient = null;
let googleAccessToken = '';

function buildSheetRequestUrl(spreadsheetId, sheetName) {
    if (!spreadsheetId) throw new Error('A spreadsheet ID is not configured.');
    if (!sheetName) throw new Error('A worksheet name is not configured.');

    const endpoint = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
    const range = encodeURIComponent(sheetName);

    return `${endpoint}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
}

async function fetchSheetTab(target) {
    if (!googleAccessToken) throw new Error('Google authorization is required before loading spreadsheet data.');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SHEET_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(buildSheetRequestUrl(target.spreadsheetId, target.sheetName), {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${googleAccessToken}` }
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const reason = payload.error?.message || `Google Sheets returned HTTP ${response.status}.`;
            throw new Error(`${target.key}: ${reason}`);
        }

        return { key: target.key, rows: payload.values || [] };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`${target.key}: the request timed out after ${SHEET_REQUEST_TIMEOUT_MS / 1000} seconds.`);
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function showDataStatus(message, type = 'info') {
    const status = document.getElementById('dataStatusMessage');
    if (!status) return;

    const alertTypes = { info: 'alert-info', success: 'alert-success', error: 'alert-danger' };
    status.className = `alert ${alertTypes[type] || alertTypes.info} mt-3 mb-0`;
    status.textContent = message;
    status.classList.remove('d-none');
}

function clearDataStatus() {
    const status = document.getElementById('dataStatusMessage');
    if (!status) return;

    status.className = 'alert d-none mt-3 mb-0';
    status.textContent = '';
}

async function fetchAllSpreadsheetTabs() {
    const awarenessTargets = [
        { key: 'wellness', spreadsheetId: window.appConfig.awareness_id, sheetName: window.appConfig.wellness_sheet_name },
        { key: 'budget', spreadsheetId: window.appConfig.awareness_id, sheetName: window.appConfig.budget_sheet_name },
        { key: 'investment', spreadsheetId: window.appConfig.awareness_id, sheetName: window.appConfig.investment_sheet_name }
    ];

    const dividendTargets = window.appConfig.dividend_id ? [
        { key: 'dividend_schd', spreadsheetId: window.appConfig.dividend_id, sheetName: window.appConfig.dividend_schd_sheet_name },
        { key: 'dividend_spyi', spreadsheetId: window.appConfig.dividend_id, sheetName: window.appConfig.dividend_spyi_sheet_name }
    ].filter(target => target.sheetName) : [];

    const targets = [...awarenessTargets, ...dividendTargets];
    const missingAwarenessTarget = awarenessTargets.find(target => !target.spreadsheetId || !target.sheetName);
    if (missingAwarenessTarget) {
        throw new Error('Complete the Awareness spreadsheet ID and worksheet names in Config before fetching data.');
    }
    if (!googleAccessToken) {
        throw new Error('Authorize with Google before fetching spreadsheet data.');
    }

    showDataStatus('Loading spreadsheet data...', 'info');

    try {
        const results = await Promise.all(targets.map(fetchSheetTab));
        window.sheetData = Object.fromEntries(results.map(result => [result.key, result.rows]));
        localStorage.setItem(SHEET_DATA_CACHE_KEY, JSON.stringify(window.sheetData));
        document.dispatchEvent(new CustomEvent('awareness:data-ready', { detail: window.sheetData }));
        showDataStatus('Spreadsheet data loaded and cached locally.', 'success');
        window.setTimeout(clearDataStatus, 4000);
        return window.sheetData;
    } catch (error) {
        console.error('Awareness data fetch failed:', error);
        showDataStatus(`Unable to load spreadsheet data. ${error.message}`, 'error');
        document.dispatchEvent(new CustomEvent('awareness:data-error', { detail: error.message }));
        throw error;
    }
}

function updateAuthenticationButton(label, disabled = false) {
    const button = document.getElementById('btn-login');
    if (!button) return;

    button.disabled = disabled;
    button.innerHTML = `<i class="bi bi-person-check-fill"></i> ${label}`;
}

function unlockDashboard() {
    document.getElementById('lockscreen').classList.add('d-none');
    document.getElementById('dashboard-contents').classList.remove('d-none');
}

function initializeGoogleAuthorization() {
    if (!window.appConfig.client_id) {
        showDataStatus('Add the OAuth Client ID in Config, then authorize.', 'error');
        updateAuthenticationButton('Configure Google');
        return false;
    }

    if (!window.google?.accounts?.oauth2) {
        showDataStatus('Google authorization could not load. Check the network and reload.', 'error');
        return false;
    }

    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: window.appConfig.client_id,
        scope: SHEETS_READONLY_SCOPE,
        callback: async tokenResponse => {
            if (tokenResponse.error) {
                console.error('Google authorization failed:', tokenResponse);
                showDataStatus(`Google authorization failed: ${tokenResponse.error}`, 'error');
                updateAuthenticationButton('Authenticate');
                return;
            }

            googleAccessToken = tokenResponse.access_token;
            unlockDashboard();
            updateAuthenticationButton('Authorized');
            await loadSpreadsheetData();
        }
    });

    return true;
}

function authorizeGoogle() {
    if (!googleAccessToken && !initializeGoogleAuthorization()) return;
    googleTokenClient.requestAccessToken({ prompt: googleAccessToken ? '' : 'consent' });
}

async function loadSpreadsheetData() {
    try {
        await fetchAllSpreadsheetTabs();
    } catch (_error) {
        const cachedData = localStorage.getItem(SHEET_DATA_CACHE_KEY);
        if (cachedData) {
            try {
                window.sheetData = JSON.parse(cachedData);
                showDataStatus('Showing cached data. The live refresh could not complete.', 'error');
                document.dispatchEvent(new CustomEvent('awareness:data-ready', { detail: window.sheetData }));
            } catch (cacheError) {
                console.error('Cached spreadsheet data is invalid:', cacheError);
                localStorage.removeItem(SHEET_DATA_CACHE_KEY);
                showDataStatus('Cached data is invalid. Update Config and try again.', 'error');
            }
        }
    }
}

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
    /* Keep private dashboard data locked until Google authorization succeeds. */
    document.getElementById('lockscreen').classList.remove('d-none');
    document.getElementById('dashboard-contents').classList.add('d-none');

    const loginButton = document.getElementById('btn-login');
    loginButton.addEventListener('click', authorizeGoogle);

    /* Tab components own their rendering and subscribe to shared data lifecycle. */
    if (typeof WellnessComponents !== 'undefined') {
        WellnessComponents.init();
    }
    if (typeof BudgetComponents !== 'undefined') {
        BudgetComponents.init();
    }
    if (typeof InvestmentsComponents !== 'undefined') {
        InvestmentsComponents.init();
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
        googleAccessToken = '';
        googleTokenClient = null;
        initializeGoogleAuthorization();

    } catch (error) {
        /* Handle structural code translation faults gracefully */
        console.error("Awareness Engine Validation Error: Missing comma, quotes or bad brackets.", error);
        if (contextStatus) {
            contextStatus.className = "small mt-3 text-center text-danger fw-bold";
            contextStatus.innerHTML = 'Invalid JSON! Check bracket pairing / commas.';
        }
    }
}
