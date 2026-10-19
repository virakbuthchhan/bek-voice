<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useBlobUrl } from "../composables/useBlobUrl.js";
import {
  mdiDownload,
  mdiPlay,
  mdiPause,
  mdiReplay,
  mdiVolumeHigh,
  mdiVolumeOff,
} from "@mdi/js";
const props = defineProps({
  blob: Blob,
  label: { type: String, default: "Audio preview" },
  filename: { type: String, default: "bek-speech.wav" },
  downloadable: { type: Boolean, default: true },
});
const url = useBlobUrl(() => props.blob);
const audio = ref(null),
  playing = ref(false),
  waiting = ref(true),
  pending = ref(false),
  duration = ref(0),
  current = ref(0),
  seeking = ref(false),
  ended = ref(false),
  muted = ref(false),
  speed = ref(1),
  error = ref("");
let disposed = false;
const ready = computed(() => duration.value > 0 && !error.value);
const action = computed(() =>
  playing.value ? "Pause" : ended.value ? "Replay" : "Play",
);
const time = (seconds) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const n = Math.floor(safe);
  const clock =
    n >= 3600
      ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`
      : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  return duration.value > 0 && duration.value < 10
    ? `${clock}.${Math.floor(safe * 10 + 1e-6) % 10}`
    : clock;
};
function metadata() {
  if (Number.isFinite(audio.value?.duration) && audio.value.duration > 0) {
    duration.value = audio.value.duration;
    waiting.value = false;
  }
}
function updateTime() {
  if (!seeking.value) current.value = audio.value?.currentTime || 0;
}
function seek(value) {
  if (!ready.value || !audio.value) return;
  const position = Math.max(0, Math.min(duration.value, Number(value)));
  if (!Number.isFinite(position)) return;
  current.value = position;
  audio.value.currentTime = position;
  ended.value = position >= duration.value;
}
async function toggle() {
  if (!audio.value || !ready.value) return;
  if (playing.value) return audio.value.pause();
  const source = url.value;
  error.value = "";
  pending.value = true;
  try {
    if (ended.value) seek(0);
    await audio.value.play();
  } catch (e) {
    if (!disposed && source === url.value && e.name !== "AbortError")
      error.value = "Could not play this audio. Try loading the preview again.";
  } finally {
    if (!disposed && source === url.value) pending.value = false;
  }
}
function started() {
  playing.value = true;
  ended.value = false;
  window.dispatchEvent(
    new CustomEvent("bek-audio-play", { detail: audio.value }),
  );
}
function pauseOther(event) {
  if (event.detail !== audio.value) audio.value?.pause();
}
function cycleSpeed() {
  const rates = [0.75, 1, 1.25, 1.5, 2];
  speed.value = rates[(rates.indexOf(speed.value) + 1) % rates.length];
}
function retry() {
  error.value = "";
  duration.value = 0;
  waiting.value = true;
  audio.value?.load();
}
watch(url, () => {
  audio.value?.pause();
  playing.value = false;
  pending.value = false;
  ended.value = false;
  duration.value = 0;
  current.value = 0;
  seeking.value = false;
  waiting.value = true;
  error.value = "";
});
onMounted(() => window.addEventListener("bek-audio-play", pauseOther));
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener("bek-audio-play", pauseOther);
  audio.value?.pause();
  audio.value?.removeAttribute("src");
  audio.value?.load();
});
</script>
<template>
  <div v-if="url" class="audio-clip">
    <audio
      ref="audio"
      :src="url"
      :muted="muted"
      :playbackRate.prop="speed"
      preload="metadata"
      hidden
      @loadstart="waiting = true"
      @loadedmetadata="metadata"
      @durationchange="metadata"
      @timeupdate="updateTime"
      @play="started"
      @playing="waiting = false"
      @waiting="waiting = true"
      @pause="
        playing = false;
        waiting = false;
      "
      @ended="
        playing = false;
        ended = true;
        current = duration;
      "
      @error="
        error =
          'This audio could not be loaded. Try loading the preview again.';
        waiting = false;
      "
    />
    <div class="audio-player" role="group" :aria-label="label">
      <div class="audio-player-header">
        <span class="audio-player-label">{{ label }}</span>
        <span class="audio-player-format">{{
          playing ? "Playing" : ended ? "Finished" : "Audio preview"
        }}</span>
      </div>
      <div class="audio-player-main">
        <v-btn
          class="audio-player-play"
          :icon="playing ? mdiPause : ended ? mdiReplay : mdiPlay"
          color="primary"
          variant="flat"
          size="44"
          :aria-label="`${action} ${label}`"
          :title="action"
          :disabled="!ready || pending"
          @click="toggle"
        />
        <div class="audio-player-timeline">
          <v-slider
            :model-value="current"
            :min="0"
            :max="duration || 1"
            :step="0.1"
            :disabled="!ready"
            color="primary"
            track-color="primary"
            :track-size="4"
            :thumb-size="12"
            hide-details
            density="compact"
            :aria-label="`Seek ${label}`"
            :aria-valuetext="`${time(current)} of ${time(duration)}`"
            @start="seeking = true"
            @end="
              seek($event);
              seeking = false;
            "
            @update:model-value="seek"
          />
          <div class="audio-player-times">
            <span>{{ time(current) }}</span
            ><span>{{ waiting && !ready ? "Loading…" : time(duration) }}</span>
          </div>
        </div>
        <div class="audio-player-tools">
          <v-btn
            variant="text"
            size="small"
            class="audio-player-speed"
            :aria-label="`Playback speed ${speed} times for ${label}`"
            title="Change playback speed"
            @click="cycleSpeed"
            >{{ speed }}×</v-btn
          >
          <v-btn
            variant="text"
            size="small"
            :icon="muted ? mdiVolumeOff : mdiVolumeHigh"
            :aria-label="`${muted ? 'Unmute' : 'Mute'} ${label}`"
            :aria-pressed="muted"
            :title="muted ? 'Unmute' : 'Mute'"
            @click="muted = !muted"
          />
        </div>
      </div>
      <div v-if="error" class="audio-player-error" role="alert">
        {{ error }}
        <v-btn size="small" variant="text" @click="retry">Reload audio</v-btn>
      </div>
    </div>
    <v-btn
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
