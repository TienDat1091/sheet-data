// ============================================================
// CHATBOT AI - Với lịch sử, backup, download & image preview
// ============================================================

(function () {
    // ── API Config ───────────────────────────────────────────
    const API_KEY = "AIzaSyAyWgw3DRqqFqHJhqBF7h501EIblmyhBdk";
    const DEFAULT_MODEL_NAME = "gemini-3-flash-preview";
    const ALLOWED_MODEL_NAMES = new Set([DEFAULT_MODEL_NAME]);
    let currentModelName = localStorage.getItem("gemini_model") || DEFAULT_MODEL_NAME;
    if (!ALLOWED_MODEL_NAMES.has(currentModelName)) {
        currentModelName = DEFAULT_MODEL_NAME;
        localStorage.setItem("gemini_model", currentModelName);
    }
    function getApiUrl() {
        return `https://generativelanguage.googleapis.com/v1beta/models/${currentModelName}:generateContent?key=${API_KEY}`;
    }
    const SYSTEM_PROMPT = `Bạn là Trợ lý phân tích dữ liệu chuyên nghiệp thuộc hệ thống NOTE REPORT. 
Nhiệm vụ của bạn là:
1. Giải đáp các thắc mắc về lỗi hệ thống, máy móc thiết bị, và quy trình xử lý.
2. Đưa ra hướng giải quyết ngắn gọn, có cấu trúc rõ ràng.
3. Luôn xưng hô là "tôi" và gọi người dùng là "bạn". Giọng văn chuyên nghiệp, lịch sự nhưng không quá máy móc.
Hạn chế dùng các câu chào hỏi dài dòng sáo rỗng. Trả lời ngay vào trọng tâm.

Khi được yêu cầu tạo file hoặc xuất nội dung ra file, hãy đặt toàn bộ nội dung file trong cấu trúc:
<CODE_FILE name="ten-file.ext">
nội dung file
</CODE_FILE>
Bạn có thể tạo nhiều file trong một tin nhắn nếu cần. Điều này rất quan trọng - đây là format duy nhất để hệ thống hiểu và tạo nút tải xuống.`;


    // ── DOM ──────────────────────────────────────────────────
    const chatBody        = document.getElementById("chat-body");
    const messageInput    = document.getElementById("message-input");
    const chatForm        = document.getElementById("chat-form");
    const fileInput       = document.getElementById("file-input");
    const sendBtn         = document.getElementById("send-message");
    const newChatBtn      = document.getElementById("new-chat-btn");
    const historyList     = document.getElementById("history-list");
    const sidebarToggle   = document.getElementById("sidebar-toggle");
    const sidebar         = document.getElementById("sidebar");
    const downloadBtn     = document.getElementById("download-btn");
    const copyChatBtn     = document.getElementById("copy-chat");
    const backupBtn       = document.getElementById("backup-btn");
    const restoreInput    = document.getElementById("restore-input");
    const sessionNameEl   = document.getElementById("session-name");
    const imagePreviewBar = document.getElementById("image-preview-bar");
    const previewCancel   = document.getElementById("preview-cancel");
    const attachmentPreviewList = document.getElementById("attachment-preview-list");
    const bulkDeleteBtn   = document.getElementById("bulk-delete-btn");
    const autoDeleteSel   = document.getElementById("auto-delete-select");
    const modelSelect     = document.getElementById("model-select");
    const knowledgeUploadInput = document.getElementById("knowledge-upload-input");
    const knowledgeList   = document.getElementById("knowledge-list");
    const knowledgeClearBtn = document.getElementById("knowledge-clear-btn");
    const cancelResponseBtn = document.getElementById("cancel-response");
    const retryResponseBtn = document.getElementById("retry-response");
    if (modelSelect) modelSelect.value = currentModelName;

    // ── State ────────────────────────────────────────────────
    const STORAGE_KEY = "chatbot_sessions";
    const AUTO_DELETE_KEY = "chatbot_auto_delete_days";
    const KNOWLEDGE_DB = "ChatbotKnowledgeDB";
    const KNOWLEDGE_STORE = "documents";
    const KNOWLEDGE_DB_VERSION = 1;
    let autoDeleteDays = parseInt(localStorage.getItem(AUTO_DELETE_KEY) || "0", 10);
    if (autoDeleteSel) autoDeleteSel.value = autoDeleteDays.toString();

    let sessions     = loadSessions();
    let currentId    = null;
    let chatHistory  = []; // Gửi lên API
    let pendingAttachments = []; // { name, text?, inlineData?, mimeType, size }
    const MAX_INLINE_FILE_BYTES = 18 * 1024 * 1024;
    const GEMINI_MIN_REQUEST_GAP_MS = 4000;
    const GEMINI_MAX_RETRIES = 3;
    let geminiRequestQueue = Promise.resolve();
    let geminiLastRequestAt = 0;
    let activeResponseController = null;
    let isResponseRunning = false;
    let lastUserRequestSnapshot = null;

    // ── Session Management ───────────────────────────────────
    function cleanOldSessions(sessionsObj) {
        if (autoDeleteDays <= 0) return sessionsObj;
        const now = Date.now();
        const maxAgeMs = autoDeleteDays * 24 * 60 * 60 * 1000;
        let modified = false;
        for (const id in sessionsObj) {
            const age = now - new Date(sessionsObj[id].updatedAt).getTime();
            if (age > maxAgeMs) {
                delete sessionsObj[id];
                modified = true;
            }
        }
        if (modified) saveSessionsSilent(sessionsObj);
        return sessionsObj;
    }

    function saveSessionsSilent(obj) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    }

    function loadSessions() {
        try { 
            let data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; 
            return typeof cleanOldSessions === 'function' ? cleanOldSessions(data) : data;
        }
        catch { return {}; }
    }

    function saveSessions() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }

    function generateId() {
        return "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    }

    function startNewChat() {
        currentId   = generateId();
        chatHistory = [];
        pendingAttachments = [];
        clearAttachment();

        sessions[currentId] = {
            id: currentId,
            title: "Chat mới",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [] // { role, text, imageData?, imageType? }
        };
        saveSessions();
        renderChat([]);
        renderSidebar();
        sessionNameEl.textContent = "Chat mới";
    }

    function loadChat(id) {
        const sess = sessions[id];
        if (!sess) return;
        currentId   = id;
        chatHistory = [];
        pendingAttachments = [];
        clearAttachment();
        sessionNameEl.textContent = sess.title;

        // Rebuild Gemini chatHistory từ saved messages
        sess.messages.forEach(m => {
            chatHistory.push({
                role: m.role === "bot" ? "model" : "user",
                parts: [
                    { text: m.text },
                    ...getMessageInlineParts(m)
                ]
            });
        });

        renderChat(sess.messages);
        renderSidebar();
    }

    function deleteSession(id) {
        delete sessions[id];
        saveSessions();
        if (currentId === id) startNewChat();
        else renderSidebar();
    }

    function saveMessage(role, text, imageData = null, imageType = null, attachments = []) {
        if (!currentId || !sessions[currentId]) return;
        const sess = sessions[currentId];
        sess.messages.push({ role, text, imageData, imageType, attachments });
        // Auto-name session from first user message
        if (sess.title === "Chat mới" && role === "user") {
            sess.title = text.slice(0, 45) + (text.length > 45 ? "…" : "");
            sessionNameEl.textContent = sess.title;
        }
        sess.updatedAt = new Date().toISOString();
        saveSessions();
        renderSidebar();
    }

    function getMessageInlineParts(message) {
        if (Array.isArray(message.attachments) && message.attachments.length > 0) {
            return message.attachments
                .filter(att => att.inlineData && att.mimeType)
                .map(att => ({ inline_data: { data: att.inlineData, mime_type: att.mimeType } }));
        }
        return message.imageData ? [{ inline_data: { data: message.imageData, mime_type: message.imageType } }] : [];
    }

    // ── Render Sidebar ───────────────────────────────────────
    function renderSidebar() {
        const sorted = Object.values(sessions).sort(
            (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        );

        if (sorted.length === 0) {
            historyList.innerHTML = '<div class="history-empty">Chưa có lịch sử chat nào.</div>';
            return;
        }

        historyList.innerHTML = "";
        sorted.forEach(sess => {
            const item = document.createElement("div");
            item.className = "history-item" + (sess.id === currentId ? " active" : "");

            const date = new Date(sess.updatedAt);
            const dateStr = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

            item.innerHTML = `
                <span class="item-text" title="${sess.title}">${sess.title}</span>
                <span class="item-date">${dateStr}</span>
                <button class="item-delete" title="Xoá" data-id="${sess.id}">✕</button>`;

            item.addEventListener("click", (e) => {
                if (e.target.classList.contains("item-delete")) return;
                loadChat(sess.id);
            });
            item.querySelector(".item-delete").addEventListener("click", (e) => {
                e.stopPropagation();
                // Bỏ qua cảnh báo confirm - xóa lập tức
                deleteSession(sess.id);
            });

            historyList.appendChild(item);
        });
    }

    // ── Render Chat Messages ─────────────────────────────────
    function renderChat(messages) {
        chatBody.innerHTML = "";
        appendBotMessage("Xin chào 👋<br>Tôi có thể giúp gì cho bạn hôm nay?");
        messages.forEach(m => {
            if (m.role === "user") {
                appendUserMessage(m.text, m.attachments, m.imageData, m.imageType);
            } else {
                appendBotMessage(m.text);
            }
        });
        chatBody.scrollTo({ top: chatBody.scrollHeight });
    }

    function appendBotMessage(html) {
        const div = document.createElement("div");
        div.className = "message bot-message";
        div.innerHTML = `
            <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
                <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5z"/>
            </svg>
            <div class="message-text">${html}</div>`;
        chatBody.appendChild(div);
        return div;
    }

    function appendUserMessage(text, attachments = [], imageData = null, imageType = null, fileName = null) {
        const div = document.createElement("div");
        div.className = "message user-message";
        let html = ``;
        if (text) html += `<div class="message-text">${escapeHtml(text)}</div>`;

        const normalizedAttachments = Array.isArray(attachments) && attachments.length > 0
            ? attachments
            : (imageData ? [{ name: fileName || "File đính kèm", inlineData: imageData, mimeType: imageType }] : []);

        normalizedAttachments.forEach(att => {
            if (att.inlineData && att.mimeType?.startsWith("image/")) {
                html += `<img class="sent-image" src="data:${att.mimeType};base64,${att.inlineData}" alt="Ảnh đính kèm">`;
                return;
            }
            html += `<div class="sent-file-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${escapeHtml(att.name || "File đính kèm")}
            </div>`;
        });

        div.innerHTML = html;
        chatBody.appendChild(div);
        return div;
    }

    function appendThinkingBubble() {
        const div = document.createElement("div");
        div.className = "message bot-message thinking";
        div.innerHTML = `
            <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
                <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9z"/>
            </svg>
            <div class="message-text">
                <div class="thinking-indicator">
                    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                </div>
            </div>`;
        chatBody.appendChild(div);
        chatBody.scrollTo({ behavior: "smooth", top: chatBody.scrollHeight });
        return div;
    }

    function setResponseRunning(isRunning) {
        isResponseRunning = isRunning;
        if (cancelResponseBtn) cancelResponseBtn.style.display = isRunning ? "flex" : "none";
        if (retryResponseBtn) retryResponseBtn.style.display = !isRunning && lastUserRequestSnapshot ? "flex" : "none";
        if (sendBtn) sendBtn.disabled = isRunning;
    }

    function buildRequestFromCurrentInput() {
        const text = messageInput.value.trim();
        if (!text && pendingAttachments.length === 0) return null;

        let mergedText = text;
        pendingAttachments.forEach((attachment, index) => {
            if (attachment.text) {
                mergedText += `\n\n[Dữ liệu đính kèm file ${index + 1}: ${attachment.name}]\n${attachment.text}`;
            }
        });
        if (!mergedText && pendingAttachments.length > 0) {
            mergedText = "Hãy đọc và phân tích các file đính kèm.";
        }

        const attachmentsToSend = pendingAttachments.map(att => ({ ...att }));
        const attachmentsToSave = attachmentsToSend.map(att => ({
            name: att.name,
            mimeType: att.mimeType,
            size: att.size,
            inlineData: att.inlineData || null
        }));
        const parts = [];
        if (mergedText) parts.push({ text: mergedText });
        attachmentsToSend.forEach(att => {
            if (att.inlineData && att.mimeType) {
                parts.push({ inline_data: { data: att.inlineData, mime_type: att.mimeType } });
            }
        });

        return { text, mergedText, attachmentsToSend, attachmentsToSave, parts };
    }

    function submitUserRequest(request, shouldAppendUserMessage = true) {
        if (!request) return;
        if (!currentId) startNewChat();
        lastUserRequestSnapshot = {
            text: request.text,
            mergedText: request.mergedText,
            attachmentsToSend: request.attachmentsToSend.map(att => ({ ...att })),
            attachmentsToSave: request.attachmentsToSave.map(att => ({ ...att })),
            parts: request.parts.map(part => part.inline_data ? { inline_data: { ...part.inline_data } } : { ...part })
        };

        if (shouldAppendUserMessage) {
            appendUserMessage(request.text, request.attachmentsToSend);
            saveMessage("user", request.mergedText, null, null, request.attachmentsToSave);
        }

        chatHistory.push({ role: "user", parts: request.parts });
        chatBody.scrollTo({ behavior: "smooth", top: chatBody.scrollHeight });

        messageInput.value = "";
        messageInput.style.height = "auto";
        clearAttachment();

        const thinkingDiv = appendThinkingBubble();
        callGemini(thinkingDiv);
    }

    // ── Send Message ─────────────────────────────────────────
    function handleSend(e) {
        e.preventDefault();
        if (isResponseRunning) return;
        submitUserRequest(buildRequestFromCurrentInput(), true);
    }

    function fetchAllNotesContext() {
        return new Promise((resolve) => {
            const req = indexedDB.open('MyNotesDB', 5);
            req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('notes')) return resolve("");
                const tx = db.transaction('notes', 'readonly');
                const store = tx.objectStore('notes');
                const getReq = store.getAll();
                getReq.onsuccess = (ev) => {
                    const notes = ev.target.result || [];
                    if(notes.length === 0) return resolve("");
                    let ctx = "\n--- DỮ LIỆU BÁO CÁO SỰ CỐ TỪ CƠ SỞ DỮ LIỆU CỦA TÔI ---\n";
                    notes.forEach(n => {
                        ctx += `- [${new Date(n.timestamp).toLocaleString('vi-VN')}] Lỗi: ${n.title} | Nguyên nhân: ${n.reason} | Thông tin: ${n.content}\n`;
                    });
                    ctx += "--------------------------------------------------------\n*Chỉ dùng database này để tham khảo tóm tắt nếu người dùng hỏi về dữ liệu ghi chú/lỗi của họ.*\n";
                    resolve(ctx);
                };
                getReq.onerror = () => resolve("");
            };
            req.onerror = () => resolve("");
        });
    }

    function openKnowledgeDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(KNOWLEDGE_DB, KNOWLEDGE_DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(KNOWLEDGE_STORE)) {
                    db.createObjectStore(KNOWLEDGE_STORE, { keyPath: "id" });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function saveKnowledgeDoc(doc) {
        const db = await openKnowledgeDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(KNOWLEDGE_STORE, "readwrite");
            tx.objectStore(KNOWLEDGE_STORE).put(doc);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getKnowledgeDocs() {
        const db = await openKnowledgeDb();
        return new Promise((resolve) => {
            const tx = db.transaction(KNOWLEDGE_STORE, "readonly");
            const req = tx.objectStore(KNOWLEDGE_STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async function clearKnowledgeDocs() {
        const db = await openKnowledgeDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(KNOWLEDGE_STORE, "readwrite");
            tx.objectStore(KNOWLEDGE_STORE).clear();
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function renderKnowledgeList() {
        if (!knowledgeList) return;
        const docs = await getKnowledgeDocs();
        if (docs.length === 0) {
            knowledgeList.innerHTML = `<div class="knowledge-item"><span class="knowledge-item-name">Chưa có tài liệu</span></div>`;
            return;
        }
        knowledgeList.innerHTML = docs
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(doc => `<div class="knowledge-item" title="${escapeHtml(doc.name)}">
                <span>📄</span><span class="knowledge-item-name">${escapeHtml(doc.name)}</span>
            </div>`)
            .join("");
    }

    async function ingestKnowledgeFiles(files) {
        const fileList = Array.from(files || []);
        if (fileList.length === 0) return;
        showTemporaryBotMessage(`Đang nạp ${fileList.length} tài liệu vào kho AI...`);
        for (const file of fileList) {
            try {
                const text = await extractKnowledgeText(file);
                const normalizedText = normalizeText(text);
                if (!normalizedText) throw new Error("Không trích xuất được nội dung");
                await saveKnowledgeDoc({
                    id: "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
                    name: file.name,
                    mimeType: inferMimeType(file),
                    size: file.size,
                    createdAt: new Date().toISOString(),
                    text: normalizedText
                });
            } catch (err) {
                showTemporaryBotMessage(`Không nạp được "${file.name}": ${err.message}`);
            }
        }
        await renderKnowledgeList();
        showTemporaryBotMessage("Đã nạp tài liệu. Từ giờ khi bạn hỏi lỗi liên quan, tôi sẽ tra kho tài liệu này trước khi trả lời.");
    }

    async function extractKnowledgeText(file) {
        const mimeType = inferMimeType(file);
        const isText = isReadableTextFile(file, mimeType);
        if (isText) return await readFileAsText(file);
        if (file.size > MAX_INLINE_FILE_BYTES) {
            throw new Error(`file quá lớn (${formatFileSize(file.size)})`);
        }
        const base64 = await readFileAsBase64(file);
        const data = await queueGeminiGenerateContent({
            contents: [{
                role: "user",
                parts: [
                    { text: `Trích xuất toàn bộ thông tin hữu ích từ tài liệu "${file.name}" để dùng làm dữ liệu tra cứu lỗi sau này. Trả về tiếng Việt nếu có thể. Tập trung vào: mã lỗi, triệu chứng, nguyên nhân, cách kiểm tra, cách xử lý, thông số, cảnh báo, quy trình.` },
                    { inline_data: { data: base64, mime_type: mimeType } }
                ]
            }]
        });
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result || "");
            reader.onerror = () => reject(new Error("không đọc được file text"));
            reader.readAsText(file, "utf-8");
        });
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target.result || "").split(",")[1] || "");
            reader.onerror = () => reject(new Error("không đọc được file"));
            reader.readAsDataURL(file);
        });
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function queueGeminiGenerateContent(payload, signal = null) {
        const run = geminiRequestQueue.then(() => throttledGeminiGenerateContent(payload, signal));
        geminiRequestQueue = run.catch(() => {});
        return run;
    }

    async function throttledGeminiGenerateContent(payload, signal = null) {
        const elapsed = Date.now() - geminiLastRequestAt;
        if (elapsed < GEMINI_MIN_REQUEST_GAP_MS) {
            await wait(GEMINI_MIN_REQUEST_GAP_MS - elapsed);
        }
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
            geminiLastRequestAt = Date.now();
            const res = await fetch(getApiUrl(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) return data;

            const retryMs = getGeminiRetryDelayMs(data) || Number(res.headers.get("Retry-After") || 0) * 1000;
            if (res.status === 429 && attempt < GEMINI_MAX_RETRIES && retryMs !== 0) {
                await wait(Math.max(retryMs, GEMINI_MIN_REQUEST_GAP_MS));
                if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
                continue;
            }
            throw new Error(formatGeminiError(data, res.status));
        }
    }

    function getGeminiRetryDelayMs(data) {
        const text = JSON.stringify(data || {});
        const secondsMatch = text.match(/"seconds"\s*:\s*"?(\d+)"?/);
        const retryDelayMatch = text.match(/retryDelay[^0-9]*(\d+(?:\.\d+)?)s/);
        if (secondsMatch) return Number(secondsMatch[1]) * 1000;
        if (retryDelayMatch) return Math.ceil(Number(retryDelayMatch[1]) * 1000);
        return 0;
    }

    function formatGeminiError(data, status) {
        const message = data?.error?.message || `Gemini API error ${status}`;
        if (status === 429 || /quota|rate/i.test(message)) {
            return "Đã chạm giới hạn Gemini API. Hệ thống đã tự thử lại nhưng quota vẫn chưa đủ. Vui lòng đợi một lúc rồi gửi lại, nạp ít file hơn, hoặc nâng cấp/bật billing cho Gemini API.";
        }
        return message;
    }

    async function fetchKnowledgeContext(query) {
        const docs = await getKnowledgeDocs();
        if (docs.length === 0) return "";
        const chunks = [];
        docs.forEach(doc => {
            splitIntoChunks(doc.text, 1200).forEach((chunk, index) => {
                chunks.push({ doc, index, text: chunk, score: scoreChunk(query, chunk, doc.name) });
            });
        });
        const top = chunks
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
        if (top.length === 0) return "";
        let ctx = "\n--- TÀI LIỆU AI LIÊN QUAN NHẤT ---\n";
        top.forEach((item, i) => {
            ctx += `[${i + 1}] Nguồn: ${item.doc.name} | Đoạn ${item.index + 1}\n${item.text}\n\n`;
        });
        ctx += "Hãy ưu tiên các tài liệu trên khi trả lời. Nếu dùng thông tin từ tài liệu, nêu rõ tên nguồn.\n";
        return ctx;
    }

    function splitIntoChunks(text, maxLength) {
        const clean = normalizeText(text);
        const chunks = [];
        for (let i = 0; i < clean.length; i += maxLength) chunks.push(clean.slice(i, i + maxLength));
        return chunks;
    }

    function scoreChunk(query, text, name) {
        const qTerms = tokenize(query);
        if (qTerms.length === 0) return 0;
        const haystack = `${name} ${text}`.toLowerCase();
        let score = 0;
        qTerms.forEach(term => {
            if (term.length < 2) return;
            const hits = haystack.split(term).length - 1;
            score += hits * (term.length >= 4 ? 2 : 1);
        });
        return score;
    }

    function tokenize(text) {
        return normalizeText(text)
            .toLowerCase()
            .split(/[^a-z0-9À-ỹ]+/i)
            .filter(Boolean);
    }

    function normalizeText(text) {
        return String(text || "").replace(/\s+/g, " ").trim();
    }

    function showTemporaryBotMessage(text) {
        const div = appendBotMessage(escapeHtml(text));
        chatBody.scrollTo({ behavior: "smooth", top: chatBody.scrollHeight });
        return div;
    }

    async function callGemini(thinkingDiv) {
        activeResponseController = new AbortController();
        setResponseRunning(true);
        try {
            const notesCtx = await fetchAllNotesContext();
            const lastUserText = chatHistory.filter(m => m.role === "user").slice(-1)[0]?.parts?.find(p => p.text)?.text || "";
            const knowledgeCtx = await fetchKnowledgeContext(lastUserText);
            const fullSystemPrompt = SYSTEM_PROMPT + notesCtx + knowledgeCtx;

            const data = await queueGeminiGenerateContent({ 
                system_instruction: {
                    parts: { text: fullSystemPrompt }
                },
                contents: chatHistory 
            }, activeResponseController.signal);

            const raw = data.candidates[0].content.parts[0].text;
            
            thinkingDiv.classList.remove("thinking");
            thinkingDiv.querySelector(".message-text").innerHTML = renderBotContent(raw);
            attachFileCardListeners(thinkingDiv);

            chatHistory.push({ role: "model", parts: [{ text: raw }] });
            saveMessage("bot", raw);
        } catch (err) {
            thinkingDiv.classList.remove("thinking");
            if (err.name === "AbortError") {
                thinkingDiv.querySelector(".message-text").innerHTML =
                    `<span style="color:#f59e0b;">Đã hủy trả lời.</span>`;
            } else {
                thinkingDiv.querySelector(".message-text").innerHTML =
                    `<span style="color:#ef4444;">⚠️ Lỗi: ${escapeHtml(err.message)}</span>`;
            }
        } finally {
            activeResponseController = null;
            setResponseRunning(false);
        }
        chatBody.scrollTo({ behavior: "smooth", top: chatBody.scrollHeight });
    }

    // ── File Handling ─────────────────────────────────────────
    // Render nội dung bot, phân tích CODE_FILE block thành card đẹp
    function renderBotContent(rawText) {
        const fileBlockRe = /<CODE_FILE name="([^"]+)">([\/\s\S]*?)<\/CODE_FILE>/g;
        const rawTextRe = /<CODE_FILE name="[^"]+">[\/\s\S]*?<\/CODE_FILE>/g;
        
        // Tách text và file blocks
        const parts = rawText.split(rawTextRe);
        const fileMatches = [...rawText.matchAll(fileBlockRe)];
        
        let result = "";
        parts.forEach((part, i) => {
            // Render text part qua Marked.js thay vì replace chay
            if (part.trim()) {
                let parsedHTML = "";
                if (typeof marked !== "undefined") {
                    parsedHTML = marked.parse(part.trim());
                } else {
                    parsedHTML = escapeHtml(part.trim()).replace(/\n/g, "<br>");
                }
                result += `<div class="md-content">${parsedHTML}</div>`;
            }
            // Sau mỗi text part, chèn card nếu có
            if (fileMatches[i]) {
                const fname = fileMatches[i][1];
                const fcontent = fileMatches[i][2].trim();
                result += buildFileCard(fname, fcontent);
            }
        });
        return result || (typeof marked !== "undefined" ? marked.parse(rawText) : rawText.replace(/\n/g, "<br>"));
    }

    function buildFileCard(name, content) {
        const escaped = escapeHtml(name);
        const dataAttr = encodeURIComponent(content);
        return `
            <div class="file-download-card" data-filename="${escaped}" data-content="${dataAttr}">
                <div class="fdc-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div class="fdc-info">
                    <span class="fdc-name">${escaped}</span>
                    <span class="fdc-hint">Nhấn để tải xuống</span>
                </div>
                <button class="fdc-btn">↓ Tải</button>
            </div>`;
    }

    function attachFileCardListeners(container) {
        container.querySelectorAll(".file-download-card").forEach(card => {
            card.addEventListener("click", () => {
                const name = card.dataset.filename;
                const content = decodeURIComponent(card.dataset.content);
                const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = name;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
            });
        });
    }

    // ── Attachment Handling ───────────────────────────────────────
    function clearAttachment() {
        pendingAttachments = [];
        if (attachmentPreviewList) attachmentPreviewList.innerHTML = "";
        imagePreviewBar.style.display = "none";
        fileInput.value = "";
    }

    function addPendingAttachment(attachment) {
        pendingAttachments.push(attachment);
        renderAttachmentPreview();
    }

    function removePendingAttachment(index) {
        pendingAttachments.splice(index, 1);
        renderAttachmentPreview();
    }

    function renderAttachmentPreview() {
        if (!attachmentPreviewList) return;
        attachmentPreviewList.innerHTML = "";

        if (pendingAttachments.length === 0) {
            imagePreviewBar.style.display = "none";
            return;
        }

        pendingAttachments.forEach((attachment, index) => {
            const item = document.createElement("div");
            item.className = "attachment-preview-item";
            item.title = attachment.name;

            const preview = attachment.inlineData && attachment.mimeType?.startsWith("image/")
                ? `<img class="attachment-preview-thumb" src="data:${attachment.mimeType};base64,${attachment.inlineData}" alt="${escapeHtml(attachment.name)}">`
                : `<div class="attachment-preview-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>`;

            item.innerHTML = `
                ${preview}
                <div class="attachment-preview-name">${escapeHtml(shortenFileName(attachment.name))}</div>
                <button type="button" class="attachment-preview-remove" title="Xóa file này" aria-label="Xóa ${escapeHtml(attachment.name)}">×</button>
            `;
            item.querySelector(".attachment-preview-remove").addEventListener("click", () => removePendingAttachment(index));
            attachmentPreviewList.appendChild(item);
        });

        imagePreviewBar.style.display = "flex";
    }

    function shortenFileName(name, maxLength = 22) {
        if (!name || name.length <= maxLength) return name || "File";
        const dotIndex = name.lastIndexOf(".");
        const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
        const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
        const keep = Math.max(8, maxLength - ext.length - 3);
        return `${base.slice(0, keep)}...${ext}`;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024*1024)).toFixed(1) + " MB";
    }

    function readFileUniversal(file) {
        if (!file) return;
        if (file.size > MAX_INLINE_FILE_BYTES) {
            alert(`File quá lớn (${formatFileSize(file.size)}). Vui lòng dùng file tối đa ${formatFileSize(MAX_INLINE_FILE_BYTES)} để gửi trực tiếp cho AI.`);
            return;
        }

        const mimeType = inferMimeType(file);
        // TEXT / CSV / JSON / CODE: đọc ra text để AI thấy nội dung đầy đủ hơn.
        if (isReadableTextFile(file, mimeType)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                addPendingAttachment({
                    name: file.name,
                    text: e.target.result,
                    mimeType,
                    size: file.size
                });
            };
            reader.onerror = () => alert("Không thể đọc nội dung file này.");
            reader.readAsText(file, "utf-8");
            return;
        }

        // Mọi file còn lại: gửi trực tiếp dạng inline_data để Gemini tự đọc nếu định dạng được hỗ trợ.
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result.split(",")[1];
            addPendingAttachment({
                name: file.name,
                text: `[File đính kèm: ${file.name} | MIME: ${mimeType} | Dung lượng: ${formatFileSize(file.size)}]\nHãy đọc và phân tích nội dung file đính kèm.`,
                inlineData: base64,
                mimeType,
                size: file.size
            });
        };
        reader.onerror = () => alert("Không thể đọc file này.");
        reader.readAsDataURL(file);
    }

    function inferMimeType(file) {
        if (file.type) return file.type;
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        const mimeMap = {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ppt: "application/vnd.ms-powerpoint",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            csv: "text/csv",
            txt: "text/plain",
            md: "text/markdown",
            json: "application/json",
            xml: "application/xml",
            html: "text/html",
            htm: "text/html",
            css: "text/css",
            js: "text/javascript",
            ts: "text/typescript",
            py: "text/x-python",
            sql: "application/x-sql",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
            mp3: "audio/mpeg",
            wav: "audio/wav",
            mp4: "video/mp4",
            mov: "video/quicktime"
        };
        return mimeMap[ext] || "application/octet-stream";
    }

    function isReadableTextFile(file, mimeType = inferMimeType(file)) {
        const textTypes  = ["text/plain","text/csv","application/json","application/xml",
                            "text/html","text/javascript","text/markdown","text/x-python",
                            "application/x-sql","text/xml","text/css","text/typescript"];
        return textTypes.some(t => mimeType.includes(t.split("/")[1]))
            || /\.(txt|csv|json|md|log|xml|html|css|js|jsx|ts|tsx|py|sql|yaml|yml|ini|env|bat|ps1|sh|java|c|cpp|h|hpp|cs|php|rb|go|rs|swift|kt|dart|vue|svelte)$/i.test(file.name);
    }

    // ── Download Chat ────────────────────────────────────────
    function downloadCurrentChat() {
        if (!currentId || !sessions[currentId]) return;
        const sess = sessions[currentId];
        if (sess.messages.length === 0) { alert("Không có tin nhắn nào để tải."); return; }

        let text = `=== ${sess.title} ===\n`;
        text += `Ngày tạo: ${new Date(sess.createdAt).toLocaleString("vi-VN")}\n\n`;
        sess.messages.forEach(m => {
            const who = m.role === "user" ? "Bạn" : "Bot";
            text += `[${who}]\n${m.text}\n`;
            if (m.imageData) text += "[Có đính kèm ảnh]\n";
            text += "\n";
        });

        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        downloadBlob(blob, `chat_${sess.title.slice(0, 30).replace(/[^a-z0-9]/gi, "_")}.txt`);
    }

    // ── Backup & Restore ─────────────────────────────────────
    function backupAllSessions() {
        const allSessions = loadSessions();
        if (Object.keys(allSessions).length === 0) { alert("Không có lịch sử nào để backup."); return; }

        const blob = new Blob([JSON.stringify(allSessions, null, 2)], { type: "application/json" });
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadBlob(blob, `chatbot_backup_${dateStr}.json`);
    }

    function restoreFromFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (typeof imported !== "object" || Array.isArray(imported))
                    throw new Error("Định dạng không hợp lệ");

                const count = Object.keys(imported).length;
                if (!confirm(`Tìm thấy ${count} cuộc trò chuyện trong file backup.\nMerge vào lịch sử hiện tại?`))
                    return;

                // Merge (giữ lại sessions hiện có, thêm mới)
                Object.assign(sessions, imported);
                saveSessions();
                renderSidebar();
                alert(`✅ Đã restore ${count} cuộc trò chuyện thành công!`);
            } catch (err) {
                alert("❌ File không hợp lệ: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Copy Chat ────────────────────────────────────────────
    function copyChat() {
        if (!currentId || !sessions[currentId]) return;
        const sess = sessions[currentId];
        let text = sess.messages.map(m => `${m.role === "user" ? "Bạn" : "Bot"}: ${m.text}`).join("\n\n");
        navigator.clipboard.writeText(text).then(() => alert("✅ Đã sao chép!"));
    }

    // ── Utility ──────────────────────────────────────────────

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.appendChild(document.createTextNode(str || ""));
        return div.innerHTML;
    }

    // ── Event Listeners ──────────────────────────────────────
    chatForm.addEventListener("submit", handleSend);

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    });

    messageInput.addEventListener("input", () => {
        messageInput.style.height = "auto";
        messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + "px";
    });

    // Paste ảnh
    messageInput.addEventListener("paste", (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                readFileUniversal(item.getAsFile());
                return;
            }
        }
    });

    // File input
    fileInput.addEventListener("change", (e) => {
        Array.from(e.target.files || []).forEach(readFileUniversal);
        e.target.value = "";
    });

    // Cancel attachment
    previewCancel.addEventListener("click", clearAttachment);

    // Sidebar toggle
    sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("collapsed"));

    // New chat
    newChatBtn.addEventListener("click", startNewChat);

    // Download
    if (downloadBtn) downloadBtn.addEventListener("click", downloadCurrentChat);

    // Copy
    if (copyChatBtn) copyChatBtn.addEventListener("click", copyChat);

    // Backup
    if (backupBtn) backupBtn.addEventListener("click", backupAllSessions);

    // Restore
    if (restoreInput) {
        restoreInput.addEventListener("change", (e) => {
            restoreFromFile(e.target.files[0]);
            e.target.value = "";
        });
    }

    if (cancelResponseBtn) {
        cancelResponseBtn.addEventListener("click", () => {
            if (activeResponseController) activeResponseController.abort();
        });
    }

    if (retryResponseBtn) {
        retryResponseBtn.addEventListener("click", () => {
            if (isResponseRunning || !lastUserRequestSnapshot) return;
            if (chatHistory[chatHistory.length - 1]?.role === "model") chatHistory.pop();
            const request = {
                text: lastUserRequestSnapshot.text,
                mergedText: lastUserRequestSnapshot.mergedText,
                attachmentsToSend: lastUserRequestSnapshot.attachmentsToSend.map(att => ({ ...att })),
                attachmentsToSave: lastUserRequestSnapshot.attachmentsToSave.map(att => ({ ...att })),
                parts: lastUserRequestSnapshot.parts.map(part => part.inline_data ? { inline_data: { ...part.inline_data } } : { ...part })
            };
            submitUserRequest(request, false);
        });
    }

    if (knowledgeUploadInput) {
        knowledgeUploadInput.addEventListener("change", (e) => {
            ingestKnowledgeFiles(e.target.files);
            e.target.value = "";
        });
    }

    if (knowledgeClearBtn) {
        knowledgeClearBtn.addEventListener("click", async () => {
            if (!confirm("Xóa toàn bộ tài liệu AI đã nạp?")) return;
            await clearKnowledgeDocs();
            await renderKnowledgeList();
            showTemporaryBotMessage("Đã xóa toàn bộ tài liệu AI.");
        });
    }

    // Bulk Delete
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener("click", () => {
            if (Object.keys(sessions).length === 0) return;
            if (confirm("Chắc chắn xoá TOÀN BỘ lịch sử chat?")) {
                sessions = {};
                saveSessions();
                startNewChat();
            }
        });
    }

    // Auto Delete Change
    if (autoDeleteSel) {
        autoDeleteSel.addEventListener("change", (e) => {
            autoDeleteDays = parseInt(e.target.value, 10);
            localStorage.setItem(AUTO_DELETE_KEY, autoDeleteDays.toString());
            sessions = cleanOldSessions(sessions);
            renderSidebar();
            if (!sessions[currentId]) startNewChat();
        });
    }


    // Model Switcher
    if (modelSelect) {
        modelSelect.addEventListener("change", (e) => {
            currentModelName = ALLOWED_MODEL_NAMES.has(e.target.value) ? e.target.value : DEFAULT_MODEL_NAME;
            modelSelect.value = currentModelName;
            localStorage.setItem("gemini_model", currentModelName);
        });
    }

    // ── Init ─────────────────────────────────────────────────
    renderSidebar();
    renderKnowledgeList();
    startNewChat();

})();
