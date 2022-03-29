<script>
    import TaxSummary from "./tax-summary.svelte"

    let tax_info = {
        grossIncome: 0.00,
        filingStatusDeduction : 0.00,
        sect125: 0.00,
        TSA: 0.00,
        WithHolding_tax: 0.00,
        FICA: 0.00,
        Misc: 0.00,
        NonTSA: 0.00,
        NetTakeHome: 0.00
    }
</script>
<div class="tax-info" style="display: flex;">

    <div class="border-2">
        <h2>Tax Information</h2>
        <div class = "border-2">
            <label for="GrossInc">
                Gross Income:
            </label>
            <input type="number" bind:value="{tax_info.grossIncome}">
        </div>

        <h4>Filing Status</h4>
        <select name="filing-status" id="filing-status">
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="Married_s">Married filing separatly</option>
            <option value="headofhousehold">Head of Houshold</option>
        </select>

        <div>
            <label for="Sect125">
                Enter value from table on the right:
            </label>
            <input type="number"  bind:value="{tax_info.filingStatusDeduction}"/>
        </div>

        <h4>Pre-Tax Contributions</h4>
        <div>
            <label for="Sect125">
                Sect 125:
            </label>
            <input type="number"  bind:value="{tax_info.sect125}"/>
        </div>

        <div>
            <label for="TSA">
                TSA:
            </label>
            <input type="number"  bind:value="{tax_info.TSA}"/>
        </div>

        <h4>Witholding Taxes</h4>

        <div>
            <label for="witholding">
                W/H Tax:
            </label>
            <input type="number"  bind:value="{tax_info.WithHolding_tax}"/>
        </div>

        <div>
            <label for="FICA">
                FICA:
            </label>
            <input type="number"  bind:value="{tax_info.FICA}"/>
        </div>

        <div>
            <label for="Misc">
                MISC:
            </label>
            <input type="number"  bind:value="{tax_info.Misc}"/>
        </div>

        <div>
            <label for="NonTSA">
                Non TSA:
            </label>
            <input type="number"  bind:value="{tax_info.NonTSA}"/>
        </div>
    </div>

    <TaxSummary {tax_info}/>
</div>

<style>
    .border-2{
        border: 2px solid black;
        padding: 5px;
    }

</style>