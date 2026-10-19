<script setup>
import { ref, computed, watch } from "vue";
import {
  mdiWaveform,
  mdiCheckCircleOutline,
  mdiAlertCircleOutline,
  mdiCloseCircleOutline,
  mdiClose,
} from "@mdi/js";
import { checkClientDevice } from "../services/deviceCheck.js";
const props = defineProps({ modelValue: Boolean, studio: Object });
const emit = defineEmits(["update:modelValue", "finish"]);
const checking = ref(false),
  report = ref(null);
const ready = computed(() => report.value?.status === "ready");
const blocked = computed(() => report.value?.status === "blocked");
const engineBusy = computed(
  () => props.studio.busy || props.studio.browser.state === "loading",
);
const heading = computed(() =>
  checking.value
    ? "Checking your device…"
    : ready.value
      ? "Browser AI requirements passed"
      : blocked.value
        ? "Browser AI needs a different setup"
        : "One thing to check before setup",
);
async function runCheck() {
  if (checking.value) return;
  checking.value = true;
  try {
    report.value = await checkClientDevice(globalThis, {
      cached: props.studio.browser.cached,
    });
  } finally {
    checking.value = false;
  }
}
function finish(destination) {
  emit("update:modelValue", false);
  emit("finish", destination);
}
watch(
  () => props.modelValue,
  (open) => {
    if (open) runCheck();
  },
  { immediate: true },
);
const color = (status) =>
  status === "pass" ? "success" : status === "fail" ? "error" : "primary";
const icon = (status) =>
  status === "pass"
    ? mdiCheckCircleOutline
    : status === "fail"
      ? mdiCloseCircleOutline
      : mdiAlertCircleOutline;
</script>
<template>
  <v-dialog
    :model-value="modelValue"
    persistent
    max-width="660"
    aria-labelledby="onboarding-title"
    scrollable
  >
    <v-card rounded="xl">
      <v-card-text class="pa-5 pa-sm-8">
        <div class="d-flex align-center justify-space-between mb-5">
          <v-icon :icon="mdiWaveform" color="primary" size="36" />
          <v-btn
            :icon="mdiClose"
            variant="text"
            size="small"
            aria-label="Close welcome"
            @click="finish()"
          />
        </div>
        <p class="eyebrow mb-2">WELCOME TO BEK</p>
        <h1 id="onboarding-title" class="text-headline-small font-weight-bold">
          Your voice. Your device.
        </h1>
        <p class="text-body-medium text-medium-emphasis mt-3">
          Turn a script into speech or clone a voice you have permission to use.
          Let’s find the right way to run AI on your computer.
        </p>
        <v-sheet
          border
          rounded="lg"
          class="pa-4 mt-6"
          aria-live="polite"
          :aria-busy="checking"
        >
          <h2 class="text-title-medium font-weight-bold">{{ heading }}</h2>
          <v-progress-linear
            v-if="checking"
            indeterminate
            color="primary"
            rounded
            class="mt-4"
            aria-label="Checking device compatibility"
          />
          <template v-else-if="report">
            <div
              v-for="check in report.checks"
              :key="check.id"
              class="d-flex ga-3 mt-4"
            >
              <v-icon
                :icon="icon(check.status)"
                :color="color(check.status)"
                size="21"
              />
              <div>
                <h3 class="text-body-medium font-weight-bold">
                  {{ check.title }} ·
                  {{
                    check.status === "pass"
                      ? "Passed"
                      : check.status === "fail"
                        ? "Needs attention"
                        : "Check manually"
                  }}
                </h3>
                <p class="text-body-small text-medium-emphasis mt-1">
                  {{ check.detail }}
                </p>
                <p
                  v-if="check.device"
                  class="text-body-small text-medium-emphasis mt-1"
                >
                  {{ check.device }}
                </p>
              </div>
            </div>
          </template>
        </v-sheet>
        <p class="text-body-small text-medium-emphasis mt-3">
          This is a capability check, not a full model test. Available GPU
          memory and generation speed can only be confirmed when the model runs.
        </p>
        <div class="mt-6">
          <h2 class="text-title-medium font-weight-bold">
            Choose how to create
          </h2>
          <p class="text-body-medium text-medium-emphasis mt-2">
            <strong>Browser AI</strong> downloads about 1.9 GB once and runs on
            this device. Nothing downloads until you start setup.
          </p>
          <p class="text-body-medium text-medium-emphasis mt-3">
            <strong>Python engine</strong> runs the original model on the
            computer hosting the local service. It needs a separate setup and
            about a 5 GB download.
          </p>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 ga-2 flex-wrap">
        <v-btn variant="text" :disabled="checking" @click="runCheck"
          >Check again</v-btn
        >
        <v-spacer />
        <v-btn variant="text" @click="finish()">Explore studio</v-btn>
        <v-btn
          v-if="!checking && !blocked"
          variant="flat"
          color="primary"
          :disabled="engineBusy"
          @click="finish('browser')"
          >Set up browser AI</v-btn
        >
        <v-btn
          v-if="!checking"
          :variant="blocked ? 'flat' : 'outlined'"
          :color="blocked ? 'primary' : undefined"
          :disabled="engineBusy"
          @click="finish('python')"
          >Use Python engine</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
