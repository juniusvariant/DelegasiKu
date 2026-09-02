<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api, type Case, type Organization } from '$lib/api';
  import { ACTION_OPTIONS } from '$lib/actions';
  import CopyButton from '$lib/components/CopyButton.svelte';

  let org = $state<Organization | null>(null);
  let cases = $state<Case[]>([]);
  let caseId = $state('');
  let allowedAction = $state(ACTION_OPTIONS[0].key);
  let validFrom = $state('');
  let expiresAt = $state('');
  let invitationUrl = $state('');
  let proofUrl = $state('');
  let error = $state('');
  let submitting = $state(false);

  onMount(async () => {
    const [o, c] = await Promise.all([api.getOrganization(), api.getCases()]);
    org = o.organization;
    cases = c.cases;
    if (cases[0]) caseId = cases[0].id;
    const now = new Date();
    validFrom = now.toISOString().slice(0, 16);
    const later = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    expiresAt = later.toISOString().slice(0, 16);
  });

  async function submit(e: Event) {
    e.preventDefault();
    if (!org) return;
    submitting = true;
    error = '';
    try {
      const res = await api.createDelegation({
        organizationId: org.id,
        caseId,
        allowedAction,
        validFrom: new Date(validFrom).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
      });
      // Build the URL from the CURRENT origin so it always matches the port
      // the web app is actually served on (dev 5173, prod 3000, or a domain).
      const token = res.invitationUrl.split('/invitations/')[1] ?? '';
      invitationUrl = `${$page.url.origin}/invitations/${token}`;
      
      // Extract proof URL from response
      if (res.proofUrl) {
        const proofToken = res.proofUrl.split('/proof/')[1] ?? '';
        proofUrl = `${$page.url.origin}/proof/${proofToken}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head><title>New Delegation — DelegasiKu</title></svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
  <a href="/admin" class="inline-flex min-h-[44px] items-center text-sm text-[var(--primary)] hover:underline">← Back</a>
  <h1 class="mt-2 text-xl font-bold sm:text-2xl">Create Delegation</h1>

  {#if invitationUrl}
    <div class="mt-6 space-y-4">
      <div class="rounded-xl border border-[var(--status-active)] bg-[var(--status-active-bg)] p-4 sm:p-6">
        <h2 class="font-semibold text-[var(--status-active)]">✓ Invitation issued</h2>
        <p class="mt-2 text-sm text-[var(--muted-foreground)]">
          Share this link with the representative. It is shown <strong>only once</strong> and cannot be recovered.
        </p>
        <div class="mt-3 break-all rounded-lg bg-[var(--card)] p-3 font-mono text-xs sm:text-sm">{invitationUrl}</div>
        <div class="mt-4">
          <CopyButton text={invitationUrl} label="Copy invitation link" />
        </div>
      </div>

      {#if proofUrl}
        <div class="rounded-xl border border-[var(--primary)] bg-[var(--muted)] p-4 sm:p-6">
          <h2 class="font-semibold">📋 Proof URL (Save this!)</h2>
          <p class="mt-2 text-sm text-[var(--muted-foreground)]">
            After the representative accepts, share this link with officers to verify the delegation status.
            Save it now — it cannot be recovered later.
          </p>
          <div class="mt-3 break-all rounded-lg bg-[var(--card)] p-3 font-mono text-xs sm:text-sm">{proofUrl}</div>
          <div class="mt-4">
            <CopyButton text={proofUrl} label="Copy proof link" />
          </div>
        </div>
      {/if}

      <div class="flex justify-end">
        <button
          onclick={() => goto('/admin')}
          class="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  {:else}
    <form onsubmit={submit} class="mt-6 space-y-5 rounded-xl border bg-[var(--card)] p-4 sm:p-6">
      <div>
        <label for="case" class="block text-sm font-medium">Case</label>
        <select id="case" bind:value={caseId} required class="mt-1 min-h-[44px] w-full rounded-lg border bg-[var(--background)] px-3 py-2">
          {#each cases as c (c.id)}
            <option value={c.id}>{c.reference} — {c.title}</option>
          {/each}
        </select>
      </div>

      <div>
        <label for="action" class="block text-sm font-medium">Authorized action</label>
        <select id="action" bind:value={allowedAction} required class="mt-1 min-h-[44px] w-full rounded-lg border bg-[var(--background)] px-3 py-2">
          {#each ACTION_OPTIONS as opt (opt.key)}
            <option value={opt.key}>{opt.label}</option>
          {/each}
        </select>
        <p class="mt-1 text-xs text-[var(--muted-foreground)]">
          The single action the representative may perform for this case.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label for="from" class="block text-sm font-medium">Valid from</label>
          <input id="from" type="datetime-local" bind:value={validFrom} required class="mt-1 min-h-[44px] w-full rounded-lg border bg-[var(--background)] px-3 py-2" />
        </div>
        <div>
          <label for="to" class="block text-sm font-medium">Expires at</label>
          <input id="to" type="datetime-local" bind:value={expiresAt} required class="mt-1 min-h-[44px] w-full rounded-lg border bg-[var(--background)] px-3 py-2" />
        </div>
      </div>

      {#if error}
        <p class="text-sm text-[var(--status-revoked)]">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="min-h-[44px] w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-medium text-[var(--primary-foreground)] disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Issue Invitation'}
      </button>
    </form>
  {/if}
</main>
