/**
 * 键盘 + 触屏输入：WASD/方向键移动、空格射击、虚拟摇杆。
 */
const InputManager = (() => {
  const keys = {};
  let moveX = 0;
  let moveY = 0;
  let shootHeld = false;
  let shootPressed = false;
  let touchMode = false;
  let onPause = null;
  let onQuit = null;
  let onAny = null;

  const DIRS = {
    ArrowUp: [0, -1],
    KeyW: [0, -1],
    ArrowDown: [0, 1],
    KeyS: [0, 1],
    ArrowLeft: [-1, 0],
    KeyA: [-1, 0],
    ArrowRight: [1, 0],
    KeyD: [1, 0]
  };

  function computeMove() {
    let x = 0;
    let y = 0;
    if (keys.ArrowLeft || keys.KeyA) x -= 1;
    if (keys.ArrowRight || keys.KeyD) x += 1;
    if (keys.ArrowUp || keys.KeyW) y -= 1;
    if (keys.ArrowDown || keys.KeyS) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 0.7071;
      x *= inv;
      y *= inv;
    }
    moveX = x;
    moveY = y;
  }

  function bind() {
    window.addEventListener("keydown", (event) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)
      ) {
        event.preventDefault();
      }
      if (onAny && !event.repeat) onAny("keydown");
      keys[event.code] = true;
      if (event.code === "Space") {
        shootHeld = true;
        shootPressed = true;
      }
      computeMove();
      if (event.code === "KeyP" || event.code === "Escape") {
        if (onPause) onPause();
      }
      if (event.code === "KeyQ") {
        if (onQuit) onQuit();
      }
    });

    window.addEventListener("keyup", (event) => {
      keys[event.code] = false;
      if (event.code === "Space") shootHeld = false;
      computeMove();
    });

    window.addEventListener("blur", () => {
      Object.keys(keys).forEach((key) => {
        keys[key] = false;
      });
      shootHeld = false;
      computeMove();
    });
  }

  function bindTouch(joystick, knob, fireBtn) {
    let pointerId = null;
    let origin = { x: 0, y: 0 };
    const radius = 40;

    joystick.addEventListener("pointerdown", (event) => {
      touchMode = true;
      if (onAny) onAny("touch");
      joystick.setPointerCapture(event.pointerId);
      pointerId = event.pointerId;
      const rect = joystick.getBoundingClientRect();
      origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateStick(event.clientX, event.clientY);
      event.preventDefault();
    });

    joystick.addEventListener("pointermove", (event) => {
      if (event.pointerId === pointerId) {
        updateStick(event.clientX, event.clientY);
      }
    });

    function endStick(event) {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      moveX = 0;
      moveY = 0;
      knob.style.transform = "translate(-50%, -50%)";
    }

    joystick.addEventListener("pointerup", endStick);
    joystick.addEventListener("pointercancel", endStick);

    fireBtn.addEventListener("pointerdown", (event) => {
      touchMode = true;
      if (onAny) onAny("touch");
      shootHeld = true;
      shootPressed = true;
      fireBtn.style.transform = "scale(0.92)";
      event.preventDefault();
    });

    function endFire() {
      shootHeld = false;
      fireBtn.style.transform = "";
    }

    fireBtn.addEventListener("pointerup", endFire);
    fireBtn.addEventListener("pointercancel", endFire);

    function updateStick(clientX, clientY) {
      let dx = clientX - origin.x;
      let dy = clientY - origin.y;
      const len = Math.hypot(dx, dy);
      if (len > radius) {
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const magnitude = Math.min(1, len / radius);
      if (len < 6) {
        moveX = 0;
        moveY = 0;
      } else {
        moveX = (dx / radius) * magnitude;
        moveY = (dy / radius) * magnitude;
      }
    }
  }

  function getMove() {
    return { x: moveX, y: moveY };
  }

  function getShootHeld() {
    return shootHeld;
  }

  function consumeShootPress() {
    const value = shootPressed;
    shootPressed = false;
    return value;
  }

  function clearShootPressed() {
    shootPressed = false;
  }

  function setTouchMode(value) {
    touchMode = value;
  }

  function isTouch() {
    return touchMode;
  }

  function setCallbacks(callbacks) {
    onPause = callbacks.pause || null;
    onQuit = callbacks.quit || null;
    onAny = callbacks.any || null;
  }

  return {
    bind,
    bindTouch,
    getMove,
    getShootHeld,
    consumeShootPress,
    clearShootPressed,
    setTouchMode,
    isTouch,
    setCallbacks
  };
})();
