console.log("SenkoPhone: index.js загружен");
(function () {
  // SillyTavern вызывает onInit у расширений
  window["SenkoPhone"] = {
    onInit() {
      // Регистрируем расширение в боковой панели
      const ext = window["ST"]["extensions"];
      ext.register("SenkoPhone", {
        name: "📱 Телефон Сенко",
        description: "Телефон персонажа Сенко",
        onButtonClick: () => {
          toggleSenkoPhone();
        }
      });
    }
  };

  function toggleSenkoPhone() {
    let phone = document.getElementById("senkoPhone");
    if (!phone) {
      phone = document.createElement("div");
      phone.id = "senkoPhone";
      phone.style.position = "fixed";
      phone.style.top = "0";
      phone.style.right = "0";
      phone.style.width = "350px";
      phone.style.height = "100%";
      phone.style.background = "#111";
      phone.style.color = "#fff";
      phone.style.borderLeft = "3px solid #ff9800";
      phone.style.padding = "10px";
      phone.style.zIndex = "9999";
      phone.innerHTML = "<h2>Телефон Сенко</h2><p>Здесь будет чат и приложения...</p>";
      document.body.appendChild(phone);
    } else {
      phone.style.display = (phone.style.display === "none") ? "block" : "none";
    }
  }
})();
