<script setup>
import { ref, watch } from "vue";
import { decode } from "../lib/audio.js";
import AudioClip from "./AudioClip.vue";
const props = defineProps({ studio: Object }),
  wave = ref([]);
watch(
  () => props.studio.result?.blob,
  async (blob, old, onCleanup) => {
    let cancelled = false;
    onCleanup(() => (cancelled = true));
    wave.value = [];
    if (!blob) return;
    try {
      const decoded = await decode(blob);
      if (cancelled) return;
      const data = decoded.getChannelData(0);
      wave.value = Array.from({ length: 90 }, (_, n) => {
        let peak = 0;
        const start = Math.floor((n * data.length) / 90),
          end = Math.floor(((n + 1) * data.length) / 90);
        for (
          let i = start;
          i < end;
          i += Math.max(1, Math.floor((end - start) / 80))
        )
          peak = Math.max(peak, Math.abs(data[i]));
        return Math.max(3, peak * 65);
      });
    } catch {}
  },
  { immediate: true },
);
</script>
<template>
  <v-card
    id="audio-result"
    v-if="studio.result"
    class="pa-5 pa-md-6"
    variant="outlined"
    ><div class="d-flex justify-space-between ga-3 align-center">
      <div>
        <div class="eyebrow">LATEST GENERATION</div>
        <h2 class="text-title-large font-weight-bold mt-2">
          {{
            studio.result.parts?.length > 1
              ? "Your merged audio is ready."
              : "Your audio is ready."
          }}
        </h2>
      </div>
      <v-chip size="x-small" variant="tonal">AI-generated</v-chip>
    </div>
    <div class="waveform" aria-hidden="true">
      <i
        v-for="(height, index) in wave"
        :key="index"
        :style="{ height: height + 'px' }"
      />
    </div>
    <AudioClip :blob="studio.result.blob" label="Generated audio" />
    <div class="d-flex align-center ga-3 mt-3">
      <v-btn variant="text" size="small" @click="studio.downloadSrt"
        >Download SRT</v-btn
      ><span class="text-body-small text-medium-emphasis"
        >Estimated subtitle timing</span
      >
    </div></v-card
  >
</template>
