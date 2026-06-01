// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered successfully:', reg.scope))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}

// Global State
let currentActiveTab = 'home-tab';
let allHouseholds = [];
const API_URL = '/api';
let uploadedPhotos = []; // Base64 data URLs or file paths
let editMode = false;
let editHouseholdId = null;
let currentCarouselIndex = 0;

// Leaflet Maps State
let registerMap = null;
let registerMarker = null;
let detailsMap = null;
let detailsMarker = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Initialize Event Handlers & Elements
  initNavigation();
  initSidebarToggle();
  initThemeToggle();
  initFormInteractivity();
  initFormHandler();
  initPhotoUploader();
  initDetailsModalHandlers();
  initSuccessModalHandlers();
  initDirectoryHandlers();
  initLanguageSelector();
  
  // Initialize Maps
  initRegisterMap();
  
  // Load Stats
  fetchStats();

  // Check URL query parameters
  checkURLParams();

  // Initialize live clock and date updates
  initLiveClock();
});

// Sidebar toggle for mobile
function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    });
  }
  if (overlay && sidebar) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

// 1. Navigation / Tab Switching
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
  bottomNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Home welcome hero registration redirect button
  const heroBtn = document.getElementById('hero-register-btn');
  if (heroBtn) {
    heroBtn.addEventListener('click', () => {
      switchTab('register-tab');
    });
  }
}

function switchTab(tabId) {
  currentActiveTab = tabId;

  // Sidebar navigation item highlight
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Bottom navigation item highlight
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle active tab block
  document.querySelectorAll('.tab-content').forEach(tab => {
    if (tab.id === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Fetch stats if navigating to Home or Register tabs, or load directory
  if (tabId === 'home-tab' || tabId === 'register-tab') {
    fetchStats();
  } else if (tabId === 'directory-tab') {
    loadDirectory();
  }

  // Rescale maps when tabs switch to register-tab
  if (tabId === 'register-tab' && registerMap) {
    setTimeout(() => {
      registerMap.invalidateSize();
    }, 150);
  }
}

// 2. Theme Toggle (Light / Dark)
function initThemeToggle() {
  const themeBtn = document.getElementById('theme-btn');
  const themeIcon = document.getElementById('theme-icon');
  const themeText = document.getElementById('theme-text');
  const body = document.body;

  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    updateThemeUI(true);
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = body.classList.contains('dark-mode');
      if (isDark) {
        body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        updateThemeUI(false);
      } else {
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        updateThemeUI(true);
      }
    });
  }

  function updateThemeUI(isDark) {
    if (isDark) {
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
      if (themeText) themeText.textContent = 'Light Mode';
    } else {
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
      if (themeText) themeText.textContent = 'Dark Mode';
    }
    if (window.lucide) lucide.createIcons();
  }
}

// 3. Form Interactivity (Smart Checkboxes and Hidden Fields)
function initFormInteractivity() {
  // Bind standard None check logic
  setupCheckboxNoneLogic('electronic-none', 'electronics');
  setupCheckboxNoneLogic('provider-none', 'providers');

  // Electronics "Other" toggler
  const elOtherCheck = document.getElementById('electronic-other-check');
  const elOtherDetailsGroup = document.getElementById('electronics-other-detail-group');
  if (elOtherCheck && elOtherDetailsGroup) {
    elOtherCheck.addEventListener('change', () => {
      if (elOtherCheck.checked) {
        elOtherDetailsGroup.classList.remove('hidden');
      } else {
        elOtherDetailsGroup.classList.add('hidden');
        document.getElementById('electronicsOthers').value = '';
      }
    });
  }

  // Add Vehicle Button listener
  const addVehicleBtn = document.getElementById('add-vehicle-btn');
  const vehiclesList = document.getElementById('vehicles-list');
  if (addVehicleBtn && vehiclesList) {
    addVehicleBtn.addEventListener('click', () => {
      addVehicleRow();
    });
  }

  // Add Member Button listener
  const addMemberBtn = document.getElementById('add-member-btn');
  const membersList = document.getElementById('members-list');
  if (addMemberBtn && membersList) {
    addMemberBtn.addEventListener('click', () => {
      addMemberRow();
    });
  }

  // "Others" Govt Scheme details toggler
  const othersCheck = document.getElementById('scheme-others-check');
  const detailsGroup = document.getElementById('others-scheme-detail-group');
  
  if (othersCheck && detailsGroup) {
    othersCheck.addEventListener('change', () => {
      if (othersCheck.checked) {
        detailsGroup.classList.remove('hidden');
      } else {
        detailsGroup.classList.add('hidden');
        document.getElementById('benefitsOthers').value = '';
      }
    });
  }

  // Migration details toggler
  const migrationSelect = document.getElementById('migrationStatus');
  const migrationDetailsGroup = document.getElementById('migration-details-group');
  if (migrationSelect && migrationDetailsGroup) {
    migrationSelect.addEventListener('change', () => {
      if (migrationSelect.value === 'Yes') {
        migrationDetailsGroup.classList.remove('hidden');
      } else {
        migrationDetailsGroup.classList.add('hidden');
        const detailsInput = document.getElementById('migrationDetails');
        if (detailsInput) detailsInput.value = '';
      }
    });
  }

  // Land owned visibility toggler
  const landOwnedSelect = document.getElementById('landOwned');
  const landAcresGroup = document.getElementById('land-acres-group');
  if (landOwnedSelect && landAcresGroup) {
    landOwnedSelect.addEventListener('change', () => {
      if (landOwnedSelect.value === 'Yes') {
        landAcresGroup.classList.remove('hidden');
      } else {
        landAcresGroup.classList.add('hidden');
        document.getElementById('landAcres').value = 0;
      }
    });
  }

  // Electricity access visibility toggler
  const electricitySelect = document.getElementById('electricityAccess');
  const electricityHoursGroup = document.getElementById('electricity-hours-group');
  if (electricitySelect && electricityHoursGroup) {
    electricitySelect.addEventListener('change', () => {
      if (electricitySelect.value === 'Yes') {
        electricityHoursGroup.classList.remove('hidden');
      } else {
        electricityHoursGroup.classList.add('hidden');
        document.getElementById('electricityHours').value = 0;
      }
    });
  }

  // Poverty status auto updater
  const incomeInput = document.getElementById('annualIncome');
  if (incomeInput) {
    incomeInput.addEventListener('input', () => {
      const val = parseFloat(incomeInput.value) || 0;
      updatePovertyClassification(val);
    });
  }

  // Livestock checkboxes list toggler
  const lsCheckboxes = document.querySelectorAll('input[name="livestock"]');
  lsCheckboxes.forEach(ch => {
    const countInput = document.getElementById(`ls-${ch.id.substring(3)}-count`);
    ch.addEventListener('change', () => {
      if (ch.checked) {
        countInput.classList.remove('hidden');
        countInput.required = true;
      } else {
        countInput.classList.add('hidden');
        countInput.required = false;
        countInput.value = 1;
      }
    });
  });

  // Bind Form Reset
  const resetBtn = document.getElementById('form-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      setTimeout(resetFormToRegister, 50);
    });
  }

  // GPS Location button event
  const getGpsBtn = document.getElementById('get-gps-btn');
  if (getGpsBtn) {
    getGpsBtn.addEventListener('click', fetchGpsLocation);
  }
}

function updatePovertyClassification(income) {
  const povertyStatusInput = document.getElementById('povertyStatus');
  if (povertyStatusInput) {
    const status = income <= 120000 ? 'BPL' : 'APL';
    povertyStatusInput.value = status;
    if (status === 'BPL') {
      povertyStatusInput.style.color = 'var(--danger)';
    } else {
      povertyStatusInput.style.color = 'var(--green-vivid)';
    }
  }
}

function resetFormToRegister() {
  editMode = false;
  editHouseholdId = null;
  uploadedPhotos = [];
  
  const titleEl = document.querySelector('#register-tab .page-title');
  if (titleEl) titleEl.textContent = 'Register New Household';
  
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.innerHTML = '<i data-lucide="check-circle-2"></i> Register Household';
  
  const previewsContainer = document.getElementById('photo-previews-container');
  if (previewsContainer) previewsContainer.innerHTML = '';
  
  const statusLabel = document.getElementById('photo-upload-status');
  if (statusLabel) statusLabel.textContent = 'No files chosen';
  
  // Hide all dynamic parts
  document.getElementById('land-acres-group').classList.add('hidden');
  document.getElementById('electricity-hours-group').classList.remove('hidden');
  document.getElementById('electricityHours').value = 24;
  
  const lsCounts = document.querySelectorAll('.ls-count-input');
  lsCounts.forEach(inp => {
    inp.classList.add('hidden');
    inp.value = 1;
  });

  // Clear GPS Location inputs
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');
  const addrInput = document.getElementById('gpsAddress');
  if (latInput) latInput.value = '';
  if (lngInput) lngInput.value = '';
  if (addrInput) addrInput.value = '';

  // Clear map marker
  if (registerMarker) {
    if (registerMap) registerMap.removeLayer(registerMarker);
    registerMarker = null;
  }
  if (registerMap) {
    registerMap.setView([16.5062, 80.6480], 13);
  }
  
  if (window.lucide) lucide.createIcons();
}

// 3.1 Photo Uploader Helpers
function initPhotoUploader() {
  const uploadBtn = document.getElementById('photo-upload-btn');
  const fileInput = document.getElementById('housePhotos');
  const statusLabel = document.getElementById('photo-upload-status');
  
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      
      for (const file of files) {
        try {
          const base64Str = await readFileAsBase64(file);
          uploadedPhotos.push(base64Str);
        } catch (err) {
          console.error('Error reading file:', err);
        }
      }
      
      renderPhotoPreviews();
      fileInput.value = ''; // Reset
    });
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreviews() {
  const previewsContainer = document.getElementById('photo-previews-container');
  const statusLabel = document.getElementById('photo-upload-status');
  if (!previewsContainer) return;
  
  previewsContainer.innerHTML = '';
  
  if (uploadedPhotos.length === 0) {
    statusLabel.textContent = 'No files chosen';
    return;
  }
  
  statusLabel.textContent = `${uploadedPhotos.length} file(s) selected`;
  
  uploadedPhotos.forEach((photo, idx) => {
    const item = document.createElement('div');
    item.className = 'photo-preview-item';
    
    item.innerHTML = `
      <img src="${photo}" alt="Preview">
      <button type="button" class="photo-preview-remove" data-index="${idx}">&times;</button>
    `;
    
    item.querySelector('.photo-preview-remove').addEventListener('click', () => {
      uploadedPhotos.splice(idx, 1);
      renderPhotoPreviews();
    });
    
    previewsContainer.appendChild(item);
  });
}


