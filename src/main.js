import { createApp } from "vue";
import "vuetify/styles";
import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import App from "./App.vue";
import "./styles.css";
const vuetify = createVuetify({
  icons: { defaultSet: "mdi", aliases, sets: { mdi } },
  display: { mobileBreakpoint: "sm" },
  defaults: {
    VCard: { rounded: "lg" },
    VTextField: { variant: "outlined", density: "comfortable" },
    VTextarea: { variant: "outlined" },
    VSelect: { variant: "outlined", density: "comfortable" },
    VBtn: { rounded: "lg", elevation: 0 },
    VExpansionPanel: { elevation: 0 },
  },
  theme: {
    defaultTheme:
      document.documentElement.dataset.theme === "dark"
        ? "bekDark"
        : "bekLight",
    themes: {
      bekLight: {
        dark: false,
        colors: {
          primary: "#b85f43",
          secondary: "#69795c",
          background: "#f7f6f2",
          surface: "#ffffff",
          "surface-variant": "#eeece4",
          "on-surface-variant": "#53584d",
          rail: "#262923",
          success: "#527851",
          error: "#b54032",
        },
      },
      bekDark: {
        dark: true,
        colors: {
          primary: "#df9b77",
          secondary: "#afc29f",
          background: "#171a17",
          surface: "#232820",
          "surface-variant": "#343b2e",
          "on-surface-variant": "#e2e6d9",
          rail: "#11150f",
          success: "#a4c698",
          error: "#f6a58d",
        },
      },
    },
  },
});
createApp(App).use(vuetify).mount("#app");
