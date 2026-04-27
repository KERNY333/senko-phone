import { registerExtension } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js'; 

// Функция, которая создает твой интерфейс
function setupMyExtension() {
    console.log("Senko Phone: Отрисовка интерфейса...");

    // 1. Создаем контейнер в меню настроек расширений
    const settingsHtml = `
        <div class="senko_phone_settings">
            <h4>🦊 Senko Phone</h4>
            <div class="inline-buttons">
                <button id="senko_test_btn" class="menu_button">
                    Проверить связь
                </button>
            </div>
        </div>
    `;

    // Добавляем в правую панель (вкладка расширений)
    $("#extensions_settings").append(settingsHtml);

    // 2. Слушаем клик по кнопке
    $("#senko_test_btn").on("click", () => {
        alert("Моши-моши! Расширение Senko Phone активно.");
        console.log("Кнопка расширения нажата успешно!");
    });
}

// Главная функция инициализации
function init() {
    console.log("Senko Phone: Расширение загружено, ждем готовности системы...");

    // Ждем, когда SillyTavern полностью загрузит интерфейс
    eventSource.on(event_types.APP_READY, () => {
        setupMyExtension();
    });
}

// Регистрация в реестре SillyTavern
registerExtension({
    name: "senko-phone",
    init: init
});
