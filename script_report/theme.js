// ── Theme Manager ──────────────────────────────────────────
function initTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app-theme', newTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const btns = document.querySelectorAll('.theme-toggle-btn');
    btns.forEach(btn => {
        btn.innerHTML = isDark ? '☀️ Light' : '🌙 Dark';
    });
}

// Khởi chạy ngay lập tức để tránh chớp màn hình trắng
initTheme();

// Gắn sự kiện khi DOM tải xong
window.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon();
    const btns = document.querySelectorAll('.theme-toggle-btn');
    btns.forEach(btn => btn.addEventListener('click', toggleTheme));
});
