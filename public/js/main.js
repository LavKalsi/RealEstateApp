// Light/Dark mode toggle
const toggleBtn = document.getElementById('toggleMode');
if (toggleBtn) {
  toggleBtn.onclick = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  };
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
}

// Logout functionality
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        window.location.href = '/login';
      } else {
        showAlert('Logout failed', 'error');
      }
    } catch (error) {
      console.error('Logout error:', error);
      showAlert('Logout failed', 'error');
    }
  });
}

// Status alert
function showAlert(msg, type = 'success') {
  const alert = document.getElementById('statusAlert');
  if (!alert) return;
  alert.textContent = msg;
  alert.className = `status-alert ${type}`;
  alert.style.display = 'block';
  setTimeout(() => { alert.style.display = 'none'; }, 3500);
}

// File upload handling
if (document.getElementById('uploadForm')) {
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('invoiceImage');
  let extractedData = null;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  function highlight(e) {
    dropArea.classList.add('drag-over');
  }

  function unhighlight(e) {
    dropArea.classList.remove('drag-over');
  }

  dropArea.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    fileInput.files = files;
    handleFiles(files);
  }

  fileInput.addEventListener('change', function(e) {
    handleFiles(this.files);
  });

  function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      showAlert('Please select an image file', 'error');
      return;
    }
    showPreview(file);
  }

  function showPreview(file) {
    const imagePreview = document.getElementById('imagePreview');
    imagePreview.innerHTML = '';
    if (!file) return;
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    imagePreview.appendChild(img);
  }

  // Upload form submission
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const file = fileInput.files[0];
    
    if (!file) {
      showAlert('Please select a file', 'error');
      return;
    }
    
    formData.append('file', file);
    showAlert('Uploading and processing...', 'info');
    
    try {
      console.log('=== UPLOAD PROCESS START ===');
      console.log('Uploading file:', file.name, 'size:', file.size);
      
      const response = await fetch('https://shardcarecubs.app.n8n.cloud/webhook/2247f975-154a-4633-b84a-4a0c83073c84', {
        method: 'POST',
        body: formData
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('\n=== N8N WEBHOOK RESPONSE ===');
      console.log(responseText);
      console.log('\n=== END WEBHOOK RESPONSE ===');
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('\n=== PARSED RESPONSE ===');
        console.log(JSON.stringify(result, null, 2));
        
        if (result && result.content) {
          console.log('\n=== CONTENT FROM RESPONSE ===');
          console.log(result.content);
          const extractedData = JSON.parse(result.content);
          console.log('\n=== FINAL PARSED DATA ===');
          console.log(JSON.stringify(extractedData, null, 2));
          showReviewSection(extractedData);
        } else {
          console.error('Response missing content field:', result);
          showAlert('Unexpected response format from server', 'error');
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        console.error('Raw response was:', responseText);
        showAlert('Invalid response from server', 'error');
        return;
      }
      console.log('=== UPLOAD PROCESS END ===');
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Upload failed: ' + (error.message || 'Unknown error'), 'error');
    }
  });
}

