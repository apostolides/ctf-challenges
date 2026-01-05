const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const results = document.getElementById('results');

uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a ZIP file to upload.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData,
        });
        
        if (response.ok) {
            let res = await response.json();
            results.innerText = res.tree;
        } else {
            results.innerText = '';
            alert('File upload failed. Please try again.');
        }
    } catch (error) {
        results.innerText = '';
        console.error('Error uploading file:', error);
        alert('An error occurred during the upload.');
    }
});