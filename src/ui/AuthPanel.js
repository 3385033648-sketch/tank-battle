/**
 * Welcome, sign-up and sign-in panel.
 */
const AuthPanel = (() => {
  let inited = false;

  function el(id) {
    return document.getElementById(id);
  }

  function showView(name) {
    ["authWelcome", "authSignup", "authLogin"].forEach((view) => {
      el(view).classList.toggle("hidden", view !== name);
    });
    el("authMessage") && (el("authMessage").textContent = "");
    el("signupMessage").textContent = "";
    el("loginMessage").textContent = "";
  }

  function showMessage(node, text, isError) {
    node.textContent = text;
    node.classList.toggle("error", !!isError);
    node.classList.toggle("success", !isError);
  }

  function open() {
    el("authPanel").classList.remove("hidden");
  }

  function close() {
    el("authPanel").classList.add("hidden");
  }

  function showWelcomeIfNeeded() {
    const user = SupabaseAuth.getCurrentUser();
    if (user) return;
    if (!SupabaseAuth.isConfigured()) {
      el("authDesc").textContent = "当前未配置云端服务，使用离线存档模式";
    }
    open();
  }

  async function handleSignup() {
    const email = el("signupEmail").value.trim();
    const password = el("signupPassword").value;
    const confirm = el("signupConfirm").value;
    if (password !== confirm) {
      showMessage(el("signupMessage"), "两次输入的密码不一致", true);
      return;
    }
    const result = await SupabaseAuth.signUp(email, password);
    if (!result.ok) {
      showMessage(el("signupMessage"), result.error, true);
      return;
    }
    if (result.needsConfirmation) {
      showMessage(el("signupMessage"), "注册成功，请查收验证邮件后登录", false);
      return;
    }
    close();
  }

  async function handleLogin() {
    const email = el("loginEmail").value.trim();
    const password = el("loginPassword").value;
    const rememberMe = el("loginRemember").checked;
    const result = await SupabaseAuth.signIn(email, password, rememberMe);
    if (!result.ok) {
      showMessage(el("loginMessage"), result.error, true);
      return;
    }
    close();
  }

  function init() {
    if (inited) return;
    inited = true;
    el("authClose").addEventListener("click", close);
    el("authSignupBtn").addEventListener("click", () => showView("authSignup"));
    el("authLoginBtn").addEventListener("click", () => showView("authLogin"));
    el("authGuestBtn").addEventListener("click", close);
    el("signupBack").addEventListener("click", () => showView("authWelcome"));
    el("loginBack").addEventListener("click", () => showView("authWelcome"));
    el("signupSubmit").addEventListener("click", handleSignup);
    el("loginSubmit").addEventListener("click", handleLogin);
    SupabaseAuth.onAuthChange((user) => {
      if (user && !user.isGuest) close();
    });
    setTimeout(showWelcomeIfNeeded, 350);
  }

  return {
    init,
    open,
    close,
    showWelcomeIfNeeded
  };
})();
