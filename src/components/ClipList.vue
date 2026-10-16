<script setup>
import { nextTick } from "vue";
import { mdiPlay, mdiDownload, mdiArrowTopRight, mdiClose } from "@mdi/js";
const props = defineProps({ clips: Array, studio: Object }),
  emit = defineEmits(["open"]);
async function open(clip) {
  props.studio.showClip(clip);
  emit("open");
  await nextTick();
  document
    .getElementById(clip.parts ? "generation-parts" : "audio-result")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function download(clip) {
  if (clip.blob) props.studio.download(clip.blob, "bek-speech.wav");
  else {
    open(clip);
    props.studio.notify("Download individual parts, or merge completed parts.");
  }
}
function reuse(clip) {
  props.studio.script = clip.text;
  emit("open");
}
</script>
<template>
  <v-card v-if="!clips.length" variant="outlined" class="pa-8 text-center"
    ><h3 class="text-title-medium">A quiet studio, for now.</h3>
    <p class="text-body-medium text-medium-emphasis mt-2">
      Your generated audio will appear here.
    </p></v-card
  ><v-card
    v-for="clip in clips"
    :key="clip.id"
    variant="outlined"
    class="clip-row pa-3 pa-md-4 mb-3"
    ><v-btn
      :icon="mdiPlay"
      variant="tonal"
      color="primary"
      size="small"
      aria-label="Play audio"
      @click="open(clip)" />
    <div class="clip-info">
      <p class="text-body-medium text-truncate">{{ clip.text }}</p>
      <p class="text-body-small text-medium-emphasis mt-1">
        {{ clip.mode === "clone" ? "Cloned voice" : "AI voice" }} ·
        {{ new Date(clip.created).toLocaleDateString() }} ·
        {{ clip.duration.toFixed(1) }}s<span v-if="clip.outputMode === 'full'">
          · Full voice</span
        ><span v-else-if="clip.parts">
          · {{ clip.parts.filter((p) => p.blob).length }}/{{
            clip.parts.length
          }}
          parts</span
        >
      </p>
    </div>
    <div class="clip-actions">
      <v-btn
        :icon="mdiDownload"
        variant="text"
        size="x-small"
        aria-label="Download audio"
        @click="download(clip)"
      /><v-btn
        :icon="mdiArrowTopRight"
        variant="text"
        size="x-small"
        aria-label="Reuse script"
        @click="reuse(clip)"
      /><v-btn
        :icon="mdiClose"
        variant="text"
        size="x-small"
        aria-label="Remove audio"
        @click="studio.deleteRecord('clips', clip.id)"
      /></div
  ></v-card>
</template>
