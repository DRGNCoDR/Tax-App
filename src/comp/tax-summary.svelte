<script>
    export let tax_info

    // let showSummary = false

    const toCurrency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    })

    const Calculate = () => {


        let percentPreTax = tax_info.grossIncome / tax_info.TSA

        let NetTaxableInc = tax_info.grossIncome -
            tax_info.TSA -
            tax_info.sect125

        let NetTakeHomePay = tax_info.grossIncome -
            tax_info.TSA -
            tax_info.sect125 -
            tax_info.WithHolding_tax -
            tax_info.FICA -
            tax_info.Misc -
            tax_info.NonTSA

            document.getElementsByName("gross-inc")[0].textContent = toCurrency.format(tax_info.grossIncome)
            document.getElementsByName("filing-status-deduction")[0].textContent = toCurrency.format(tax_info.filingStatusDeduction)
            document.getElementsByName("sect-125")[0].textContent = toCurrency.format(tax_info.sect125)
            document.getElementsByName("tsa-cont")[0].textContent = toCurrency.format(tax_info.TSA)
            document.getElementsByName("percent-pre-tax")[0].textContent = percentPreTax
            document.getElementsByName("net-taxible")[0].textContent = toCurrency.format(NetTaxableInc)
            document.getElementsByName("withholding-tax")[0].textContent = toCurrency.format(tax_info.WithHolding_tax)
            document.getElementsByName("FICA")[0].textContent = toCurrency.format(tax_info.FICA)
            document.getElementsByName("MISC")[0].textContent = toCurrency.format(tax_info.Misc)
            document.getElementsByName("non-tsa-savings")[0].textContent = toCurrency.format(tax_info.NonTSA)
            document.getElementsByName("net-take-home")[0].textContent = toCurrency.format(NetTakeHomePay)

            document.getElementById("tax-summary").removeAttribute("hidden")
            // ShowSummary(true)
    }

    // const ShowSummary = (show) => {
    //     showSummary = show
    // }
</script>



<div class="border-2">


    <h2>Tax Summary</h2>

    <div>
        <button
        on:click={Calculate}
        class="calculate-button">
            Calculate
        </button>
    </div>
    <div hidden id="tax-summary">
        <h4>Income</h4>
        <p>
            Gross Income per Paycheck:
            <span name = "gross-inc">

            </span>
        </p>
        <h4>Filing Status</h4>
        <p>
            Filing Status:
            <span name = "filing-status">

            </span>
        </p>
        <p>
            Filing Status Deduction:
            <span name = "filing-status-deduction">

            </span>
        </p>
        <p>
            Section 125:
            <span name = "sect-125">

            </span>
        </p>

        <h4>Pre-Tax Contributions </h4>

        <p>
            TSA Contribution:
            <span name = "tsa-cont">

            </span>
        </p>

        <p>
            Contribution:
            <span name = "percent-pre-tax">

            </span>
            %
        </p>

        <p>
            Net Taxable:
            <span name = "net-taxible">

            </span>
        </p>

        <h4>Withholding Taxes: </h4>

        <p>
            W/H Tax:
            <span name = "withholding-tax">

            </span>
        </p>

        <p>
            FICA:
            <span name = "FICA">

            </span>
        </p>

        <p>
            MISC:
            <span name = "MISC">

            </span>
        </p>

        <p>
            Non-TSA Savings:
            <span name = "non-tsa-savings">

            </span>
        </p>

        <h4>Summary </h4>

        <p>
            Net Take-Home Pay:
            <span name = "net-take-home">

            </span>
        </p>
    </div>

</div>

<style>
    .border-2{
        border: 2px solid black;
        padding: 5px;

    }
    .calculate-button{
        width: 100%;
    }
</style>