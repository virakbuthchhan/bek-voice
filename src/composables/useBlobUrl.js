import { ref, watch, onBeforeUnmount } from "vue";
export function useBlobUrl(source) {
  const url = ref("");
  watch(
    source,
    (blob) => {
      if (url.value) URL.revokeObjectURL(url.value);
      url.value = blob ? URL.createObjectURL(blob) : "";
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    if (url.value) URL.revokeObjectURL(url.value);
  });
  return url;
}
