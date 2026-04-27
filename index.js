// extensions/senko-phone/senko-phone.js
import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "senko-phone";
const defaultSettings = { is_active: false };

// Простая структура данных в памяти и localStorage
window.senkoPhoneData = window.senkoPhoneData || {
    characters: {} // example: characters["Senko"] = { messages: [], notes: [], profile: {...} }
};

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    $("#senko_active_setting").prop("checked", extension_settings[extensionName].is_active);
}

function onCheckboxChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].is_active = value;
    saveSettingsDebounced();
}

// Utility: save to localStorage
function saveLocalData() {
    try {
        localStorage.setItem("senkoPhoneData_v1", JSON.stringify(window.senkoPhoneData));
    } catch (e) {
        console.error("Senko Phone: save error", e);
    }
}

// Utility: load from localStorage
function loadLocalData() {
    try {
        const raw = localStorage.getItem("senkoPhoneData_v1");
        if (raw) {
            const parsed = JSON.parse(raw);
            window.senkoPhoneData = Object.assign(window.senkoPhoneData || {}, parsed);
        }
    } catch (e) {
        console.error("Senko Phone: load error", e);
    }
}

// Создаем кнопку рядом с полем ввода и сам drawer
jQuery(async () => {
    console.log("🦊 Senko Phone: инициализация...");

    // Подождём, пока поле ввода появится (селектор может отличаться в вашей версии ST)
    const waitFor = (sel, timeout = 5000) => new Promise((res, rej) => {
        const start = Date.now();
        const iv = setInterval(() => {
            const el = $(sel);
            if (el.length) { clearInterval(iv); res(el); }
            if (Date.now() - start > timeout) { clearInterval(iv); rej("timeout"); }
        }, 100);
    });

    let inputArea;
    try {
        inputArea = await waitFor("#input_textarea, #input, textarea, #input_text"); // пробуем несколько селекторов
    } catch (e) {
        console.warn("Senko Phone: не нашёл поле ввода по стандартным селекторам.");
        inputArea = $("textarea").first();
    }

    // Добавляем кнопку рядом с полем ввода (обёртка)
    const phoneButtonHtml = `
        <div id="senko_phone_button_wrapper" style="display:inline-block; margin-left:8px;">
            <button id="senko_open_phone" class="menu_button" title="Открыть телефон персонажа">📱</button>
        </div>
    `;
    // Попробуем добавить рядом с кнопкой отправки или полем ввода
    const sendBtn = $("#send_button, #send, button.send, .send-button").first();
    if (sendBtn.length) {
        $(phoneButtonHtml).insertBefore(sendBtn);
    } else {
        // fallback: вставим после поля ввода
        $(phoneButtonHtml).insertAfter(inputArea);
    }

    // Drawer HTML (скрыт по умолчанию)
    const drawerHtml = `
        <div id="senko_phone_drawer" style="
            position: fixed;
            right: 12px;
            top: 80px;
            width: 360px;
            height: calc(100% - 160px);
            background: var(--bg-color, #111);
            color: var(--text-color, #eee);
            border-left: 1px solid rgba(255,255,255,0.06);
            box-shadow: 0 8px 30px rgba(0,0,0,0.6);
            z-index: 9999;
            display: none;
            overflow: auto;
            padding: 12px;
            border-radius: 8px 0 0 8px;
        ">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>📱 Senko Phone</strong>
                <div>
                    <button id="senko_export_json" class="menu_button">Export</button>
                    <button id="senko_close_phone" class="menu_button">✖</button>
                </div>
            </div>

            <div id="senko_tabs">
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                    <button class="senko_tab_btn" data-tab="messages">Сообщения</button>
                    <button class="senko_tab_btn" data-tab="notes">Заметки</button>
                    <button class="senko_tab_btn" data-tab="profile">Профиль</button>
                </div>

                <div id="senko_tab_messages" class="senko_tab" style="display:none;">
                    <div style="margin-bottom:8px;">
                        <select id="senko_select_character"></select>
                        <button id="senko_new_character" class="menu_button">Новый</button>
                    </div>
                    <div id="senko_messages_list" style="height:300px; overflow:auto; background:rgba(255,255,255,0.02); padding:8px; border-radius:6px;"></div>
                    <div style="margin-top:8px; display:flex; gap:6px;">
                        <input id="senko_message_input" style="flex:1;" placeholder="Сообщение от персонажа...">
                        <button id="senko_send_message" class="menu_button">Добавить</button>
                        <button id="senko_insert_to_chat" class="menu_button">→ В чат</button>
                    </div>
                </div>

                <div id="senko_tab_notes" class="senko_tab" style="display:none;">
                    <textarea id="senko_notes_area" style="width:100%; height:300px;"></textarea>
                    <div style="margin-top:8px;">
                        <button id="senko_save_notes" class="menu_button">Сохранить заметки</button>
                    </div>
                </div>

                <div id="senko_tab_profile" class="senko_tab" style="display:none;">
                    <div>
                        <label>Имя: <input id="senko_profile_name"></label><br>
                        <label>Описание: <input id="senko_profile_desc" style="width:100%"></label>
                    </div>
                    <div style="margin-top:8px;">
                        <button id="senko_save_profile" class="menu_button">Сохранить профиль</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    $("body").append(drawerHtml);

    // Загрузим данные из localStorage
    loadLocalData();

    // Инициализация UI: список персонажей
    function refreshCharacterSelect() {
        const sel = $("#senko_select_character");
        sel.empty();
        const chars = Object.keys(window.senkoPhoneData.characters || {});
        if (chars.length === 0) {
            sel.append(`<option value="">(нет персонажей)</option>`);
        } else {
            chars.forEach(c => sel.append(`<option value="${c}">${c}</option>`));
        }
    }

    function renderMessagesForCharacter(name) {
        const list = $("#senko_messages_list");
        list.empty();
        if (!name || !window.senkoPhoneData.characters[name]) return;
        const msgs = window.senkoPhoneData.characters[name].messages || [];
        msgs.forEach(m => {
            const el = $(`<div style="padding:6px; margin-bottom:6px; border-radius:6px; background:rgba(255,255,255,0.02);">
                <div style="font-size:12px; color:var(--muted-color,#aaa)">${m.time || ""}</div>
                <div>${m.text}</div>
            </div>`);
            list.append(el);
        });
        list.scrollTop(list[0].scrollHeight);
    }

    // Tab switching
    $(".senko_tab_btn").on("click", function () {
        const tab = $(this).data("tab");
        $(".senko_tab").hide();
        $(`#senko_tab_${tab}`).show();
        $(".senko_tab_btn").removeClass("active");
        $(this).addClass("active");
    });
    // default tab
    $(".senko_tab_btn[data-tab='messages']").click();

    // Button handlers
    $("#senko_open_phone").on("click", () => {
        $("#senko_phone_drawer").show();
        refreshCharacterSelect();
    });
    $("#senko_close_phone").on("click", () => $("#senko_phone_drawer").hide());

    $("#senko_new_character").on("click", () => {
        const name = prompt("Имя персонажа:");
        if (!name) return;
        window.senkoPhoneData.characters[name] = window.senkoPhoneData.characters[name] || { messages: [], notes: "", profile: {} };
        saveLocalData();
        refreshCharacterSelect();
        $("#senko_select_character").val(name).trigger("change");
    });

    $("#senko_select_character").on("change", function () {
        const name = $(this).val();
        if (!name) return;
        const ch = window.senkoPhoneData.characters[name];
        $("#senko_notes_area").val(ch.notes || "");
        $("#senko_profile_name").val(ch.profile?.name || name);
        $("#senko_profile_desc").val(ch.profile?.desc || "");
        renderMessagesForCharacter(name);
    });

    $("#senko_send_message").on("click", () => {
        const name = $("#senko_select_character").val();
        if (!name) { toastr.error("Выберите персонажа"); return; }
        const text = $("#senko_message_input").val().trim();
        if (!text) return;
        const msg = { text, time: new Date().toLocaleString() };
        window.senkoPhoneData.characters[name].messages.push(msg);
        $("#senko_message_input").val("");
        renderMessagesForCharacter(name);
        saveLocalData();
    });

    // Вставить выбранное сообщение в поле ввода SillyTavern
    $("#senko_insert_to_chat").on("click", () => {
        const name = $("#senko_select_character").val();
        if (!name) { toastr.error("Выберите персонажа"); return; }
        const msgs = window.senkoPhoneData.characters[name].messages;
        if (!msgs || msgs.length === 0) { toastr.info("Нет сообщений"); return; }
        const last = msgs[msgs.length - 1].text;
        // Попробуем найти поле ввода ST
        const stInput = $("#input_textarea, #input, textarea, #input_text").first();
        if (stInput.length) {
            stInput.val(last);
            stInput.trigger("input");
            toastr.success("Текст вставлен в поле ввода");
        } else {
            // fallback: копируем в буфер
            navigator.clipboard.writeText(last).then(() => toastr.success("Текст скопирован в буфер"));
        }
    });

    // Notes save
    $("#senko_save_notes").on("click", () => {
        const name = $("#senko_select_character").val();
        if (!name) { toastr.error("Выберите персонажа"); return; }
        window.senkoPhoneData.characters[name].notes = $("#senko_notes_area").val();
        saveLocalData();
        toastr.success("Заметки сохранены");
    });

    // Profile save
    $("#senko_save_profile").on("click", () => {
        const name = $("#senko_select_character").val();
        if (!name) { toastr.error("Выберите персонажа"); return; }
        window.senkoPhoneData.characters[name].profile = {
            name: $("#senko_profile_name").val(),
            desc: $("#senko_profile_desc").val()
        };
        saveLocalData();
        toastr.success("Профиль сохранён");
    });

    // Export JSON (скачать файл)
    $("#senko_export_json").on("click", () => {
        const dataStr = JSON.stringify(window.senkoPhoneData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "senko_phone_data.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    // Инициализация списка персонажей при старте
    refreshCharacterSelect();
    // Если есть персонаж Senko — выбрать его
    if (window.senkoPhoneData.characters["Senko"]) {
        $("#senko_select_character").val("Senko").trigger("change");
    } else {
        // создадим Senko по умолчанию
        window.senkoPhoneData.characters["Senko"] = { messages: [], notes: "", profile: { name: "Senko", desc: "" } };
        saveLocalData();
        refreshCharacterSelect();
        $("#senko_select_character").val("Senko").trigger("change");
    }

    // Сохраняем настройки
    loadSettings();
});
