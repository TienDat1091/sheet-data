// ============================================================
// Google Drive Upload - Frontend Only (No Server Required)
// Uses Google Identity Services (GIS) + Drive REST API
// ============================================================

const DRIVE_CLIENT_ID = '499820560799-pmp01in4l4me1gumkrp51e8h6mdulrhv.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_AUTH_STORAGE_KEY = 'google_drive_auth';
const DRIVE_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

let driveTokenClient = null;
let driveAccessToken = null;
let driveSilentTokenRequest = false;
let pendingUploadFiles = []; // files đang chờ upload

// ---- Init GIS khi trang load xong ----
window.addEventListener('load', () => {
    if (typeof google === 'undefined') return;
    driveTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: DRIVE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (tokenResponse) => {
            if (tokenResponse.error) {
                if (driveSilentTokenRequest) {
                    driveSilentTokenRequest = false;
                    return;
                }
                showDriveStatus('❌ Đăng nhập thất bại: ' + tokenResponse.error, 'error');
                return;
            }
            driveSilentTokenRequest = false;
            saveDriveAuth(tokenResponse);
            showDriveStatus('✅ Đã đăng nhập Google thành công!', 'success');
            updateDriveLoginState(true);
            // Nếu có file chờ thì upload luôn
            if (pendingUploadFiles.length > 0) {
                startUploadAll(pendingUploadFiles);
                pendingUploadFiles = [];
            }
        }
    });

    if (restoreDriveAuthFromStorage()) {
        updateDriveLoginState(true);
    }
});

// ---- Mở/Đóng Modal ----
function openDriveModal() {
    document.getElementById('driveModal').style.display = 'flex';
    clearDriveModal();
    if (restoreDriveAuthFromStorage()) {
        updateDriveLoginState(true);
        showDriveStatus('✅ Đã khôi phục đăng nhập Google.', 'success');
    } else {
        updateDriveLoginState(false);
        requestSilentDriveToken();
    }
}

function closeDriveModal() {
    document.getElementById('driveModal').style.display = 'none';
}

function clearDriveModal() {
    document.getElementById('driveFileInput').value = '';
    document.getElementById('driveFileList').innerHTML = '';
    document.getElementById('driveProgressArea').innerHTML = '';
    showDriveStatus('', '');
}

// ---- Lưu / khôi phục đăng nhập Google ----
function saveDriveAuth(tokenResponse) {
    driveAccessToken = tokenResponse.access_token;
    const expiresInMs = Number(tokenResponse.expires_in || 3600) * 1000;
    const authData = {
        accessToken: driveAccessToken,
        expiresAt: Date.now() + expiresInMs,
        scope: tokenResponse.scope || DRIVE_SCOPE
    };
    localStorage.setItem(DRIVE_AUTH_STORAGE_KEY, JSON.stringify(authData));
}

function restoreDriveAuthFromStorage() {
    try {
        const authData = JSON.parse(localStorage.getItem(DRIVE_AUTH_STORAGE_KEY) || 'null');
        if (!authData || !authData.accessToken || !authData.expiresAt) return false;
        if (Date.now() + DRIVE_TOKEN_REFRESH_BUFFER_MS >= authData.expiresAt) {
            clearDriveAuthStorage();
            return false;
        }
        driveAccessToken = authData.accessToken;
        return true;
    } catch {
        clearDriveAuthStorage();
        return false;
    }
}

function clearDriveAuthStorage() {
    localStorage.removeItem(DRIVE_AUTH_STORAGE_KEY);
    driveAccessToken = null;
}

function requestSilentDriveToken() {
    if (!driveTokenClient) return;
    driveSilentTokenRequest = true;
    driveTokenClient.requestAccessToken({ prompt: '' });
}

// ---- Đăng nhập Google ----
function signInGoogle() {
    if (!driveTokenClient) {
        showDriveStatus('❌ Google API chưa tải xong. Vui lòng thử lại.', 'error');
        return;
    }
    driveSilentTokenRequest = false;
    driveTokenClient.requestAccessToken({ prompt: 'select_account consent' });
}

// ---- Đăng xuất ----
function signOutGoogle() {
    if (driveAccessToken) {
        google.accounts.oauth2.revoke(driveAccessToken, () => {});
    }
    clearDriveAuthStorage();
    updateDriveLoginState(false);
    showDriveStatus('🔒 Đã đăng xuất khỏi Google.', '');
}

function updateDriveLoginState(isLoggedIn) {
    const loginBtn = document.getElementById('driveLoginBtn');
    const logoutBtn = document.getElementById('driveLogoutBtn');
    const uploadBtn = document.getElementById('driveUploadBtn');
    if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';
    if (uploadBtn) uploadBtn.disabled = !isLoggedIn;
}