function setupCheckboxNoneLogic(noneId, groupName) {
  const noneCheck = document.getElementById(noneId);
  if (!noneCheck) return;
  
  const groupChecks = document.querySelectorAll(`input[name="${groupName}"]`);
  
  noneCheck.addEventListener('change', () => {
    if (noneCheck.checked) {
      groupChecks.forEach(ch => {
        if (ch !== noneCheck) ch.checked = false;
      });
    }
  });

  groupChecks.forEach(ch => {
    if (ch !== noneCheck) {
      ch.addEventListener('change', () => {
        if (ch.checked) {
          noneCheck.checked = false;
        }
      });
    }
  });
}

// 4. Form Submission Handling
function initFormHandler() {
  const form = document.getElementById('registration-form');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    const loadText = editMode ? 'Updating...' : 'Registering...';
    submitBtn.innerHTML = `<span class="spinner" style="width:16px; height:16px; border-width:2px; display:inline-block; margin-right:8px; vertical-align:middle;"></span> ${loadText}`;

    // Vehicles array of objects
    const vehicles = [];
    document.querySelectorAll('.vehicle-row-item').forEach(row => {
      vehicles.push({
        vehicleNo: row.querySelector('.v-number-input').value.toUpperCase().trim(),
        wheels: row.querySelector('.v-wheels-select').value,
        fuelType: row.querySelector('.v-fuel-select').value
      });
    });
    
    // Electronics array
    const electronics = Array.from(document.querySelectorAll('input[name="electronics"]:checked')).map(el => el.value);
    if (electronics.includes('Other')) {
      const idx = electronics.indexOf('Other');
      const details = document.getElementById('electronicsOthers').value.trim();
      electronics[idx] = `Other: ${details || 'Unspecified'}`;
    }
    
    // Providers array
    const serviceProviders = Array.from(document.querySelectorAll('input[name="providers"]:checked')).map(el => el.value);
    
    // Water array
    const waterStorage = Array.from(document.querySelectorAll('input[name="water"]:checked')).map(el => el.value);
    
    // Schemes array with Others detail mapping
    const govtBeneficiary = Array.from(document.querySelectorAll('input[name="schemes"]:checked')).map(el => el.value);
    if (govtBeneficiary.includes('Others')) {
      const idx = govtBeneficiary.indexOf('Others');
      const details = document.getElementById('benefitsOthers').value.trim();
      govtBeneficiary[idx] = `Others: ${details || 'Unspecified'}`;
    }

    // Family members array of objects
    const members = [];
    document.querySelectorAll('.member-row-item').forEach(row => {
      members.push({
        fullName: row.querySelector('.m-name-input').value.trim(),
        phone: row.querySelector('.m-phone-input') ? row.querySelector('.m-phone-input').value.trim() : '',
        age: parseInt(row.querySelector('.m-age-input').value, 10) || 0,
        gender: row.querySelector('.m-gender-select').value,
        relationship: row.querySelector('.m-relationship-select').value,
        education: row.querySelector('.m-education-select').value,
        occupation: row.querySelector('.m-occupation-select').value,
        category: row.querySelector('.m-category-select').value,
        healthIssues: row.querySelector('.m-health-input').value.trim() || 'None',
        mnregaJobCard: row.querySelector('.m-mnrega-select').value,
        aadharNumber: row.querySelector('.m-aadhar-input') ? row.querySelector('.m-aadhar-input').value.trim() : '',
        bankAccount: row.querySelector('.m-bank-select') ? row.querySelector('.m-bank-select').value : 'No',
        income: parseFloat(row.querySelector('.m-income-input') ? row.querySelector('.m-income-input').value : 0) || 0
      });
    });

    // Cooking fuel
    const cookingFuel = Array.from(document.querySelectorAll('input[name="cookingFuel"]:checked')).map(el => el.value);

    // Livestock count collection
    const livestock = {};
    document.querySelectorAll('input[name="livestock"]:checked').forEach(ch => {
      const countInput = document.getElementById(`ls-${ch.id.substring(3)}-count`);
      livestock[ch.value] = parseInt(countInput.value, 10) || 1;
    });

    const payload = {
      headName: document.getElementById('headName').value.trim(),
      category: document.getElementById('category').value,
      contactNo: document.getElementById('contactNo').value.trim(),
      familyMembers: parseInt(document.getElementById('familyMembers').value, 10) || 0,
      migrationStatus: document.getElementById('migrationStatus').value,
      migrationDetails: document.getElementById('migrationDetails') ? document.getElementById('migrationDetails').value.trim() : '',
      aadharNumber: document.getElementById('aadharNumber') ? document.getElementById('aadharNumber').value.trim() : '',
      bankAccount: document.getElementById('bankAccount') ? document.getElementById('bankAccount').value : 'No',
      annualIncome: parseFloat(document.getElementById('annualIncome').value) || 0,
      mainIncomeSource: document.getElementById('mainIncomeSource').value.trim(),
      mnregaJobCard: document.getElementById('mnregaJobCard').value,
      houseOwnership: document.getElementById('houseOwnership').value,
      
      // New fields
      houseType: document.getElementById('houseType').value,
      electricityAccess: document.getElementById('electricityAccess').value,
      electricityHours: parseInt(document.getElementById('electricityHours').value, 10) || 0,
      toiletAvailable: document.getElementById('toiletAvailable').value,
      drinkingWaterSource: document.getElementById('drinkingWaterSource').value,
      cookingFuel,
      landOwned: document.getElementById('landOwned').value,
      landAcres: parseFloat(document.getElementById('landAcres').value) || 0,
      livestock,
      photos: uploadedPhotos,
      
      // GPS Coordinates
      latitude: document.getElementById('latitude').value ? parseFloat(document.getElementById('latitude').value) : null,
      longitude: document.getElementById('longitude').value ? parseFloat(document.getElementById('longitude').value) : null,
      gpsAddress: document.getElementById('gpsAddress').value.trim(),
      
      vehicles,
      electronics,
      serviceProviders,
      waterStorage,
      agricultureCrops: document.getElementById('agricultureCrops').value.trim(),
      agricultureChemicals: document.getElementById('agricultureChemicals').value.trim(),
      irrigation: document.getElementById('irrigation').value,
      healthIssues: document.getElementById('healthIssues').value.trim(),
      govtBeneficiary,
      members
    };

    try {
      const url = editMode ? `${API_URL}/households/${editHouseholdId}` : `${API_URL}/households`;
      const method = editMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Request failed');

      const data = await response.json();
      showSuccessModal(data);
      form.reset();
      resetFormToRegister();
      
      const vehiclesList = document.getElementById('vehicles-list');
      if (vehiclesList) {
        vehiclesList.innerHTML = '<p class="no-vehicles-msg" style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No vehicles registered</p>';
      }

      const membersList = document.getElementById('members-list');
      if (membersList) {
        membersList.innerHTML = `<p class="no-members-msg" style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No family members registered yet. Click 'Add Member' to add details.</p>`;
      }
      document.getElementById('familyMembers').value = 0;
      
      // Hide details input again
      document.getElementById('others-scheme-detail-group').classList.add('hidden');
      
      const migrationDetailsGroup = document.getElementById('migration-details-group');
      if (migrationDetailsGroup) migrationDetailsGroup.classList.add('hidden');

      const elOtherGroup = document.getElementById('electronics-other-detail-group');
      if (elOtherGroup) elOtherGroup.classList.add('hidden');
      const elOtherInput = document.getElementById('electronicsOthers');
      if (elOtherInput) elOtherInput.value = '';
      
    } catch (err) {
      console.error('Error submitting form:', err);
      alert('Error saving household data. Make sure the server is online and try again.');
    } finally {
      submitBtn.disabled = false;
      const btnText = editMode ? 'Update Household' : 'Register Household';
      submitBtn.innerHTML = `<i data-lucide="check-circle-2"></i> ${btnText}`;
      if (window.lucide) lucide.createIcons();
    }
  });
}

// 5. Success Overlay Card Mapping
let currentRegisteredData = null;

function showSuccessModal(data) {
  currentRegisteredData = data;
  
  // Fill Modal Info
  document.getElementById('success-household-id').textContent = data.record.id;
  document.getElementById('success-head-name').textContent = data.record.headName;
  document.getElementById('success-category').textContent = data.record.category;
  document.getElementById('success-ownership').textContent = data.record.houseOwnership;
  document.getElementById('success-phone').textContent = data.record.contactNo || 'N/A';
  document.getElementById('success-aadhar').textContent = data.record.aadharNumber || 'N/A';
  document.getElementById('success-bank').textContent = data.record.bankAccount || 'No';
  
  // QR image
  const successQrImg = document.getElementById('success-qr-img');
  successQrImg.src = data.qrCode;

  // Prepare Print Receipt Card
  populatePrintReceipt(data.record, data.qrCode);

  // Display success modal
  document.getElementById('success-overlay').classList.remove('hidden');
}

function populatePrintReceipt(record, qrCodeDataUrl) {
  document.getElementById('print-h-id').textContent = record.id;
  document.getElementById('print-h-name').textContent = record.headName;
  document.getElementById('print-h-category').textContent = record.category;
  document.getElementById('print-h-house').textContent = record.houseOwnership;
  document.getElementById('print-h-phone').textContent = record.contactNo || 'N/A';
  document.getElementById('print-h-members').textContent = record.familyMembers;
  
  // Dynamic print variables
  const povertyEl = document.getElementById('print-h-poverty');
  if (povertyEl) povertyEl.textContent = record.povertyStatus || 'APL';
  
  const houseTypeEl = document.getElementById('print-h-house-type');
  if (houseTypeEl) houseTypeEl.textContent = record.houseType || 'Pucca';
  
  const landEl = document.getElementById('print-h-land');
  if (landEl) landEl.textContent = record.landOwned === 'Yes' ? `${record.landAcres} Acres` : 'No';

  document.getElementById('print-h-income-src').textContent = record.mainIncomeSource || 'N/A';
  document.getElementById('print-h-aadhar').textContent = record.aadharNumber || 'N/A';
  document.getElementById('print-h-bank').textContent = record.bankAccount || 'No';
  document.getElementById('print-qr-img').src = qrCodeDataUrl;
  
  const createdDate = new Date(record.createdAt);
  document.getElementById('print-h-date').textContent = `Date: ${createdDate.toLocaleDateString()}`;
}

