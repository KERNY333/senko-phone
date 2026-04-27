// Правильные пути импорта для third-party расширений
import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "senko-phone";
const defaultSettings = {
    is_active: false
};

// Загрузка или инициализация настроек
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    // Обновляем галочку в интерфейсе при загрузке
    $("#senko_active_setting").prop("checked", extension_settings[extensionName].is_active);
}

// Сохранение настроек при клике
function onCheckboxChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].is_active = value;
    saveSettingsDebounced();
}

// Главная функция, которая ждет загрузки интерфейса ST
jQuery(async () => {
    console.log("🦊 Senko Phone: Загрузка по официальному шаблону...");

    // Создаем HTML-блок нашего меню (используем классы ST для красивого отображения)
    const settingsHtml = `
        <div class="senko-phone-container">
            <hr class="sys--m">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>🦊 Senko Phone</b>
                    <div class="inline-drawer-icon fa-solid fa-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content" style="display: none;">
                    <label for="senko_active_setting">
                        <input id="senko_active_setting" type="checkbox"> Включить телефон
                    </label>
                    <br><br>
                    <button id="senko_test_button" class="menu_button">
                        📱 Вызвать Сенко
                    </button>
                </div>
            </div>
        </div>
    `;

    // Добавляем этот HTML в панель расширений
    $("#extensions_settings").append(settingsHtml);

    // Вешаем обработчик на чекбокс
    $("#senko_active_setting").on("input", onCheckboxChange);

    // Вешаем обработчик на кнопку (используем всплывающее уведомление ST)
    $("#senko_test_button").on("click", () => {
        toastr.success("Ало! Сенко на связи!", "Senko Phone");
    });

    // Оживляем сворачивающееся меню (аккордеон)
    $(".senko-phone-container .inline-drawer-toggle").on("click", function () {
        $(this).toggleClass("open");
        $(this).next(".inline-drawer-content").slideToggle(200);
    });

    // Загружаем настройки
    loadSettings();
});
