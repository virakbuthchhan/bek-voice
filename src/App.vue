<script setup>
import { computed, ref, watch, onMounted, defineAsyncComponent } from "vue";
import { useDisplay } from "vuetify";
import {
  mdiWaveform,
  mdiTextBoxOutline,
  mdiAccountVoice,
  mdiBookshelf,
  mdiCogOutline,
  mdiBookOpenPageVariantOutline,
  mdiWeatherSunny,
  mdiWeatherNight,
  mdiHelpCircleOutline,
  mdiShieldCheckOutline,
  mdiMenuOpen,
  mdiMenu,
} from "@mdi/js";
import {
  usePreferences,
  useRoute,
  readPreference,
  savePreference,
} from "./composables/usePreferences.js";
import { useStudio } from "./composables/useStudio.js";
import LoadingView from "./components/LoadingView.vue";
import OnboardingDialog from "./components/OnboardingDialog.vue";
const lazy = (loader) =>
  defineAsyncComponent({ loader, loadingComponent: LoadingView, delay: 0 });
const StudioView = lazy(() => import("./components/StudioView.vue"));
const LibraryView = lazy(() => import("./components/LibraryView.vue"));
const SettingsView = lazy(() => import("./components/SettingsView.vue"));
const DocsView = lazy(() => import("./components/DocsView.vue"));
const { theme, preference, toggle } = usePreferences(),
  { route, topic, navigate } = useRoute(),
  { mobile, width } = useDisplay(),
  studio = useStudio();
