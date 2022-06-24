<script>
    import Email from "./email.svelte"
    let variations =
        [
            "Current",
            "Projected 1",
            "Projected 2"
        ]
    let selectedVariation = "Current"
    export let onChange
    $: onChange(selectedVariation)

    const ShowTaxTable = () => {
        FadeBackgroundItems()
        document.getElementsByClassName("pdf-table")[0].style.display = "block"
        document.getElementsByClassName("tax-table-frame")[0].src = "../src/PDF_Tables/tax-table/i1040tt.pdf"
    }

    const ShowCCCTable = () => {
        FadeBackgroundItems()
        document.getElementsByClassName("pdf-table")[0].style.display = "block"
        document.getElementsByClassName("tax-table-frame")[0].src = ""
    }

    const ShowEmailForm = () => {
        FadeBackgroundItems()
        document.getElementsByClassName("email")[0].style.display = "block"
    }

    const ShowCombinedSummary = () => {
        document.getElementById("combined-tax-summary").removeAttribute("hidden")
        document.getElementsByClassName("actions-to-take")[0].removeAttribute("hidden")

    }

    const Print = () => {
        window.print()
    }

    const FadeBackgroundItems = () => {
        document.getElementsByClassName("tax-app")[0].style.opacity = "0.2";
        document.getElementsByClassName("logo")[0].style.opacity = "0.2";
        document.getElementsByClassName("top-nav-container")[0].style.opacity = "0.2";
    }
</script>

<div class="top-nav-container">
    <ul class="top-nav">

        <div class="float-left">
            {#each variations as variation}
                <li class="variation">
                    <label>
                        <input
                            type="radio"
                            bind:group={selectedVariation}
                            value={variation}
                        >
                            {variation}
                    </label>
                </li>
            {/each}
        </div>

        <div class="float-right">
            <li>
                <button
                    class="btn"
                    on:click={Print}
                >
                    Print
                </button>
            </li>
            <li>
                <button
                    class="btn"
                    on:click={ShowEmailForm}
                >
                    Email
                </button>
            </li>
            <li>
                <button
                    class="btn"
                    on:click={ShowCombinedSummary}
                >
                    Show Combined Summary
                </button>
            </li>
            <li>
                <select class="btn">
                    <option>
                        Select a Table to Show
                    </option>
                    <option   on:click={ShowTaxTable}>
                        i1040tt
                    </option>
                    <option  on:click={ShowCCCTable}>
                        Child Care Credit
                    </option>
                    <option  on:click={ShowEmailForm}>
                        Retirement Savings
                    </option>
                    <option  on:click={ShowEmailForm}>
                        Earned Income Credit (EIC)
                    </option>
                </select>
            </li>
        </div>
    </ul>
</div>

<div class="email" hidden>
    <Email/>
</div>

<style>
    .top-nav-container{
        background-color: black;
        color: floralwhite;
        top: 0;
        left: 0;
        position: fixed;
        width: 100%;
        z-index: 99;
    }
    .top-nav{
        display: flex;
        list-style-type: none;
        justify-content: space-between;
        margin: 1px;
    }
    .variation{
        padding-top: 5px;
    }
    .float-left{
        display: flex;
    }
    .float-left li{
        padding: 5px;
    }
    .float-right{
        display: flex;
    }
    .btn{
        padding: 5px;
        margin: 1px 5px;
    }

    .email {
        position: relative;
        opacity: 1;
        z-index: 1;
    }
</style>
