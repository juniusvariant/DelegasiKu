<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Delegation, type Organization } from '$lib/api';
  import { actionLabel } from '$lib/actions';
  import StatusBadge from '$lib/components/StatusBadge.svelte';

  let org = $state<Organization | null>(null);
  let delegations = $state<Delegation[]>([]);
  let demoLabel = $state<string | null>(null);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    try {
      const [o, d] = await Promise.all([api.getOrganization(), api.getDiagnostics()]);
      org = o.organization;
      demoLabel = d.demoLabel;
      const list = await api.listDelegations(o.organization.id);
      delegations = list.delegations;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head><title>Admin — DelegasiKu</title></svelte:head>

<main class="mx-auto max-w-5xl px-4 py-8">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">Delegations</h1>
      {#if org}
        <p class="mt-1 text-sm text-[var(--muted-foreground)]">
          {org.name}
          <span class="ml-2 rounded bg-[var(--muted)] px-2 py-0.5 text-xs">{org.demoStatus}</span>
        </p>
      {/if}
    </div>
    <a
      href="/admin/delegations/new"
      class="rounded-lg bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-foreground)] hover:opacity-90"
    >
      New Delegation
    </a>
  </div>

  {#if demoLabel}
    <p class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--status-pending-bg)] px-3 py-1 text-sm text-[var(--status-pending)]">
      <span aria-hidden="true">⚠</span> {demoLabel}
    </p>
  {/if}

  {#if loading}
    <p class="mt-8 text-[var(--muted-foreground)]">Loading…</p>
  {:else if error}
    <p class="mt-8 text-[var(--status-revoked)]">{error}</p>
  {:else if delegations.length === 0}
    <div class="mt-8 rounded-xl border border-dashed p-12 text-center text-[var(--muted-foreground)]">
      No delegations yet. Create your first delegation to issue an invitation.
    </div>
  {:else}
    <div class="mt-6 overflow-x-auto rounded-xl border bg-[var(--card)]">
      <table class="w-full min-w-[520px] text-left text-sm">
        <thead class="border-b bg-[var(--muted)]">
          <tr>
            <th class="px-4 py-3 font-medium">Action</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Expires</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {#each delegations as d (d.id)}
            <tr class="border-b last:border-0">
              <td class="px-4 py-3 font-medium">{actionLabel(d.allowedAction)}</td>
              <td class="px-4 py-3"><StatusBadge status={d.status} /></td>
              <td class="px-4 py-3 text-[var(--muted-foreground)]">
                {new Date(d.expiresAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}
              </td>
              <td class="px-4 py-3 text-right">
                <a href="/admin/delegations/{d.id}" class="inline-flex min-h-[44px] items-center text-[var(--primary)] hover:underline">View</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</main>
