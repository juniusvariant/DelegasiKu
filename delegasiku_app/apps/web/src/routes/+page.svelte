<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let org = $state<string>('');
  let demoLabel = $state<string | null>(null);

  onMount(async () => {
    try {
      const [o, d] = await Promise.all([api.getOrganization(), api.getDiagnostics()]);
      org = o.organization.name;
      demoLabel = d.demoLabel;
    } catch {
      /* non-fatal on landing */
    }
  });
</script>

<svelte:head>
  <title>DelegasiKu — Verified Delegation</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-16">
  {#if demoLabel}
    <div class="mb-6 inline-flex items-center gap-2 rounded-full bg-[var(--status-pending-bg)] px-3 py-1 text-sm font-medium text-[var(--status-pending)]">
      <span aria-hidden="true">⚠</span> {demoLabel}
    </div>
  {/if}

  <h1 class="text-3xl font-bold tracking-tight">DelegasiKu</h1>
  <p class="mt-4 text-lg text-[var(--muted-foreground)]">
    Verified, time-bound delegation of authority using e.id identity. Issue, verify, and revoke
    delegations — with a public proof that flips status in real time.
  </p>

  <div class="mt-10 flex gap-4">
    <a
      href="/admin"
      class="rounded-lg bg-[var(--primary)] px-5 py-3 font-medium text-[var(--primary-foreground)] hover:opacity-90"
    >
      Admin Dashboard
    </a>
  </div>

  {#if org}
    <p class="mt-8 text-sm text-[var(--muted-foreground)]">Demo organization: {org}</p>
  {/if}
</main>
