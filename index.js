
// --- Надёжная вставка кнопки и drawer + MutationObserver + левое позиционирование
(function () {
  const PHONE_BUTTON_ID = "senko_open_phone";
  const PHONE_WRAPPER_ID = "senko_phone_button_wrapper";
  const DRAWER_ID = "senko_phone_drawer";

  const phoneButtonHtml = `
    <div id="${PHONE_WRAPPER_ID}" style="display:inline-block; margin-left:8px;">
      <button id="${PHONE_BUTTON_ID}" class="menu_button" title="Открыть телефон персонажа">📱</button>
    </div>
  `;

  const drawerHtml = `...`; // ваш drawerHtml (как в index.js), без изменения

  function ensureDrawerInBody() {
    if (!document.getElementById(DRAWER_ID)) {
      document.body.insertAdjacentHTML("beforeend", drawerHtml);
      console.log("Senko Phone: drawer inserted into body");
    }
    // Принудительно установить левое позиционирование
    const drawer = document.getElementById(DRAWER_ID);
    if (drawer) {
      drawer.style.left = "12px";
      drawer.style.right = "auto";
      drawer.style.top = "80px";
      drawer.style.zIndex = "99999";
      drawer.style.pointerEvents = "auto";
    }
  }

  function insertButtonNearSend() {
    // Попробуем найти кнопку отправки
    const sendBtn = document.querySelector("#send_button, #send, button.send, .send-button");
    if (sendBtn && sendBtn.parentElement) {
      // если уже есть — не вставляем дубликат
      if (!document.getElementById(PHONE_WRAPPER_ID)) {
        sendBtn.insertAdjacentHTML("beforebegin", phoneButtonHtml);
        console.log("Senko Phone: button inserted before send button");
      }
      return true;
    } else {
      // fallback: вставляем в body, если нет кнопки отправки
      if (!document.getElementById(PHONE_WRAPPER_ID)) {
        document.body.insertAdjacentHTML("beforeend", phoneButtonHtml);
        console.log("Senko Phone: send button not found, inserted button into body (fallback)");
      }
      return false;
    }
  }

  // Вставляем drawer и кнопку при старте
  function initialInsert() {
    ensureDrawerInBody();
    insertButtonNearSend();
  }

  // MutationObserver: следим за изменениями в контейнере, где обычно находится поле ввода/кнопка отправки
  function startObserver() {
    const root = document.body;
    const observer = new MutationObserver((mutations) => {
      // если кнопка исчезла — восстановим
      if (!document.getElementById(PHONE_WRAPPER_ID)) {
        console.log("Senko Phone: button missing, restoring...");
        insertButtonNearSend();
      }
      // если drawer исчез — восстановим
      if (!document.getElementById(DRAWER_ID)) {
        console.log("Senko Phone: drawer missing, restoring...");
        ensureDrawerInBody();
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    console.log("Senko Phone: MutationObserver started");
  }

  // Делегированные обработчики (toggle drawer)
  document.addEventListener("click", function (e) {
    const t = e.target;
    if (!t) return;
    if (t.id === PHONE_BUTTON_ID) {
      e.preventDefault();
      const drawer = document.getElementById(DRAWER_ID);
      if (drawer) {
        drawer.style.display = (drawer.style.display === "block") ? "none" : "block";
      }
    }
    if (t.id === "senko_close_phone") {
      e.preventDefault();
      const drawer = document.getElementById(DRAWER_ID);
      if (drawer) drawer.style.display = "none";
    }
  });

  // Запуск
  window.addEventListener("load", () => {
    setTimeout(() => {
      try {
        initialInsert();
        startObserver();
      } catch (e) {
        console.error("Senko Phone init error:", e);
      }
    }, 200);
  });

  // Если документ уже загружен
  if (document.readyState === "complete") {
    setTimeout(() => { initialInsert(); startObserver(); }, 200);
  }
})();
