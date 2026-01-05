let prediction = document.getElementById("prediction-input");
let results = document.getElementById("results");

document.getElementById("prediction-btn").addEventListener("click", ()=>{
    fetch("/roll",
        {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify({value: prediction.value})
        })
        .then(res => {
            return res.json();
        })
        .then(res => {
            if(res.prediction){
                results.innerText = "Your prediction: " + res.prediction;
                if(res.flag){
                    results.innerText += ", here is your glory: " + res.flag;
                }
            }
            else{
                results.innerText = "Bad request :(";
            }
        })
        .catch(()=>{
            results.innerText = "Bad request :(";
        });
});