<script setup>
import { computed } from "vue";
import { mdiChip, mdiDownload, mdiCheckCircleOutline } from "@mdi/js";
const props = defineProps({ studio: Object });
const emit = defineEmits(["settings"]);
const progress = computed(() =>
  props.studio.browser.total
    ? (props.studio.browser.loaded / props.studio.browser.total) * 100
    : 0,
);
const label = computed(() => {
  const b = props.studio.browser;
  return b.state === "ready"
    ? "Model ready"
    : b.state === "loading"
      ? b.stage === "compile"
        ? "Preparing GPU…"
        : "Downloading…"
      : b.cached
        ? "Load saved model"
        : "Set up · 1.9 GB";
});
</script>
<template>
  <v-card
    v-if="studio.engineChoice === 'browser'"
    class="pa-5"
    variant="outlined"
    ><div class="d-flex align-center ga-3 flex-wrap">
      <v-icon :icon="mdiChip" color="primary" />
      <div class="flex-grow-1">
        <h3 class="text-title-medium font-weight-bold">Local voice engine</h3>
        <p class="text-body-small text-medium-emphasis">
          Download once. Create on this device.
        </p>
      </div>
      <v-btn
        :disabled="
          ['loading', 'busy', 'ready'].includes(studio.browser.state) ||
          studio.browser.supported === false
        "
        :prepend-icon="
          studio.browser.state === 'ready' ? mdiCheckCircleOutline : mdiDownload
        "
        variant="tonal"
        color="primary"
        @click="studio.loadModel"
        >{{ label }}</v-btn
      >
    </div>
    <p class="text-body-medium text-medium-emphasis mt-4">
      {{ studio.browser.message }}
    </p>
    <template v-if="studio.browser.state === 'loading'"
      ><v-progress-linear
        :model-value="progress"
        color="primary"
        class="mt-4"
        rounded
        height="6"
      />
      <div class="d-flex justify-space-between mt-2 text-body-small">
        <span v-if="studio.browser.stage === 'compile'"
          >Preparing graph {{ studio.browser.loaded }} /
          {{ studio.browser.total }}</span
        ><span v-else
          >{{ (studio.browser.loaded / 1e9).toFixed(2) }} /
          {{ (studio.browser.total / 1e9).toFixed(2) }} GB</span
        ><v-btn size="small" variant="text" @click="studio.cancelModel"
          >Cancel</v-btn
        >
      </div></template
    ><v-expansion-panels variant="accordion" class="mt-3"
      ><v-expansion-panel title="Device details"
        ><v-expansion-panel-text
          ><p>
            {{
              studio.browser.supported === false
                ? "WebGPU is unavailable. Try a compatible browser or Python."
                : studio.browser.supported
                  ? "WebGPU with shader-f16 is available."
                  : "Checking this device…"
            }}
          </p>
          <p class="text-body-small mt-2">
            VoxCPM2 · 4-bit · 1.94 GB. Clearing site data removes saved model
            files.
          </p>
          <v-btn
            class="mt-2"
            size="small"
            variant="text"
            @click="emit('settings')"
            >Engine settings ↗</v-btn
          ></v-expansion-panel-text
        ></v-expansion-panel
      ></v-expansion-panels
    ></v-card
  >
</template>
