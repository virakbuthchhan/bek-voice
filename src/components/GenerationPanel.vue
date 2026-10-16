<script setup>
import { computed } from "vue";
import { mdiMerge, mdiPlay, mdiStop } from "@mdi/js";
import AudioClip from "./AudioClip.vue";
const props = defineProps({ studio: Object });
const batch = computed(() => props.studio.viewBatch),
  done = computed(() => batch.value?.parts.filter((p) => p.blob).length || 0),
  full = computed(() => batch.value?.outputMode === "full");
const status = computed(() => {
  const b = batch.value;
  if (!b) return "";
  if (props.studio.isActive) {
    if (props.studio.stopRequested)
      return "Finishing the current part, then stopping…";
    const i = b.parts.findIndex((p) => p.status === "running");
    return i < 0
      ? "Preparing your voice…"
      : full.value
        ? "Generating your full script…"
        : `Generating part ${i + 1} of ${b.parts.length}…`;
  }
  return b.status === "complete"
    ? "Your audio is ready."
    : b.status === "error"
      ? `Generation paused: ${b.error}`
      : "Stopped. Completed audio is kept.";
});
const elapsed = (part) =>
  Math.max(0, Math.floor((props.studio.now - part.started) / 1000));
</script>
<template>
  <v-card
    v-if="batch"
    id="generation-parts"
    class="pa-5 pa-md-6"
    variant="outlined"
    ><div class="d-flex align-center justify-space-between ga-3">
      <div>
        <div class="eyebrow">SCRIPT TO AUDIO</div>
        <h2 class="text-title-large font-weight-bold mt-2">
          {{ full ? "Your full voice." : "Your audio, part by part." }}
        </h2>
      </div>
      <v-chip size="small" variant="tonal"
        >{{ done }} / {{ batch.parts.length }} ready</v-chip
      >
    </div>
    <p class="text-body-medium my-4" role="status">{{ status }}</p>
    <v-progress-linear
      :model-value="(done / batch.parts.length) * 100"
      :indeterminate="full && studio.isActive"
      color="primary"
      rounded
      height="7"
      aria-label="Completed speech parts" />
    <p class="text-body-small text-medium-emphasis mt-2">
      {{ done }} completed · {{ batch.duration.toFixed(1) }}s of audio{{
        batch.storageWarning ? " · Download before leaving this page" : ""
      }}
    </p>
    <div class="d-flex ga-2 flex-wrap my-4">
      <v-btn
        v-if="!full"
        :prepend-icon="mdiMerge"
        variant="tonal"
        color="primary"
        :loading="studio.merging"
        :disabled="studio.busy || !done"
        @click="studio.merge"
        >{{
          done === batch.parts.length
            ? "Merge all parts"
            : "Merge completed parts"
        }}</v-btn
      ><v-btn
        v-if="studio.canContinue"
        :prepend-icon="mdiPlay"
        variant="text"
        @click="studio.continueParts"
        >Continue remaining parts</v-btn
      ><v-btn
        v-if="studio.isActive && !full"
        :prepend-icon="mdiStop"
        variant="text"
        :disabled="studio.stopRequested"
        @click="studio.stopQueue"
        >{{
          studio.stopRequested
            ? "Stopping after this part…"
            : "Stop after this part"
        }}</v-btn
      >
    </div>
    <ol class="parts-list">
      <li v-for="(part, index) in batch.parts" :key="index">
        <v-card
          :variant="
            part.status === 'running' && studio.isActive ? 'tonal' : 'outlined'
          "
          :color="
            part.status === 'running' && studio.isActive ? 'primary' : undefined
          "
          class="pa-4"
          ><div class="d-flex justify-space-between ga-2">
            <b class="text-body-medium">{{
              full ? "Full script" : `Part ${index + 1}`
            }}</b
            ><span class="text-body-small text-medium-emphasis">{{
              part.blob
                ? `Ready · ${part.duration.toFixed(1)}s`
                : part.status === "running" && studio.isActive
                  ? `Generating · ${elapsed(part)}s`
                  : part.status === "error"
                    ? "Needs retry"
                    : "Waiting"
            }}</span>
          </div>
          <v-progress-linear
            :model-value="part.blob ? 100 : 0"
            :indeterminate="part.status === 'running' && studio.isActive"
            :color="part.blob ? 'success' : 'primary'"
            :aria-label="`Part ${index + 1} generation progress`"
            rounded
            height="5"
            class="my-3" />
          <details class="part-text">
            <summary>View text</summary>
            <p>{{ part.text }}</p>
          </details>
          <AudioClip
            v-if="part.blob"
            :blob="part.blob"
            :label="`Play part ${index + 1}`"
            :filename="`bek-part-${String(index + 1).padStart(2, '0')}.wav`"
            class="mt-3"
        /></v-card>
      </li></ol
  ></v-card>
</template>
