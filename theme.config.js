export const theme = {
  themeApiVersion: 2,
  kind: "app",
  sdkApiVersion: 1,
  id: "brutalist-for-2fa",
  name: "Brutalist（野兽派）",
  version: "1.0.0",
  author: "2FA Theme Contributors",
  description:
    "彩色野兽派 2FA 主题：排版式账本行、巨大验证码与吸顶的粗体服务页签。",
  entry: "src/theme.js",
  preview: "preview.webp",
  styles: [
    "src/styles/tokens.css",
    "src/styles/components.css",
    "src/styles/application.css",
    "src/styles/ledger.css",
  ],
  capabilities: ["accounts", "host-flows", "preferences"],
  settings: [
    {
      key: "density",
      type: "select",
      label: "信息密度 / Density",
      default: "comfortable",
      options: [
        { value: "comfortable", label: "舒适 / Comfortable" },
        { value: "compact", label: "紧凑 / Compact" },
      ],
    },
  ],
};
