<script>
    export let tax_info

    const toCurrency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    })

    const Calculate = () => {
        let percentPreTax = (tax_info.TSA / tax_info.grossIncome) * 100

        document.getElementsByName("gross-inc")[0].textContent = toCurrency.format(tax_info.grossIncome)
        document.getElementsByName("filling-status")[0].textContent = GetFilingStatus()
        document.getElementsByName("filing-status-deduction")[0].textContent = toCurrency.format(tax_info.filingStatusDeduction)
        document.getElementsByName("sect-125")[0].textContent = toCurrency.format(tax_info.sect125)
        document.getElementsByName("tsa-cont")[0].textContent = toCurrency.format(tax_info.TSA)
        document.getElementsByName("percent-pre-tax")[0].textContent = percentPreTax.toFixed(2)
        document.getElementsByName("standard-deduction")[0].textContent = toCurrency.format(GetStandardDeduction())
        document.getElementsByName("over65deduction")[0].textContent = toCurrency.format(GetOver65Deduction())
        document.getElementsByName("net-taxible")[0].textContent = toCurrency.format(GetTaxableIncome())
        document.getElementsByName("withholding-tax")[0].textContent = toCurrency.format(tax_info.WithHolding_tax)
        document.getElementsByName("FICA")[0].textContent = toCurrency.format(GetFICA())
        document.getElementsByName("MISC")[0].textContent = toCurrency.format(tax_info.Misc)
        document.getElementsByName("non-tsa-savings")[0].textContent = toCurrency.format(tax_info.NonTSA)
        document.getElementsByName("net-take-home")[0].textContent = toCurrency.format(GetNetTakeHomePay())

        document.getElementById("tax-summary").removeAttribute("hidden")
    }
    const GetTaxableIncome = () =>{
        let NetTaxableInc = tax_info.grossIncome -
            tax_info.TSA -
            tax_info.sect125
        NetTaxableInc -= GetStandardDeduction()
        if (tax_info.over65dedution)
        {
            NetTaxableInc -= 1700
        }
        return NetTaxableInc
    }
    const GetFilingStatus =() =>{
        let selectElement = document.querySelector('#filing-status');
        let output = selectElement.options[selectElement.selectedIndex].value;

        switch (output) {
            case 'singe':
                return "Single"
                break;
            case 'married':
            return "Married"
                break;
            case 'Married_s':
            return "Married filing separately"
                break;
            case 'headofhousehold':
            return "Head of Household"
                break;
            default:
            return "Single"
                break;
        }
    }
    const GetStandardDeduction = () =>{
        let selectElement = document.querySelector('#filing-status');
        let output = selectElement.options[selectElement.selectedIndex].value;

        switch (output) {
            case 'singe':
                tax_info.filingStatusDeduction = 12950
                break;
            case 'married':
            tax_info.filingStatusDeduction = 25900
                break;
            case 'Married_s':
            tax_info.filingStatusDeduction = 12950
                break;
            case 'headofhousehold':
            tax_info.filingStatusDeduction = 19400
                break;
            default:
            tax_info.filingStatusDeduction = 12950
                break;
        }
        return tax_info.filingStatusDeduction
    }
    const GetOver65Deduction =() =>{
        if(tax_info.over65dedution){
            return 1700
        }
        else
            return 0
    }
    const GetNetTakeHomePay = () => {
        return tax_info.grossIncome -
            tax_info.TSA -
            tax_info.sect125 -
            tax_info.WithHolding_tax -
            GetFICA() -
            tax_info.Misc -
            tax_info.NonTSA -
            tax_info.filingStatusDeduction
    }
    const GetFICA = () => {
        return (tax_info.grossIncome - tax_info.sect125) * .0765
    }

</script>



<div class="border-2">
    <h1>
        <u>
            Tax Summary
        </u>
    </h1>

    <div>
        <button
            on:click={Calculate}
            class="calculate-button">
                Calculate
        </button>
    </div>

    <div hidden id="tax-summary">
        <h2>
            Income
        </h2>

        <p>
            Gross Income per Year:
            <b>
                <span name = "gross-inc">

                </span>
            </b>
        </p>

        <h2>
            Filing Status
        </h2>

        <p>
            Filing Status:
            <b>
                <span name = "filling-status">

                </span>
            </b>
        </p>
        <p>
            Tax Owed:
            <b>
                <span name = "filing-status-deduction">

                </span>
            </b>
        </p>
        <p>
            Section 125:
            <b>
                <span name = "sect-125">

                </span>
            </b>
        </p>

        <h2>
            Pre-Tax Contributions
        </h2>

        <p>
            TSA Contribution:
            <b>
                <span name = "tsa-cont">

                </span>
            </b>
        </p>

        <p>
            Contribution:
            <b>
                <span name = "percent-pre-tax">

                </span>
                % <i>*rounded</i>
            </b>
        </p>

        <p>
            Standard Deduction:
            <b>
                <span name = "standard-deduction">

                </span>
            </b>
        </p>

        <p>
            Over 65 deduction:
            <b>
                <span name = "over65deduction">

                </span>
            </b>
        </p>

        <p>
            Net Taxable:
            <b>
                <span name = "net-taxible">

                </span>
            </b>
        </p>

        <h2>
            Withholding Taxes:
        </h2>

        <p>
            W/H Tax:
            <b>
                <span name = "withholding-tax">

                </span>
            </b>
        </p>

        <p>
            FICA:
            <b>
                <span name = "FICA">

                </span>
            </b>
        </p>

        <p>
            MISC:
            <b>
                <span name = "MISC">

                </span>
            </b>
        </p>

        <p>
            Non-TSA Savings:
            <b>
                <span name = "non-tsa-savings">

                </span>
            </b>
        </p>

        <h2>
            Summary
        </h2>

        <p>
            Net Take-Home Pay:
            <b>
                <span name = "net-take-home">

                </span>
            </b>
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
