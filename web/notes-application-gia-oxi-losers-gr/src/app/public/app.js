const API_BASE = "";

window.logout = function () {
    fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include"
    }).then(() => {
        window.location = "/login";
    });
};

window.registerUser = async function (event) {
    event.preventDefault();

    const username = document.querySelector("#username").value.trim();
    const password = document.querySelector("#password").value.trim();

    const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
    });

    const data = await res.json();
    const msgBox = document.querySelector("#message");

    msgBox.innerText = data.message;

    if (res.ok) {
        msgBox.style.color = "#00ff66";
        setTimeout(() => window.location = "/login", 800);
    } else {
        msgBox.style.color = "red";
    }
};

window.loginUser = async function (event) {
    event.preventDefault();

    const username = document.querySelector("#username").value.trim();
    const password = document.querySelector("#password").value.trim();

    const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    const msgBox = document.querySelector("#message");

    msgBox.innerText = data.message;

    if (res.ok) {
        msgBox.style.color = "#00ff66";
        setTimeout(() => window.location = "/home", 800);
    } else {
        msgBox.style.color = "red";
    }
};

window.loadProfile = async function () {
    const profileBox = document.querySelector("#profileBox");

    const res = await fetch(`${API_BASE}/profile/info`, {
        credentials: "include"
    });

    if (!res.ok) {
        profileBox.innerText = "Not logged in.";
        setTimeout(() => window.location = "/login", 800);
        return;
    }

    const data = await res.json();
    profileBox.innerText = JSON.stringify(data.user, null, 2);
};
