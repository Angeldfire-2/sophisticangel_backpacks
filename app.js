const whitelist = ['Angeldfire2'];

window.onload = function () {
    loadComments();
    checkForStoredName();
}

function checkForStoredName() {
    const storedName = localStorage.getItem('userName');
    const nameContainer = document.getElementById('nameContainer');
    const userInfo = document.getElementById('userInfo');
    const displayName = document.getElementById('displayName');

    if (storedName) {
        nameContainer.style.display = 'none';
        userInfo.style.display = 'flex';
        displayName.textContent = `Usuario: ${storedName}`;
    } else {
        nameContainer.style.display = 'block';
        userInfo.style.display = 'none';
    }
}

async function saveName() {
    const nameInput = document.getElementById('nameInput');
    const name = nameInput.value.trim();

    if (name === '') {
        alert('Por favor, ingresa tu nombre');
        return;
    }

    const nameExists = await checkNameExists(name);
    if (nameExists) {
        alert('Este nombre ya está en uso. Por favor, elige otro.');
        return;
    }

    localStorage.setItem('userName', name);
    await db.collection("users").doc(name).set({ name: name });

    document.getElementById('nameContainer').style.display = 'none';
    document.getElementById('userInfo').style.display = 'block';
    document.getElementById('displayName').textContent = `Usuario: ${name}`;

    alert(`Nombre guardado: ${name}`);
}

async function checkNameExists(name) {
    const userDoc = await db.collection("users").doc(name).get();
    return userDoc.exists;
}

async function resetName() {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
        await db.collection("comments").where("name", "==", storedName).get().then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                doc.ref.delete();
            });
        });
        await db.collection("users").doc(storedName).delete();
    }

    localStorage.removeItem('userName');
    document.getElementById('nameContainer').style.display = 'block';
    document.getElementById('userInfo').style.display = 'none';
}

let commentCooldown = false;

async function addComment() {
    const commentInput = document.getElementById('commentInput');
    const storedName = localStorage.getItem('userName');
    const commentText = commentInput.value.trim();
    const date = new Date();

    if (!storedName) {
        alert('Por favor, ingresa tu nombre antes de comentar');
        return;
    }

    if (commentText === '') {
        alert('El comentario no puede estar vacío');
        return;
    }

    if (commentCooldown) {
        alert('Por favor, espera 5 segundos antes de enviar otro comentario.');
        return;
    }

    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

    await db.collection("comments").add({
        name: storedName,
        commentText: commentText,
        date: serverTimestamp
    }).then(() => {
        commentInput.value = '';
        loadComments();
        startCommentCooldown();
    }).catch((error) => {
        console.error("Error agregando comentario: ", error);
    });
}

function startCommentCooldown() {
    commentCooldown = true;
    setTimeout(() => {
        commentCooldown = false;
    }, 5000); // 5 segundos en milisegundos
}

function loadComments() {
    const commentList = document.getElementById('commentList');
    commentList.innerHTML = '';

    // Escuchar cambios en tiempo real
    db.collection("comments").orderBy("date", "desc").onSnapshot((querySnapshot) => {
        commentList.innerHTML = ''; // Limpiar la lista de comentarios
        querySnapshot.forEach((doc) => {
            const commentData = doc.data();
            const formattedDate = commentData.date ? commentData.date.toDate().toLocaleString() : 'Sin fecha';
            const newComment = document.createElement('li');
            newComment.innerHTML = `
                <div class="comment-meta">
                    <strong class="nameCommentPe">${commentData.name}</strong> - ${formattedDate}
                </div>
                <div>${commentData.commentText}</div>
                <button class="reply-btn" onclick="showReplyBox('${doc.id}')">Responder</button>
                <div class="replies" id="replies-${doc.id}"></div>
                <button class="delete-btn" onclick="deleteComment('${doc.id}')">✕</button>
            `;

            const deleteBtn = newComment.querySelector('.delete-btn');
            const storedName = localStorage.getItem('userName');

            if (commentData.name === storedName || isUserInWhitelist(storedName)) {
                deleteBtn.style.display = 'inline-block';
            }

            commentList.appendChild(newComment);
            loadReplies(doc.id);
        });
    }, (error) => {
        console.error("Error escuchando cambios en los comentarios: ", error);
    });
}

function showReplyBox(commentId) {
    const replyBox = document.createElement('div');
    replyBox.innerHTML = `
        <textarea class="respuesta-comment" id="replyInput-${commentId}" rows="2" placeholder="Escribe una respuesta..."></textarea>
        <button class="respuesta-button" onclick="addReply('${commentId}')">Enviar Respuesta</button>
    `;
    document.getElementById(`replies-${commentId}`).appendChild(replyBox);
}

async function addReply(commentId) {
    const replyInput = document.getElementById(`replyInput-${commentId}`);
    const storedName = localStorage.getItem('userName');
    const replyText = replyInput.value.trim();

    if (!storedName) {
        alert('Por favor, ingresa tu nombre antes de responder');
        return;
    }

    if (replyText === '') {
        alert('La respuesta no puede estar vacía');
        return;
    }

    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

    await db.collection("comments").doc(commentId).collection("replies").add({
        name: storedName,
        replyText: replyText,
        date: serverTimestamp
    }).then(() => {
        replyInput.value = '';
        loadReplies(commentId);
    }).catch((error) => {
        console.error("Error agregando respuesta: ", error);
    });
}

