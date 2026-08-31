<script lang="ts">
  /**
   * QR code renderer using the `qrcode` package (client-side only).
   * Renders a scannable QR for the e.id wallet deep link.
   */
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  export let data: string;
  export let size = 220;

  let imgSrc = '';

  onMount(async () => {
    if (!data) return;
    try {
      imgSrc = await QRCode.toDataURL(data, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
    } catch {
      imgSrc = '';
    }
  });
</script>

<div class="flex justify-center">
  {#if imgSrc}
    <img src={imgSrc} alt="Scan with your e.id wallet app" width={size} height={size} class="rounded-xl border bg-white p-2" />
  {:else}
    <div class="flex h-[220px] w-[220px] items-center justify-center rounded-xl border bg-[var(--muted)] text-sm text-[var(--muted-foreground)]">
      Generating QR…
    </div>
  {/if}
</div>
