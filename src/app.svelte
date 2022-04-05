<script>
    import TaxInfo  from "./comp/tax-info.svelte";
</script>
    <h1>
        Anthony App ALPHA v3
    </h1>
    <div class="app-container">
        <div id="app-taxinfo">
            <TaxInfo/>
        </div>
        <iframe
            src="../src/tax-table/i1040tt.pdf"
            title="2021 Tax Table"
            class="tax-table"
        />
    </div>

<style>
    .app-container{
        display: flex;
        flex-flow: row wrap;
        justify-content: space-around;
        padding: 10px;
    }
    .tax-table{
        flex-grow: 1;
        border: none;
        margin: 0;
        padding: 10px;
    }

</style>