function initSuccessModalHandlers() {
  const closeBtn = document.getElementById('success-close-btn');
  const printBtn = document.getElementById('success-print-btn');
  const downloadBtn = document.getElementById('success-download-btn');
  const overlay = document.getElementById('success-overlay');

  closeBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    fetchStats();
  });

  printBtn.addEventListener('click', () => {
    window.print();
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentRegisteredData || !currentRegisteredData.qrCode) return;
    const link = document.createElement('a');
    link.href = currentRegisteredData.qrCode;
    link.download = `${currentRegisteredData.record.id}_QR_Code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// 6. Manual Lookup & In-app Camera Scanning
function initDetailsModalHandlers() {
  const closeBtn = document.getElementById('details-close-btn');
  const overlay = document.getElementById('details-overlay');

  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
    });
  }

  // Click outside to close
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  }
}

async function fetchHouseholdDetails(id) {
  try {
    const response = await fetch(`${API_URL}/households/${id}`);
    if (!response.ok) {
      throw new Error(response.status === 404 ? `Household ID ${id} not found` : 'Error fetching household details');
    }
    const data = await response.json();
    populateDetailsCard(data);
  } catch (err) {
    console.error('Error fetching details, trying local cache:', err);
    // Offline / Network error fallback - search allHouseholds cache
    const cachedRecord = allHouseholds.find(r => r.id.toUpperCase() === id.toUpperCase());
    if (cachedRecord) {
      populateDetailsCard(cachedRecord);
    } else {
      alert(err.message || 'Household ID not found (Offline: No cached data available).');
    }
  }
}

function populateDetailsCard(data) {
  const resultCard = document.getElementById('scan-result-card');
  
  // Header Info
  document.getElementById('detail-id').textContent = data.id;
  document.getElementById('detail-headName').textContent = data.headName;
  document.getElementById('detail-category-tag').textContent = `Category: ${data.category}`;
  
  // Details list
  document.getElementById('detail-contactNo').textContent = data.contactNo || 'N/A';
  document.getElementById('detail-familyMembers').textContent = data.familyMembers;
  document.getElementById('detail-migrationStatus').textContent = data.migrationStatus || 'No';
  
  const migrationRow = document.getElementById('detail-migration-details-row');
  if (data.migrationStatus === 'Yes' && data.migrationDetails) {
    document.getElementById('detail-migrationDetails').textContent = data.migrationDetails;
    if (migrationRow) migrationRow.classList.remove('hidden');
  } else {
    if (migrationRow) migrationRow.classList.add('hidden');
  }

  const detailAadhar = document.getElementById('detail-aadharNumber');
  if (detailAadhar) detailAadhar.textContent = data.aadharNumber || 'N/A';

  const detailBank = document.getElementById('detail-bankAccount');
  if (detailBank) detailBank.textContent = data.bankAccount || 'No';

  // Poverty, house type, electricity, toilet, water, cooking fuel
  const povertyStatusEl = document.getElementById('detail-povertyStatus');
  if (povertyStatusEl) {
    povertyStatusEl.textContent = data.povertyStatus || 'APL';
    povertyStatusEl.className = 'det-val badge-poverty ' + (data.povertyStatus || 'APL').toLowerCase();
  }
  document.getElementById('detail-houseType').textContent = data.houseType || 'Pucca (Concrete/Brick)';
  document.getElementById('detail-electricity').textContent = data.electricityAccess === 'Yes' ? `Yes (${data.electricityHours || 0} Hrs/Day)` : 'No';
  const detailToiletVal = data.toiletAvailable || 'No';
  document.getElementById('detail-toiletAvailable').textContent = detailToiletVal.startsWith('No') ? 'No - Using Public Toilets' : 'Yes';
  document.getElementById('detail-drinkingWaterSource').textContent = data.drinkingWaterSource || 'Panchayat Tap Water';
  document.getElementById('detail-cookingFuel').textContent = data.cookingFuel && data.cookingFuel.length ? data.cookingFuel.join(', ') : 'None';
  document.getElementById('detail-landAcres').textContent = data.landOwned === 'Yes' ? `${data.landAcres || 0} Acres` : 'No';

  // Livestock
  const livestockContainer = document.getElementById('detail-livestock');
  if (data.livestock && Object.keys(data.livestock).length > 0) {
    const list = Object.entries(data.livestock)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => `<span class="vehicle-badge"><i data-lucide="paw-print"></i> <strong>${name}</strong>: ${count}</span>`)
      .join(' ');
    livestockContainer.innerHTML = list || 'None';
  } else {
    livestockContainer.textContent = 'None';
  }

  // House Photos Carousel
  const carouselGroup = document.getElementById('detail-photos-carousel-group');
  const carouselTrack = document.getElementById('detail-photos-carousel-track');
  if (data.photos && data.photos.length > 0) {
    carouselTrack.innerHTML = data.photos.map(url => `
      <div class="carousel-slide">
        <img src="${url}" alt="House Photo">
      </div>
    `).join('');
    carouselGroup.classList.remove('hidden');
    
    currentCarouselIndex = 0;
    carouselTrack.style.transform = `translateX(0%)`;
    
    const prevBtn = document.getElementById('carousel-prev-btn');
    const nextBtn = document.getElementById('carousel-next-btn');
    
    prevBtn.onclick = () => {
      if (currentCarouselIndex > 0) {
        currentCarouselIndex--;
      } else {
        currentCarouselIndex = data.photos.length - 1;
      }
      carouselTrack.style.transform = `translateX(-${currentCarouselIndex * 100}%)`;
    };
    
    nextBtn.onclick = () => {
      if (currentCarouselIndex < data.photos.length - 1) {
        currentCarouselIndex++;
      } else {
        currentCarouselIndex = 0;
      }
      carouselTrack.style.transform = `translateX(-${currentCarouselIndex * 100}%)`;
    };
  } else {
    carouselGroup.classList.add('hidden');
    carouselTrack.innerHTML = '';
  }

  // Family members list details
  const membersTableBody = document.getElementById('detail-members-table-body');
  if (data.members && data.members.length) {
    membersTableBody.innerHTML = data.members.map(m => `
      <tr>
        <td class="table-name-cell">${m.fullName}</td>
        <td>${m.phone || 'N/A'}</td>
        <td>${m.age}</td>
        <td>${m.gender}</td>
        <td>${m.relationship}</td>
        <td>${m.education}</td>
        <td>${m.occupation}</td>
        <td>${m.category || 'N/A'}</td>
        <td>${m.healthIssues || 'None'}</td>
        <td>${m.mnregaJobCard || 'No'}</td>
        <td>${m.aadharNumber || 'N/A'}</td>
        <td>${m.bankAccount || 'No'}</td>
        <td>${m.income ? '\u20B9' + parseFloat(m.income).toLocaleString('en-IN') : '\u20B90'}</td>
      </tr>
    `).join('');
  } else {
    membersTableBody.innerHTML = `<tr><td colspan="13" class="text-center" style="padding: 14px;">No members listed</td></tr>`;
  }
  
  // Finance/House Info
  const income = data.annualIncome ? `₹${parseFloat(data.annualIncome).toLocaleString('en-IN')}` : '₹0';
  document.getElementById('detail-annualIncome').textContent = income;
  document.getElementById('detail-mainIncomeSource').textContent = data.mainIncomeSource || 'N/A';
  document.getElementById('detail-mnregaJobCard').textContent = data.mnregaJobCard || 'No';
  document.getElementById('detail-houseOwnership').textContent = data.houseOwnership;
  
  // Checkbox arrays
  const vehiclesContainer = document.getElementById('detail-vehicles');
  if (data.vehicles && data.vehicles.length) {
    vehiclesContainer.innerHTML = `
      <div class="vehicle-badge-list">
        ${data.vehicles.map(v => `
          <span class="vehicle-badge">
            <i data-lucide="car"></i>
            <strong>${v.vehicleNo}</strong> (${v.wheels}-Wheeler, ${v.fuelType})
          </span>
        `).join('')}
      </div>
    `;
  } else {
    vehiclesContainer.textContent = 'None';
  }
  document.getElementById('detail-electronics').textContent = data.electronics && data.electronics.length ? data.electronics.join(', ') : 'None';
  document.getElementById('detail-serviceProviders').textContent = data.serviceProviders && data.serviceProviders.length ? data.serviceProviders.join(', ') : 'None';
  document.getElementById('detail-waterStorage').textContent = data.waterStorage && data.waterStorage.length ? data.waterStorage.join(', ') : 'None';
  
  // Agri & Health Info
  document.getElementById('detail-agricultureCrops').textContent = data.agricultureCrops || 'None';
  document.getElementById('detail-agricultureChemicals').textContent = data.agricultureChemicals || 'None';
  document.getElementById('detail-irrigation').textContent = data.irrigation;
  document.getElementById('detail-healthIssues').textContent = data.healthIssues || 'None';
  
  // Schemes array
  document.getElementById('detail-schemes').textContent = data.govtBeneficiary && data.govtBeneficiary.length ? data.govtBeneficiary.join(', ') : 'None';
  
  // Registration date
  const createdDate = new Date(data.createdAt);
  document.getElementById('detail-createdAt').textContent = createdDate.toLocaleString();

  // Load print layout parameters
  populatePrintReceipt(data, data.qrCode);

  // Setup details print and download bindings
  const printBtn = document.getElementById('detail-print-btn');
  const downloadBtn = document.getElementById('detail-download-btn');
  const detailEditBtn = document.getElementById('detail-edit-btn');
  const detailDeleteBtn = document.getElementById('detail-delete-btn');

  const newPrintBtn = printBtn.cloneNode(true);
  const newDownloadBtn = downloadBtn.cloneNode(true);
  printBtn.parentNode.replaceChild(newPrintBtn, printBtn);
  downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);

  newPrintBtn.addEventListener('click', () => {
    window.print();
  });

  newDownloadBtn.addEventListener('click', () => {
    if (!data.qrCode) return;
    const link = document.createElement('a');
    link.href = data.qrCode;
    link.download = `${data.id}_QR_Code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  if (detailEditBtn) {
    detailEditBtn.onclick = () => {
      const detailsOverlay = document.getElementById('details-overlay');
      if (detailsOverlay) detailsOverlay.classList.add('hidden');
      loadHouseholdForEdit(data.id);
    };
  }
  if (detailDeleteBtn) {
    detailDeleteBtn.onclick = () => deleteHousehold(data.id);
  }

  // Display details card modal
  const detailsOverlay = document.getElementById('details-overlay');
  if (detailsOverlay) {
    detailsOverlay.classList.remove('hidden');
  }
  resultCard.classList.remove('hidden');

  // Handle Map in Details Modal
  const mapRow = document.getElementById('detail-map-row');
  const navLink = document.getElementById('detail-navigation-link');
  if (data.latitude && data.longitude) {
    if (mapRow) mapRow.classList.remove('hidden');
    if (navLink) {
      navLink.href = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
    }
    
    // Initialize or relocate details map
    setTimeout(() => {
      if (!detailsMap) {
        detailsMap = L.map('details-map').setView([data.latitude, data.longitude], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(detailsMap);
        
        detailsMarker = L.marker([data.latitude, data.longitude]).addTo(detailsMap);
      } else {
        detailsMap.setView([data.latitude, data.longitude], 16);
        if (detailsMarker) {
          detailsMarker.setLatLng([data.latitude, data.longitude]);
        } else {
          detailsMarker = L.marker([data.latitude, data.longitude]).addTo(detailsMap);
        }
      }
      detailsMap.invalidateSize();
    }, 150);
  } else {
    if (mapRow) mapRow.classList.add('hidden');
  }

  if (window.lucide) lucide.createIcons();
}

// 7. Directory List Handlers
function initDirectoryHandlers() {
  const searchInput = document.getElementById('dir-search-input');
  const catFilter = document.getElementById('dir-category-filter');
  const migFilter = document.getElementById('dir-migration-filter');
  const refreshBtn = document.getElementById('dir-refresh-btn');

  searchInput.addEventListener('input', renderFilteredDirectory);
  catFilter.addEventListener('change', renderFilteredDirectory);
  migFilter.addEventListener('change', renderFilteredDirectory);
  refreshBtn.addEventListener('click', loadDirectory);
}

async function loadDirectory() {
  const tbody = document.getElementById('directory-table-body');
  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center py-8">
        <div class="spinner-container">
          <div class="spinner"></div>
          <p>Refreshing database...</p>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await fetch(`${API_URL}/households`);
    if (!response.ok) throw new Error('Database refresh failed');

    allHouseholds = await response.json();
    allHouseholds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Save to local storage for offline use
    localStorage.setItem('allHouseholds', JSON.stringify(allHouseholds));
    
    renderFilteredDirectory();
  } catch (err) {
    console.error('Error fetching directory database:', err);
    
    // Try to load from cache
    const cached = localStorage.getItem('allHouseholds');
    if (cached) {
      allHouseholds = JSON.parse(cached);
      renderFilteredDirectory();
      
      // Notify user they are viewing offline data
      const statsSpan = document.getElementById('directory-stats');
      if (statsSpan) {
        statsSpan.innerHTML = `<span style="color:var(--gold); font-weight:bold;"><i data-lucide="wifi-off" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Viewing Offline Data: Showing ${allHouseholds.length} cached records</span>`;
        if (window.lucide) lucide.createIcons();
      }
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-8" style="color:var(--danger)">
            <i data-lucide="alert-triangle" style="margin:0 auto 8px auto; display:block; width:30px; height:30px;"></i>
            Failed to load records. Make sure the server is online.
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
    }
  }
}

