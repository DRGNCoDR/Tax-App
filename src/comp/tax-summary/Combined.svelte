<script>
    import {current_tax_info} from "../../stores/store.js"
    import {projected1_tax_info} from "../../stores/store.js"
    import {projected2_tax_info} from "../../stores/store.js"

    const toCurrency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    })

    $current_tax_info[0].PercentPreTax =
        (
            $current_tax_info[0].TSA /
            $current_tax_info[0].grossIncome
        ) *
        100
    $projected1_tax_info[0].PercentPreTax =
        (
            $projected1_tax_info[0].TSA /
            $projected1_tax_info[0].grossIncome
        ) *
        100
    $projected2_tax_info[0].PercentPreTax =
        (
            $projected2_tax_info[0].TSA /
            $projected2_tax_info[0].grossIncome
        ) *
        100
</script>

<h1>
    Combined Summary
</h1>
<div class="combined-container">
    <div class="combined-current">
        <h4>
            <u>
                Current
            </u>
        </h4>
        {#each $current_tax_info as item}
            <!-- <p>Gross Income: {item.grossIncome}</p>
            <p>Filling Status: {item.FillingStatus}</p>
            <p>AGI Tax: {item.AGI}</p>
            <p>Sect 125: {item.sect125}</p>
            <p>Percent of Gross: {item.PercentPreTax}</p>
            {#if !item.isScheduleADeduction}
                <p>Standard Deduction:{item.StandardDeduction}</p>
            {:else if item.isScheduleADeduction}
                <p>Schedule A: {item.StandardDeduction}</p>
            {/if}
            <p>Over 65 Deduction: {item.Over65Deduction}</p>
            <p>Net Taxable Income: {item.NetTaxableInc}</p>
            <p>Withholding Tax: {item.WithHoldingTax}</p>
            <p>FICA: {item.FICA}</p>
            <p>MISC: {item.MISC}</p>
            <p>Non TSA Savings: {item.NonTSASavings}</p>
            <p>Net Take Home Pay: {item.NetTakeHomePay}</p> -->
            <div class="current-summary">
                <p>Annual Tax Savings: {toCurrency.format(item.NetTakeHomePay)}</p>
                <p>Proj. Savings @ Curr. Int. Rate: {item.PercentPreTax.toFixed(2)}%</p>
                <p>5 year: {toCurrency.format(item.NetTakeHomePay * 5)}</p>
                <p>50 year: {toCurrency.format(item.NetTakeHomePay * 10) }</p>
                <p>20 year: {toCurrency.format(item.NetTakeHomePay * 20) } </p>
                <p>Age 65: ??</p>
            </div>
        {/each}
    </div>
    <div class="combined-projected1">
        <h4>Projected 1</h4>
        {#each $projected1_tax_info as item}

            <div class="projected1-vs-current">
                <p>Annual Tax Savings: {toCurrency.format(item.NetTakeHomePay - $current_tax_info[0].NetTakeHomePay)}</p>
                <p>Proj. Savings @ Curr. Int. Rate: {(item.PercentPreTax - $current_tax_info[0].PercentPreTax).toFixed(2)}%</p>
                <p>5 year: {toCurrency.format((item.NetTakeHomePay - $current_tax_info[0].NetTakeHomePay) * 5)}</p>
                <p>50 year: {toCurrency.format((item.NetTakeHomePay - $current_tax_info[0].NetTakeHomePay) * 10)}</p>
                <p>20 year: {toCurrency.format((item.NetTakeHomePay - $current_tax_info[0].NetTakeHomePay) * 20)} </p>
                <p>Age 65: ??</p>
            </div>
        {/each}
    </div>
    <div class="combined-projected2">
        <h4>Projected 2</h4>
        {#each $projected2_tax_info as item}

            <div class="projected2-vs-current">
                <p>Annual Tax Savings: {toCurrency.format(item.NetTakeHomePay - $current_tax_info[0].NetTakeHomePay)}</p>
                <p>Proj. Savings @ Curr. Int. Rate: {(item.PercentPreTax - $current_tax_info[0].PercentPreTax).toFixed(2)}%</p>
                <p>5 year: {toCurrency.format((item.NetTakeHomePay - $current_tax_info[0].NetTakeHomePay) * 5)}</p>
                <p>50 year: {toCurrency.format((item.NetTakeHomePay - $current_tax_info[0].NetTakeHomePay) * 10)}</p>
                <p>20 year: {toCurrency.format((item.NetTakeHomePay - $current_tax_info[0].NetTakeHomePay) * 20)} </p>
                <p>Age 65: ??</p>
            </div>
        {/each}
    </div>
</div>

<style>
    .combined-container{
        background-color: gray;
        color: white;
        padding: 10px;
        text-align: center;
        display: flex;
    }
    .combined-current{
        border-right: 1px solid black;
        margin: 0px 10px;
        padding: 0px 10px;
    }
    .combined-projected1{
        border-right: 1px solid black;
        margin: 0px 10px;
        padding: 0px 10px;
    }
    .combined-projected2{
        border-right: 1px solid black;
        margin: 0px 10px;
        padding: 0px 10px;
    }
</style>