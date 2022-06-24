<script>
    import {projected2_tax_info} from "../../stores/store.js"
    import TaxSummary from "../tax-summary.svelte"

    const toCurrency = new Intl.NumberFormat(
            'en-US',
        {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }
    )

    const GetAGI = () =>{
        $projected2_tax_info[0].AGI =
            toCurrency.format(
                $projected2_tax_info[0].grossIncome -
                $projected2_tax_info[0].TSA -
                $projected2_tax_info[0].sect125
            )

        return $projected2_tax_info[0].AGI
    }

    const CalculateAGI = () => {
        let AGI = GetAGI()
        document.querySelector(".AGI").textContent = AGI
    }

    const LoadSummary = () => {
        if(document.getElementById("tax-summary-projected2") == null)
        {
            const app = new TaxSummary({
                target: document.body,
                props: {
                    selectedVariation: "Projected 2"
                },
            });
        }
        else if(document.getElementById("tax-summary-projected2") != null)
        {
            document.getElementById("tax-summary-projected2").remove()
            const app = new TaxSummary({
                target: document.body,
                props: {
                    selectedVariation: "Projected 2"
                },
            });
        }
    }
</script>

<div
    class="projected2-tax-form"
>
    {#each $projected2_tax_info as projected2_tax_info}
        <div class="border-2">
            <h2>
                <u>
                Projected 2 Tax Information
                </u>
            </h2>

            <div >
                <label for="GrossInc">
                    Gross Income /yr:
                </label>

                <input
                    type="number"
                    bind:value="{projected2_tax_info.grossIncome}"/>

                <h3>
                    Pre-Tax Contributions
                </h3>

                <div>
                    <label for="Sect125">
                        Sect 125:
                    </label>

                    <input
                        type="number"
                        bind:value="{projected2_tax_info.sect125}"
                    />
                </div>

                <div>
                    <label for="TSA">
                        TSA:
                    </label>

                    <input
                        type="number"
                        bind:value="{projected2_tax_info.TSA}"
                    />

                </div>
                <div>
                    <label for="NonTSA">
                        Non TSA:
                    </label>
                    <input
                        type="number"
                        bind:value="{projected2_tax_info.NonTSASavings}"/>
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
                        <span >
                            <input
                                type="text"
                                class="AGI"
                                bind:value="{projected2_tax_info.AGI}"
                                disabled
                            />
                        </span>
                    </b>
                </p>
            </div>

            <h3>
                Filing Status
            </h3>

            <select name="filing-status" id="filing-status" >
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="Married_s">Married filing separatly</option>
                <option value="headofhousehold">Head of Houshold</option>
            </select>

            <div>
                Use Schedule A
                <input
                    class="isScheduleA"
                    type="checkbox"
                    bind:checked="{projected2_tax_info.isScheduleADeduction}"
                />

                <input
                    type="number"
                    bind:value="{projected2_tax_info.scheduleADeduction}"
                />
            </div>

            <div>
                <label for="AGI-tax">
                    Search Tax Owed:
                </label>

                <input
                    type="number"
                    bind:value="{projected2_tax_info.AGITax}"/>
            </div>

            <div>
                65+ years old
                <input
                    class="is65orover"
                    type="checkbox"
                    bind:checked="{projected2_tax_info.over65dedution}"/>
            </div>
            <div>
                Age 65:
                <input
                type="number"
                bind:value="{projected2_tax_info.Age65}"/>
            </div>

            <h3>
                Witholding Taxes
            </h3>

            <div>
                <label for="witholding">
                    W/H Tax:
                </label>

                <input
                    type="number"
                    bind:value="{projected2_tax_info.WithHoldingTax}"/>
            </div>

            <div>
                <label for="Misc">
                    MISC:
                </label>
                <input
                    type="number"
                    bind:value="{projected2_tax_info.MISC}"/>
            </div>

            <div>
                <label for="Proj2TaxRefund">
                    Proj Tax Refund:
                </label>
                <input
                    type="number"
                    class="Proj2TaxRefund"
                    bind:value="{projected2_tax_info.ProjTaxRefund}"
                    disabled>
            </div>
        </div>
    {/each}
    <button
        style="
            width: 100%;
            padding: 5px;
        "
        on:click={LoadSummary}
    >
        Calculate Summary
    </button>
</div>

<style>
    .projected2-tax-form{
        width:25%;
        text-align: center;
        float:left;
        padding: 5px;
    }
    .border-2{
        border: 2px solid black;
        padding: 10px;
        background: lightcoral;
        opacity: 0.9;
        color: white;
    }
    .calculate-agi{
        width: 100%;
        padding: 5px;
    }
    #filing-status{
        width: 100%;
        padding: 5px;
        margin-bottom: 10px;
        text-align: center;
    }
</style>