function renderFilteredDirectory() {
  const tbody = document.getElementById('directory-table-body');
  const searchTerm = document.getElementById('dir-search-input').value.toLowerCase().trim();
  const selectedCat = document.getElementById('dir-category-filter').value;
  const selectedMig = document.getElementById('dir-migration-filter').value;
  const statsSpan = document.getElementById('directory-stats');

  const filtered = allHouseholds.filter(item => {
    const catMatch = !selectedCat || item.category === selectedCat;
    const migMatch = !selectedMig || item.migrationStatus === selectedMig;
    
    const searchMatch = !searchTerm || 
      item.id.toLowerCase().includes(searchTerm) ||
      item.headName.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm) ||
      (item.mainIncomeSource && item.mainIncomeSource.toLowerCase().includes(searchTerm)) ||
      (item.contactNo && item.contactNo.includes(searchTerm));
      
    return catMatch && migMatch && searchMatch;
  });

  statsSpan.textContent = `Showing ${filtered.length} of ${allHouseholds.length} households`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8">No matching records found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    return `
      <tr onclick="viewHouseholdFromTable('${item.id}')">
        <td class="table-id-cell">${item.id}</td>
        <td class="table-name-cell">${item.headName}</td>
        <td>${item.category}</td>
        <td>${item.mainIncomeSource || 'N/A'}</td>
        <td>${item.contactNo || 'N/A'}</td>
        <td>${item.familyMembers} members</td>
        <td>${item.migrationStatus}</td>
        <td>
          <div class="table-actions">
            <button class="action-icon-btn" title="View details" onclick="event.stopPropagation(); viewHouseholdFromTable('${item.id}')">
              <i data-lucide="eye" style="width:16px; height:16px;"></i>
            </button>
            <button class="action-icon-btn" title="Print card" onclick="event.stopPropagation(); printHouseholdFromTable('${item.id}')">
              <i data-lucide="printer" style="width:16px; height:16px;"></i>
            </button>
            <button class="action-icon-btn edit-btn" title="Edit details" onclick="event.stopPropagation(); editHouseholdFromTable('${item.id}')">
              <i data-lucide="edit" style="width:16px; height:16px;"></i>
            </button>
            <button class="action-icon-btn delete-btn" title="Delete household" onclick="event.stopPropagation(); deleteHouseholdFromTable('${item.id}')">
              <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Global actions linked to window for table onclick handlers
window.viewHouseholdFromTable = function(id) {
  fetchHouseholdDetails(id);
};

window.editHouseholdFromTable = function(id) {
  loadHouseholdForEdit(id);
};

window.deleteHouseholdFromTable = function(id) {
  deleteHousehold(id);
};

window.printHouseholdFromTable = async function(id) {
  try {
    const response = await fetch(`${API_URL}/households/${id}`);
    if (!response.ok) throw new Error('Record fetch failed');
    const data = await response.json();
    
    populatePrintReceipt(data, data.qrCode);
    window.print();
  } catch (err) {
    console.error('Failed to print from table:', err);
    alert('Error printing card. Could not fetch data.');
  }
};

async function fetchStats() {
  try {
    const response = await fetch(`${API_URL}/households`);
    if (response.ok) {
      const data = await response.json();
      const count = data.length;
      
      localStorage.setItem('totalHouseholdsCount', count);
      
      const totalCountEl = document.getElementById('total-households-count');
      if (totalCountEl) totalCountEl.textContent = count;
      
      const portalCountEl = document.getElementById('portal-families-count');
      if (portalCountEl) portalCountEl.textContent = count;
    }
  } catch (err) {
    console.error('Error updating household count:', err);
    
    const cachedCount = localStorage.getItem('totalHouseholdsCount');
    const displayCount = cachedCount !== null ? cachedCount : 'N/A';
    
    const totalCountEl = document.getElementById('total-households-count');
    if (totalCountEl) totalCountEl.textContent = displayCount;
    
    const portalCountEl = document.getElementById('portal-families-count');
    if (portalCountEl) portalCountEl.textContent = displayCount;
  }
}

function checkURLParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const scannedId = urlParams.get('id');
  if (scannedId && scannedId.match(/^H\d+$/i)) {
    setTimeout(() => {
      fetchHouseholdDetails(scannedId);
    }, 200);
  }
}

// Vehicle Row Builder Helper
function addVehicleRow(data = null) {
  const vehiclesList = document.getElementById('vehicles-list');
  if (!vehiclesList) return;
  
  const noMsg = vehiclesList.querySelector('.no-vehicles-msg');
  if (noMsg) noMsg.remove();

  const row = document.createElement('div');
  row.className = 'vehicle-row-item';

  const vehicleNo = data ? data.vehicleNo : '';
  const wheels = data ? data.wheels : '2';
  const fuelType = data ? data.fuelType : 'Petrol';

  row.innerHTML = `
    <div class="form-group flex-1">
      <input type="text" class="v-number-input" placeholder="Vehicle No (e.g. AP39AX1234)" value="${vehicleNo}" required>
    </div>
    <div class="form-group">
      <select class="v-wheels-select">
        <option value="2" ${wheels === '2' ? 'selected' : ''}>2-Wheeler</option>
        <option value="3" ${wheels === '3' ? 'selected' : ''}>3-Wheeler</option>
        <option value="4" ${wheels === '4' ? 'selected' : ''}>4-Wheeler</option>
        <option value="6+" ${wheels === '6+' ? 'selected' : ''}>Heavy Vehicle (6+)</option>
      </select>
    </div>
    <div class="form-group">
      <select class="v-fuel-select">
        <option value="Electric" ${fuelType === 'Electric' ? 'selected' : ''}>Electric</option>
        <option value="Petrol" ${fuelType === 'Petrol' ? 'selected' : ''}>Petrol</option>
        <option value="Diesel" ${fuelType === 'Diesel' ? 'selected' : ''}>Diesel</option>
      </select>
    </div>
    <button type="button" class="action-icon-btn delete-btn remove-vehicle-row" title="Remove vehicle">
      <i data-lucide="trash-2"></i>
    </button>
  `;

  row.querySelector('.remove-vehicle-row').addEventListener('click', () => {
    row.remove();
    if (vehiclesList.querySelectorAll('.vehicle-row-item').length === 0) {
      vehiclesList.innerHTML = '<p class="no-vehicles-msg" style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No vehicles registered</p>';
    }
  });

  vehiclesList.appendChild(row);
  if (window.lucide) lucide.createIcons();
}

