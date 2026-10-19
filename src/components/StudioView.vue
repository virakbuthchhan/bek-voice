<script setup>
import { ref, watch, nextTick } from "vue";
import { mdiTextBoxOutline, mdiUndoVariant, mdiArrowRight } from "@mdi/js";
import { samples } from "../composables/useStudio.js";
import VoiceSettings from "./VoiceSettings.vue";
import GenerationPanel from "./GenerationPanel.vue";
import ResultPanel from "./ResultPanel.vue";
import ModelPanel from "./ModelPanel.vue";
import ClipList from "./ClipList.vue";
const props = defineProps({ studio: Object }),
  emit = defineEmits(["navigate"]),
  textFile = ref(null);
watch(
  () => props.studio.activeBatch?.id,
  async () => {
    await nextTick();
    document
      .getElementById("generation-parts")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  },
);
</script>
<template>
  <v-alert
    v-if="studio.engineChoice === 'server'"
    variant="tonal"
    color="primary"
    class="mb-5 text-body-medium"
  >
    <strong>Server generation</strong> ·
    {{
      studio.remote.connected
        ? studio.remote.url
        : "Connect your GPU server in Settings."
    }}<br />Scripts and reference recordings are sent to your server. Audio is
    saved in this browser.
  </v-alert>
  <div class="page-heading">
    <div class="eyebrow">CREATE</div>
    <h1>Let’s hear it.</h1>
    <p>Write a script. Choose a voice. Make it yours.</p>
  </div>
  <div class="studio-layout">
    <div class="writing-stack">
      <v-card variant="outlined" class="editor-card"
        ><div class="d-flex align-center justify-space-between pa-5 ga-3">
          <div>
            <h2 class="text-title-medium font-weight-bold">Your script</h2>
            <p class="text-body-small text-medium-emphasis mt-1">
              Type or paste your text below.
            </p>
          </div>
          <div class="d-flex ga-1">
            <v-btn
              :prepend-icon="mdiTextBoxOutline"
              variant="text"
              size="small"
              @click="textFile.click()"
              >Import text</v-btn
            ><v-btn
              :icon="mdiUndoVariant"
              variant="text"
              size="small"
              aria-label="Clear text"
              @click="studio.script = ''"
            />
          </div>
          <input
            ref="textFile"
            type="file"
            accept=".txt,text/plain"
            hidden
            @change="studio.importText($event.target.files[0])"
          />
        </div>
        <v-textarea
          id="script"
          v-model="studio.script"
          label="Your script"
          variant="plain"
          hide-details
          :rows="10"
          :maxlength="5000"
          placeholder="Start with a thought, a story, or a simple hello…"
          class="script-input mx-5"
        />
        <div class="d-flex align-center ga-2 flex-wrap px-5 pb-5">
          <span class="text-body-small text-medium-emphasis">Try a sample</span
          ><v-btn
            v-for="(label, key) in {
              khmer: 'ភាសាខ្មែរ',
              welcome: 'A warm welcome',
              story: 'A short story',
            }"
            :key="key"
            size="small"
            variant="outlined"
            @click="studio.script = samples[key]"
            >{{ label }}</v-btn
          >
        </div>
        <v-divider />
        <div
          class="d-flex justify-space-between pa-4 text-body-small text-medium-emphasis"
        >
          <span
            >{{ studio.script.length.toLocaleString() }} / 5,000
            characters</span
          ><span>{{
            studio.draftSaved
              ? "Auto-saved locally"
              : "Local saving unavailable"
          }}</span>
        </div>
        <v-divider />
        <div class="pa-5">
          <h3 class="text-body-medium font-weight-medium mb-3">
            How would you like to generate?
          </h3>
          <v-btn-toggle
            v-model="studio.outputMode"
            mandatory
            divided
            rounded="lg"
            color="primary"
            class="output-toggle"
            :disabled="studio.busy"
            ><v-btn value="full" :aria-pressed="studio.outputMode === 'full'"
              ><div>
                <b>Full voice</b><small>One continuous generation</small>
              </div></v-btn
            ><v-btn value="split" :aria-pressed="studio.outputMode === 'split'"
              ><div>
                <b>Split voice</b
                ><small>Short parts to listen to and merge</small>
              </div></v-btn
            ></v-btn-toggle
          >
          <p class="text-body-small text-medium-emphasis mt-3">
            {{
              studio.outputMode === "full"
                ? "Your whole script in one request. Longer scripts take more time before audio is ready."
                : `Generates ${studio.partCount || 1} short ${studio.partCount === 1 ? "part" : "parts"}. Listen as they finish, then merge into one WAV.`
            }}
          </p>
        </div>
        <v-divider />
        <div class="generate-actions pa-5">
          <span class="text-body-small text-medium-emphasis"
            >WAV audio · 48 kHz</span
          ><v-btn
            color="primary"
            size="large"
            :append-icon="mdiArrowRight"
            :loading="studio.busy"
            :disabled="!studio.ready || studio.merging"
            @click="studio.generate"
            >Generate speech</v-btn
          >
        </div></v-card
      ><GenerationPanel :studio="studio" /><ResultPanel
        :studio="studio"
      /><ModelPanel :studio="studio" @settings="emit('navigate', 'settings')" />
    </div>
    <VoiceSettings :studio="studio" />
  </div>
  <div class="d-flex align-center justify-space-between mt-9 mb-4">
    <div>
      <h2 class="text-title-large font-weight-bold">
        Recent creations
        <span class="text-medium-emphasis">{{ studio.clips.length }}</span>
      </h2>
      <p class="text-body-small text-medium-emphasis">
        Pick up where you left off.
      </p>
    </div>
    <v-btn variant="text" @click="emit('navigate', 'history')"
      >View all audio ↗</v-btn
    >
  </div>
  <ClipList
    :clips="studio.clips.slice(0, 3)"
    :studio="studio"
    @open="emit('navigate', 'studio')"
  />
</template>
