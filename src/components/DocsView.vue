<script setup>
import { computed, ref, watch } from "vue";
import { mdiMagnify, mdiContentCopy } from "@mdi/js";
import guide from "../data/guide.json";
const props = defineProps({ topic: String }),
  emit = defineEmits(["navigate", "notify"]),
  query = ref("");
const article = computed(
  () => guide.find((a) => a.id === props.topic) || guide[0],
);
const plain = (html) =>
  html
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
const matches = computed(() => {
  const words = (query.value || "").toLocaleLowerCase().trim().split(/\s+/u);
  return guide.filter((a) =>
    words.every((word) => plain(a.html).toLocaleLowerCase().includes(word)),
  );
});
const html = computed(() =>
  article.value.html.replace(
    /<pre>/gu,
    '<pre><button type="button" class="copy-command" aria-label="Copy command">Copy</button>',
  ),
);
watch(
  () => props.topic,
  () => (query.value = ""),
);
async function contentClick(event) {
  const button = event.target.closest(".copy-command");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(
      button.parentElement.querySelector("code").textContent,
    );
    emit("notify", "Command copied.");
  } catch {
    emit(
      "notify",
      "Clipboard unavailable. Select the command text to copy it.",
    );
  }
}
function select(id) {
  query.value = "";
  emit("navigate", "docs/" + id);
}
</script>
<template>
  <div class="page-heading d-flex justify-space-between ga-3 align-center">
    <div>
      <div class="eyebrow">THE BEK GUIDE</div>
      <h1>A little guidance.</h1>
      <p>Guides for browser AI, local Python, and your GPU server.</p>
    </div>
    <v-btn variant="outlined" @click="emit('navigate', 'studio')"
      >Open studio ↗</v-btn
    >
  </div>
  <div class="docs-layout">
    <v-card variant="outlined" class="docs-sidebar pa-4"
      ><v-text-field
        v-model="query"
        label="Search the guide"
        :prepend-inner-icon="mdiMagnify"
        hide-details
        clearable
        @click:clear="query = ''"
      /><v-list
        v-if="!query?.trim()"
        nav
        density="compact"
        class="mt-3 bg-transparent"
        ><v-list-item
          v-for="item in guide"
          :key="item.id"
          :active="article.id === item.id"
          :title="item.label"
          color="primary"
          @click="select(item.id)"
      /></v-list>
      <p class="text-body-small text-medium-emphasis mt-4">
        Available inside the app.<br />No account or API key needed.
      </p></v-card
    ><v-card variant="outlined" class="docs-content pa-5 pa-md-8"
      ><template v-if="query?.trim()"
        ><p class="text-body-medium mb-4" role="status">
          {{
            matches.length
              ? `${matches.length} matching topics`
              : "No matching topics. Try “model”, “Python”, or “recording”."
          }}
        </p>
        <v-list class="bg-transparent"
          ><v-list-item
            v-for="item in matches"
            :key="item.id"
            :title="item.title"
            :subtitle="plain(item.html).slice(0, 180) + '…'"
            class="py-4"
            @click="select(item.id)" /></v-list
      ></template>
      <article
        v-else
        class="guide-article"
        v-html="html"
        @click="contentClick"
      />
      <v-divider class="mt-7 mb-4" />
      <div
        class="d-flex justify-space-between ga-3 text-body-small text-medium-emphasis"
      >
        <span>Bek · Local voice studio</span
        ><a
          href="https://github.com/virakbuthchhan/bek-voice"
          target="_blank"
          rel="noopener"
          >Source on GitHub ↗</a
        >
      </div></v-card
    >
  </div>
</template>
