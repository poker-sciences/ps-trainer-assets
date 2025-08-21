(function(){
  // Message console
  console.log("%c[Trainer] TEST script chargé !", "color: black; background: yellow; padding: 4px;");

  // Message visuel dans la page (h1 en haut)
  var banner = document.createElement("div");
  banner.textContent = "⚠️ TEST script chargé (poker-sciences.webflow.io)";
  banner.style.position = "fixed";
  banner.style.top = "0";
  banner.style.left = "0";
  banner.style.right = "0";
  banner.style.zIndex = "9999";
  banner.style.padding = "10px";
  banner.style.fontSize = "18px";
  banner.style.color = "black";
  banner.style.backgroundColor = "yellow";
  banner.style.textAlign = "center";
  document.body.appendChild(banner);
})();