/**
 * Supabase authentication wrapper with offline fallback.
 */
const SupabaseAuth = (() => {
  let client = null;
  let currentUser = null;
  let listeners = [];
  let remember = true;
  let ready = false;

  function isConfigured() {
    const config = GameConfig.SUPABASE_CONFIG || {};
    return !!(config.url && config.anonKey);
  }

  function isSdkReady() {
    return !!(window.supabase && window.supabase.createClient);
  }

  function waitForSdk(timeout) {
    if (isSdkReady()) return Promise.resolve(true);
    if (!isConfigured()) return Promise.resolve(false);
    const limit = timeout || 8000;
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (isSdkReady()) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > limit || window.__supabaseSdkFailed) {
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });
  }

  function createSupabaseClient(persistSession) {
    const config = GameConfig.SUPABASE_CONFIG;
    return window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: persistSession !== false,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  function notify() {
    const snapshot = getDisplayUser();
    listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (err) {
        // Ignore listener errors.
      }
    });
  }

  function getCurrentUser() {
    return currentUser;
  }

  function getDisplayUser() {
    if (currentUser) {
      return {
        id: currentUser.id,
        email: currentUser.email || "",
        name: (currentUser.user_metadata && currentUser.user_metadata.name) || currentUser.email || "",
        isGuest: false
      };
    }
    return { id: "guest", email: "游客", name: "游客", isGuest: true };
  }

  function getClient() {
    return client;
  }

  function isAvailable() {
    return !!client;
  }

  async function init() {
    if (ready) return { user: currentUser, offline: !client };
    ready = true;
    const sdkOk = await waitForSdk();
    if (!sdkOk || !isConfigured()) {
      notify();
      return { user: null, offline: true };
    }
    try {
      client = createSupabaseClient(remember);
      const { data } = await client.auth.getSession();
      currentUser = data && data.session && data.session.user ? data.session.user : null;
      client.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        notify();
      });
    } catch (err) {
      client = null;
      currentUser = null;
    }
    notify();
    return { user: currentUser, offline: !client };
  }

  function mapError(message) {
    const text = String(message || "").toLowerCase();
    if (text.indexOf("already registered") >= 0 || text.indexOf("already been registered") >= 0) {
      return "该邮箱已被注册";
    }
    if (text.indexOf("invalid login") >= 0 || text.indexOf("invalid credentials") >= 0) {
      return "账号不存在或密码错误";
    }
    if (text.indexOf("email not confirmed") >= 0) {
      return "邮箱尚未验证，请先查收验证邮件";
    }
    if (text.indexOf("network") >= 0 || text.indexOf("fetch") >= 0 || text.indexOf("load failed") >= 0) {
      return "网络异常，已切换离线模式";
    }
    return message || "操作失败，请稍后重试";
  }

  async function signUp(email, password) {
    const normalized = String(email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { ok: false, error: "请输入正确的邮箱地址" };
    }
    if (!password || String(password).length < 6) {
      return { ok: false, error: "密码至少需要 6 位" };
    }
    if (!isConfigured()) {
      return { ok: false, error: "当前为离线模式：请先在 config.js 中配置 Supabase" };
    }
    if (!(await waitForSdk())) {
      return { ok: false, error: "网络异常，已切换离线模式" };
    }
    try {
      if (!client) client = createSupabaseClient(remember);
      const { data, error } = await client.auth.signUp({ email: normalized, password: String(password) });
      if (error) return { ok: false, error: mapError(error.message) };
      if (data.session) {
        currentUser = data.user || null;
        notify();
      }
      return { ok: true, user: data.user, needsConfirmation: !data.session };
    } catch (err) {
      return { ok: false, error: "网络异常，已切换离线模式" };
    }
  }

  async function signIn(email, password, rememberMe) {
    const normalized = String(email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { ok: false, error: "请输入正确的邮箱地址" };
    }
    if (!password) {
      return { ok: false, error: "请输入密码" };
    }
    if (!isConfigured()) {
      return { ok: false, error: "当前为离线模式：请先在 config.js 中配置 Supabase" };
    }
    if (!(await waitForSdk())) {
      return { ok: false, error: "网络异常，已切换离线模式" };
    }
    try {
      remember = rememberMe !== false;
      if (client && rememberMe === false) {
        try {
          await client.auth.signOut();
        } catch (err) {
          // Ignore sign-out errors while switching session persistence.
        }
        client = createSupabaseClient(false);
      } else if (!client) {
        client = createSupabaseClient(remember);
      }
      const { data, error } = await client.auth.signInWithPassword({
        email: normalized,
        password: String(password)
      });
      if (error) return { ok: false, error: mapError(error.message) };
      currentUser = data.user || null;
      notify();
      return { ok: true, user: currentUser };
    } catch (err) {
      return { ok: false, error: "网络异常，已切换离线模式" };
    }
  }

  async function signOut() {
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        // Continue clearing local state even if the network call fails.
      }
    }
    currentUser = null;
    notify();
  }

  function onAuthChange(callback) {
    listeners.push(callback);
    const snapshot = getDisplayUser();
    try {
      callback(snapshot);
    } catch (err) {
      // Ignore listener errors.
    }
    return () => {
      listeners = listeners.filter((cb) => cb !== callback);
    };
  }

  return {
    init,
    signUp,
    signIn,
    signOut,
    onAuthChange,
    getCurrentUser,
    getDisplayUser,
    getClient,
    isAvailable,
    isConfigured
  };
})();
