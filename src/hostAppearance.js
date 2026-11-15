/** Keep host dialogs and public pages in the theme's contrast, square edges and hard shadows. */
export function hostAppearance(_settings = {}, dark = false) {
  return {
    surface: dark ? "#30364a" : "#ffffff",
    subtle: dark ? "#202437" : "#f4f4f4",
    hover: dark ? "#374562" : "#eeeeee",
    text: dark ? "#ffffff" : "#000000",
    muted: dark ? "#c4c4c4" : "#545454",
    line: dark ? "#686868" : "#d0d0d0",
    stroke: dark ? "#b0b0b0" : "#000000",
    // Accent is also used for link text; blue retains contrast on light surfaces.
    accent: dark ? "#a9caff" : "#2346d8",
    accentHover: dark ? "#c4dcff" : "#1633a6",
    accentText: dark ? "#000000" : "#ffffff",
    selected: dark ? "#473b12" : "#fff3c2",
    danger: dark ? "#ffaaa3" : "#a82121",
    dangerBackground: dark ? "#482222" : "#fff0ee",
    dangerFill: dark ? "#ffaaa3" : "#a82121",
    dangerFillHover: dark ? "#ffc6c1" : "#861616",
    dangerText: dark ? "#000000" : "#ffffff",
    warning: dark ? "#f6d775" : "#795700",
    warningBackground: dark ? "#473b12" : "#fff3c2",
    success: dark ? "#a4ddb4" : "#24713b",
    successBackground: dark ? "#203b28" : "#eaf5ed",
    radius: 0,
    controlRadius: 0,
    borderWidth: 3,
    shadow: { x: 6, y: 6, blur: 0, spread: 0, color: "#000000" },
    controlShadow: { x: 3, y: 3, blur: 0, spread: 0, color: "#000000" },
    fontFamily: ["Arial", "Microsoft YaHei", "PingFang SC", "sans-serif"],
  };
}
