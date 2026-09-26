// ==========================================
// ===== API =====
// ==========================================
async function api(path, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'x-init-data': initData } };
    if (body) opts.body = JSON.stringify({ ...body, initData });
    const res = await fetch(path, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('Server returned HTML'); }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ==========================================
// ===== AUTH =====
// ==========================================
async function auth() {
    try {
        const { user } = await api('/api/auth', 'POST');
        currentUser = user;
        tgUser.id = user.id;
        tgUser.name = user.name;
        updateSettingsUI();
        return true;
    } catch (e) { console.error('Auth:', e.message); return false; }
}