<script>
    import TopNav from './comp/top-nav.svelte'
    import PDFTable from './comp/pdf-table.svelte'
    import TaxForm from './comp/tax-form.svelte'
    import Disclaimer from './comp/disclaimer.svelte'
    import ActionsToTake from './comp/actions-to-take.svelte'
    import CombinedSummary from './comp/tax-summary/Combined.svelte'

    import {current_tax_info} from "./stores/store.js"
    import {projected1_tax_info} from "./stores/store.js"
    import {projected2_tax_info} from "./stores/store.js"
    let selectedVariation

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
        NetTakeHomePay: 0,
        ProjTaxRefund: 0,
        Age65: 0
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
        NetTakeHomePay: 0,
        ProjTaxRefund: 0,
        Age65: 0

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
        NetTakeHomePay: 0,
        ProjTaxRefund: 0,
        Age65: 0
    }];
</script>

<div class="logo">
    <img src="../src/logo/logo.png" alt="Nature" class="responsive" width="50%" height="80%">
</div>

<div class="Nav">
    <TopNav onChange={newValue => selectedVariation = newValue} />
</div>

<div class="PDFTable">
    <PDFTable/>
</div>
<div class="disclaimer-containter">
    <Disclaimer/>
</div>

<div class="tax-app">
    <TaxForm {selectedVariation}/>
</div>

<div id="combined-tax-summary" hidden>
    <CombinedSummary />
</div>

<div class="actions-to-take" hidden>
    <ActionsToTake />
</div>

<style>
    .logo{
        position: absolute;
        margin: 0% auto;
        width:90%;
        padding: 4% 5%;
        z-index: -1;
    }
    .logo img {
        opacity: 0.4;
        width:100%;
    }
    .Nav {
        padding : 3px;
    }
    .disclaimer-containter{
        width: 100%;
        padding: 5px;
        margin-top: 20px;
    }
    .actions-to-take{
        margin-top: 10px;
    }

    @media print{
        .Nav {
            display: none;
        }
    }
     @media (orientation: landscape) {
        @media print {
            .logo {
                width: 100%;
                padding: 0;
                height: 95%;
            }
            .disclaimer-containter{
                width: 100%;
                top:0;
                left:0;
                margin: 0;
            }
        }
    }
    @media (orientation: portrait) {
        @media print {
            .logo{margin: 50% auto}
            .disclaimer-containter{
                width: 100%;
                top:0;
                left:0;
                margin: 0;
            }
        }
    }
</style>
