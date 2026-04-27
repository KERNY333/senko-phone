// Импортируем инструменты (путь подкорректируй в зависимости от того, где лежит папка)
// Если в public/extensions/ -> ../../extensions.js
// Если в public/scripts/extensions/third-party/ -> ../../../../extensions.js
import { registerExtension } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js'; 

function init() {
    console.log("Senko phone: Инициализация...");

    // Используем событие APP_READY, чтобы быть уверенными, что меню уже отрисовано
    eventSource.on(event_types.APP_READY, () => {
        console.log("Senko phone: Интерфейс готов, добавляю кнопку.");

        const menu = document.getElementById('extensions_menu');
        
        if (menu) {
            const button = document.createElement('div');
            button.innerText = "🦊 Senko Phone";
            button.classList.add('menu_button');
            button.style.cursor = 'pointer'; // Чтобы было понятно, что кликабельно
            
            button.onclick = () => {
                alert("Магия Сенко активирована!");
            };
            
            menu.appendChild(button);
        } else {
            console.error("Senko phone: Не нашел элемент #extensions_menu");
        }
    });
}

registerExtension({
    name: "senko-phone",
    init: init
});
