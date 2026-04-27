// extensions/senko-phone/senko-phone.js
import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "senko-phone";
const defaultSettings = { is_active: false };

// extensions/senko-phone/index.js
// Правильные пути импортов оставьте если нужно, но этот файл самодостаточен
// Если у вас есть extension_settings, можно интегрировать позже.

(function () {
  // Защитная инициализация
  function safeLog(...args) { console.log("Senko Phone:", ...args); }

  function saveLocalData() {
    try {
      localStorage.setItem("senkoPhoneData_v1", JSON.stringify(window.senkoPhoneData));
    } catch (e) { console.error("Senko Phone save error", e); }
  }

  function loadLocalData() {
    try {
      const raw = localStorage.getItem("senkoPhoneData_v1");
      if (raw) window.senkoPhoneData = Object.assign(window.senkoPhoneData || {}, JSON.parse(raw));
    } catch (e) { console.error("Senko Phone load error", e); }
  }

  // HTML шаблоны
  const phoneButtonHtml = `
    <div id="senko_phone_button_wrapper" style="display:inline-block; margin-left:8px;">
      <button id="senko_open_phone" class="menu_button" title="Открыть телефон персонажа">📱</button>
    </div>
  `;

  const drawerHtml = `
    <div id="senko_phone_drawer" class="senko-drawer" style="display:none;">
      <div class="senko-drawer-header">
        <strong>📱 Senko Phone</strong>
        <div class="senko-drawer-controls">
          <button id="senko_export_json" class="menu_button">Export</button>
          <button id="senko_close_phone" class="menu_button">✖</button>
        </div>
      </div>

      <div class="senko-tabs">
        <div class="senko-tab-buttons">
          <button class="senko_tab_btn" data-tab="messages">Сообщения</button>
          <button class="senko_tab_btn" data-tab="notes">Заметки</button>
          <button class="senko_tab_btn" data-tab="profile">Профиль</button>
        </div>

        <div id="senko_tab_messages" class="senko_tab" style="display:none;">
          <div style="margin-bottom:8px;">
            <select id="senko_select_character"></select>
            <button id="senko_new_character" class="menu_button">Новый</button>
          </div>
          <div id="senko_messages_list" class="senko-messages-list"></div>
          <div class="senko-message-input-row">
            <input id="senko_message_input" placeholder="Сообщение от персонажа...">
            <button id="senko_send_message" class="menu_button">Добавить</button>
            <button id="senko_insert_to_chat" class="menu_button">→ В чат</button>
          </div>
        </div>

        <div id="senko_tab_notes" class="senko_tab" style="display:none;">
          <textarea id="senko_notes_area" class="senko-notes-area"></textarea>
          <div style="margin-top:8px;"><button id="senko_save_notes" class="menu_button">Сохранить заметки</button></div>
        </div>

        <div id="senko_tab_profile" class="senko_tab" style="display:none;">
          <div>
            <label>Имя: <input id="senko_profile_name"></label><br>
            <label>Описание: <input id="senko_profile_desc" style="width:100%"></label>
          </div>
          <div style="margin-top:8px;"><button id="senko_save_profile" class="menu_button">Сохранить профиль</button></div>
        </div>
      </div>
    </div>
  `;

  // Основная инициализация
  function initSenkoPhone() {
    safeLog("инициализация...");

    // вставляем стили защиты если ещё нет
    if (!document.getElementById("senko_phone_styles")) {
      const style = document.createElement("style");
      style.id = "senko_phone_styles";
      style.innerHTML = `
        .senko-drawer {
          position: fixed;
          right: 12px;
          top: 80px;
          width: 360px;
          height: calc(100% - 160px);
          background: var(--bg-color, #0f1115);
          color: var(--text-color, #e6e6e6);
          border-left: 1px solid rgba(255,255,255,0.04);
          box-shadow: 0 8px 30px rgba(0,0,0,0.6);
          z-index: 99999 !important;
          overflow: auto;
          padding: 12px;
          border-radius: 8px 0 0 8px;
          pointer-events: auto;
        }
        .senko-drawer-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .senko-tab-buttons { display:flex; gap:6px; margin-bottom:8px; }
        .senko-messages-list { height:300px; overflow:auto; background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; }
        .senko-message-input-row { margin-top:8px; display:flex; gap:6px; }
        .senko-notes-area { width:100%; height:300px; }
      `;
      document.head.appendChild(style);
    }

    // Вставляем кнопку и drawer в body если ещё не вставлены
    if (!document.getElementById("senko_phone_button_wrapper")) {
      // пытаемся вставить рядом с кнопкой отправки, иначе в body
      const sendBtn = document.querySelector("#send_button, #send, button.send, .send-button");
      if (sendBtn && sendBtn.parentElement) {
        sendBtn.insertAdjacentHTML("beforebegin", phoneButtonHtml);
      } else {
        document.body.insertAdjacentHTML("beforeend", phoneButtonHtml);
      }
    }

    if (!document.getElementById("senko_phone_drawer")) {
      document.body.insertAdjacentHTML("beforeend", drawerHtml);
    }

    // Инициализация данных
    window.senkoPhoneData = window.senkoPhoneData || { characters: {} };
    loadLocalData();

    // UI вспомогательные функции
    function refreshCharacterSelect() {
      const sel = document.getElementById("senko_select_character");
      if (!sel) return;
      sel.innerHTML = "";
      const chars = Object.keys(window.senkoPhoneData.characters || {});
      if (chars.length === 0) {
        const opt = document.createElement("option"); opt.value = ""; opt.textContent = "(нет персонажей)"; sel.appendChild(opt);
      } else {
        chars.forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o); });
      }
    }

    function renderMessagesForCharacter(name) {
      const list = document.getElementById("senko_messages_list");
      if (!list) return;
      list.innerHTML = "";
      if (!name || !window.senkoPhoneData.characters[name]) return;
      const msgs = window.senkoPhoneData.characters[name].messages || [];
      msgs.forEach(m => {
        const el = document.createElement("div");
        el.className = "senko-message-item";
        el.style.padding = "6px";
        el.style.marginBottom = "6px";
        el.style.borderRadius = "6px";
        el.style.background = "rgba(255,255,255,0.02)";
        el.innerHTML = `<div style="font-size:12px;color:var(--muted-color,#aaa)">${m.time || ""}</div><div>${m.text}</div>`;
        list.appendChild(el);
      });
      list.scrollTop = list.scrollHeight;
    }

    // Делегированные обработчики
    document.addEventListener("click", function (e) {
      const target = e.target;

      if (target && target.id === "senko_open_phone") {
        e.preventDefault();
        const drawer = document.getElementById("senko_phone_drawer");
        if (drawer) drawer.style.display = (drawer.style.display === "none" || !drawer.style.display) ? "block" : "none";
      }

      if (target && target.id === "senko_close_phone") {
        e.preventDefault();
        const drawer = document.getElementById("senko_phone_drawer");
        if (drawer) drawer.style.display = "none";
      }

      if (target && target.id === "senko_new_character") {
        e.preventDefault();
        const name = prompt("Имя персонажа:");
        if (!name) return;
        window.senkoPhoneData.characters[name] = window.senkoPhoneData.characters[name] || { messages: [], notes: "", profile: {} };
        saveLocalData();
        refreshCharacterSelect();
        const sel = document.getElementById("senko_select_character");
        if (sel) { sel.value = name; sel.dispatchEvent(new Event('change')); }
      }

      if (target && target.id === "senko_send_message") {
        e.preventDefault();
        const sel = document.getElementById("senko_select_character");
        const name = sel ? sel.value : null;
        if (!name) { window.toastr?.error("Выберите персонажа"); return; }
        const input = document.getElementById("senko_message_input");
        const text = input ? input.value.trim() : "";
        if (!text) return;
        const msg = { text, time: new Date().toLocaleString() };
        window.senkoPhoneData.characters[name].messages.push(msg);
        if (input) input.value = "";
        renderMessagesForCharacter(name);
        saveLocalData();
      }

      if (target && target.id === "senko_insert_to_chat") {
        e.preventDefault();
        const sel = document.getElementById("senko_select_character");
        const name = sel ? sel.value : null;
        if (!name) { window.toastr?.error("Выберите персонажа"); return; }
        const msgs = window.senkoPhoneData.characters[name].messages || [];
        if (!msgs.length) { window.toastr?.info("Нет сообщений"); return; }
        const last = msgs[msgs.length - 1].text;
        // Попробуем найти поле ввода ST
        const stInput = document.querySelector("#input_textarea, #input, textarea, #input_text");
        if (stInput) {
          stInput.value = last;
          stInput.dispatchEvent(new Event('input', { bubbles: true }));
          window.toastr?.success("Текст вставлен в поле ввода");
        } else {
          navigator.clipboard.writeText(last).then(() => window.toastr?.success("Текст скопирован в буфер"));
        }
      }

      if (target && target.id === "senko_save_notes") {
        e.preventDefault();
        const sel = document.getElementById("senko_select_character");
        const name = sel ? sel.value : null;
        if (!name) { window.toastr?.error("Выберите персонажа"); return; }
        const notes = document.getElementById("senko_notes_area").value;
        window.senkoPhoneData.characters[name].notes = notes;
        saveLocalData();
        window.toastr?.success("Заметки сохранены");
      }

      if (target && target.id === "senko_save_profile") {
        e.preventDefault();
        const sel = document.getElementById("senko_select_character");
        const name = sel ? sel.value : null;
        if (!name) { window.toastr?.error("Выберите персонажа"); return; }
        const profile = {
          name: document.getElementById("senko_profile_name").value,
          desc: document.getElementById("senko_profile_desc").value
        };
        window.senkoPhoneData.characters[name].profile = profile;
        saveLocalData();
        window.toastr?.success("Профиль сохранён");
      }

      if (target && target.id === "senko_export_json") {
        e.preventDefault();
        const dataStr = JSON.stringify(window.senkoPhoneData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "senko_phone_data.json"; document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }
    });

    // change handler for select
    document.addEventListener("change", function (e) {
      const t = e.target;
      if (t && t.id === "senko_select_character") {
        const name = t.value;
        if (!name) return;
        const ch = window.senkoPhoneData.characters[name];
        document.getElementById("senko_notes_area").value = ch.notes || "";
        document.getElementById("senko_profile_name").value = ch.profile?.name || name;
        document.getElementById("senko_profile_desc").value = ch.profile?.desc || "";
        renderMessagesForCharacter(name);
      }
    });

    // Инициализация UI
    refreshCharacterSelect();
    if (!window.senkoPhoneData.characters["Senko"]) {
      window.senkoPhoneData.characters["Senko"] = { messages: [], notes: "", profile: { name: "Senko", desc: "" } };
      saveLocalData();
      refreshCharacterSelect();
    }
    // выбрать Senko
    const sel = document.getElementById("senko_select_character");
    if (sel) { sel.value = "Senko"; sel.dispatchEvent(new Event('change')); }

    safeLog("готово");
  }

  // Запуск после загрузки
  function start() {
    try {
      initSenkoPhone();
    } catch (e) {
      console.error("Senko Phone init error", e);
    }
  }

  if (document.readyState === "complete") {
    setTimeout(start, 200);
  } else {
    window.addEventListener("load", () => setTimeout(start, 200));
  }
})();
