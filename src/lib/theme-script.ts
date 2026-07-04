/** Runs before paint so the first frame matches system/stored theme. */
export const themeInitScript = `(function(){
  try {
    var stored = localStorage.getItem("mailslip-theme");
    var theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var root = document.documentElement;
    root.classList.remove("light", "dark");
    var resolved = theme;
    if (theme === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      root.classList.add(theme);
    }
    root.style.colorScheme = resolved;
    var density = localStorage.getItem("mailslip-density");
    if (density === "comfortable" || density === "compact") {
      root.dataset.density = density;
    }
  } catch (e) {}
})();`;
