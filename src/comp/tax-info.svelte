<script>
    import TaxSummary from "./tax-summary.svelte"

    // let variations = ["Original","1","2"];
    const toCurrency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    })

    let tax_info = {
        grossIncome: 0.00,
        filingStatusDeduction : 0.00,
        sect125: 0.00,
        TSA: 0.00,
        WithHolding_tax: 0.00,
        Misc: 0.00,
        NonTSA: 0.00,
        NetTakeHome: 0.00,
        over65dedution: 0.00
    }

    const GetAGI = () =>{
        return toCurrency.format(tax_info.grossIncome -
            tax_info.TSA -
            tax_info.sect125)
    }

    const CalculateAGI = () => {
        document.querySelector(".AGI").textContent = GetAGI()
    }
</script>

<!-- <div>
    <p>Select the variation you want to edit:</p>
    {#each variations as variation}
        <input type="radio" value={variation} name="variations"> {variation}
    {/each}
</div>
<br>-->

<div class="tax-info" style="display: flex;">
    <div class="border-2">
        <h1>
            <u>
                Tax Information
            </u>
        </h1>

        <div class = "border-2">
            <label for="GrossInc">
                Gross Income:
            </label>

            <input
                type="number"
                bind:value="{tax_info.grossIncome}">
            <h2>
                Pre-Tax Contributions
            </h2>

            <div>
                <label for="Sect125">
                    Sect 125:
                </label>

                <input
                    type="number"
                    bind:value="{tax_info.sect125}"/>

            </div>
        <div>
            <label for="TSA">
                TSA:
            </label>

            <input type="number"  bind:value="{tax_info.TSA}"/>

        </div>

        <div>
            <br>
            <button
                on:click={CalculateAGI}
                class="calculate-agi">
                    Calculate AGI
            </button>
        </div>
            <p>Current AGI:
                <b>
                    <span class="AGI">

                    </span>
                </b>
            </p>
        </div>

        <h2>
            Filing Status
        </h2>

        <select name="filing-status" id="filing-status" >
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="Married_s">Married filing separatly</option>
            <option value="headofhousehold">Head of Houshold</option>
        </select>

        <div>
            <label for="Sect125">
                Search Tax Table for AGI:
            </label>

            <input
                type="number"
                bind:value="{tax_info.filingStatusDeduction}"/>
        </div>

        <div>
            65+ years old
            <input
                class="is65orover"
                type="checkbox"
                bind:checked="{tax_info.over65dedution}">
        </div>

        <h2>
            Witholding Taxes
        </h2>

        <div>
            <label for="witholding">
                W/H Tax:
            </label>

            <input
                type="number"
                bind:value="{tax_info.WithHolding_tax}"/>
        </div>

        <div>
            <label for="Misc">
                MISC:
            </label>
            <input
                type="number"
                bind:value="{tax_info.Misc}"/>
        </div>

        <div>
            <label for="NonTSA">
                Non TSA:
            </label>
            <input
                type="number"
                bind:value="{tax_info.NonTSA}"/>
        </div>
    </div>
</div>

<div>
    <TaxSummary {tax_info}/>
</div>

<style>
    .border-2{
        border: 2px solid black;
        padding: 5px;
    }
</style>