function loadReplies(commentId) {
    const repliesContainer = document.getElementById(`replies-${commentId}`);
    repliesContainer.innerHTML = '';

    // Escuchar cambios en tiempo real en las respuestas
    db.collection("comments").doc(commentId).collection("replies").orderBy("date", "desc").onSnapshot((querySnapshot) => {
        repliesContainer.innerHTML = ''; // Limpiar las respuestas existentes
        querySnapshot.forEach((doc) => {
            const replyData = doc.data();
            const formattedDate = replyData.date ? replyData.date.toDate().toLocaleString() : 'Sin fecha';
            const newReply = document.createElement('div');
            newReply.classList.add('reply');
            newReply.innerHTML = `
                <div class="comment-meta">
                    <strong class="nameCommentPe">${replyData.name}</strong> - ${formattedDate}
                </div>
                <div>${replyData.replyText}</div>
                <button class="delete-reply-btn" onclick="deleteReply('${commentId}', '${doc.id}')">✕</button>
            `;

            const deleteReplyBtn = newReply.querySelector('.delete-reply-btn');
            const storedName = localStorage.getItem('userName');

            if (replyData.name === storedName || isUserInWhitelist(storedName)) {
                deleteReplyBtn.style.display = 'inline-block';
            }

            repliesContainer.appendChild(newReply);
        });
    }, (error) => {
        console.error("Error escuchando cambios en las respuestas: ", error);
    });
}
function deleteReply(commentId, replyId) {
    db.collection("comments").doc(commentId).collection("replies").doc(replyId).delete().then(() => {
        loadReplies(commentId);  // Recargar las respuestas después de eliminar una
    }).catch((error) => {
        console.error("Error eliminando la respuesta: ", error);
    });
}

function deleteComment(commentId) {
    const storedName = localStorage.getItem('userName');

    db.collection("comments").doc(commentId).get().then((doc) => {
        const commentData = doc.data();
        if (commentData.name === storedName || isUserInWhitelist(storedName)) {
            db.collection("comments").doc(commentId).delete().then(() => {
                loadComments();
            }).catch((error) => {
                console.error("Error eliminando comentario: ", error);
            });
        } else {
            alert('Solo el creador del comentario o un administrador pueden eliminarlo');
        }
    });
}

function isUserInWhitelist(username) {
    return whitelist.includes(username);
}


var content = [{
    title: "Sophisticangel Projects",
    items: [
        {
            name: "Sophisticangel Backpack - v1.0.0",
            tags: "newVersion",
            links: ["https://huggingface.co/datasets/Angeldfire2/sophisticangel_backpack/resolve/main/sophisticangel%20backpack%20v1.0.0.mcaddon?download=true"],
            buttons: ["Descargar New Version"]
        },
        {
            name: "Sophisticangel Backpack - v0.5.2",
            links: ["https://huggingface.co/datasets/Angeldfire2/sophisticangel_backpack/resolve/main/Sophisticangel%20Backpack%20v0.5.2%20MC-1.21.20%2B%20New.mcaddon?download=true"],
            buttons: []
        },
        { 
            name: "Sophisticangel Backpack - v0.5.1", 
            links: ["https://huggingface.co/datasets/Angeldfire2/sophisticangel_backpack/resolve/main/Sophisticangel%20Backpack%20v0.5.1%20MC-1.21.20%2B.mcaddon?download=true"], 
            buttons: [] 
        },
        { 
            name: "Sophisticangel Backpack - v0.4.4", 
            links: ["https://huggingface.co/datasets/Angeldfire2/sophisticangel_backpack/resolve/main/Sophisticangel%20Backpack%20v0.4.4%20MC-1.21.20%2B.mcaddon?download=true"], 
            buttons: [] 
        }
    ]
}];

var itemContainer = document.querySelector("ul.items");
var buttonContainer = document.querySelector("div.downloadButtons");
var newContainer = document.querySelector("div.new");

function loadItems() {
    itemContainer.innerHTML = "";
    newContainer.innerHTML = "";

    let firstNewVersionItem = null;

    content[0].items.forEach((item, index) => {
        var listItem = document.createElement("li");
        listItem.textContent = item.name;

        if (item.tags === "newVersion") {
            listItem.classList.add("newVersion");
            newContainer.appendChild(listItem);
            if (!firstNewVersionItem) firstNewVersionItem = { item, listItem };
        } else {
            itemContainer.appendChild(listItem);
        }

        listItem.addEventListener("click", () => selectItem(item, listItem));
    });

    if (firstNewVersionItem) {
        selectItem(firstNewVersionItem.item, firstNewVersionItem.listItem);
    } else if (itemContainer.firstChild) {
        selectItem(content[0].items.find(item => !item.tags), itemContainer.firstChild);
    }
}

function selectItem(item, listItem) {
    buttonContainer.innerHTML = "";

    document.querySelectorAll("ul.items li, div.new li").forEach(li => li.classList.remove("selected"));

    listItem.classList.add("selected");

    item.links.forEach((link, index) => {
        var button = document.createElement("a");
        button.textContent = item.buttons[index] || "Descargar";
        button.href = link;
        button.classList.add(index % 2 === 0 ? "dark" : "turquoise");
        buttonContainer.appendChild(button);
    });
}

loadItems();
