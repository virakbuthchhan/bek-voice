<script setup>
import { ref, computed } from "vue";
import {
  mdiServerNetwork,
  mdiLockOutline,
  mdiEyeOutline,
  mdiEyeOffOutline,
} from "@mdi/js";
const props = defineProps({ studio: Object });
const emit = defineEmits(["navigate"]);
const address = ref(
  props.studio.remote.url ||
    (location.protocol === "https:" ? location.origin : ""),
);
const token = ref(""),
  showToken = ref(false);
const disabled = computed(
  () => props.studio.busy || props.studio.remote.connecting,
);
async function connect() {
  if (await props.studio.connectRemote(address.value, token.value))
    token.value = "";
}
</script>
<template>
  <v-sheet border rounded="lg" class="pa-4 mb-5">
    <div class="d-flex ga-3 align-center mb-3">
      <v-icon :icon="mdiServerNetwork" color="primary" />
      <h3 class="text-title-medium font-weight-bold">
        Connect to your GPU server
      </h3>
    </div>
    <p class="text-body-small text-medium-emphasis mb-4">
      Use the HTTPS address and API token from your Bek server deployment. Keep
      SSH passwords and private keys on your server.
    </p>
    <v-form @submit.prevent="connect">
      <v-text-field
        v-model="address"
        label="Server address"
        placeholder="https://voice.example.com"
        type="url"
        autocomplete="url"
        :disabled="disabled"
      />
      <v-text-field
        v-model="token"
        label="Server access token"
        :type="showToken ? 'text' : 'password'"
        autocomplete="off"
        :prepend-inner-icon="mdiLockOutline"
        :disabled="disabled"
        :append-inner-icon="showToken ? mdiEyeOffOutline : mdiEyeOutline"
        @click:append-inner="showToken = !showToken"
        hint="Held in memory only. Re-enter after a page refresh."
        persistent-hint
      />
      <v-alert
        v-if="studio.remote.error"
        type="error"
        variant="tonal"
        class="mt-3 text-body-small"
        >{{ studio.remote.error }}</v-alert
      >
      <v-alert
        v-if="studio.remote.connected"
        type="success"
        variant="tonal"
        class="mt-3 text-body-small"
        >Connected to {{ studio.remote.url }}. Your token is not saved to
        browser storage.</v-alert
      >
      <div class="d-flex ga-2 flex-wrap mt-4">
        <v-btn
          type="submit"
          color="primary"
          :disabled="disabled || !token || !address"
          :loading="studio.remote.connecting"
          >{{
            studio.remote.connected ? "Update connection" : "Connect to server"
          }}</v-btn
        >
        <v-btn
          v-if="studio.remote.connected"
          variant="outlined"
          :disabled="disabled"
          @click="studio.disconnectRemote"
          >Disconnect</v-btn
        >
        <v-btn variant="text" @click="emit('navigate', 'docs/server')"
          >Server setup guide ↗</v-btn
        >
      </div>
    </v-form>
    <p class="text-body-small text-medium-emphasis mt-4">
      Server mode sends your script, voice direction, and any reference
      recording to this server for processing. Finished audio is saved in this
      browser. Connect only to a server you trust.
    </p>
  </v-sheet>
</template>