// Camera capture logic (modal)
document.addEventListener('DOMContentLoaded', function() {
  const cameraBtn = document.getElementById('cameraBtn');
  const fileInput = document.getElementById('invoiceImage');
  const cameraModal = document.getElementById('cameraModal');
  const cameraVideo = document.getElementById('cameraVideo');
  const capturePhotoBtn = document.getElementById('capturePhotoBtn');
  const closeCameraModal = document.getElementById('closeCameraModal');

  if (cameraBtn && fileInput) {
    cameraBtn.addEventListener('click', () => {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        if (cameraModal) {
          cameraModal.style.display = 'flex';
          if (cameraVideo) {
            navigator.mediaDevices.getUserMedia({ video: true })
              .then(stream => {
                cameraVideo.srcObject = stream;
                cameraVideo.play();
              })
              .catch((err) => {
                console.error('Camera error:', err);
                showAlert('Could not access camera.', 'error');
                if (cameraModal) cameraModal.style.display = 'none';
              });
          }
        }
      } else {
        showAlert('Your browser does not support camera capture.', 'error');
      }
    });
  }
  if (capturePhotoBtn && cameraVideo && fileInput && cameraModal) {
    capturePhotoBtn.addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = cameraVideo.videoWidth || 320;
      canvas.height = cameraVideo.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], 'captured.jpg', { type: 'image/jpeg' });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;
          window.showPreview(file);
        }
      }, 'image/jpeg');
      // Stop webcam and close modal
      if (cameraVideo.srcObject) {
        cameraVideo.srcObject.getTracks().forEach(track => track.stop());
        cameraVideo.srcObject = null;
      }
      cameraModal.style.display = 'none';
    });
  }
  if (closeCameraModal && cameraModal && cameraVideo) {
    closeCameraModal.addEventListener('click', () => {
      if (cameraVideo.srcObject) {
        cameraVideo.srcObject.getTracks().forEach(track => track.stop());
        cameraVideo.srcObject = null;
      }
      cameraModal.style.display = 'none';
    });
  }
});

// Manual form handling
const manualInvoiceForm = document.getElementById('manualInvoiceForm');
if (manualInvoiceForm) {
  manualInvoiceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    extractedData = data;
    showReviewSection(data);
  });
}

// Review section handling
function showReviewSection(data) {
  try {
    // Parse the data if it's a string
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    
    const reviewSection = document.getElementById('reviewSection');
    reviewSection.style.display = 'block';
    
    // Update input fields with extracted data
    const fields = {
      'reviewInvoiceNumber': 'invoiceNumber',
      'reviewClientName': 'clientName',
      'reviewAmount': 'amount',
      'reviewDate': 'date',
      'reviewAddress': 'propertyAddress',
      'reviewDescription': 'serviceDescription'
    };
    
    // Create editable fields for each piece of data
    Object.entries(fields).forEach(([elementId, dataKey]) => {
      const container = document.getElementById(elementId);
      container.innerHTML = ''; // Clear existing content
      
      // Create appropriate input type based on the field
      let input;
      if (dataKey === 'date') {
        input = document.createElement('input');
        input.type = 'date';
        input.value = data[dataKey] || '';
      } else if (dataKey === 'amount') {
        input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.min = '0';
        input.value = data[dataKey] || '';
      } else if (dataKey === 'propertyAddress' || dataKey === 'serviceDescription') {
        input = document.createElement('textarea');
        input.value = data[dataKey] || '';
        input.rows = 3;
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = data[dataKey] || '';
      }
      
      // Add common properties
      input.className = 'review-input';
      input.name = dataKey;
      input.addEventListener('change', function() {
        // Update extractedData when input changes
        if (this.type === 'number') {
          extractedData[dataKey] = parseFloat(this.value) || 0;
        } else {
          extractedData[dataKey] = this.value;
        }
      });
      
      container.appendChild(input);
    });
    
    // Update extractedData with the current values
    extractedData = {...data};
    
    // Scroll to review section
    reviewSection.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Error showing review:', error);
    showAlert('Error displaying review data', 'error');
  }
}

// Edit button handling
const editButton = document.getElementById('editButton');
if (editButton) {
  editButton.addEventListener('click', () => {
    const reviewSection = document.getElementById('reviewSection');
    reviewSection.style.display = 'none';
    document.querySelector('#manualSection').scrollIntoView({ behavior: 'smooth' });
  });
}

