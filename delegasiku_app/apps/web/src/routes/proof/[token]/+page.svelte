<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { actionLabel } from '$lib/actions';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const proof = data.proof;

  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '—';
</script>

<svelte:head>
  <title>Delegation Proof — {proof.status}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
  <div class="rounded-2xl border bg-[var(--card)] p-4 shadow-sm sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">Delegation Proof</h1>
      <StatusBadge status={proof.status} />
    </div>

    {#if proof.simulationMode}
      <p class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--status-pending-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--status-pending)]">
        <span aria-hidden="true">⚠</span> Simulation mode
      </p>
    {/if}

    {#if proof.status === 'NOT_VALID'}
      <p class="mt-6 text-[var(--muted-foreground)]">
        This proof is not valid. The link may be malformed, expired, or never issued.
      </p>
    {:else}
      <dl class="mt-6 space-y-4">
        <div>
          <dt class="text-sm text-[var(--muted-foreground)]">Organization</dt>
          <dd class="font-medium">{proof.organizationName}</dd>
        </div>
        <div>
          <dt class="text-sm text-[var(--muted-foreground)]">Authorized Action</dt>
          <dd class="font-medium">{actionLabel(proof.allowedAction)}</dd>
        </div>
        {#if proof.representativeDisplayName}
          <div>
            <dt class="text-sm text-[var(--muted-foreground)]">Representative</dt>
            <dd class="font-medium">{proof.representativeDisplayName}</dd>
          </div>
        {/if}
        <div>
          <dt class="text-sm text-[var(--muted-foreground)]">Case Reference</dt>
          <dd class="font-mono text-sm">{proof.caseReference}</dd>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-sm text-[var(--muted-foreground)]">Valid From</dt>
            <dd class="text-sm">{fmt(proof.validFrom)}</dd>
          </div>
          <div>
            <dt class="text-sm text-[var(--muted-foreground)]">Expires</dt>
            <dd class="text-sm">{fmt(proof.expiresAt)}</dd>
          </div>
        </div>
      </dl>
      <p class="mt-6 text-xs text-[var(--muted-foreground)]">
        Status is computed at read time. A revoked or expired delegation shows its current state
        immediately, even with an older QR code.
      </p>
    {/if}
  </div>
</main>
