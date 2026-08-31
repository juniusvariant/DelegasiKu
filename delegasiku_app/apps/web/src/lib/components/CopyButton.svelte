<script lang="ts">
  /**
   * Copy-to-clipboard button with feedback (§12.5 UX).
   * Copies `text` on click; shows a transient check state.
   */
  export let text: string;
  export let label = 'Copy';

  let copied = false;
  let error = false;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      error = false;
    } catch {
      // Fallback for older browsers / non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        copied = true;
        error = false;
      } catch {
        error = true;
      }
      document.body.removeChild(ta);
    }
    setTimeout(() => (copied = false), 2000);
  }
</script>

<button
  type="button"
  onclick={copy}
  class="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
  aria-live="polite"
>
  {#if copied}
    <svg class="h-4 w-4 text-[var(--status-active)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
    <span>Copied!</span>
  {:else if error}
    <span class="text-[var(--status-revoked)]">Copy failed</span>
  {:else}
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
    <span>{label}</span>
  {/if}
</button>
