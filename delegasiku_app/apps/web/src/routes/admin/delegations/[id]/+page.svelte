<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api, type Delegation, type AuditEvent } from '$lib/api';
  import { actionLabel } from '$lib/actions';
  import StatusBadge from '$lib/components/StatusBadge.svelte';

  let delegation = $state<Delegation | null>(null);
  let auditEvents = $state<AuditEvent[]>([]);
  let error = $state('');
  let revoking = $state(false);

  const id = $derived($page.params.id);

  onMount(async () => {
    try {
      const res = await api.getDelegation(id);
      delegation = res.delegation;
      auditEvents = res.auditEvents;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    }
  });

  async function revoke() {
    if (!confirm('Revoke this delegation? This takes effect immediately.')) return;
    revoking = true;
    try {
      const res = await api.revokeDelegation(id, 'Revoked by admin');
      delegation = res.delegation;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Revoke failed';
    } finally {
      revoking = false;
    }
  }
</script>

<svelte:head><title>Delegation Detail — DelegasiKu</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-8">
  <a href="/admin" class="text-sm text-[var(--primary)] hover:underline">← Back</a>

  {#if error}
    <p class="mt-4 text-[var(--status-revoked)]">{error}</p>
  {:else if delegation}
    <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-xl font-bold sm:text-2xl">{actionLabel(delegation.allowedAction)}</h1>
        <p class="mt-1 break-all font-mono text-xs text-[var(--muted-foreground)] sm:text-sm">{delegation.id}</p>
      </div>
      <StatusBadge status={delegation.status} />
    </div>

    <div class="mt-6 grid gap-4 rounded-xl border bg-[var(--card)] p-6 sm:grid-cols-2">
      <div>
        <p class="text-sm text-[var(--muted-foreground)]">Valid From</p>
        <p>{new Date(delegation.validFrom).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
      </div>
      <div>
        <p class="text-sm text-[var(--muted-foreground)]">Expires At</p>
        <p>{new Date(delegation.expiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
      </div>
    </div>

    {#if delegation.status === 'ACTIVE'}
      <button
        onclick={revoke}
        disabled={revoking}
        class="mt-4 rounded-lg border border-[var(--status-revoked)] px-4 py-2 font-medium text-[var(--status-revoked)] hover:bg-[var(--status-revoked-bg)]"
      >
        {revoking ? 'Revoking…' : 'Revoke Delegation'}
      </button>
    {/if}

    <h2 class="mt-8 text-lg font-semibold">Audit Timeline</h2>
    <ol class="mt-4 space-y-3">
      {#each auditEvents as e (e.createdAt + e.eventType)}
        <li class="flex items-center gap-3 rounded-lg border bg-[var(--card)] px-4 py-3">
          <span class="h-2 w-2 rounded-full bg-[var(--primary)]" aria-hidden="true"></span>
          <div class="flex-1">
            <p class="font-medium">{e.eventType}</p>
            <p class="text-sm text-[var(--muted-foreground)]">by {e.actorType}</p>
          </div>
          <time class="text-sm text-[var(--muted-foreground)]">
            {new Date(e.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', timeStyle: 'short', dateStyle: 'short' })}
          </time>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="mt-8 text-[var(--muted-foreground)]">Loading…</p>
  {/if}
</main>
