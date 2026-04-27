import { extension_settings } from "../../../extensions.js";
import * as st from "../../../../script.js";
import { phoneContent } from "./senkos-phone/content.js";
import { ChatCompletionService } from "../../../custom-request.js";
import { getChatCompletionModel, oai_settings } from "../../../openai.js";

const extensionName = "senko-phone";
const defaultApps = phoneContent.apps || [];
const defaultSettings = {
    is_active: true,
    panel_open: false,
    current_view: "home",
    messenger_subview: "list",
    apps: [],
    messenger: {
        contacts: [],
        active_contact_id: null,
        owner_persona: "",
    },
};

function makeId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;");
}

function sanitizeForPrompt(text, maxLen = 900) {
    const s = String(text ?? "")
        .replaceAll("\r", "\n")
        .replace(/[^\S\n]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/[*_`]/g, "")
        .replace(/>\s?/g, "")
        .trim();
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

function getApps() {
    return (extension_settings[extensionName].apps || []).length
        ? extension_settings[extensionName].apps
        : defaultApps;
}

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    extension_settings[extensionName] = Object.assign({}, defaultSettings, extension_settings[extensionName]);
    extension_settings[extensionName].messenger = Object.assign(
        {},
        defaultSettings.messenger,
        extension_settings[extensionName].messenger || {},
    );
    if (typeof extension_settings[extensionName].messenger.owner_persona !== "string") {
        extension_settings[extensionName].messenger.owner_persona = String(phoneContent.ownerPersona || "");
    }

    // Migration for older saved contacts
    const contacts = extension_settings[extensionName].messenger.contacts || [];
    for (const contact of contacts) {
        if (!contact.id) contact.id = makeId("contact");
        if (!Array.isArray(contact.messages)) contact.messages = [];
        if (typeof contact.name !== "string") contact.name = String(contact.name || "Без имени");
        if (typeof contact.description !== "string") contact.description = String(contact.description || "");
        if (typeof contact.customPrompt !== "string") contact.customPrompt = String(contact.customPrompt || "");
    }
}

function saveSettings() {
    st.saveSettingsDebounced();
}

function getActiveContact() {
    const messenger = extension_settings[extensionName].messenger;
    return messenger.contacts.find((c) => c.id === messenger.active_contact_id) || null;
}

function injectStyles() {
    if ($("#senko-phone-styles").length) return;
    $("head").append(`
        <style id="senko-phone-styles">
            #senko_phone_launch_btn { margin-left: 8px; min-width: 38px; height: 38px; border-radius: 10px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); cursor: pointer; }
            #senko_phone_panel { position: fixed; left: 6px; top: 44px; width: clamp(280px,23vw,340px); height: calc(100vh - 56px); background: linear-gradient(180deg,#1f2027 0%,#181a22 100%); border: 1px solid rgba(255,255,255,.14); border-radius: 30px; box-shadow: 0 16px 48px rgba(0,0,0,.5); display: none; z-index: 3500; overflow: hidden; }
            #senko_phone_panel.open { display: flex; flex-direction: column; }
            .senko-phone-top-bezel { width: 120px; height: 18px; border-radius: 0 0 14px 14px; margin: 0 auto; background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.05); border-top: 0; }
            .senko-phone-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.08); background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02)); }
            .senko-phone-close { border: 0; border-radius: 8px; width: 28px; height: 28px; cursor: pointer; background: rgba(255,255,255,.1); color: inherit; }
            .senko-phone-screen { flex: 1; position: relative; padding: 12px; overflow: auto; }
            .senko-phone-screen::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(9,14,28,.32), rgba(9,12,26,.52)), radial-gradient(circle at 70% 30%, rgba(255,166,74,.26), transparent 35%), radial-gradient(circle at 28% 14%, rgba(123,211,255,.22), transparent 34%), linear-gradient(160deg, #12203d 0%, #1d1a39 44%, #2c1f2f 100%); z-index: 0; }
            .senko-phone-overlay { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: 100%; }
            /* top action buttons removed */
            .senko-view { display: none; }
            .senko-view.active { display: block; }
            #senko_messenger_view.active { display: flex; flex-direction: column; flex: 1; }
            .senko-phone-app-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px 10px; }
            .senko-phone-app { border: 0; padding: 0; background: transparent; text-align: center; min-height: 88px; display: flex; flex-direction: column; align-items: center; gap: 7px; color: #f8f8f8; cursor: pointer; }
            .senko-phone-app-icon { position: relative; width: 54px; height: 54px; border-radius: 14px; background: linear-gradient(145deg, rgba(255,255,255,.32), rgba(255,255,255,.16)); border: 1px solid rgba(255,255,255,.24); box-shadow: 0 8px 16px rgba(0,0,0,.26); display: flex; align-items: center; justify-content: center; font-size: 24px; }
            .senko-phone-app.badge .senko-phone-app-icon::after { content: ""; position: absolute; top: -4px; right: -4px; width: 10px; height: 10px; border-radius: 50%; background: #ff4a4a; border: 1px solid rgba(255,255,255,.62); }
            .senko-phone-app-label { width: 100%; line-height: 1.15; font-size: 11px; text-shadow: 0 1px 4px rgba(0,0,0,.72); }
            .senko-phone-page-indicator { margin: 10px auto 0; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,.24); border-radius: 999px; padding: 8px 14px; }
            .senko-phone-page-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.45); }
            .senko-phone-page-dot.active { width: 16px; border-radius: 6px; background: rgba(255,255,255,.9); }
            .senko-messenger-header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; margin-bottom: 8px; }
            .senko-action-btn { border: 1px solid rgba(255,255,255,.2); border-radius: 10px; background: rgba(0,0,0,.24); color: #fff; padding: 7px 10px; cursor: pointer; }
            .senko-messenger-list { display: flex; flex-direction: column; gap: 6px; }
            .senko-contact-row { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.18); border-radius: 10px; padding: 8px; }
            .senko-contact-open { min-width: 0; background: transparent; border: 0; color: #fff; cursor: pointer; text-align: left; }
            .senko-contact-menu { background: transparent; border: 0; color: #fff; cursor: pointer; text-align: left; }
            .senko-contact-menu { font-size: 20px; line-height: 1; width: 22px; text-align: center; }
            .senko-contact-name { font-size: 13px; font-weight: 600; }
            .senko-contact-desc { font-size: 11px; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .senko-menu { position: absolute; right: 8px; top: 35px; width: 188px; border-radius: 10px; border: 1px solid rgba(255,255,255,.2); background: #25273a; box-shadow: 0 8px 20px rgba(0,0,0,.4); padding: 6px; z-index: 5; display: none; }
            .senko-menu.open { display: flex; flex-direction: column; gap: 4px; }
            .senko-menu button { border: 0; border-radius: 7px; background: rgba(255,255,255,.07); color: #fff; cursor: pointer; text-align: left; padding: 7px 8px; }
            .senko-menu button:hover { background: rgba(255,255,255,.16); }
            .senko-chat-view { display: none; flex-direction: column; gap: 8px; min-height: 100%; flex: 1; min-height: 0; }
            .senko-chat-view.active { display: flex; }
            #senko_chat_messages { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 7px; padding: 6px; border-radius: 10px; background: rgba(0,0,0,.22); border: 1px solid rgba(255,255,255,.16); }
            .senko-msg { border-radius: 10px; padding: 7px 9px; font-size: 12px; line-height: 1.25; max-width: 90%; word-break: break-word; }
            .senko-msg.user { align-self: flex-end; background: rgba(123,188,255,.28); }
            .senko-msg.assistant { align-self: flex-start; background: rgba(255,255,255,.18); }
            .senko-chat-input-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
            #senko_chat_input { border-radius: 10px; border: 1px solid rgba(255,255,255,.2); background: rgba(0,0,0,.25); color: #fff; padding: 8px 10px; }
            #senko_send_btn { border: 1px solid rgba(255,255,255,.24); border-radius: 10px; background: rgba(255,255,255,.12); color: #fff; padding: 0 12px; cursor: pointer; }
            .senko-phone-bottom-bezel { flex: 0 0 58px; border-top: 1px solid rgba(255,255,255,.08); background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.12)); display: flex; align-items: center; justify-content: center; }
            #senko_phone_home_btn { width: 54px; height: 54px; border-radius: 999px; border: 2px solid rgba(255,255,255,.22); background: radial-gradient(circle at 35% 35%, rgba(255,255,255,.25), rgba(255,255,255,.06)); box-shadow: inset 0 2px 6px rgba(0,0,0,.45); cursor: pointer; color: transparent; }
        </style>
    `);
}

function createPhonePanel() {
    if ($("#senko_phone_panel").length) return;
    $("body").append(`
        <div id="senko_phone_panel">
            <div class="senko-phone-top-bezel"></div>
            <div class="senko-phone-header">
                <div class="senko-phone-title">${phoneContent.phoneTitle || "🦊 Senko Phone"}</div>
                <button class="senko-phone-close" id="senko_phone_close_btn" title="Закрыть">✕</button>
            </div>
            <div class="senko-phone-screen">
                <div class="senko-phone-overlay">
                    <div class="senko-view active" id="senko_home_view">
                        <div class="senko-phone-app-grid" id="senko_phone_app_grid"></div>
                        <div class="senko-phone-page-indicator"><span class="senko-phone-page-dot"></span><span class="senko-phone-page-dot active"></span></div>
                    </div>
                    <div class="senko-view" id="senko_messenger_view">
                        <div id="senko_contact_list_view">
                            <div class="senko-messenger-header">
                                <button id="senko_back_home_btn" class="senko-action-btn">Домой</button>
                                <div></div>
                                <button id="senko_add_contact_btn" class="senko-action-btn">+ Контакт</button>
                            </div>
                            <div id="senko_contact_list" class="senko-messenger-list"></div>
                        </div>
                        <div id="senko_chat_view" class="senko-chat-view">
                            <div class="senko-messenger-header">
                                <button id="senko_back_to_list_btn" class="senko-action-btn">←</button>
                                <div id="senko_chat_title">Чат</div>
                                <button id="senko_chat_menu_btn" class="senko-action-btn" title="Меню">⋯</button>
                            </div>
                            <div class="senko-menu" id="senko_chat_menu">
                                <button data-action="name" data-scope="chat">Изменить имя</button>
                                <button data-action="description" data-scope="chat">Изменить описание</button>
                                <button data-action="prompt" data-scope="chat">Изменить подсказку</button>
                                <button data-action="owner-persona" data-scope="chat">Персона Сенко</button>
                                <button data-action="delete-last" data-scope="chat">Удалить последнее сообщение</button>
                                <button data-action="delete-contact" data-scope="chat">Удалить контакт</button>
                            </div>
                            <div id="senko_chat_messages"></div>
                            <div class="senko-chat-input-row">
                                <input id="senko_chat_input" type="text" placeholder="Сообщение контакту..." />
                                <button id="senko_send_btn">➤</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="senko-phone-bottom-bezel"><button id="senko_phone_home_btn">home</button></div>
        </div>
    `);
}

function setView(viewName) {
    extension_settings[extensionName].current_view = viewName;
    $("#senko_home_view").toggleClass("active", viewName === "home");
    $("#senko_messenger_view").toggleClass("active", viewName === "messenger");
    saveSettings();
}

function setMessengerSubview(mode) {
    extension_settings[extensionName].messenger_subview = mode;
    $("#senko_contact_list_view").toggle(mode === "list");
    $("#senko_chat_view").toggleClass("active", mode === "chat");
    saveSettings();
}

function renderApps() {
    const grid = $("#senko_phone_app_grid");
    if (!grid.length) return;
    grid.html(getApps().map((app) => `
        <button class="senko-phone-app ${app.badge ? "badge" : ""}" data-app-id="${app.id}">
            <div class="senko-phone-app-icon">${escapeHtml(app.icon || "📦")}</div>
            <div class="senko-phone-app-label">${escapeHtml(app.name || "App")}</div>
        </button>
    `).join(""));
}

function renderMessengerContacts() {
    const container = $("#senko_contact_list");
    if (!container.length) return;
    const contacts = extension_settings[extensionName].messenger.contacts || [];
    if (!contacts.length) {
        container.html(`<div class="senko-contact-row">Контактов пока нет</div>`);
        return;
    }
    const preview = (contact) => {
        const last = (contact.messages || []).at(-1);
        const text = (last?.text || contact.description || "Без сообщений").replaceAll("\n", " ").trim();
        return text.length > 46 ? `${text.slice(0, 46)}…` : text;
    };

    container.html(contacts.map((contact) => `
        <div class="senko-contact-row" data-contact-id="${contact.id}">
            <button class="senko-contact-open" data-contact-id="${contact.id}">
                <div class="senko-contact-name">${escapeHtml(contact.name || "Без имени")}</div>
                <div class="senko-contact-desc">${escapeHtml(preview(contact))}</div>
            </button>
            <button class="senko-contact-menu" data-contact-id="${contact.id}" title="Меню">⋯</button>
            <div class="senko-menu" id="senko_menu_${contact.id}">
                <button data-action="name" data-contact-id="${contact.id}">Изменить имя</button>
                <button data-action="description" data-contact-id="${contact.id}">Изменить описание</button>
                <button data-action="prompt" data-contact-id="${contact.id}">Изменить подсказку</button>
                <button data-action="owner-persona" data-contact-id="${contact.id}">Персона Сенко</button>
                <button data-action="delete-last" data-contact-id="${contact.id}">Удалить последнее сообщение</button>
                <button data-action="delete-contact" data-contact-id="${contact.id}">Удалить контакт</button>
            </div>
        </div>
    `).join(""));
}

function renderMessengerChat() {
    const contact = getActiveContact();
    $("#senko_chat_title").text(contact ? contact.name : "Чат");
    const box = $("#senko_chat_messages");
    if (!contact) {
        box.html(`<div class="senko-msg assistant">Контакт не выбран.</div>`);
        return;
    }
    const messages = contact.messages || [];
    if (!messages.length) {
        box.html(`<div class="senko-msg assistant">История пуста. Напишите первое сообщение.</div>`);
        return;
    }
    box.html(messages.map((msg) => `
        <div class="senko-msg ${msg.role === "user" ? "user" : "assistant"}">${escapeHtml(msg.text)}</div>
    `).join(""));
    box.scrollTop(box[0].scrollHeight);
}

function getRequestHeadersSafe() {
    if (typeof st.getRequestHeaders === "function") return st.getRequestHeaders();

    const meta =
        document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
        || document.querySelector('meta[name="csrf"]')?.getAttribute("content")
        || document.querySelector('meta[name="csrfToken"]')?.getAttribute("content");

    const headers = {};
    if (meta) headers["X-CSRF-Token"] = meta;
    return headers;
}

async function generateReplyViaSillyTavern(contact, userText) {
    const ownerName = String(phoneContent.ownerName || "Senko");
    const ownerPersona = sanitizeForPrompt(
        extension_settings[extensionName]?.messenger?.owner_persona || phoneContent.ownerPersona || "",
        520,
    );

    const basePersona = `
Ты персонаж "${contact.name}" и ведёшь переписку в мессенджере на телефоне.
Твой собеседник в чате — "${ownerName}" (владелец телефона).
Пиши от лица "${contact.name}", естественно и по-человечески.
`.trim();

    const safeDesc = sanitizeForPrompt(contact.description || "", 500);
    const cardBlock = safeDesc ? `Описание персонажа:\n${safeDesc}` : "";

    const safeCustom = sanitizeForPrompt(contact.customPrompt || "", 420);
    const customBlock = safeCustom ? `Доп. подсказка чата:\n${safeCustom}` : "";

    const ownerBlock = ownerPersona ? `Описание "${ownerName}":\n${ownerPersona}` : "";

    const personaPrompt = [basePersona, ownerBlock, cardBlock, customBlock].filter(Boolean).join("\n\n").trim();
    const isMakerSuiteLike = ["makersuite", "vertexai"].includes(String(oai_settings.chat_completion_source || "").toLowerCase());
    const historyMessages = (contact.messages || []).slice(-12).map((msg) => ({ role: msg.role, content: msg.text }));
    const buildMessages = (promptText) => (
        isMakerSuiteLike
            ? [
                {
                    role: "user",
                    content: `${promptText}\n\nФормат: короткие реплики, как в мессенджере. Всегда оставайся в роли персонажа.`,
                },
                ...historyMessages,
                { role: "user", content: userText },
            ]
            : [
                { role: "system", content: promptText },
                ...historyMessages,
                { role: "user", content: userText },
            ]
    );

    const model = getChatCompletionModel(oai_settings);
    const requestOnce = async (promptText) => {
        const messengerMaxTokens = Math.min(Number(oai_settings.openai_max_tokens) || 512, 700);
        const payload = ChatCompletionService.createRequestData({
            stream: false,
            model,
            chat_completion_source: oai_settings.chat_completion_source,
            max_tokens: messengerMaxTokens,
            temperature: Math.min(1, Math.max(0, Number(oai_settings.temp_openai) || 0.8)),
            custom_prompt_post_processing: oai_settings.custom_prompt_post_processing,
            use_sysprompt: false,
            messages: buildMessages(promptText),
        });
        const result = await ChatCompletionService.sendRequest(payload, true);
        return result?.content || "Нет ответа от модели.";
    };

    try {
        return await requestOnce(personaPrompt);
    } catch (error) {
        const message = String(error?.message || "");
        if (message.includes("PROHIBITED_CONTENT") || message.toLowerCase().includes("blocked")) {
            // Retry with a minimal prompt (exclude custom/description which may trigger Google safety)
            const minimalPrompt = `${basePersona}\n\n(Короткие ответы, стиль мессенджера.)`;
            return await requestOnce(minimalPrompt);
        }
        if (message.includes("Internal error encountered") || message.includes("INTERNAL")) {
            const minimalPrompt = `${basePersona}\n\n(Короткие ответы, стиль мессенджера.)`;
            return await requestOnce(minimalPrompt);
        }
        throw error;
    }
}

function setPanelVisibility(isOpen) {
    const panel = $("#senko_phone_panel");
    if (!panel.length) return;
    panel.toggleClass("open", isOpen);
    extension_settings[extensionName].panel_open = isOpen;
    saveSettings();
}

function togglePhonePanel() {
    setPanelVisibility(!$("#senko_phone_panel").hasClass("open"));
}

function openChatByContactId(contactId) {
    extension_settings[extensionName].messenger.active_contact_id = contactId;
    setMessengerSubview("chat");
    renderMessengerChat();
    saveSettings();
}

function bindPhoneEvents() {
    $(document).off("click.senkoCloseBtn", "#senko_phone_close_btn").on("click.senkoCloseBtn", "#senko_phone_close_btn", () => setPanelVisibility(false));
    $(document).off("click.senkoHomeBtn", "#senko_phone_home_btn").on("click.senkoHomeBtn", "#senko_phone_home_btn", () => setView("home"));
    $(document).off("click.senkoBackHome", "#senko_back_home_btn").on("click.senkoBackHome", "#senko_back_home_btn", () => setView("home"));
    $(document).off("click.senkoBackList", "#senko_back_to_list_btn").on("click.senkoBackList", "#senko_back_to_list_btn", () => setMessengerSubview("list"));

    $(document).off("click.senkoApp", ".senko-phone-app").on("click.senkoApp", ".senko-phone-app", function () {
        const appId = $(this).data("app-id");
        if (appId === "messenger") {
            setView("messenger");
            setMessengerSubview("list");
            renderMessengerContacts();
            return;
        }
        const app = getApps().find((entry) => entry.id === appId);
        toastr.info(`Пока не реализовано: ${app?.name || "Приложение"}`, phoneContent.phoneTitle || "Senko Phone");
    });

    $(document).off("click.senkoAddContact", "#senko_add_contact_btn").on("click.senkoAddContact", "#senko_add_contact_btn", () => {
        const name = prompt("Имя контакта:");
        if (!name) return;
        const description = prompt("Описание карты персонажа:", "") || "";
        const customPrompt = prompt("Особая подсказка для этого чата:", "") || "";
        extension_settings[extensionName].messenger.contacts.push({
            id: makeId("contact"),
            name,
            description,
            customPrompt,
            messages: [],
        });
        saveSettings();
        renderMessengerContacts();
    });

    $(document).off("click.senkoOpenContact", ".senko-contact-open").on("click.senkoOpenContact", ".senko-contact-open", function () {
        openChatByContactId($(this).data("contact-id"));
    });

    $(document).off("click.senkoToggleMenu", ".senko-contact-menu").on("click.senkoToggleMenu", ".senko-contact-menu", function (event) {
        event.stopPropagation();
        const contactId = $(this).data("contact-id");
        $(".senko-menu").removeClass("open");
        $(`#senko_menu_${contactId}`).toggleClass("open");
    });

    $(document).off("click.senkoChatMenuBtn", "#senko_chat_menu_btn").on("click.senkoChatMenuBtn", "#senko_chat_menu_btn", function (event) {
        event.stopPropagation();
        $(".senko-menu").removeClass("open");
        $("#senko_chat_menu").toggleClass("open");
    });

    $(document).off("click.senkoMenuAction", ".senko-menu button").on("click.senkoMenuAction", ".senko-menu button", function (event) {
        event.stopPropagation();
        const action = $(this).data("action");
        const scope = $(this).data("scope");
        const contacts = extension_settings[extensionName].messenger.contacts;
        const contactId = scope === "chat" ? extension_settings[extensionName].messenger.active_contact_id : $(this).data("contact-id");
        const contact = contacts.find((c) => c.id === contactId);
        if (!contact) return;

        if (action === "name") {
            contact.name = prompt("Новое имя:", contact.name) || contact.name;
        } else if (action === "description") {
            contact.description = prompt("Новое описание:", contact.description || "") || "";
        } else if (action === "prompt") {
            contact.customPrompt = prompt("Новая подсказка этого чата:", contact.customPrompt || "") || "";
        } else if (action === "owner-persona") {
            const current = extension_settings[extensionName].messenger.owner_persona || String(phoneContent.ownerPersona || "");
            const updated = prompt(
                `Персона владельца телефона (${phoneContent.ownerName || "Сенко"}).\nОпишите Сенко и стиль её речи:`,
                current,
            );
            if (updated !== null) {
                extension_settings[extensionName].messenger.owner_persona = String(updated);
            }
        } else if (action === "delete-last") {
            if ((contact.messages || []).length) {
                contact.messages.pop();
            } else {
                toastr.info("У контакта нет сообщений", phoneContent.phoneTitle || "Senko Phone");
            }
        } else if (action === "delete-contact") {
            extension_settings[extensionName].messenger.contacts = contacts.filter((c) => c.id !== contactId);
            if (extension_settings[extensionName].messenger.active_contact_id === contactId) {
                extension_settings[extensionName].messenger.active_contact_id = null;
                setMessengerSubview("list");
            }
        }

        $(".senko-menu").removeClass("open");
        saveSettings();
        renderMessengerContacts();
        renderMessengerChat();
    });

    $(document).off("click.senkoCloseMenu").on("click.senkoCloseMenu", () => {
        $(".senko-menu").removeClass("open");
    });

    $(document).off("click.senkoSend", "#senko_send_btn").on("click.senkoSend", "#senko_send_btn", async () => {
        const input = $("#senko_chat_input");
        const text = String(input.val() || "").trim();
        if (!text) return;
        const contact = getActiveContact();
        if (!contact) {
            toastr.warning("Сначала выберите контакт", phoneContent.phoneTitle || "Senko Phone");
            return;
        }

        contact.messages.push({ role: "user", text, ts: Date.now() });
        input.val("");
        renderMessengerChat();
        saveSettings();

        try {
            const reply = await generateReplyViaSillyTavern(contact, text);
            contact.messages.push({ role: "assistant", text: reply, ts: Date.now() });
        } catch (error) {
            contact.messages.push({
                role: "assistant",
                text: `Ошибка API: ${error?.message || "Проверьте настройки модели."}`,
                ts: Date.now(),
            });
        }

        renderMessengerChat();
        saveSettings();
    });

    $(document).off("keydown.senkoSend", "#senko_chat_input").on("keydown.senkoSend", "#senko_chat_input", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            $("#senko_send_btn").trigger("click");
        }
    });
}

