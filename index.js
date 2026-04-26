console.log("SenkoPhone: index.js загружен");

// Простейший тест: добавить кнопку в body
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.createElement("button");
  btn.textContent = "📱 Телефон Сенко (тест)";
  btn.style.cssText = "position:fixed;top:10px;right:10px;z-index:99999;padding:8px;background:#ff9800;";
  btn.onclick = () => alert("Телефон Сенко открыт!");
  document.body.appendChild(btn);
  console.log("SenkoPhone: кнопка добавлена");
});