const onboardingOpen = ref(readPreference("bek-onboarding-v1", "") !== "done");
function finishOnboarding(engine) {
  savePreference("bek-onboarding-v1", "done");
  if (engine) {
    studio.setEngine(engine);
    navigate("settings");
  }
}
const sidebarPreference = ref(readPreference("bek-sidebar-collapsed", "auto"));
const sidebarCollapsed = computed(() =>
  sidebarPreference.value === "auto"
    ? width.value < 1200
    : sidebarPreference.value === "true",
);
function toggleSidebar() {
  sidebarPreference.value = String(!sidebarCollapsed.value);
  savePreference("bek-sidebar-collapsed", sidebarPreference.value);
}
const navigation = [
  { id: "studio", label: "Studio", icon: mdiTextBoxOutline },
  { id: "voices", label: "My voices", icon: mdiAccountVoice },
  { id: "history", label: "Audio library", icon: mdiBookshelf },
  { id: "settings", label: "Settings", icon: mdiCogOutline },
  {
    id: "docs",
    label: "Documentation",
    short: "Docs",
    icon: mdiBookOpenPageVariantOutline,
  },
];
const title = computed(
  () => navigation.find((item) => item.id === route.value)?.label || "Studio",
);
const engineLabel = computed(() =>
  studio.engineChoice === "python"
    ? {
        ready: "Python engine ready",
        loading: "Loading Python model…",
        busy: "Generating locally…",
        idle: "Python service connected",
      }[studio.engine.state] || "Python service offline"
    : {
        ready: "Browser model ready",
        loading: "Preparing browser model…",
        busy: "Generating on your GPU…",
      }[studio.browser.state] || "Browser AI · WebGPU",
);
watch(route, (value) => {
  if (value !== "studio") studio.leaveStudio();
  if (value === "settings") studio.checkEngine();
});
function focusMain() {
  const content = document.getElementById("main-content");
  content?.focus();
  content?.scrollIntoView({ block: "start" });
}
onMounted(() => {
  if (import.meta.env.PROD && "serviceWorker" in navigator)
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
});
</script>
<template>
  <v-app :theme="theme"
    ><a class="skip-link" href="#main-content" @click.prevent="focusMain"
      >Skip to content</a
    ><v-navigation-drawer
      v-if="!mobile"
      permanent
      id="workspace-navigation"
      :rail="sidebarCollapsed"
      width="232"
      theme="bekDark"
      :color="theme === 'bekDark' ? 'rail' : '#262923'"
      class="app-drawer"
      ><div
        class="brand"
        :class="{ 'brand-rail': sidebarCollapsed }"
        role="button"
        tabindex="0"
        aria-label="Bek studio"
        @click="navigate('studio')"
        @keydown.enter="navigate('studio')"
      >
        <v-icon :icon="mdiWaveform" color="primary" size="32" /><span
          v-if="!sidebarCollapsed"
          >bek<span class="brand-dot">.</span></span
        >
      </div>
      <p
        v-if="!sidebarCollapsed"
        class="eyebrow px-6 mt-8 mb-3 text-medium-emphasis"
      >
        YOUR WORKSPACE
      </p>
      <v-list nav :class="sidebarCollapsed ? 'px-2' : 'px-3'"
        ><v-list-item
          v-for="item in navigation"
          :key="item.id"
          :active="route === item.id"
          :prepend-icon="item.icon"
          :title="item.label"
          :aria-label="item.label"
          color="primary"
          :aria-current="route === item.id ? 'page' : undefined"
          rounded="lg"
          class="mb-2"
          @click="navigate(item.id)"
          ><v-tooltip
            activator="parent"
            location="end"
            :disabled="!sidebarCollapsed"
            :text="item.label"
          /><template v-if="item.id === 'voices' && !sidebarCollapsed" #append
            ><v-chip size="x-small" variant="tonal">{{
              studio.voices.length
            }}</v-chip></template
          ></v-list-item
        ></v-list
      ><template #append
        ><div v-if="!sidebarCollapsed" class="privacy-note ma-5 pa-3">
          <v-icon :icon="mdiShieldCheckOutline" size="22" />
          <p class="text-body-medium font-weight-medium mt-3">
            A little more private.
          </p>
          <p class="text-body-small text-medium-emphasis mt-2">
            Your scripts and recordings stay on your device.
          </p>
          <p class="eyebrow mt-5 text-medium-emphasis">
            LOCAL AI. PERSONAL VOICE.
          </p>
        </div></template
      ></v-navigation-drawer
    >
    <v-app-bar flat height="72" class="app-topbar" border="b"
      ><template #prepend
        ><v-btn
          v-if="!mobile"
          :icon="sidebarCollapsed ? mdiMenu : mdiMenuOpen"
          :aria-label="
            sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'
          "
          :title="
            sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'
          "
          :aria-expanded="!sidebarCollapsed"
          aria-controls="workspace-navigation"
          @click="toggleSidebar" /><v-btn
          v-if="mobile"
          :icon="mdiWaveform"
          color="primary"
          aria-label="Bek studio"
          @click="navigate('studio')" /></template
      ><v-app-bar-title class="text-body-medium"
        ><span v-if="!mobile" class="text-medium-emphasis mr-3"
          >Workspace /</span
        >{{ title }}</v-app-bar-title
      ><v-btn
        class="engine-chip mr-1"
        :color="studio.engine.state === 'ready' ? 'success' : undefined"
        variant="tonal"
        size="small"
        rounded="pill"
        @click="navigate('settings')"
        ><span class="text-truncate">{{ engineLabel }}</span></v-btn
      ><v-btn
        :icon="theme === 'bekDark' ? mdiWeatherSunny : mdiWeatherNight"
        aria-label="Dark mode"
        :aria-pressed="theme === 'bekDark'"
        :title="
          theme === 'bekDark' ? 'Switch to light theme' : 'Switch to dark theme'
        "
        size="small"
        @click="toggle" /><v-btn
        :icon="mdiHelpCircleOutline"
        aria-label="Documentation and help"
        size="small"
        class="mr-2"
        @click="navigate('docs/quick-start')"
    /></v-app-bar>
    <v-main
      ><v-container id="main-content" tabindex="-1" fluid class="app-content"
        ><StudioView
          v-if="route === 'studio'"
          :studio="studio"
          @navigate="navigate"
        /><LibraryView
          v-else-if="route === 'voices' || route === 'history'"
          :studio="studio"
          :page="route"
          @navigate="navigate"
        /><SettingsView
          v-else-if="route === 'settings'"
          :studio="studio"
          v-model:preference="preference"
          @onboarding="onboardingOpen = true"
          @navigate="navigate"
        /><DocsView
          v-else-if="route === 'docs'"
          :topic="topic"
          @navigate="navigate"
          @notify="studio.notify"
        />
        <footer class="app-footer">
          <span>Made for your own voice.</span
          ><span>Bek studio · Local by default</span>
        </footer></v-container
      ></v-main
    >
    <v-bottom-navigation
      v-if="mobile"
      :model-value="route"
      color="primary"
      grow
      height="68"
      class="mobile-navigation"
      ><v-btn
        v-for="item in navigation"
        :key="item.id"
        :value="item.id"
        :aria-label="item.label"
        @click="navigate(item.id)"
        ><v-icon :icon="item.icon" size="21" /><span>{{
          item.short || item.label
        }}</span></v-btn
      ></v-bottom-navigation
    ><OnboardingDialog
      v-model="onboardingOpen"
      :studio="studio"
      @finish="finishOnboarding"
    />
    <v-snackbar
      v-model="studio.snackbar"
      :timeout="6000"
      location="bottom"
      :class="{ 'mobile-snackbar': mobile }"
      role="status"
      >{{ studio.message
      }}<template #actions
        ><v-btn variant="text" @click="studio.snackbar = false"
          >Close</v-btn
        ></template
      ></v-snackbar
    ></v-app
  >
</template>