function createLaunchButtonNearInput() {
    if ($("#senko_phone_launch_btn").length) return true;
    const input = $("#send_textarea, #chat_input textarea, textarea[name='send_textarea']").first();
    const html = `<button id="senko_phone_launch_btn" class="menu_button" title="Открыть Senko Phone">📱</button>`;
    if (input.length) input.after(html);
    else $("#send_form, #chat_input, .input_form, .send_form").first().append(html);
    if (!$("#senko_phone_launch_btn").length) return false;

    $("#senko_phone_launch_btn").off("click").on("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!extension_settings[extensionName].is_active) {
            toastr.warning("Телефон выключен в настройках расширения", phoneContent.phoneTitle || "Senko Phone");
            return;
        }
        togglePhonePanel();
    });
    return true;
}

function initExtensionSettingsUI() {
    if ($("#senko-phone-settings").length) return;
    $("#extensions_settings").append(`
        <div id="senko-phone-settings">
            <hr class="sys--m">
            <label for="senko_active_setting"><input id="senko_active_setting" type="checkbox"> Включить Senko Phone</label>
        </div>
    `);
    $("#senko_active_setting")
        .prop("checked", extension_settings[extensionName].is_active)
        .on("input", (event) => {
            extension_settings[extensionName].is_active = Boolean($(event.target).prop("checked"));
            saveSettings();
        });
}

jQuery(async () => {
    loadSettings();
    injectStyles();
    createPhonePanel();
    bindPhoneEvents();
    renderApps();
    renderMessengerContacts();
    renderMessengerChat();
    setView(extension_settings[extensionName].current_view || "home");
    setMessengerSubview(extension_settings[extensionName].messenger_subview || "list");
    initExtensionSettingsUI();
    createLaunchButtonNearInput();
    setPanelVisibility(Boolean(extension_settings[extensionName].panel_open));

    let attempts = 0;
    const attachTimer = setInterval(() => {
        attempts += 1;
        if (createLaunchButtonNearInput() || attempts > 30) clearInterval(attachTimer);
    }, 500);
});
