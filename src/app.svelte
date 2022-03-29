<script>
    import TaxInfo  from "./comp/tax-info.svelte";
</script>


    <h1>
        Anthony App ALPHA v 0.0.2
    </h1>
    <div class="app-container">
        <div id="app-taxinfo">
            <TaxInfo/>
        </div>


            <iframe
                src="../src/tax-table/i1040tt.pdf"
                title="W3Schools Free Online Web Tutorials"
                id="tax-table">
            </iframe>

    </div>


    <div style="display:flex; display:none;">
        <TaxInfo/>
    </div>



<style>
    .app-container{
        display: flex;
        flex-flow: row wrap;
        justify-content: space-around;
        padding: 10px;
    }
    #tax-table{
        flex-grow: 1;
         border: none;
         margin: 0;
          padding: 10px;
    }
</style>