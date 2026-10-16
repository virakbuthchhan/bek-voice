import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
export const readPreference = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
export const savePreference = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
};
export function usePreferences() {
  const media = matchMedia("(prefers-color-scheme: dark)"),
    systemDark = ref(media.matches),
    initial = readPreference("bek-theme", "system"),
    preference = ref(["light", "dark"].includes(initial) ? initial : "system");
  const theme = computed(() =>
    preference.value === "system"
      ? systemDark.value
        ? "bekDark"
        : "bekLight"
      : preference.value === "dark"
        ? "bekDark"
        : "bekLight",
  );
  watch(
    [theme, preference],
    () => {
      document.documentElement.dataset.theme =
        theme.value === "bekDark" ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]').content =
        theme.value === "bekDark" ? "#171a17" : "#f7f6f2";
      savePreference(
        "bek-theme",
        preference.value === "system" ? null : preference.value,
      );
    },
    { immediate: true },
  );
  const changed = (e) => (systemDark.value = e.matches),
    storage = (e) => {
      if (e.key === "bek-theme" || e.key === null)
        preference.value = ["light", "dark"].includes(e.newValue)
          ? e.newValue
          : "system";
    };
  onMounted(() => {
    media.addEventListener("change", changed);
    window.addEventListener("storage", storage);
  });
  onBeforeUnmount(() => {
    media.removeEventListener("change", changed);
    window.removeEventListener("storage", storage);
  });
  return {
    preference,
    theme,
    toggle: () =>
      (preference.value = theme.value === "bekDark" ? "light" : "dark"),
  };
}
export function useRoute() {
  const route = ref("studio"),
    topic = ref("quick-start");
  function sync() {
    const [page, doc] = location.hash.slice(1).split("/");
    route.value = ["studio", "voices", "history", "settings", "docs"].includes(
      page,
    )
      ? page
      : "studio";
    topic.value = doc || "quick-start";
    document.title =
      route.value === "docs" ? "Documentation — Bek" : "Bek — Voice studio";
  }
  function navigate(page) {
    if (location.hash === "#" + page) sync();
    else location.hash = page;
    sync();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  onMounted(() => window.addEventListener("hashchange", sync));
  onBeforeUnmount(() => window.removeEventListener("hashchange", sync));
  sync();
  return { route, topic, navigate };
}
