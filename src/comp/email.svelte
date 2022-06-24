<script>
    const SendEmail = () =>{
        let name = document.getElementsByClassName("name")[0].value;
        let email = document.getElementsByClassName("email")[0].value;
        let message = document.getElementsByClassName("message")[0].value;

        window.open(
            'mailto:[email]?subject=Request for information&body=' +
                'Name: ' + name + '%0D%0A' +
                'Email: ' + email + '%0D%0A' +
                'Date: '+ new Date().toDateString() + '%0D%0A'+
                '%0D%0A' +
                name +
                ' has requested more information about their taxes on ' +
                new Date().toDateString() +
                    '%0D%0A %0D%0A Message: %0D%0A %0D%0A' + message +'%0D%0A %0D%0A'
        );
    }

    const ClosePopup = () =>{
        document.getElementsByClassName("tax-app")[0].style.opacity = "1";
        document.getElementsByClassName("top-nav-container")[0].style.opacity = "1";
        document.getElementsByClassName("logo")[0].style.opacity = ".5";
        document.getElementsByClassName("email")[0].style.display = "none"
    }
</script>

<div class="container">
    <div class="email-form">
        <h4>Name</h4>
        <input type="text" class="name">

        <h4>Email</h4>
        <input type="email" class="email">

        <h4>Message</h4>
        <textarea
            placeholder="Enter your message"
            class="message width100"
        >
        </textarea>

        <div class="btn-grp">
            <button on:click={SendEmail}>Send Email</button>
            <button on:click={ClosePopup}>Cancel</button>
        </div>
    </div>
</div>

<style>
    .container{
        position: absolute;
        overflow: visible;
        margin-left: 30%;
        margin-top: 50px;
        border: 2px solid black;
        background-color: white;
        padding:5px;
        width: 50%;
        z-index: 999;
    }
    .email-form{
        width: 90%;
        padding: 5px;
    }
    .width100{
        width:100%;
    }

    .btn-grp{
        padding: 5px;
    }
</style>
