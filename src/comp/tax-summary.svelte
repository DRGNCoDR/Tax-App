<script>
    import {current_tax_info} from "../stores/store.js"
    import {projected1_tax_info} from "../stores/store.js"
    import {projected2_tax_info} from "../stores/store.js"

    import Current from "../comp/tax-summary/Current.svelte"
    import Proj1 from "../comp/tax-summary/Projected1.svelte"
    import Proj2 from "../comp/tax-summary/Projected2.svelte"

    export let selectedVariation
</script>

<div class="tax-summary">
    <!-- <h1>Current Seleted: {selectedVariation}</h1> -->
    {#if selectedVariation == "Current"}
        <Current {current_tax_info}/>
    {:else if selectedVariation == "Projected 1"}
        <Proj1 {projected1_tax_info}/>
    {:else if selectedVariation == "Projected 2"}
        <Proj2 {projected2_tax_info}/>
    {/if}
</div>

