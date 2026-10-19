<script setup>
import ServerConnection from "./ServerConnection.vue";
import ModelPanel from "./ModelPanel.vue";
defineProps({ studio: Object, preference: String });
const emit = defineEmits(["update:preference", "navigate", "onboarding"]);
</script>
<template>
  <div class="page-heading">
    <div class="eyebrow">MAKE YOURSELF AT HOME</div>
    <h1>Studio settings.</h1>
    <p>Your tools, running your way.</p>
  </div>
  <v-card variant="outlined" class="pa-5 mb-6"
    ><div class="appearance-row">
      <div>
        <h2 class="text-title-large font-weight-bold">Appearance</h2>
        <p class="text-body-medium text-medium-emphasis mt-1">
          Choose a theme for this device.
        </p>
      </div>
      <v-select
        :model-value="preference"
        @update:model-value="emit('update:preference', $event)"
        :items="[
          { title: 'Use system theme', value: 'system' },
          { title: 'Light', value: 'light' },
          { title: 'Dark', value: 'dark' },
        ]"
        label="Color theme"
        hide-details
        class="theme-select"
      /></div></v-card
  ><v-card variant="outlined" class="pa-5 mb-6">
    <h2 class="text-title-large font-weight-bold">Device compatibility</h2>
    <p class="text-body-medium text-medium-emphasis mt-2">
      Check whether this browser can run the local AI model, or review your
      setup options.
    </p>
    <v-btn
      variant="tonal"
      color="primary"
      class="mt-4"
      @click="emit('onboarding')"
      >Run device check</v-btn
    > </v-card
  ><v-row
    ><v-col cols="12" md="7"
      ><v-card variant="outlined" class="pa-5 pa-md-6 mb-5"
        ><h2 class="text-title-large font-weight-bold">Where should AI run?</h2>
        <p class="text-body-medium text-medium-emphasis mt-2 mb-5">
          Use your computer or connect to a private GPU server.
        </p>
        <v-select
          :model-value="studio.engineChoice"
          @update:model-value="studio.setEngine"
          :items="[
            { title: 'This browser · WebGPU · ≈1.9 GB', value: 'browser' },
            { title: 'This computer · Python · ≈5 GB', value: 'python' },
            { title: 'My GPU server · Access token required', value: 'server' },
          ]"
          label="Run speech on"
          :disabled="studio.busy || studio.browser.state === 'loading'"
        /><ServerConnection
          v-if="studio.engineChoice === 'server'"
          :studio="studio"
          @navigate="emit('navigate', $event)"
        /><v-alert
          variant="tonal"
          :color="studio.engine.state === 'ready' ? 'success' : 'primary'"
          class="text-body-medium"
          >{{ studio.engine.message }}</v-alert
        ><template
          v-if="
            studio.engineChoice === 'python' || studio.engineChoice === 'server'
          "
          ><p class="text-body-medium text-medium-emphasis my-5">
            {{
              studio.engineChoice === "server"
                ? "The original model downloads and runs on your server. The first setup downloads about 5 GB to the VPS."
                : "Run the included Python service to use the original model on MPS, CUDA, or CPU. Model setup downloads about 5 GB."
            }}
          </p>
          <code v-if="studio.engineChoice === 'python'" class="inline-command"
            >./start-python.sh</code
          >
          <div class="d-flex ga-2 flex-wrap mt-5">
            <v-btn
              color="primary"
              :disabled="
                ['ready', 'busy', 'loading'].includes(studio.engine.state) ||
                (studio.engineChoice === 'server' && !studio.remote.connected)
              "
              :loading="studio.engine.state === 'loading'"
              @click="studio.loadModel"
              >{{
                studio.engine.state === "ready"
                  ? "Model loaded"
                  : studio.engineChoice === "server"
                    ? "Load server model"
                    : "Load Python model"
              }}</v-btn
            ><v-btn variant="outlined" @click="studio.checkEngine"
              >Check connection</v-btn
            >
          </div></template
        ><v-btn
          variant="text"
          class="mt-4"
          @click="
            emit(
              'navigate',
              'docs/' +
                (studio.engineChoice === 'server'
                  ? 'server'
                  : studio.engineChoice === 'python'
                    ? 'python'
                    : 'models'),
            )
          "
          >Setup guide ↗</v-btn
        ></v-card
      ><ModelPanel
        :studio="studio"
        @settings="emit('navigate', 'docs/models')" /></v-col
    ><v-col cols="12" md="5"
      ><v-card variant="outlined" class="pa-6"
        ><h2 class="text-title-large font-weight-bold">
          Your voice belongs to you.
        </h2>
        <p class="text-body-medium text-medium-emphasis my-4">
          Browser mode keeps scripts, recordings, and generated audio on your
          device. Python mode uses the loopback service on your own computer.
          Server mode sends scripts and reference audio to the server you
          connect to.
        </p>
        <v-divider />
        <h3 class="text-title-medium font-weight-bold mt-5">
          Create with care.
        </h3>
        <p class="text-body-medium text-medium-emphasis mt-2">
          Clone your own voice or one you have permission to use. Label shared
          audio as AI-generated.
        </p>
        <v-btn
          variant="text"
          class="mt-4"
          @click="emit('navigate', 'docs/quick-start')"
          >Open documentation ↗</v-btn
        ></v-card
      ></v-col
    ></v-row
  >
</template>
