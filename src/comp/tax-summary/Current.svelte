<script>
    import {current_tax_info} from "../../stores/store.js"

    const toCurrency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    })

    $current_tax_info[0].PercentPreTax = ($current_tax_info[0].TSA / $current_tax_info[0].grossIncome) * 100

    const GetTaxableIncome = () =>{
        $current_tax_info[0].NetTaxableInc =
            $current_tax_info[0].grossIncome -
            $current_tax_info[0].TSA -
            $current_tax_info[0].sect125 -
            GetStandardDeduction() -
            GetOver65Deduction()

        return $current_tax_info[0].NetTaxableInc
    }
    const GetFilingStatus =() =>{
        let selectElement = document.querySelector('#filing-status');
        let output = selectElement.options[selectElement.selectedIndex].value;

        switch (output) {
            case 'singe':
                $current_tax_info[0].FillingStatus ="Single"
                return $current_tax_info[0].FillingStatus
                break;
            case 'married':
                $current_tax_info[0].FillingStatus ="Married"
                return $current_tax_info[0].FillingStatus
                break;
            case 'Married_s':
                $current_tax_info[0].FillingStatus = "Married filing separately"
                return $current_tax_info[0].FillingStatus
                break;
            case 'headofhousehold':
                $current_tax_info[0].FillingStatus = "Head of Household"
                return $current_tax_info[0].FillingStatus
                break;
            default:
                $current_tax_info[0].FillingStatus = "Single"
                return $current_tax_info[0].FillingStatus
                break;
        }
    }
    const GetStandardDeduction = () =>{
        let selectElement = document.querySelector('#filing-status');
        let output = selectElement.options[selectElement.selectedIndex].value;

        if(!$current_tax_info[0].isScheduleADeduction){
            switch (output) {
            case 'singe':
                $current_tax_info[0].StandardDeduction = 12950
                break;
            case 'married':
                $current_tax_info[0].StandardDeduction = 25900
                break;
            case 'Married_s':
                $current_tax_info[0].StandardDeduction = 12950
                break;
            case 'headofhousehold':
                $current_tax_info[0].StandardDeduction = 19400
                break;
            default:
                $current_tax_info[0].StandardDeduction = 12950
                break;
            }
        }
        console.log({$current_tax_info})
        if($current_tax_info[0].isScheduleADeduction){
            $current_tax_info[0].StandardDeduction = $current_tax_info[0].ScheduleA
        }
        return $current_tax_info[0].StandardDeduction
    }
    const GetOver65Deduction =() =>{
        if($current_tax_info[0].over65dedution){
            $current_tax_info[0].Over65Deduction = 1700
            return $current_tax_info[0].Over65Deduction
        }
        else
            return 0
    }
    const GetNetTakeHomePay = () => {
        $current_tax_info[0].NetTakeHomePay =
            $current_tax_info[0].grossIncome -
            $current_tax_info[0].AGITax -
            $current_tax_info[0].TSA -
            $current_tax_info[0].sect125 -
            $current_tax_info[0].WithHoldingTax -
            GetFICA() -
            $current_tax_info[0].MISC -
            $current_tax_info[0].NonTSASavings

        return $current_tax_info[0].NetTakeHomePay
    }
    const GetFICA = () => {
        $current_tax_info[0].FICA =
            (
            $current_tax_info[0].grossIncome -
            $current_tax_info[0].sect125 ) *
            .0765

        return $current_tax_info[0].FICA
    }

</script>

<div id="tax-summary-current" class="tax-summary-current border-2">
    <div  id="tax-summary-title">
        <h1>
            <u>
                Current Tax Summary
            </u>
        </h1>
    </div>

    <div>
        <h2>
            Income
        </h2>

        <p>
            Gross Income per Year:
            <b>
                <span name = "gross-inc">
                    {toCurrency.format($current_tax_info[0].grossIncome)}
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
                    {toCurrency.format($current_tax_info[0].AGITax)}
                </span>
            </b>
        </p>
        <p>
            Section 125:
            <b>
                <span name = "sect-125">
                    {toCurrency.format($current_tax_info[0].sect125)}
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
                    {toCurrency.format($current_tax_info[0].TSA)}
                </span>
            </b>
        </p>

        <p>
            Contribution:
            <b>
                <span name = "percent-pre-tax">
                    {$current_tax_info[0].PercentPreTax.toFixed(2)}
                </span>
                % <i>*rounded</i>
            </b>
        </p>
        {#if !$current_tax_info[0].isScheduleADeduction}
        <p>
            Standard Deduction: {toCurrency.format(GetStandardDeduction())}
            <b>
                <div name = "standard-deduction">
                    Using Standard Deduction
                </div>
            </b>
        </p>
        {:else if $current_tax_info[0].isScheduleADeduction}
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
                    {toCurrency.format($current_tax_info[0].WithHoldingTax)}
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
                    {toCurrency.format($current_tax_info[0].MISC)}
                </span>
            </b>
        </p>

        <p>
            Non-TSA Savings:
            <b>
                <span name = "non-tsa-savings">
                    {toCurrency.format($current_tax_info[0].NonTSASavings)}
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
    .tax-summary-current{
        text-align: center;
        width: 25%;
        float:left;
    }
    .border-2{
        border: 2px solid black;
        padding: 10px;
    }
</style>
