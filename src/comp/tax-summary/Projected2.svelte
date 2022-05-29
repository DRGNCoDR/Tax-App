<script>
    import {projected2_tax_info} from "../../stores/store.js"

    const toCurrency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    })
    $projected2_tax_info[0].PercentPreTax = ($projected2_tax_info[0].TSA / $projected2_tax_info[0].grossIncome) * 100

const GetTaxableIncome = () =>{
    $projected2_tax_info[0].NetTaxableInc =
        $projected2_tax_info[0].grossIncome -
        $projected2_tax_info[0].TSA -
        $projected2_tax_info[0].sect125 -
        GetStandardDeduction() -
        GetOver65Deduction()

    return $projected2_tax_info[0].NetTaxableInc
}
const GetFilingStatus =() =>{
    let selectElement = document.querySelector('#filing-status');
    let output = selectElement.options[selectElement.selectedIndex].value;

    switch (output) {
        case 'singe':
            $projected2_tax_info[0].FillingStatus ="Single"
            return $projected2_tax_info[0].FillingStatus
            break;
        case 'married':
            $projected2_tax_info[0].FillingStatus ="Married"
            return $projected2_tax_info[0].FillingStatus
            break;
        case 'Married_s':
            $projected2_tax_info[0].FillingStatus = "Married filing separately"
            return $projected2_tax_info[0].FillingStatus
            break;
        case 'headofhousehold':
            $projected2_tax_info[0].FillingStatus = "Head of Household"
            return $projected2_tax_info[0].FillingStatus
            break;
        default:
            $projected2_tax_info[0].FillingStatus = "Single"
            return $projected2_tax_info[0].FillingStatus
            break;
    }
}
const GetStandardDeduction = () =>{
    let selectElement = document.querySelector('#filing-status');
    let output = selectElement.options[selectElement.selectedIndex].value;

    if(!$projected2_tax_info[0].isScheduleADeduction){
        switch (output) {
        case 'singe':
            $projected2_tax_info[0].StandardDeduction = 12950
            break;
        case 'married':
            $projected2_tax_info[0].StandardDeduction = 25900
            break;
        case 'Married_s':
            $projected2_tax_info[0].StandardDeduction = 12950
            break;
        case 'headofhousehold':
            $projected2_tax_info[0].StandardDeduction = 19400
            break;
        default:
            $projected2_tax_info[0].StandardDeduction = 12950
            break;
        }
    }

    if($projected2_tax_info[0].isScheduleADeduction){
        $projected2_tax_info[0].StandardDeduction = $projected2_tax_info[0].scheduleADeduction
    }
    return $projected2_tax_info[0].StandardDeduction
}
const GetOver65Deduction =() =>{
    if($projected2_tax_info[0].over65dedution){
        $projected2_tax_info[0].Over65Deduction = 1700
        return $projected2_tax_info[0].Over65Deduction
    }
    else
        return 0
}
const GetNetTakeHomePay = () => {
    $projected2_tax_info[0].NetTakeHomePay =
        $projected2_tax_info[0].grossIncome -
        $projected2_tax_info[0].AGITax -
        $projected2_tax_info[0].TSA -
        $projected2_tax_info[0].sect125 -
        $projected2_tax_info[0].WithHoldingTax -
        GetFICA() -
        $projected2_tax_info[0].MISC -
        $projected2_tax_info[0].NonTSASavings

    return $projected2_tax_info[0].NetTakeHomePay
}
const GetFICA = () => {
    $projected2_tax_info[0].FICA =
        (
        $projected2_tax_info[0].grossIncome -
        $projected2_tax_info[0].sect125 ) *
        .0765

    return $projected2_tax_info[0].FICA
}
</script>

<div id="tax-summary-projected2" class="tax-summary-projected2 border-2">
    <div  id="tax-summary-title">
        <h1>
            <u>
                Projected 2 Tax Summary
            </u>
        </h1>
    </div>

    <div  id="tax-summary">
        <h2>
            Income
        </h2>

        <p>
            Gross Income per Year:
            <b>
                <span name = "gross-inc">
                    {toCurrency.format($projected2_tax_info[0].grossIncome)}
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
                    {GetFilingStatus()}
                </span>
            </b>
        </p>
        <p>
            Tax Owed:
            <b>
                <span name = "AGI-tax">
                    {toCurrency.format($projected2_tax_info[0].AGITax)}
                </span>
            </b>
        </p>
        <p>
            Section 125:
            <b>
                <span name = "sect-125">
                    {toCurrency.format($projected2_tax_info[0].sect125)}
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
                    {toCurrency.format($projected2_tax_info[0].TSA)}
                </span>
            </b>
        </p>

        <p>
            Contribution:
            <b>
                <span name = "percent-pre-tax">
                    {$projected2_tax_info[0].PercentPreTax.toFixed(2)}
                </span>
                % <i>*rounded</i>
            </b>
        </p>
        {#if !$projected2_tax_info[0].isScheduleADeduction}
        <p>
            Standard Deduction: {toCurrency.format(GetStandardDeduction())}
            <b>
                <div name = "standard-deduction">
                    Using Standard Deduction
                </div>
            </b>
        </p>
        {:else if $projected2_tax_info[0].isScheduleADeduction}
        <p>
            Schedule A Deduction: {toCurrency.format(GetStandardDeduction())}
            <b>
                <div name = "schedule-a-deduction">
                    Using Schedule A Deduction
                </div>
            </b>
        </p>
        {/if}

        <p>
            Over 65 deduction:
            <b>
                <span name = "over65deduction">
                    {toCurrency.format(GetOver65Deduction())}
                </span>
            </b>
        </p>

        <p>
            Net Taxable:
            <b>
                <span name = "net-taxible">
                    {toCurrency.format(GetTaxableIncome())}
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
                    {toCurrency.format($projected2_tax_info[0].WithHoldingTax)}
                </span>
            </b>
        </p>

        <p>
            FICA:
            <b>
                <span name = "FICA">
                    {toCurrency.format(GetFICA())}
                </span>
            </b>
        </p>

        <p>
            MISC:
            <b>
                <span name = "MISC">
                    {toCurrency.format($projected2_tax_info[0].MISC)}
                </span>
            </b>
        </p>

        <p>
            Non-TSA Savings:
            <b>
                <span name = "non-tsa-savings">
                    {toCurrency.format($projected2_tax_info[0].NonTSASavings)}
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
                    {toCurrency.format(GetNetTakeHomePay())}
                </span>
            </b>
        </p>
    </div>
</div>

<style>
    .tax-summary-projected2{
        text-align: center;
        width: 20%;
        float:left;
    }
    .border-2{
        border: 2px solid black;
        padding: 10px;

    }
</style>
