<script setup>
import { computed, ref } from "vue";
import {
  mdiMicrophone,
  mdiUpload,
  mdiAccountVoice,
  mdiCheckCircleOutline,
  mdiStop,
  mdiRecordCircle,
} from "@mdi/js";
import {
  languages,
  characters,
  readingSamples,
} from "../composables/useStudio.js";
import AudioClip from "./AudioClip.vue";
const props = defineProps({ studio: Object });
const upload = ref(null);
const status = computed(() =>
  props.studio.mode === "tts"
    ? "AI voice selected"
    : !props.studio.reference
      ? "Add a voice sample"
      : !props.studio.consent
        ? "Confirm permission to clone this voice"
        : "Your voice is ready",
);
const method = (value) => {
  if (value === "upload" && props.studio.recording.isBusy)
    props.studio.cancelRecording();
  props.studio.referenceMethod = value;
};
function dropped(event) {
  if (!props.studio.busy)
    props.studio.pickReference(event.dataTransfer.files[0]);
}
</script>
<template>
  <v-card class="voice-settings pa-5 pa-md-6" variant="outlined"
    ><div class="eyebrow">MAKE IT SOUND RIGHT</div>
    <h2 class="text-title-large font-weight-bold mt-2">Voice settings</h2>
    <p class="text-body-medium text-medium-emphasis mt-1 mb-5">
      Choose a voice, then set its delivery.
    </p>
    <section class="voice-step">
      <h3 class="step-title"><span>1</span>Choose your voice</h3>
      <v-btn-toggle
        v-model="studio.mode"
        mandatory
        divided
        rounded="lg"
        color="primary"
        class="w-100 voice-toggle"
        :disabled="studio.busy"
        ><v-btn
          value="tts"
          :aria-pressed="studio.mode === 'tts'"
          :prepend-icon="mdiAccountVoice"
          >AI voice</v-btn
        ><v-btn
          value="clone"
          :aria-pressed="studio.mode === 'clone'"
          :prepend-icon="mdiMicrophone"
          >Clone my voice</v-btn
        ></v-btn-toggle
      >
      <template v-if="studio.mode === 'tts'"
        ><p class="text-body-small text-medium-emphasis my-3">
          Pick a starting character for your AI voice.
        </p>
        <v-card
          v-for="character in characters"
          :key="character.value"
          :color="studio.character === character.value ? 'primary' : undefined"
          :variant="studio.character === character.value ? 'tonal' : 'outlined'"
          class="pa-3 mb-2 voice-character"
          :disabled="studio.busy"
          role="button"
          :aria-pressed="studio.character === character.value"
          tabindex="0"
          @click="studio.character = character.value"
          @keydown.enter="studio.character = character.value"
          @keydown.space.prevent="studio.character = character.value"
          ><div class="d-flex align-center ga-3">
            <v-icon :icon="mdiAccountVoice" />
            <div>
              <div class="text-body-medium font-weight-medium">
                {{ character.title }}
              </div>
              <small class="text-medium-emphasis">{{
                character.subtitle
              }}</small>
            </div>
            <v-icon
              v-if="studio.character === character.value"
              :icon="mdiCheckCircleOutline"
              size="18"
              class="ml-auto"
            /></div></v-card
      ></template>
      <template v-else
        ><p class="text-body-small text-medium-emphasis my-3">
          Use a saved voice, upload a WAV, or record yourself.
        </p>
        <v-select
          :model-value="studio.selectedVoice"
          @update:model-value="studio.selectVoice"
          :items="studio.voices"
          item-title="name"
          item-value="id"
          label="Saved voice"
          placeholder="Choose a saved voice"
          :disabled="studio.busy"
          hide-details
          class="mb-3"
        />
        <template v-if="studio.referencePicker"
          ><v-btn-toggle
            :model-value="studio.referenceMethod"
            @update:model-value="method"
            mandatory
            divided
            rounded="lg"
            class="w-100 voice-toggle mb-3"
            color="primary"
            :disabled="studio.busy"
            ><v-btn value="upload" :prepend-icon="mdiUpload">Upload</v-btn
            ><v-btn value="record" :prepend-icon="mdiMicrophone"
              >Record</v-btn
            ></v-btn-toggle
          >
          <div
            v-if="studio.referenceMethod === 'upload'"
            class="upload-area"
            @dragover.prevent
            @drop.prevent="dropped"
          >
            <v-icon :icon="mdiUpload" size="30" color="primary" /><v-btn
              block
              variant="text"
              class="mt-2"
              :disabled="studio.busy"
              @click="upload.click()"
              >Choose a voice sample</v-btn
            >
            <p class="text-body-small text-medium-emphasis">
              Drop WAV · 3–30s · 15 MB max
            </p>
            <input
              ref="upload"
              type="file"
              accept="audio/wav,.wav"
              hidden
              @change="studio.pickReference($event.target.files[0])"
            />
          </div>
          <div v-else class="record-box">
            <v-select
              v-model="studio.readingLanguage"
              :items="[
                { title: 'Khmer · ភាសាខ្មែរ', value: 'km' },
                { title: 'English', value: 'en' },
              ]"
              label="Read this aloud"
              :disabled="studio.recording.isBusy"
              hide-details
            />
            <blockquote :lang="studio.readingLanguage" class="reading-sample">
              {{ readingSamples[studio.readingLanguage] }}
            </blockquote>
            <p class="text-body-small text-medium-emphasis">
              Read naturally in a quiet room. Aim for 10–20 seconds.
            </p>
            <div class="d-flex align-center justify-space-between my-3">
              <span class="text-body-small">{{
                studio.recording.state === "recording"
                  ? "● Recording"
                  : "Microphone off"
              }}</span
              ><span class="text-body-small"
                >00:{{
                  String(
                    Math.min(30, Math.floor(studio.recording.elapsed)),
                  ).padStart(2, "0")
                }}
                / 00:30</span
              >
            </div>
            <v-progress-linear
              :model-value="
                Math.min(100, (studio.recording.elapsed / 30) * 100)
              "
              :color="
                studio.recording.state === 'recording' ? 'error' : 'primary'
              "
              rounded
              height="5"
            />
            <p class="text-body-small mt-3" role="status">
              {{ studio.recording.message }}
            </p>
            <div class="d-flex ga-2 flex-wrap mt-3">
              <v-btn
                size="small"
                :prepend-icon="mdiRecordCircle"
                :disabled="studio.busy || studio.recording.isBusy"
                @click="studio.startRecording"
                >{{
                  studio.recording.draft ? "Record again" : "Start recording"
                }}</v-btn
              ><v-btn
                size="small"
                :prepend-icon="mdiStop"
                variant="outlined"
                :disabled="
                  studio.recording.state !== 'recording' ||
                  studio.recording.elapsed < 3
                "
                @click="studio.stopRecording"
                >Stop</v-btn
              ><v-btn
                v-if="studio.recording.isBusy"
                size="small"
                variant="text"
                @click="studio.cancelRecording"
                >Cancel</v-btn
              >
            </div>
            <div
              v-if="studio.recording.draft && !studio.recording.isBusy"
              class="mt-4"
            >
              <AudioClip
                :blob="studio.recording.draft.blob"
                label="Recorded voice preview"
                :downloadable="false"
              />
              <div class="d-flex ga-2 mt-3">
                <v-btn
                  size="small"
                  color="primary"
                  :disabled="studio.busy"
                  @click="studio.useRecording"
                  >Use recording</v-btn
                ><v-btn
                  size="small"
                  variant="text"
                  @click="studio.discardRecording"
                  >Discard</v-btn
                >
              </div>
            </div>
            <p class="text-body-small text-medium-emphasis mt-3">
              Recording stops at 30 seconds. Audio stays on this device.
            </p>
          </div></template
        >
        <v-card v-if="studio.reference" variant="tonal" class="pa-3 mt-3"
          ><h4 class="text-body-medium font-weight-bold">
            {{ studio.reference.name }}
          </h4>
          <p class="text-body-small text-medium-emphasis mb-2">
            {{ studio.reference.duration.toFixed(1) }} seconds · Selected sample
          </p>
          <AudioClip
            :blob="studio.reference.blob"
            label="Selected reference voice"
            :downloadable="false"
          /><v-btn
            class="mt-2"
            size="small"
            variant="text"
            :disabled="studio.busy"
            @click="studio.referencePicker = true"
            >Choose another sample</v-btn
          ></v-card
        >
        <v-checkbox
          v-model="studio.consent"
          label="This is my voice, or I have permission to clone it."
          color="primary"
          hide-details
          :disabled="studio.busy"
          class="consent-check"
        />
        <v-expansion-panels variant="accordion" class="mt-3"
          ><v-expansion-panel title="Save this voice for later"
            ><v-expansion-panel-text
              ><v-text-field
                v-model="studio.voiceName"
                label="Voice name"
                maxlength="60"
              /><v-btn
                block
                variant="tonal"
                color="primary"
                :disabled="studio.busy || studio.recording.isBusy"
                @click="studio.saveVoice"
                >Save to my voices</v-btn
              ></v-expansion-panel-text
            ></v-expansion-panel
          ></v-expansion-panels
        ></template
      >
    </section>
    <section class="voice-step">
      <h3 class="step-title"><span>2</span>Language</h3>
      <v-select
        v-model="studio.language"
        :items="languages"
        label="Script language"
        hide-details
        :disabled="studio.busy"
      />
      <p class="text-body-small text-medium-emphasis mt-2">
        Choose the language your script is written in.
      </p>
    </section>
    <section class="voice-step">
      <h3 class="step-title">
        <span>3</span>Delivery
        <small class="text-medium-emphasis">Optional</small>
      </h3>
      <v-text-field
        v-model="studio.direction"
        label="How should it sound?"
        placeholder="Soft, hopeful, a little slower…"
        maxlength="250"
        :disabled="studio.busy"
      /><v-select
        v-model="studio.steps"
        :items="[
          { title: 'Balanced · everyday use', value: 10 },
          { title: 'High · takes longer', value: 20 },
          { title: 'Fast · quick preview', value: 5 },
        ]"
        label="Generation quality"
        hide-details
        :disabled="studio.busy"
      />
    </section>
    <v-expansion-panels variant="accordion"
      ><v-expansion-panel title="Advanced settings"
        ><v-expansion-panel-text
          ><p class="text-body-small text-medium-emphasis mb-3">
            These defaults work well for most scripts.
          </p>
          <v-slider
            v-model="studio.guidance"
            label="Guidance"
            :min="1"
            :max="4"
            :step="0.1"
            thumb-label
            :disabled="studio.busy"
            color="primary"
          /><v-text-field
            v-model="studio.seed"
            type="number"
            :min="0"
            :max="2147483647"
            label="Random seed (optional)"
            placeholder="Random each time"
            :disabled="studio.busy"
            hide-details
          />
          <p class="text-body-small text-medium-emphasis mt-2">
            Reuse a number to reduce variation between takes.
          </p></v-expansion-panel-text
        ></v-expansion-panel
      ></v-expansion-panels
    >
    <v-alert
      :type="
        studio.mode === 'clone' && (!studio.reference || !studio.consent)
          ? 'info'
          : 'success'
      "
      variant="tonal"
      density="compact"
      class="mt-5 text-body-small"
      role="status"
      >{{ status }}</v-alert
    ></v-card
  >
</template>