// Family Members Row Builder Helpers
function addMemberRow(data = null) {
  const membersList = document.getElementById('members-list');
  if (!membersList) return;
  
  const noMsg = membersList.querySelector('.no-members-msg');
  if (noMsg) noMsg.remove();

  const row = document.createElement('div');
  row.className = 'member-row-item';

  const fullName = data ? data.fullName : '';
  const memberPhone = data ? (data.phone || '') : '';
  const age = data ? data.age : '';
  const gender = data ? data.gender : 'Male';
  const relationship = data ? data.relationship : 'Self';
  const education = data ? data.education : 'Graduate';
  const occupation = data ? data.occupation : 'Unemployed';
  const category = data ? data.category : 'General';
  const healthIssues = data ? data.healthIssues : '';
  const mnregaJobCard = data ? data.mnregaJobCard : 'No';
  const memberAadhar = data ? (data.aadharNumber || '') : '';
  const memberBank = data ? (data.bankAccount || 'No') : 'No';
  const memberIncome = data ? (data.income || '') : '';

  // Check if Self is already defined in existing list to toggle default selection
  const hasHead = Array.from(membersList.querySelectorAll('.m-relationship-select')).some(select => select.value === 'Self');
  const defaultRel = data ? data.relationship : (hasHead ? 'Spouse' : 'Self');

  row.innerHTML = `
    <div class="form-group flex-grow-2">
      <input type="text" class="m-name-input" placeholder="Full Name" value="${fullName}" required>
    </div>
    <div class="form-group" style="width: 130px;">
      <input type="tel" class="m-phone-input" placeholder="Phone No" value="${memberPhone}" pattern="[0-9]{10}" maxlength="10">
    </div>
    <div class="form-group m-age-group">
      <input type="number" class="m-age-input" placeholder="Age" min="0" max="120" value="${age}" required style="width: 100%;">
    </div>
    <div class="form-group">
      <select class="m-gender-select">
        <option value="Male" ${gender === 'Male' ? 'selected' : ''}>Male</option>
        <option value="Female" ${gender === 'Female' ? 'selected' : ''}>Female</option>
        <option value="Other" ${gender === 'Other' ? 'selected' : ''}>Other</option>
      </select>
    </div>
    <div class="form-group">
      <select class="m-relationship-select">
        <option value="Self" ${defaultRel === 'Self' ? 'selected' : ''}>Self/Head</option>
        <option value="Spouse" ${defaultRel === 'Spouse' ? 'selected' : ''}>Spouse</option>
        <option value="Son" ${defaultRel === 'Son' ? 'selected' : ''}>Son</option>
        <option value="Daughter" ${defaultRel === 'Daughter' ? 'selected' : ''}>Daughter</option>
        <option value="Father" ${defaultRel === 'Father' ? 'selected' : ''}>Father</option>
        <option value="Mother" ${defaultRel === 'Mother' ? 'selected' : ''}>Mother</option>
        <option value="Brother" ${defaultRel === 'Brother' ? 'selected' : ''}>Brother</option>
        <option value="Sister" ${defaultRel === 'Sister' ? 'selected' : ''}>Sister</option>
        <option value="Other" ${defaultRel === 'Other' ? 'selected' : ''}>Other</option>
      </select>
    </div>
    <div class="form-group">
      <select class="m-education-select">
        <option value="Illiterate" ${education === 'Illiterate' ? 'selected' : ''}>Illiterate</option>
        <option value="Primary" ${education === 'Primary' ? 'selected' : ''}>Primary</option>
        <option value="High School" ${education === 'High School' ? 'selected' : ''}>High School</option>
        <option value="Graduate" ${education === 'Graduate' ? 'selected' : ''}>Graduate</option>
        <option value="Post-Graduate" ${education === 'Post-Graduate' ? 'selected' : ''}>Post-Graduate</option>
      </select>
    </div>
    <div class="form-group">
      <select class="m-occupation-select">
        <option value="Unemployed" ${occupation === 'Unemployed' ? 'selected' : ''}>Unemployed</option>
        <option value="Student" ${occupation === 'Student' ? 'selected' : ''}>Student</option>
        <option value="Agriculture" ${occupation === 'Agriculture' ? 'selected' : ''}>Agriculture</option>
        <option value="Daily Wage" ${occupation === 'Daily Wage' ? 'selected' : ''}>Daily Wage</option>
        <option value="Private Job" ${occupation === 'Private Job' ? 'selected' : ''}>Private Job</option>
        <option value="Govt Job" ${occupation === 'Govt Job' ? 'selected' : ''}>Govt Job</option>
        <option value="Business" ${occupation === 'Business' ? 'selected' : ''}>Business</option>
        <option value="Retired" ${occupation === 'Retired' ? 'selected' : ''}>Retired</option>
      </select>
    </div>
    <div class="form-group">
      <select class="m-category-select">
        <option value="General" ${category === 'General' ? 'selected' : ''}>General</option>
        <option value="OBC" ${category === 'OBC' ? 'selected' : ''}>OBC</option>
        <option value="SC" ${category === 'SC' ? 'selected' : ''}>SC</option>
        <option value="ST" ${category === 'ST' ? 'selected' : ''}>ST</option>
      </select>
    </div>
    <div class="form-group flex-grow-2">
      <input type="text" class="m-health-input" placeholder="Health Issues" value="${healthIssues}">
    </div>
    <div class="form-group">
      <select class="m-mnrega-select">
        <option value="No" ${mnregaJobCard === 'No' ? 'selected' : ''}>MNREGA: No</option>
        <option value="Yes" ${mnregaJobCard === 'Yes' ? 'selected' : ''}>MNREGA: Yes</option>
      </select>
    </div>
    <div class="form-group">
      <input type="text" class="m-aadhar-input" placeholder="Aadhaar No (12-digit)" value="${memberAadhar}" maxlength="12" pattern="[0-9]{12}">
    </div>
    <div class="form-group">
      <select class="m-bank-select">
        <option value="No" ${memberBank === 'No' ? 'selected' : ''}>Bank A/C: No</option>
        <option value="Yes" ${memberBank === 'Yes' ? 'selected' : ''}>Bank A/C: Yes</option>
      </select>
    </div>
    <div class="form-group m-age-group">
      <input type="number" class="m-income-input" placeholder="Income (₹)" min="0" value="${memberIncome}" style="width: 100%;">
    </div>
    <button type="button" class="action-icon-btn delete-btn remove-member-row" title="Remove member">
      <i data-lucide="trash-2"></i>
    </button>
  `;

  row.querySelector('.remove-member-row').addEventListener('click', () => {
    row.remove();
    updateFamilyMembersCount();
    if (membersList.querySelectorAll('.member-row-item').length === 0) {
      membersList.innerHTML = `<p class="no-members-msg" style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No family members registered yet. Click 'Add Member' to add details.</p>`;
    }
  });

  // Track select/input change events to auto-update family members count
  membersList.appendChild(row);
  updateFamilyMembersCount();
  if (window.lucide) lucide.createIcons();
}

function updateFamilyMembersCount() {
  const countInput = document.getElementById('familyMembers');
  const membersList = document.getElementById('members-list');
  if (countInput && membersList) {
    const count = membersList.querySelectorAll('.member-row-item').length;
    countInput.value = count;
  }
}

// Live Clock and Date Updater
function initLiveClock() {
  const clockEl = document.getElementById('current-time');
  const dateEl = document.getElementById('current-date');
  
  function updateClock() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  
  updateClock();
  setInterval(updateClock, 1000);
}

