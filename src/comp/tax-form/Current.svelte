<script>
    import {current_tax_info} from "../../stores/store.js"
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
        $current_tax_info[0].AGI =
            toCurrency.format(
                $current_tax_info[0].grossIncome -
                $current_tax_info[0].TSA -
                $current_tax_info[0].sect125
            )

        return $current_tax_info[0].AGI
    }

    const CalculateAGI = () => {
        let AGI = GetAGI()
        document.querySelector(".AGI").textContent = AGI
    }
    const LoadSummary = () => {
        if(document.getElementById("tax-summary-current") == null)
        {
            const app = new TaxSummary({
                target: document.body,
                props: {
                    selectedVariation: "Current"
                },
            });
        }
        else if(document.getElementById("tax-summary-current") != null)
        {
            document.getElementById("tax-summary-current").remove()
            const app = new TaxSummary({
                target: document.body,
                props: {
                    selectedVariation: "Current"
                },
            });
        }

    }
</script>

<div
    class="current-tax-form"
>
    {#each $current_tax_info as current_tax_info}
        <div class="border-2">
            <h1>
                <u>
                Current Tax Information
                </u>
            </h1>

            <div >
                <label for="GrossInc">
                    Gross Income /yr:
                </label>

                <input
                    type="number"
                    bind:value="{current_tax_info.grossIncome}"/>

                <h2>
                    Pre-Tax Contributions
                </h2>

                <div>
                    <label for="Sect125">
                        Sect 125:
                    </label>

                    <input
                        type="number"
                        bind:value="{current_tax_info.sect125}"
                    />
                </div>

                <div>
                    <label for="TSA">
                        TSA:
                    </label>

                    <input
                        type="number"
                        bind:value="{current_tax_info.TSA}"
                    />

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
                                bind:value="{current_tax_info.AGI}"
                                disabled
                            />
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
                Use Schedule A
                <input
                    class="isScheduleA"
                    type="checkbox"
                    bind:checked="{current_tax_info.isScheduleADeduction}"
                />

                <input
                    type="number"
                    bind:value="{current_tax_info.ScheduleA}"
                />
            </div>

            <div>
                <label for="AGI-tax">
                    Search Tax Table for AGI:
                </label>

                <input
                    type="number"
                    bind:value="{current_tax_info.AGITax}"/>
            </div>

            <div>
                65+ years old
                <input
                    class="is65orover"
                    type="checkbox"
                    bind:checked="{current_tax_info.over65dedution}"/>
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
                    bind:value="{current_tax_info.WithHoldingTax}"/>
            </div>

            <div>
                <label for="Misc">
                    MISC:
                </label>
                <input
                    type="number"
                    bind:value="{current_tax_info.MISC}"/>
            </div>

            <div>
                <label for="NonTSA">
                    Non TSA:
                </label>
                <input
                    type="number"
                    bind:value="{current_tax_info.NonTSASavings}"/>
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
    .current-tax-form{
        width:25%;
        text-align: center;
        float: left;
    }
    .border-2{
        border: 2px solid black;
        padding: 10px;
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
