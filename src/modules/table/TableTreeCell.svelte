<script lang="ts">
    import type { SvelteRow } from '../../core/row';

    import { createEventDispatcher } from "svelte";

    export let row: SvelteRow;

    const dispatch = createEventDispatcher();

    function onExpandToggle() {
        if(row.expanded) {
            dispatch('rowCollapsed', { row });
        } else {
            dispatch('rowExpanded', { row });
        }
    }
</script>

<div class="sg-cell-inner" style="padding-left: {row.childLevel*3}em">
    {#if row.children}
        <div class="sg-tree-expander" on:click="{onExpandToggle}">
            {#if row.expanded}
            <i class="bi bi-caret-down-fill"></i>
            {:else}
            <i class="bi bi-caret-right-fill"></i>
            {/if}
        </div>
    {/if}
    <slot></slot>
</div>

<style>
    .sg-tree-expander {
        cursor: pointer;
        min-width: 1.4em;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .sg-cell-inner {
        display: flex;
    }
</style>
