<script setup>
import { mdiPlus, mdiAccountVoice } from "@mdi/js";
import ClipList from "./ClipList.vue";
const props = defineProps({ studio: Object, page: String }),
  emit = defineEmits(["navigate"]);
function useVoice(voice) {
  props.studio.applyReference(voice.blob, voice.name, voice.duration, voice.id);
  props.studio.mode = "clone";
  emit("navigate", "studio");
}
</script>
<template>
  <template v-if="page === 'voices'"
    ><div class="page-heading d-flex justify-space-between align-center ga-3">
      <div>
        <div class="eyebrow">YOUR COLLECTION</div>
        <h1>My voices.</h1>
        <p>Familiar voices, ready for their next story.</p>
      </div>
      <v-btn
        color="primary"
        :prepend-icon="mdiPlus"
        @click="
          studio.mode = 'clone';
          emit('navigate', 'studio');
        "
        >Add a voice</v-btn
      >
    </div>
    <v-row v-if="studio.voices.length"
      ><v-col
        v-for="voice in studio.voices"
        :key="voice.id"
        cols="12"
        sm="6"
        lg="4"
        ><v-card variant="outlined" class="pa-6"
          ><v-icon :icon="mdiAccountVoice" color="primary" size="32" />
          <h2 class="text-title-large mt-4">{{ voice.name }}</h2>
          <p class="text-body-small text-medium-emphasis my-3">
            {{ voice.duration.toFixed(1) }} seconds · Stored locally
          </p>
          <v-btn color="primary" variant="tonal" @click="useVoice(voice)"
            >Use this voice ↗</v-btn
          ><v-btn
            variant="text"
            size="small"
            class="ml-2"
            @click="studio.deleteRecord('voices', voice.id)"
            >Remove</v-btn
          ></v-card
        ></v-col
      ></v-row
    ><v-card v-else variant="outlined" class="pa-10 text-center"
      ><h2 class="text-title-large">Your voice belongs here.</h2>
      <p class="text-body-medium text-medium-emphasis mt-2">
        Upload or record a reference in the studio, then save it here.
      </p></v-card
    ></template
  ><template v-else
    ><div class="page-heading">
      <div class="eyebrow">YOUR COLLECTION</div>
      <h1>Audio library.</h1>
      <p>Everything you’ve created, right here on this device.</p>
    </div>
    <ClipList
      :clips="studio.clips"
      :studio="studio"
      @open="emit('navigate', 'studio')"
  /></template>
</template>