// Translations Mapping Dictionary
const TRANSLATIONS = {
  en: {
    'portal-title-telugu': 'GRAM PANCHAYAT PORTAL',
    'portal-title-english': 'GRAM PANCHAYAT PORTAL • ANDHRA PRADESH',
    'nav-home': 'Home',
    'nav-register': 'Register New',
    'nav-scan': 'Scan QR Code',
    'nav-directory': 'Directory List',
    'hero-title': 'Your Village, Your Rights, Your Portal',
    'hero-desc': 'Welcome to the official Gram Panchayat Portal. Manage household registries, verify cards via QR codes, and access welfare schemes seamlessly.',
    'hero-btn': 'Register New Household',
    'quick-access-title': 'Quick Access',
    'dashboard-title': 'Panchayat Dashboard',
    'stat-families': 'Registered Families',
    'stat-families-desc': 'Total households logged in portal',
    'stat-schemes': 'Active Schemes',
    'stat-schemes-desc': 'Welfare programs running in village',
    'stat-notices': 'Monthly Notices',
    'stat-notices-desc': 'Announcements issued this month',
    'stat-budget': 'Annual Budget',
    'stat-budget-desc': 'Total developmental funds allocated',
    'form-title': 'Household Details Form',
    'sec-basic': 'Basic & Social Info',
    'lbl-head': 'Household Head Name',
    'lbl-category': 'Social Category',
    'lbl-contact': 'Contact Phone Number',
    'lbl-members': 'Total Family Members',
    'lbl-migration': 'Migration Status',
    'lbl-migration-details': 'Migration Details',
    'lbl-aadhar': 'Aadhaar Number',
    'lbl-bank': 'Bank Account',
    'lbl-add-member': 'Add Member',
    'sec-finance': 'Finance & Housing',
    'lbl-income': 'Annual Income (₹)',
    'lbl-income-src': 'Main Income Source',
    'lbl-mnrega': 'MNREGA Job Card',
    'lbl-house': 'House Status / Ownership',
    'sec-utilities': 'Utilities, Vehicles & Appliances',
    'lbl-vehicles': 'Vehicles Owned',
    'lbl-add-vehicle': 'Add Vehicle',
    'lbl-electronics': 'Electronic Appliances',
    'lbl-electronics-other': 'Other Appliances Details',
    'lbl-providers': 'Service Providers',
    'lbl-water': 'Water Storage System',
    'sec-agri': 'Agriculture, Schemes & Health',
    'lbl-crops': 'Agricultural Crops Grown',
    'lbl-chemicals': 'Chemicals/Fertilizers Used',
    'lbl-irrigation': 'Irrigation Source',
    'lbl-health': 'Chronic/Family Health Issues',
    'lbl-schemes-benefits': 'Govt Schemes Beneficiary Status',
    'btn-reset': 'Reset',
    'btn-submit': 'Register Household',
    'info-title': 'Panchayat Registry System',
    'info-desc': 'Create secure profiles for village households. A permanent sequential Household ID and verification QR code will be generated immediately on registration.',
    'feat-1-title': 'Secure Local Database',
    'feat-1-desc': 'All social, asset, and utility parameters are safely logged in the database.',
    'feat-2-title': 'Dynamically Generated QR',
    'feat-2-desc': 'A quick-scan barcode that encodes a direct link to the household\'s ledger file.',
    'feat-3-title': 'Official Printing Support',
    'feat-3-desc': 'Generates print-optimized card receipts for village distribution.',
    'lbl-registered-count': 'Registered Households:',
    'scan-title': 'Camera Scanner',
    'scan-subtitle': 'Grant camera permissions to scan the household QR code',
    'btn-start-camera': 'Start Camera',
    'lookup-title': 'Manual Lookup',
    'lookup-subtitle': 'No QR code? Find household by entering the Household ID',
    'lookup-waiting-title': 'Awaiting Input',
    'lookup-waiting-desc': 'Scan a household QR code or type an ID above to view details',
    'dir-all-cat': 'All Categories',
    'dir-all-mig': 'All Migration Status',
    'dir-refresh': 'Refresh'
  },
  te: {
    'portal-title-telugu': 'గ్రామ పంచాయతీ పోర్టల్',
    'portal-title-english': 'గ్రామ పంచాయతీ పోర్టల్ • ఆంధ్ర ప్రదేశ్',
    'nav-home': 'Home | గృహం',
    'nav-register': 'Register New | నమోదు',
    'nav-scan': 'Scan QR Code | స్కాన్ క్యూఆర్',
    'nav-directory': 'Directory List | కుటుంబ వివరాలు',
    'hero-title': 'మీ గ్రామం, మీ హక్కులు, మీ పోర్టల్',
    'hero-desc': 'అధికారిక గ్రామ పంచాయతీ పోర్టల్‌కు స్వాగతం. గృహ నమోదులను నిర్వహించండి, QR కోడ్‌ల ద్వారా కార్డులను ధృవీకరించండి మరియు సంక్షేమ పథకాలను సులభంగా యాక్సెస్ చేయండి.',
    'hero-btn': 'Register New Household / నమోదు',
    'quick-access-title': 'Quick Access | త్వరిత యాక్సెస్',
    'dashboard-title': 'Panchayat Dashboard | గణాంకాలు',
    'stat-families': 'Registered Families',
    'stat-families-desc': 'పోర్టల్‌లో నమోదైన మొత్తం గృహాలు',
    'stat-schemes': 'Active Schemes',
    'stat-schemes-desc': 'గ్రామంలో అమలవుతున్న సంక్షేమ పథకాలు',
    'stat-notices': 'Monthly Notices',
    'stat-notices-desc': 'ఈ నెలలో జారీ చేసిన నోటీసులు',
    'stat-budget': 'Annual Budget',
    'stat-budget-desc': 'కేటాయించిన మొత్తం అభివృద్ధి నిధులు',
    'form-title': 'Household Details Form',
    'sec-basic': 'Basic & Social Info',
    'lbl-head': 'Household Head Name',
    'lbl-category': 'Social Category',
    'lbl-contact': 'Contact Phone Number',
    'lbl-members': 'Total Family Members',
    'lbl-migration': 'Migration Status',
    'lbl-migration-details': 'Migration Details',
    'lbl-aadhar': 'Aadhaar Number',
    'lbl-bank': 'Bank Account',
    'lbl-add-member': 'Add Member',
    'sec-finance': 'Finance & Housing',
    'lbl-income': 'Annual Income (₹)',
    'lbl-income-src': 'Main Income Source',
    'lbl-mnrega': 'MNREGA Job Card',
    'lbl-house': 'House Status / Ownership',
    'sec-utilities': 'Utilities, Vehicles & Appliances',
    'lbl-vehicles': 'Vehicles Owned',
    'lbl-add-vehicle': 'Add Vehicle',
    'lbl-electronics': 'Electronic Appliances',
    'lbl-electronics-other': 'ఇతర పరికరాల వివరాలు',
    'lbl-providers': 'Service Providers',
    'lbl-water': 'Water Storage System',
    'sec-agri': 'Agriculture, Schemes & Health',
    'lbl-crops': 'Agricultural Crops Grown',
    'lbl-chemicals': 'Chemicals/Fertilizers Used',
    'lbl-irrigation': 'Irrigation Source',
    'lbl-health': 'Chronic/Family Health Issues',
    'lbl-schemes-benefits': 'Govt Schemes Beneficiary Status',
    'btn-reset': 'Reset',
    'btn-submit': 'Register Household',
    'info-title': 'Panchayat Registry System',
    'info-desc': 'గ్రామ గృహాల కోసం సురక్షిత ప్రొఫైల్‌లను సృష్టించండి. నమోదు చేసిన వెంటనే శాశ్వత గృహ ఐడి మరియు ధృవీకరణ QR కోడ్ సృష్టించబడుతుంది.',
    'feat-1-title': 'Secure Local Database',
    'feat-1-desc': 'అన్ని సామాజిక, ఆస్తి మరియు ఇతర వివరాలు సురక్షితంగా రికార్డ్ చేయబడతాయి.',
    'feat-2-title': 'Dynamically Generated QR',
    'feat-2-desc': 'గృహ రికార్డుకు నేరుగా లింక్ చేసే త్వరిత స్కాన్ బార్‌కోడ్.',
    'feat-3-title': 'Official Printing Support',
    'feat-3-desc': 'పంపిణీ కోసం అనుకూలమైన ప్రింట్ కార్డును సృష్టిస్తుంది.',
    'lbl-registered-count': 'Registered Households:',
    'scan-title': 'Camera Scanner',
    'scan-subtitle': 'క్యూఆర్ కోడ్ స్కాన్ చేయడానికి కెమెరా అనుమతి ఇవ్వండి',
    'btn-start-camera': 'Start Camera',
    'lookup-title': 'Manual Lookup',
    'lookup-subtitle': 'క్యూఆర్ కోడ్ లేదా? గృహ ఐడిని నమోదు చేసి శోధించండి',
    'lookup-waiting-title': 'Awaiting Input',
    'lookup-waiting-desc': 'వివరాలను చూడటానికి క్యూఆర్ కోడ్‌ను స్కాన్ చేయండి లేదా పైన ఐడిని టైప్ చేయండి',
    'dir-all-cat': 'All Categories',
    'dir-all-mig': 'All Migration Status',
    'dir-refresh': 'Refresh'
  },
  hi: {
    'portal-title-telugu': 'ग्राम पंचायत पोर्टल',
    'portal-title-english': 'ग्राम पंचायत पोर्टल • आंध्र प्रदेश',
    'nav-home': 'Home | गृह',
    'nav-register': 'Register New | पंजीकरण',
    'nav-scan': 'Scan QR Code | क्यूआर स्कैन',
    'nav-directory': 'Directory List | परिवार सूची',
    'hero-title': 'आपका गाँव, आपका अधिकार, आपका पोर्टल',
    'hero-desc': 'आधिकारिक ग्राम पंचायत पोर्टल में आपका स्वागत है। घरेलू रजिस्ट्रियों का प्रबंधन करें, क्यूआर कोड के माध्यम से कार्ड सत्यापित करें और कल्याणकारी योजनाओं का उपयोग करें।',
    'hero-btn': 'Register New Household / पंजीकरण करें',
    'quick-access-title': 'Quick Access | त्वरित पहुंच',
    'dashboard-title': 'Panchayat Dashboard | पंचायत डैशबोर्ड',
    'stat-families': 'Registered Families',
    'stat-families-desc': 'पोर्टल में कुल पंजीकृत परिवार',
    'stat-schemes': 'Active Schemes',
    'stat-schemes-desc': 'गाँव में चल रहे कल्याणकारी कार्यक्रम',
    'stat-notices': 'Monthly Notices',
    'stat-notices-desc': 'इस महीने जारी की गई सूचनाएं',
    'stat-budget': 'Annual Budget',
    'stat-budget-desc': 'कुल आवंटित विकास निधि',
    'form-title': 'Household Details Form',
    'sec-basic': 'Basic & Social Info',
    'lbl-head': 'Household Head Name',
    'lbl-category': 'Social Category',
    'lbl-contact': 'Contact Phone Number',
    'lbl-members': 'Total Family Members',
    'lbl-migration': 'Migration Status',
    'lbl-migration-details': 'Migration Details',
    'lbl-aadhar': 'Aadhaar Number',
    'lbl-bank': 'Bank Account',
    'lbl-add-member': 'Add Member',
    'sec-finance': 'Finance & Housing',
    'lbl-income': 'Annual Income (₹)',
    'lbl-income-src': 'Main Income Source',
    'lbl-mnrega': 'MNREGA Job Card',
    'lbl-house': 'House Status / Ownership',
    'sec-utilities': 'Utilities, Vehicles & Appliances',
    'lbl-vehicles': 'Vehicles Owned',
    'lbl-add-vehicle': 'Add Vehicle',
    'lbl-electronics': 'Electronic Appliances',
    'lbl-electronics-other': 'अन्य उपकरणों का विवरण',
    'lbl-providers': 'Service Providers',
    'lbl-water': 'Water Storage System',
    'sec-agri': 'Agriculture, Schemes & Health',
    'lbl-crops': 'Agricultural Crops Grown',
    'lbl-chemicals': 'Chemicals/Fertilizers Used',
    'lbl-irrigation': 'Irrigation Source',
    'lbl-health': 'Chronic/Family Health Issues',
    'lbl-schemes-benefits': 'Govt Schemes Beneficiary Status',
    'btn-reset': 'Reset',
    'btn-submit': 'Register Household',
    'info-title': 'Panchayat Registry System',
    'info-desc': 'गाँव के परिवारों के लिए सुरक्षित प्रोफ़ाइल बनाएं। पंजीकरण पर तुरंत एक स्थायी घरेलू आईडी और सत्यापन क्यूआर कोड उत्पन्न होगा।',
    'feat-1-title': 'Secure Local Database',
    'feat-1-desc': 'सभी सामाजिक, संपत्ति और उपयोगिता मापदंडों को सुरक्षित रूप से लॉग किया जाता है।',
    'feat-2-title': 'Dynamically Generated QR',
    'feat-2-desc': 'एक त्वरित-स्कैन बारकोड जो घरेलू फ़ाइल के लिए एक सीधा लिंक एन्कोड करता है।',
    'feat-3-title': 'Official Printing Support',
    'feat-3-desc': 'वितरण के लिए मुद्रण-अनुक्रमिक कार्ड रसीदें उत्पन्न करता है।',
    'lbl-registered-count': 'Registered Households:',
    'scan-title': 'Camera Scanner',
    'scan-subtitle': 'घरेलू क्यूआर कोड को स्कैन करने के लिए कैमरा अनुमति दें',
    'btn-start-camera': 'Start Camera',
    'lookup-title': 'Manual Lookup',
    'lookup-subtitle': 'क्यूआर कोड नहीं है? घरेलू आईडी दर्ज करके खोजें',
    'lookup-waiting-title': 'Awaiting Input',
    'lookup-waiting-desc': 'विवरण देखने के लिए क्यूआर कोड स्कैन करें या ऊपर एक आईडी टाइप करें',
    'dir-all-cat': 'All Categories',
    'dir-all-mig': 'All Migration Status',
    'dir-refresh': 'Refresh'
  }
};

