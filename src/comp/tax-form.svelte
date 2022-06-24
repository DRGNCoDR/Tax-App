<script>
    import Current from "./tax-form/Current.svelte"
    import Proj1 from "./tax-form/Projected1.svelte"
    import Proj2 from "./tax-form/Projected2.svelte"

    import {current_tax_info} from "../stores/store.js"
    import {projected1_tax_info} from "../stores/store.js"
    import {projected2_tax_info} from "../stores/store.js"

    export let selectedVariation
</script>
<div
    class="load-tax-form">
    {#if selectedVariation == "Current"}
        <Current {current_tax_info}/>
    {:else if selectedVariation == "Projected 1"}
        <Proj1 {projected1_tax_info}/>
    {:else if selectedVariation == "Projected 2"}
        <Proj2 {projected2_tax_info}/>
    {/if}
</div>
<style>
    @media print{
        .load-tax-form{
            display:none;
        }
    }
</style>