// ---- Hiển thị trạng thái ----
function showDriveStatus(msg, type) {
    const el = document.getElementById('driveStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#94a3b8';
}

// ---- Hiển thị danh sách file đã chọn ----
function onDriveFilesSelected() {
    const input = document.getElementById('driveFileInput');
    const listEl = document.getElementById('driveFileList');
    listEl.innerHTML = '';
    Array.from(input.files).forEach(file => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; gap:8px; padding:6px 10px; background:rgba(255,255,255,0.05); border-radius:6px; margin-bottom:6px; font-size:0.85rem;';
        div.innerHTML = `<span style="color:#38bdf8;">📄</span>
            <span style="flex:1; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</span>
            <span style="color:#64748b;">${(file.size / 1024).toFixed(1)} KB</span>`;
        listEl.appendChild(div);
    });
}

// ---- Nút Upload chính ----
function uploadFilesToDrive() {
    const input = document.getElementById('driveFileInput');
    const files = Array.from(input.files);
    if (files.length === 0) {
        showDriveStatus('⚠️ Vui lòng chọn ít nhất một file.', 'error');
        return;
    }
    restoreDriveAuthFromStorage();
    if (!driveAccessToken) {
        pendingUploadFiles = files;
        showDriveStatus('🔑 Đang yêu cầu đăng nhập...', '');
        signInGoogle();
        return;
    }
    startUploadAll(files);
}

async function startUploadAll(files) {
    const progressArea = document.getElementById('driveProgressArea');
    progressArea.innerHTML = '';

    for (const file of files) {
        await uploadSingleFile(file, progressArea);
    }
}

async function uploadSingleFile(file, container) {
    // Tạo progress item
    const itemId = 'progress_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const itemEl = document.createElement('div');
    itemEl.id = itemId;
    itemEl.style.cssText = 'padding:10px; background:rgba(0,0,0,0.3); border-radius:6px; margin-bottom:8px;';
    itemEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="font-size:0.85rem; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">${file.name}</span>
            <span class="upload-status" style="font-size:0.8rem; color:#94a3b8;">Đang upload...</span>
        </div>
        <div style="background:rgba(255,255,255,0.1); border-radius:4px; height:6px; overflow:hidden;">
            <div class="progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#38bdf8,#818cf8); transition:width 0.3s;"></div>
        </div>
        <div class="result-link" style="margin-top:6px; font-size:0.8rem;"></div>`;
    container.appendChild(itemEl);

    const progressBar = itemEl.querySelector('.progress-bar');
    const statusSpan = itemEl.querySelector('.upload-status');
    const resultLink = itemEl.querySelector('.result-link');

    try {
        // Đọc file
        const arrayBuffer = await file.arrayBuffer();

        // Metadata
        const metadata = { name: file.name, mimeType: file.type || 'application/octet-stream' };

        // Multipart upload
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadataStr = JSON.stringify(metadata);
        const encoder = new TextEncoder();

        const multipartBody = new Blob([
            delimiter,
            'Content-Type: application/json; charset=UTF-8\r\n\r\n',
            metadataStr,
            delimiter,
            `Content-Type: ${metadata.mimeType}\r\n\r\n`,
            new Uint8Array(arrayBuffer),
            closeDelimiter
        ], { type: `multipart/related; boundary="${boundary}"` });

        progressBar.style.width = '40%';

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${driveAccessToken}`,
                'Content-Type': `multipart/related; boundary="${boundary}"`
            },
            body: multipartBody
        });

        progressBar.style.width = '90%';

        if (!response.ok) {
            const errData = await response.json();
            if (response.status === 401) {
                clearDriveAuthStorage();
                updateDriveLoginState(false);
            }
            throw new Error(errData.error?.message || 'Upload thất bại');
        }

        const data = await response.json();
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg,#10b981,#34d399)';
        statusSpan.textContent = '✅ Xong!';
        statusSpan.style.color = '#10b981';

        // Hiện link
        if (data.webViewLink) {
            resultLink.innerHTML = `<a href="${data.webViewLink}" target="_blank" style="color:#38bdf8; text-decoration:underline;">🔗 Mở trên Google Drive</a>`;
        } else {
            resultLink.innerHTML = `<span style="color:#10b981;">ID: ${data.id}</span>`;
        }

    } catch (err) {
        progressBar.style.width = '100%';
        progressBar.style.background = '#ef4444';
        statusSpan.textContent = '❌ Lỗi!';
        statusSpan.style.color = '#ef4444';
        resultLink.innerHTML = `<span style="color:#ef4444;">${err.message}</span>`;
        console.error('Drive upload error:', err);
    }
}