// Language Selector Handler
function initLanguageSelector() {
  const langBtns = document.querySelectorAll('.lang-btn');
  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const langText = btn.textContent.trim();
      let langCode = 'te'; // default Telugu
      if (langText === 'English') {
        langCode = 'en';
      } else if (langText === 'హిందీ' || langText === 'Hindi') {
        langCode = 'hi';
      }
      translatePage(langCode);
    });
  });

  // Apply default active language (Telugu is active in HTML)
  const activeBtn = document.querySelector('.lang-btn.active');
  if (activeBtn) {
    const langText = activeBtn.textContent.trim();
    let langCode = 'te';
    if (langText === 'English') langCode = 'en';
    else if (langText === 'హిందీ') langCode = 'hi';
    translatePage(langCode);
  }
}

// Page translation engine using CSS selectors
function translatePage(langCode) {
  const tr = TRANSLATIONS[langCode];
  if (!tr) return;

  const translationRules = [
    { selector: '.portal-title-telugu', key: 'portal-title-telugu' },
    { selector: '.portal-title-english', key: 'portal-title-english' },
    { selector: 'button[data-tab="home-tab"] span', key: 'nav-home' },
    { selector: 'button[data-tab="register-tab"] span', key: 'nav-register' },
    { selector: 'button[data-tab="directory-tab"] span', key: 'nav-directory' },
    { selector: '.hero-welcome h2', key: 'hero-title' },
    { selector: '.hero-welcome p', key: 'hero-desc' },
    { selector: '#hero-register-btn span', key: 'hero-btn' },
    { selector: '.quick-access-section .section-title', key: 'quick-access-title' },
    { selector: '.stats-section .section-title', key: 'dashboard-title' },
    { selector: '.card-families .stat-card-title', key: 'stat-families' },
    { selector: '.card-families .stat-card-desc', key: 'stat-families-desc' },
    { selector: '.card-schemes .stat-card-title', key: 'stat-schemes' },
    { selector: '.card-schemes .stat-card-desc', key: 'stat-schemes-desc' },
    { selector: '.card-notices .stat-card-title', key: 'stat-notices' },
    { selector: '.card-notices .stat-card-desc', key: 'stat-notices-desc' },
    { selector: '.card-budget .stat-card-title', key: 'stat-budget' },
    { selector: '.card-budget .stat-card-desc', key: 'stat-budget-desc' },
    { selector: '.form-card .card-header h3', key: 'form-title' },
    { selector: '.form-section-group:nth-child(1) .section-title-tag span', key: 'sec-basic' },
    { selector: 'label[for="headName"] span:nth-child(1)', key: 'lbl-head' },
    { selector: 'label[for="category"]', key: 'lbl-category' },
    { selector: 'label[for="contactNo"]', key: 'lbl-contact' },
    { selector: 'label[for="familyMembers"]', key: 'lbl-members' },
    { selector: 'label[for="migrationStatus"]', key: 'lbl-migration' },
    { selector: 'label[for="migrationDetails"]', key: 'lbl-migration-details' },
    { selector: 'label[for="aadharNumber"]', key: 'lbl-aadhar' },
    { selector: 'label[for="bankAccount"]', key: 'lbl-bank' },
    { selector: '#add-member-btn span', key: 'lbl-add-member' },
    { selector: '.form-section-group:nth-of-type(2) .section-title-tag span', key: 'sec-finance' },
    { selector: 'label[for="annualIncome"]', key: 'lbl-income' },
    { selector: 'label[for="mainIncomeSource"]', key: 'lbl-income-src' },
    { selector: 'label[for="mnregaJobCard"]', key: 'lbl-mnrega' },
    { selector: 'label[for="houseOwnership"]', key: 'lbl-house' },
    { selector: '.form-section-group:nth-of-type(3) .section-title-tag span', key: 'sec-utilities' },
    { selector: '#add-vehicle-btn span', key: 'lbl-add-vehicle' },
    { selector: 'label[for="electronicsOthers"]', key: 'lbl-electronics-other' },
    { selector: '.form-section-group:nth-of-type(4) .section-title-tag span', key: 'sec-agri' },
    { selector: 'label[for="agricultureCrops"]', key: 'lbl-crops' },
    { selector: 'label[for="agricultureChemicals"]', key: 'lbl-chemicals' },
    { selector: 'label[for="irrigation"]', key: 'lbl-irrigation' },
    { selector: 'label[for="healthIssues"]', key: 'lbl-health' },
    { selector: 'label[for="schemes"]', key: 'lbl-schemes-benefits' },
    { selector: 'button[type="reset"] span', key: 'btn-reset' },
    { selector: '#submit-btn span', key: 'btn-submit' },
    { selector: '.info-card h3', key: 'info-title' },
    { selector: '.info-card .info-desc', key: 'info-desc' },
    { selector: '.info-card .feature-item:nth-child(1) h4', key: 'feat-1-title' },
    { selector: '.info-card .feature-item:nth-child(1) p', key: 'feat-1-desc' },
    { selector: '.info-card .feature-item:nth-child(2) h4', key: 'feat-2-title' },
    { selector: '.info-card .feature-item:nth-child(2) p', key: 'feat-2-desc' },
    { selector: '.info-card .feature-item:nth-child(3) h4', key: 'feat-3-title' },
    { selector: '.info-card .feature-item:nth-child(3) p', key: 'feat-3-desc' },
    { selector: '.database-card-count .lbl', key: 'lbl-registered-count' },
    { selector: '.scanner-card h3', key: 'scan-title' },
    { selector: '.scanner-card .card-subtitle', key: 'scan-subtitle' },
    { selector: '#toggle-camera-btn span', key: 'btn-start-camera' },
    { selector: '.lookup-card h3', key: 'lookup-title' },
    { selector: '.lookup-card .card-subtitle', key: 'lookup-subtitle' },
    { selector: '#scan-waiting-card h4', key: 'lookup-waiting-title' },
    { selector: '#scan-waiting-card p', key: 'lookup-waiting-desc' },
    { selector: '#dir-refresh-btn span', key: 'dir-refresh' }
  ];

  translationRules.forEach(rule => {
    const el = document.querySelector(rule.selector);
    if (el && tr[rule.key]) {
      const val = tr[rule.key];
      // Keep any icon intact
      const icon = el.querySelector('i');
      if (icon) {
        const tempIcon = icon.cloneNode(true);
        el.innerHTML = '';
        el.appendChild(tempIcon);
        el.appendChild(document.createTextNode(' ' + val));
      } else {
        el.textContent = val;
      }
    }
  });

  // Handle dropdown option translations dynamically
  const dirCat = document.querySelector('#dir-category-filter option[value=""]');
  if (dirCat && tr['dir-all-cat']) dirCat.textContent = tr['dir-all-cat'];

  const dirMig = document.querySelector('#dir-migration-filter option[value=""]');
  if (dirMig && tr['dir-all-mig']) dirMig.textContent = tr['dir-all-mig'];

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 8. Edit and Delete Handlers
async function loadHouseholdForEdit(id) {
  try {
    const response = await fetch(`${API_URL}/households/${id}`);
    if (!response.ok) throw new Error('Failed to load household details');
    const data = await response.json();
    
    // Switch to Register tab
    switchTab('register-tab');
    
    // Set edit variables
    editMode = true;
    editHouseholdId = data.id;
    
    // Update Page UI
    const titleEl = document.querySelector('#register-tab .page-title');
    if (titleEl) titleEl.textContent = `Edit Household: ${data.id}`;
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="check-circle-2"></i> Update Household';
    
    // Populate Form Fields
    document.getElementById('headName').value = data.headName || '';
    document.getElementById('category').value = data.category || 'General';
    document.getElementById('contactNo').value = data.contactNo || '';
    document.getElementById('migrationStatus').value = data.migrationStatus || 'No';
    
    const migrationDetailsGroup = document.getElementById('migration-details-group');
    const migrationDetailsInput = document.getElementById('migrationDetails');
    if (data.migrationStatus === 'Yes') {
      migrationDetailsGroup.classList.remove('hidden');
      migrationDetailsInput.value = data.migrationDetails || '';
    } else {
      migrationDetailsGroup.classList.add('hidden');
      migrationDetailsInput.value = '';
    }
    
    document.getElementById('aadharNumber').value = data.aadharNumber || '';
    document.getElementById('bankAccount').value = data.bankAccount || 'No';
    
    // Finance & Housing
    document.getElementById('annualIncome').value = data.annualIncome || '';
    updatePovertyClassification(data.annualIncome || 0);
    document.getElementById('mainIncomeSource').value = data.mainIncomeSource || '';
    document.getElementById('mnregaJobCard').value = data.mnregaJobCard || 'No';
    document.getElementById('houseOwnership').value = data.houseOwnership || 'Own House';
    document.getElementById('houseType').value = data.houseType || 'Pucca (Concrete/Brick)';
    
    // Utilities
    document.getElementById('electricityAccess').value = data.electricityAccess || 'No';
    const electricityHoursGroup = document.getElementById('electricity-hours-group');
    if (data.electricityAccess === 'Yes') {
      electricityHoursGroup.classList.remove('hidden');
      document.getElementById('electricityHours').value = data.electricityHours || 24;
    } else {
      electricityHoursGroup.classList.add('hidden');
      document.getElementById('electricityHours').value = 0;
    }
    
    const toiletVal = data.toiletAvailable || 'No';
    document.getElementById('toiletAvailable').value = toiletVal.startsWith('No') ? 'No - Using Public Toilets' : 'Yes';
    document.getElementById('drinkingWaterSource').value = data.drinkingWaterSource || 'Panchayat Tap Water';
    
    // Checkboxes: Cooking Fuel
    const cookingFuelChecks = document.querySelectorAll('input[name="cookingFuel"]');
    cookingFuelChecks.forEach(ch => {
      ch.checked = data.cookingFuel && data.cookingFuel.includes(ch.value);
    });
    
    // Checkboxes: Electronics
    const electronicsChecks = document.querySelectorAll('input[name="electronics"]');
    electronicsChecks.forEach(ch => {
      const foundValue = data.electronics ? data.electronics.find(val => val.startsWith(ch.value)) : null;
      ch.checked = !!foundValue;
      if (ch.value === 'Other') {
        const otherDetailGroup = document.getElementById('electronics-other-detail-group');
        const otherDetailInput = document.getElementById('electronicsOthers');
        if (foundValue && foundValue.includes(':')) {
          otherDetailGroup.classList.remove('hidden');
          otherDetailInput.value = foundValue.split(':')[1].trim();
        } else {
          otherDetailGroup.classList.add('hidden');
          otherDetailInput.value = '';
        }
      }
    });
    
    // Checkboxes: Providers
    const providerChecks = document.querySelectorAll('input[name="providers"]');
    providerChecks.forEach(ch => {
      ch.checked = data.serviceProviders && data.serviceProviders.includes(ch.value);
    });
    
    // Checkboxes: Water Storage
    const waterChecks = document.querySelectorAll('input[name="water"]');
    waterChecks.forEach(ch => {
      ch.checked = data.waterStorage && data.waterStorage.includes(ch.value);
    });
    
    // Agriculture & Health
    document.getElementById('landOwned').value = data.landOwned || 'No';
    const landAcresGroup = document.getElementById('land-acres-group');
    if (data.landOwned === 'Yes') {
      landAcresGroup.classList.remove('hidden');
      document.getElementById('landAcres').value = data.landAcres || 0;
    } else {
      landAcresGroup.classList.add('hidden');
      document.getElementById('landAcres').value = 0;
    }
    
    document.getElementById('agricultureCrops').value = data.agricultureCrops || '';
    document.getElementById('agricultureChemicals').value = data.agricultureChemicals || '';
    document.getElementById('irrigation').value = data.irrigation || 'None';
    document.getElementById('healthIssues').value = data.healthIssues || '';
    
    // Checkboxes: Schemes
    const schemeChecks = document.querySelectorAll('input[name="schemes"]');
    schemeChecks.forEach(ch => {
      const foundValue = data.govtBeneficiary ? data.govtBeneficiary.find(val => val.startsWith(ch.value)) : null;
      ch.checked = !!foundValue;
      if (ch.value === 'Others') {
        const othersSchemeGroup = document.getElementById('others-scheme-detail-group');
        const othersSchemeInput = document.getElementById('benefitsOthers');
        if (foundValue && foundValue.includes(':')) {
          othersSchemeGroup.classList.remove('hidden');
          othersSchemeInput.value = foundValue.split(':')[1].trim();
        } else {
          othersSchemeGroup.classList.add('hidden');
          othersSchemeInput.value = '';
        }
      }
    });
    
    // Livestock
    const lsTypes = ['Cows', 'Buffaloes', 'Goats/Sheep', 'Poultry', 'Pigs', 'Others'];
    lsTypes.forEach(type => {
      const ch = document.querySelector(`input[name="livestock"][value="${type}"]`);
      const countInput = document.getElementById(`ls-${ch.id.substring(3)}-count`);
      const count = data.livestock && data.livestock[type];
      if (count !== undefined && count > 0) {
        ch.checked = true;
        countInput.classList.remove('hidden');
        countInput.value = count;
      } else {
        ch.checked = false;
        countInput.classList.add('hidden');
        countInput.value = 1;
      }
    });
    
    // Vehicles
    const vehiclesList = document.getElementById('vehicles-list');
    vehiclesList.innerHTML = '';
    if (data.vehicles && data.vehicles.length) {
      data.vehicles.forEach(v => addVehicleRow(v));
    } else {
      vehiclesList.innerHTML = '<p class="no-vehicles-msg" style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No vehicles registered</p>';
    }
    
    // Members
    const membersList = document.getElementById('members-list');
    membersList.innerHTML = '';
    if (data.members && data.members.length) {
      data.members.forEach(m => addMemberRow(m));
    } else {
      membersList.innerHTML = `<p class="no-members-msg" style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No family members registered yet. Click 'Add Member' to add details.</p>`;
    }
    updateFamilyMembersCount();
    
    // Photos
    uploadedPhotos = data.photos || [];
    renderPhotoPreviews();

    // GPS Coordinates
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const addrInput = document.getElementById('gpsAddress');
    if (latInput) latInput.value = data.latitude !== null && data.latitude !== undefined ? data.latitude : '';
    if (lngInput) lngInput.value = data.longitude !== null && data.longitude !== undefined ? data.longitude : '';
    if (addrInput) addrInput.value = data.gpsAddress || '';

    // Update map marker
    if (data.latitude && data.longitude) {
      setTimeout(() => {
        if (registerMap) {
          registerMap.setView([data.latitude, data.longitude], 16);
          if (registerMarker) {
            registerMarker.setLatLng([data.latitude, data.longitude]);
          } else {
            registerMarker = L.marker([data.latitude, data.longitude]).addTo(registerMap);
          }
          registerMap.invalidateSize();
        }
      }, 200);
    } else {
      if (registerMarker) {
        if (registerMap) registerMap.removeLayer(registerMarker);
        registerMarker = null;
      }
    }
    
    if (window.lucide) lucide.createIcons();
    
  } catch (err) {
    console.error('Error loading edit household:', err);
    alert('Error fetching household data for edit.');
  }
}

async function deleteHousehold(id) {
  if (!confirm(`Are you sure you want to delete household ${id}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/households/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Delete request failed');
    
    alert(`Household ${id} has been deleted successfully.`);
    
    // Clear viewed detail card and hide modal overlay
    const detailsOverlay = document.getElementById('details-overlay');
    if (detailsOverlay) {
      detailsOverlay.classList.add('hidden');
    }
    
    // Refresh directory or dashboard stats
    if (currentActiveTab === 'directory-tab') {
      loadDirectory();
    } else {
      fetchStats();
    }
    
  } catch (err) {
    console.error('Error deleting household:', err);
    alert(`Failed to delete household ${id}. Make sure the server is online.`);
  }
}

// Initialize registration location map
function initRegisterMap() {
  const mapElement = document.getElementById('register-map');
  if (!mapElement) return;

  // Center at Vijayawada, Andhra Pradesh [16.5062, 80.6480] by default
  registerMap = L.map('register-map').setView([16.5062, 80.6480], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(registerMap);

  // Enable clicking on map to manually position marker
  registerMap.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    updateGPSFields(lat, lng);
  });
}

// Helper to update GPS fields and place marker
async function updateGPSFields(lat, lng) {
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');
  const addrInput = document.getElementById('gpsAddress');

  if (latInput) latInput.value = lat.toFixed(7);
  if (lngInput) lngInput.value = lng.toFixed(7);
  if (addrInput) addrInput.value = 'Fetching address...';

  // Move or add marker
  if (registerMarker) {
    registerMarker.setLatLng([lat, lng]);
  } else {
    registerMarker = L.marker([lat, lng]).addTo(registerMap);
  }

  registerMap.setView([lat, lng]);

  // Fetch address via reverse geocoding
  try {
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(geoUrl, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await response.json();
    const addressStr = data.display_name || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    if (addrInput) addrInput.value = addressStr;
  } catch (err) {
    console.error('Error reverse geocoding:', err);
    if (addrInput) addrInput.value = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} (Address lookup failed)`;
  }
}

// Click handler to get actual device GPS location
function fetchGpsLocation() {
  const getGpsBtn = document.getElementById('get-gps-btn');
  const addrInput = document.getElementById('gpsAddress');

  if (getGpsBtn) {
    getGpsBtn.disabled = true;
    getGpsBtn.innerHTML = '<span class="spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; vertical-align:middle; margin-right:4px;"></span> Locating...';
  }
  if (addrInput) addrInput.value = 'Requesting GPS coordinates...';

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  };

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      await updateGPSFields(lat, lng);
      
      if (getGpsBtn) {
        getGpsBtn.disabled = false;
        getGpsBtn.innerHTML = '<i data-lucide="crosshair"></i> Get GPS Location &amp; Address';
        if (window.lucide) lucide.createIcons();
      }
    },
    (err) => {
      console.error('Geolocation error:', err);
      let errMsg = 'Failed to fetch GPS coordinates';
      if (err.code === err.PERMISSION_DENIED) {
        errMsg = 'GPS Permission Denied. Please enable location services in browser settings.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errMsg = 'Location information is unavailable.';
      } else if (err.code === err.TIMEOUT) {
        errMsg = 'Location request timed out.';
      }
      
      if (addrInput) addrInput.value = errMsg;
      alert(`GPS Error: ${errMsg}`);

      if (getGpsBtn) {
        getGpsBtn.disabled = false;
        getGpsBtn.innerHTML = '<i data-lucide="crosshair"></i> Get GPS Location &amp; Address';
        if (window.lucide) lucide.createIcons();
      }
    },
    geoOptions
  );
}

