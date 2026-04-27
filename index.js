// Импорт API SillyTavern (если используешь модули)
import { registerExtension, getContext } from "../../../extensions.js";

function init() {
    console.log("Мое расширение успешно загружено!");

    // Пример добавления кнопки в верхнее меню расширений
    const button = document.createElement('div');
    button.innerText = "🚀 Жми меня";
    button.classList.add('menu_button');
    button.onclick = () => alert("Магия работает!");
    
    // Добавляем кнопку в интерфейс
    document.getElementById('extensions_menu').appendChild(button);
}

// Регистрация расширения
registerExtension({
    name: "my-awesome-extension",
    init: init
});
