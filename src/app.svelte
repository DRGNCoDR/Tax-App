<script>
    import {current_tax_info} from "./stores/store.js"
    import {projected1_tax_info} from "./stores/store.js"
    import {projected2_tax_info} from "./stores/store.js"
    import TaxForm from './comp/tax-form.svelte'
    import CombinedSummary from './comp/tax-summary/Combined.svelte'

    let variations =
        [
            "Current",
            "Projected 1",
            "Projected 2"
        ]
    let selectedVariation = "Current"

    $current_tax_info = []
    $current_tax_info = [...$current_tax_info, {
        GrossIncome: 0,
        FillingStatus: "",
        AGITax: 0,
        Sect125: 0,
        TSA: 0,
        PercentPreTax: 0,
        StandardDeduction: 0,
        isScheduleADeduction : false,
        ScheduleA: 0,
        Over65Deduction: 0,
        NetTaxableInc: 0,
        WithHoldingTax: 0,
        FICA: 0,
        MISC: 0,
        NonTSASavings: 0,
        NetTakeHomePay: 0
    }];
    $projected1_tax_info = []
    $projected1_tax_info = [...$projected1_tax_info, {
        GrossIncome: 0,
        FillingStatus: "",
        AGITax: 0,
        Sect125: 0,
        TSA: 0,
        PercentPreTax: 0,
        StandardDeduction: 0,
        isScheduleADeduction : false,
        ScheduleA: 0,
        Over65Deduction: 0,
        NetTaxableInc: 0,
        WithHoldingTax: 0,
        FICA: 0,
        MISC: 0,
        NonTSASavings: 0,
        NetTakeHomePay: 0
    }];
    $projected2_tax_info = []
    $projected2_tax_info = [...$projected2_tax_info, {
        GrossIncome: 0,
        FillingStatus: "",
        AGITax: 0,
        Sect125: 0,
        TSA: 0,
        PercentPreTax: 0,
        StandardDeduction: 0,
        isScheduleADeduction : false,
        ScheduleA: 0,
        Over65Deduction: 0,
        NetTaxableInc: 0,
        WithHoldingTax: 0,
        FICA: 0,
        MISC: 0,
        NonTSASavings: 0,
        NetTakeHomePay: 0
    }];

    const ShowTaxTable = () => {
        // document.getElementsByClassName("tax-table")[0].removeAttribute("hidden")
    }
    const ShowCombinedSummary = () => {
        document.getElementById("combined-tax-summary").removeAttribute("hidden")
    }
</script>
<div
    class="tax-app"
>
    <div
        class="variation-options"
    >
        <ul
            class="variation-radio-list"
        >
            {#each variations as variation}
                <li>
                    <label>
                        <input
                            type="radio"
                            bind:group={selectedVariation}
                            value={variation}
                        >
                            {variation}
                    </label>
                </li>
            {/each}
        </ul>
        <div
            class="variation-button-group"
        >
            <!-- <button on:click={ShowSummary("Current")}>Show Summary</button> -->
            <button
                class="btn-header btn-show-tax-table"
                on:click={ShowTaxTable}
            >
                Show Tax Table
            </button>
            <button
                class="btn-header btn-show-combined-summary"
                on:click={ShowCombinedSummary}
            >
                Show Combined Summary
            </button>
        </div>
    </div>
    <div
        class="tax-form"
    >
        <TaxForm selectedVariation = {selectedVariation}/>
    </div>
</div>
<div hidden id="combined-tax-summary">
    <CombinedSummary />
</div>
<style>
    .variation-options{
        display: flex;
        position: fixed;
        width: 100%;
        top: 0;
        left: 0;
        background-color: black;
        color: darkorange;
        justify-content: space-evenly;
    }
    .variation-radio-list{
        list-style: none;
        display: flex;
        width: 70%;
    }
    .variation-radio-list li{
        flex-basis: 15%;
    }
    .btn-header{
        padding: 6px;
        margin-top: 8px;
    }
</style>
