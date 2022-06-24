<script>
    const ClosePopupTaxTable = () =>{
        document.getElementsByClassName("tax-app")[0].style.opacity = "1";
        document.getElementsByClassName("top-nav-container")[0].style.opacity = "1";
        document.getElementsByClassName("pdf-table")[0].style.display = "none"
    }
</script>

<div class="pdf-table" hidden>
    <div class="close-btn">
        <button on:click={ClosePopupTaxTable}>Close</button>
    </div>
    <div>
        <iframe
            src="../src/PDF_Tables/tax-table/i1040tt.pdf"
            title="tax-table"
            style="
                width: 90%;
                height: 600px;
                position: absolute;
                margin-left: 5%;"
            class="tax-table-frame"
        >
    </div>
</div>

<style>
    .pdf-table {
        position: relative;
        opacity: 1;
        z-index: 1;
        margin-top: 5%;
    }
    .close-btn{
        margin-left: 92%;
    }
</style>