// Confirm button handling
const confirmButton = document.getElementById('confirmButton');
if (confirmButton) {
  confirmButton.addEventListener('click', async () => {
    try {
      const response = await fetch('https://shardcarecubs.app.n8n.cloud/webhook/5b91870b-e072-4562-9737-6277f4ca670b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(extractedData)
      });
      
      const result = await response.json();
      if (result.success) {
        // Hide all sections
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('manualSection').style.display = 'none';
        document.getElementById('reviewSection').style.display = 'none';
        
        // Show success message
        const successMsg = document.getElementById('successMsg');
        successMsg.textContent = 'Invoice submitted successfully! Thank you.';
        successMsg.style.display = 'block';
      } else {
        showAlert('Failed to submit invoice', 'error');
      }
    } catch (error) {
      console.error('Submit error:', error);
      showAlert('Failed to submit invoice', 'error');
    }
  });
}

// --- Site Management & Selector ---
async function fetchSites() {
  try {
    const response = await fetch('/sites');
    const data = await response.json();
    return data.sites || [];
  } catch (error) {
    console.error('Error fetching sites:', error);
    return [];
  }
}
async function fetchActiveSite() {
  const res = await fetch('/active-site');
  const data = await res.json();
  return data.site || null;
}
async function setActiveSite(siteId) {
  await fetch('/set-active-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId })
  });
}
function renderSiteSelector(sites, activeSiteId) {
  const selector = document.getElementById('siteSelector');
  if (!selector) return;
  selector.innerHTML = '';
  sites.forEach(site => {
    const opt = document.createElement('option');
    opt.value = site.id;
    opt.textContent = site.name;
    if (site.id === activeSiteId) opt.selected = true;
    selector.appendChild(opt);
  });
}
async function updateSiteSelector() {
  const sites = await fetchSites();
  const activeSite = await fetchActiveSite();
  renderSiteSelector(sites, activeSite ? activeSite.id : (sites[0] && sites[0].id));
}
document.addEventListener('DOMContentLoaded', () => {
  updateSiteSelector();
  const selector = document.getElementById('siteSelector');
  if (selector) {
    selector.addEventListener('change', async (e) => {
      await setActiveSite(e.target.value);
      showAlert('Active site changed!');
      // Optionally reload data for new site
      location.reload();
    });
  }
  // --- Site Management Modal ---
  const manageBtn = document.getElementById('manageSitesBtn');
  const modal = document.getElementById('siteModal');
  const closeModal = document.getElementById('closeSiteModal');
  const addForm = document.getElementById('addSiteForm');
  const siteList = document.getElementById('siteList');
  function renderSiteList(sites) {
    siteList.innerHTML = '';
    sites.forEach(site => {
      const li = document.createElement('li');
      li.innerHTML = `<span><b>${site.name}</b> (${site.status})<br><small>${site.address}</small></span>` +
        `<span class="site-actions">
          <button data-edit="${site.id}">Edit</button>
          <button data-delete="${site.id}">Delete</button>
        </span>`;
      siteList.appendChild(li);
    });
  }
  async function refreshSiteList() {
    const sites = await fetchSites();
    renderSiteList(sites);
    updateSiteSelector();
  }
  if (manageBtn && modal) {
    manageBtn.onclick = async () => {
      modal.style.display = 'flex';
      await refreshSiteList();
    };
  }
  if (closeModal && modal) {
    closeModal.onclick = () => { modal.style.display = 'none'; };
  }
  if (addForm) {
    addForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('siteName').value.trim();
      const address = document.getElementById('siteAddress').value.trim();
      const status = document.getElementById('siteStatus').value;
      if (!name || !address) return showAlert('Name and address required', 'error');
      await fetch('/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, status })
      });
      addForm.reset();
      await refreshSiteList();
      showAlert('Site added!');
    };
  }
  if (siteList) {
    siteList.onclick = async (e) => {
      if (e.target.dataset.delete) {
        if (!confirm('Delete this site?')) return;
        await fetch(`/sites/${e.target.dataset.delete}/delete`, { method: 'POST' });
        await refreshSiteList();
        showAlert('Site deleted!');
      } else if (e.target.dataset.edit) {
        const id = e.target.dataset.edit;
        const sites = await fetchSites();
        const site = sites.find(s => s.id === id);
        if (!site) return;
        const newName = prompt('Edit site name:', site.name);
        if (newName === null) return;
        const newAddress = prompt('Edit address:', site.address);
        if (newAddress === null) return;
        const newStatus = prompt('Edit status (Active/Completed/On Hold):', site.status);
        if (newStatus === null) return;
        await fetch(`/sites/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName, address: newAddress, status: newStatus })
        });
        await refreshSiteList();
        showAlert('Site updated!');
      }
    };
  }
});

// --- Stock Management UI ---
async function fetchMaterials(siteId) {
  const res = await fetch(`/site/${siteId}/materials`);
  const data = await res.json();
  return data.materials || [];
}
async function fetchStockHistory(siteId) {
  const res = await fetch(`/site/${siteId}/stock-history`);
  const data = await res.json();
  return data.history || [];
}
async function addMaterial(siteId, material) {
  await fetch(`/site/${siteId}/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(material)
  });
}
async function editMaterial(siteId, materialId, updates) {
  await fetch(`/site/${siteId}/materials/${materialId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}
async function deleteMaterial(siteId, materialId) {
  await fetch(`/site/${siteId}/materials/${materialId}/delete`, { method: 'POST' });
}
async function stockOperation(siteId, op) {
  const res = await fetch(`/site/${siteId}/stock-op`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Stock operation failed');
}
function renderMaterialTable(materials) {
  const tbody = document.querySelector('#materialTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  materials.forEach(mat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${mat.name}</td><td>${mat.unit}</td><td>${mat.cost}</td><td>${mat.quantity}</td>` +
      `<td><button data-edit="${mat.id}">Edit</button><button data-delete="${mat.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}
function renderStockHistory(history, materials) {
  const tbody = document.querySelector('#stockHistoryTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  history.forEach(h => {
    const mat = materials.find(m => m.id === h.materialId);
    const matName = mat ? mat.name : h.materialId;
    const date = new Date(h.date).toLocaleString();
    tbody.innerHTML += `<tr><td>${date}</td><td>${matName}</td><td>${h.type}</td><td>${h.quantity}</td><td>${h.note || ''}</td></tr>`;
  });
}
async function refreshStockUI() {
  const selector = document.getElementById('siteSelector');
  if (!selector) return;
  const siteId = selector.value;
  const materials = await fetchMaterials(siteId);
  renderMaterialTable(materials);
  const history = await fetchStockHistory(siteId);
  renderStockHistory(history, materials);
}
document.addEventListener('DOMContentLoaded', () => {
  // Stock Management UI
  const addBtn = document.getElementById('addMaterialBtn');
  const matTable = document.getElementById('materialTable');
  const receiveBtn = document.getElementById('receiveStockBtn');
  const issueBtn = document.getElementById('issueStockBtn');
  const transferBtn = document.getElementById('transferStockBtn');
  const selector = document.getElementById('siteSelector');
  async function getSiteId() {
    return selector ? selector.value : null;
  }
  if (selector) {
    selector.addEventListener('change', refreshStockUI);
  }
  if (addBtn) {
    addBtn.onclick = async () => {
      const siteId = await getSiteId();
      const name = prompt('Material name:');
      if (!name) return;
      const unit = prompt('Unit (e.g. kg, pcs):');
      if (!unit) return;
      const cost = prompt('Cost per unit:');
      if (!cost) return;
      const quantity = prompt('Initial quantity:');
      if (!quantity) return;
      await addMaterial(siteId, { name, unit, cost, quantity });
      showAlert('Material added!');
      refreshStockUI();
    };
  }
  if (matTable) {
    matTable.onclick = async (e) => {
      const siteId = await getSiteId();
      if (e.target.dataset.edit) {
        const matId = e.target.dataset.edit;
        const materials = await fetchMaterials(siteId);
        const mat = materials.find(m => m.id === matId);
        if (!mat) return;
        const name = prompt('Edit name:', mat.name);
        if (name === null) return;
        const unit = prompt('Edit unit:', mat.unit);
        if (unit === null) return;
        const cost = prompt('Edit cost:', mat.cost);
        if (cost === null) return;
        await editMaterial(siteId, matId, { name, unit, cost });
        showAlert('Material updated!');
        refreshStockUI();
      } else if (e.target.dataset.delete) {
        if (!confirm('Delete this material?')) return;
        await deleteMaterial(siteId, e.target.dataset.delete);
        showAlert('Material deleted!');
        refreshStockUI();
      }
    };
  }
  if (receiveBtn) {
    receiveBtn.onclick = async () => {
      const siteId = await getSiteId();
      const materials = await fetchMaterials(siteId);
      if (!materials.length) return showAlert('No materials found', 'error');
      const matName = prompt('Material name to receive:\n' + materials.map(m => m.name).join(', '));
      const mat = materials.find(m => m.name === matName);
      if (!mat) return showAlert('Material not found', 'error');
      const qty = prompt('Quantity to receive:');
      if (!qty) return;
      const note = prompt('Note (optional):');
      try {
        await stockOperation(siteId, { materialId: mat.id, type: 'Receive', quantity: qty, note });
        showAlert('Stock received!');
        refreshStockUI();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    };
  }
  if (issueBtn) {
    issueBtn.onclick = async () => {
      const siteId = await getSiteId();
      const materials = await fetchMaterials(siteId);
      if (!materials.length) return showAlert('No materials found', 'error');
      const matName = prompt('Material name to issue:\n' + materials.map(m => m.name).join(', '));
      const mat = materials.find(m => m.name === matName);
      if (!mat) return showAlert('Material not found', 'error');
      const qty = prompt('Quantity to issue:');
      if (!qty) return;
      const note = prompt('Note (optional):');
      try {
        await stockOperation(siteId, { materialId: mat.id, type: 'Issue', quantity: qty, note });
        showAlert('Stock issued!');
        refreshStockUI();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    };
  }
  if (transferBtn) {
    transferBtn.onclick = async () => {
      const siteId = await getSiteId();
      const materials = await fetchMaterials(siteId);
      if (!materials.length) return showAlert('No materials found', 'error');
      const matName = prompt('Material name to transfer:\n' + materials.map(m => m.name).join(', '));
      const mat = materials.find(m => m.name === matName);
      if (!mat) return showAlert('Material not found', 'error');
      const qty = prompt('Quantity to transfer:');
      if (!qty) return;
      const allSites = await fetchSites();
      const otherSites = allSites.filter(s => s.id !== siteId);
      if (!otherSites.length) return showAlert('No other sites found', 'error');
      const targetName = prompt('Transfer to site:\n' + otherSites.map(s => s.name).join(', '));
      const targetSite = otherSites.find(s => s.name === targetName);
      if (!targetSite) return showAlert('Target site not found', 'error');
      const note = prompt('Note (optional):');
      try {
        await stockOperation(siteId, { materialId: mat.id, type: 'Transfer', quantity: qty, note, targetSiteId: targetSite.id });
        showAlert('Stock transferred!');
        refreshStockUI();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    };
  }
  // Initial load
  refreshStockUI();
});

// --- Site Selector Population ---
async function populateSiteSelector() {
  const siteSelector = document.getElementById('siteSelector');
  if (!siteSelector) return;

  try {
    const response = await fetch('/sites');
    const data = await response.json();
    const sites = data.sites || [];

    siteSelector.innerHTML = '';
    sites.forEach(site => {
      const option = document.createElement('option');
      option.value = site.id;
      option.textContent = site.name;
      siteSelector.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching sites:', error);
  }
}

// Call this function on page load
document.addEventListener('DOMContentLoaded', populateSiteSelector);