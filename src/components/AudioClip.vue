<script setup>
import { useBlobUrl } from "../composables/useBlobUrl.js";
import { mdiDownload } from "@mdi/js";
const props = defineProps({
  blob: Blob,
  label: { type: String, default: "Audio preview" },
  filename: { type: String, default: "bek-speech.wav" },
  downloadable: { type: Boolean, default: true },
});
const url = useBlobUrl(() => props.blob);
</script>
<template>
  <div v-if="url" class="audio-clip">
    <audio :src="url" controls preload="metadata" :aria-label="label" /><v-btn
      v-if="downloadable"
      :href="url"
      :download="filename"
      :prepend-icon="mdiDownload"
      variant="text"
      size="small"
      class="mt-2"
      >Download {{ filename.includes("part") ? "part" : "WAV" }}</v-btn
    >
  </div>
</template>
