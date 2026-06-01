const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = process.env.DATA_DIR || (IS_VERCEL ? '/tmp' : path.join(__dirname, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'households.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR || (IS_VERCEL ? '/tmp/uploads' : path.join(__dirname, 'public', 'uploads'));
const RENDER_BACKEND_URL = process.env.RENDER_BACKEND_URL;

// Vercel reverse proxy to Render backend (if RENDER_BACKEND_URL is set)
if (IS_VERCEL && RENDER_BACKEND_URL) {
  const proxy = async (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
      const targetUrl = `${RENDER_BACKEND_URL.replace(/\/$/, '')}${req.originalUrl}`;
      try {
        const headers = { ...req.headers };
        delete headers.host; // let fetch set correct host header

        const fetchOptions = {
          method: req.method,
          headers: headers,
          duplex: 'half'
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          // Since this middleware runs before body parsers, stream the body directly
          fetchOptions.body = req;
        }

        const response = await fetch(targetUrl, fetchOptions);

        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });

        res.status(response.status);
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      } catch (err) {
        console.error(`Proxy error for ${targetUrl}:`, err);
        res.status(500).json({ error: 'Proxy to backend failed' });
      }
    } else {
      next();
    }
  };
  app.use(proxy);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files from custom UPLOADS_DIR if it's not the default public/uploads
if (UPLOADS_DIR !== path.join(__dirname, 'public', 'uploads')) {
  app.use('/uploads', express.static(UPLOADS_DIR));
}

// Ensure directories and database file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  // Try to copy default database template to custom/tmp path
  const bundledSeed = path.join(__dirname, 'data', 'households.json');
  if (fs.existsSync(bundledSeed) && DATA_FILE !== bundledSeed) {
    try {
      fs.copyFileSync(bundledSeed, DATA_FILE);
      console.log(`Successfully seeded database to ${DATA_FILE}`);
    } catch (err) {
      console.error('Error copying seed data:', err);
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helpers for photo uploads
function savePhotos(householdId, photosBase64) {
  if (!photosBase64 || !Array.isArray(photosBase64)) return [];
  const urls = [];
  
  photosBase64.forEach((base64Str, idx) => {
    // If it's already a saved file URL, keep it
    if (typeof base64Str === 'string' && base64Str.startsWith('/uploads/')) {
      urls.push(base64Str);
      return;
    }
    
    try {
      const matches = base64Str.match(/^data:image\/([A-Za-z\-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return;
      }
      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `${householdId}_photo_${idx}_${Date.now()}.${ext}`;
      const filepath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filepath, buffer);
      urls.push(`/uploads/${filename}`);
    } catch (err) {
      console.error(`Error saving photo ${idx} for ${householdId}:`, err);
    }
  });
  return urls;
}

function deletePhotos(photoUrls) {
  if (!photoUrls || !Array.isArray(photoUrls)) return;
  photoUrls.forEach(url => {
    try {
      if (url.startsWith('/uploads/')) {
        const filename = path.basename(url);
        const filepath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }
    } catch (err) {
      console.error(`Error deleting photo file ${url}:`, err);
    }
  });
}

function calculatePovertyStatus(annualIncome) {
  const incomeNum = parseFloat(annualIncome) || 0;
  return incomeNum <= 120000 ? 'BPL' : 'APL';
}


// Database Helpers
function readDatabase() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return [];
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to database:', error);
    return false;
  }
}

// Helper to calculate the next household ID (H001, H002, etc.)
function getNextHouseholdId(records) {
  if (records.length === 0) return 'H001';
  let maxNum = 0;
  records.forEach(r => {
    if (r.id && r.id.startsWith('H')) {
      const num = parseInt(r.id.substring(1), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  const nextNum = maxNum + 1;
  return 'H' + String(nextNum).padStart(3, '0');
}

// API Endpoints

// 1. Get all households
app.get('/api/households', (req, res) => {
  const records = readDatabase();
  res.json(records);
});

// 2. Get household by ID (with QR code generation)
app.get('/api/households/:id', async (req, res) => {
  const { id } = req.params;
  const records = readDatabase();
  const record = records.find(r => r.id.toUpperCase() === id.toUpperCase());

  if (!record) {
    return res.status(404).json({ error: `Household with ID ${id} not found` });
  }

  // Generate QR code dynamically based on current host
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const qrUrl = `${protocol}://${host}/?id=${record.id}`;

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      },
      width: 300,
      margin: 2
    });
    
    res.json({ ...record, qrCode: qrCodeDataUrl, qrUrl });
  } catch (err) {
    console.error('Error generating QR code:', err);
    res.json(record);
  }
});

// 3. Register a new household
app.post('/api/households', async (req, res) => {
  const {
    headName,
    category,
    healthIssues,
    mnregaJobCard,
    govtBeneficiary,
    houseOwnership,
    vehicles,
    electronics,
    serviceProviders,
    waterStorage,
    agricultureCrops,
    agricultureChemicals,
    irrigation,
    mainIncomeSource,
    migrationStatus,
    migrationDetails,
    aadharNumber,
    bankAccount,
    contactNo,
    familyMembers,
    annualIncome,
    members
  } = req.body;

  // Validation
  if (!headName) {
    return res.status(400).json({ error: 'Household Head Name is required' });
  }

  const records = readDatabase();
  const newId = getNextHouseholdId(records);

  // Save base64-encoded photos to files
  const savedPhotoUrls = savePhotos(newId, req.body.photos);

  const newRecord = {
    id: newId,
    headName: headName.trim(),
    category: category || 'General',
    healthIssues: (healthIssues || '').trim(),
    mnregaJobCard: mnregaJobCard || 'No',
    govtBeneficiary: govtBeneficiary || [],
    houseOwnership: houseOwnership || 'Own House',
    houseType: req.body.houseType || 'Pucca (Concrete/Brick)',
    electricityAccess: req.body.electricityAccess || 'No',
    electricityHours: parseInt(req.body.electricityHours, 10) || 0,
    toiletAvailable: req.body.toiletAvailable || 'No',
    drinkingWaterSource: req.body.drinkingWaterSource || 'Panchayat Tap Water',
    cookingFuel: req.body.cookingFuel || [],
    landOwned: req.body.landOwned || 'No',
    landAcres: parseFloat(req.body.landAcres) || 0,
    livestock: req.body.livestock || {},
    povertyStatus: calculatePovertyStatus(annualIncome),
    photos: savedPhotoUrls,
    vehicles: vehicles || [],
    electronics: electronics || [],
    serviceProviders: serviceProviders || [],
    waterStorage: waterStorage || [],
    agricultureCrops: (agricultureCrops || '').trim(),
    agricultureChemicals: (agricultureChemicals || '').trim(),
    irrigation: irrigation || 'None',
    mainIncomeSource: (mainIncomeSource || '').trim(),
    migrationStatus: migrationStatus || 'No',
    migrationDetails: (migrationDetails || '').trim(),
    aadharNumber: (aadharNumber || '').trim(),
    bankAccount: bankAccount || 'No',
    contactNo: (contactNo || '').trim(),
    familyMembers: parseInt(familyMembers, 10) || 0,
    annualIncome: parseFloat(annualIncome) || 0,
    members: (members || []).map(m => ({
      ...m,
      fullName: (m.fullName || '').trim(),
      phone: (m.phone || '').trim(),
      healthIssues: (m.healthIssues || '').trim() || 'None'
    })),
    createdAt: new Date().toISOString()
  };

  records.push(newRecord);
  
  if (writeDatabase(records)) {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const qrUrl = `${protocol}://${host}/?id=${newId}`;
    
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        color: {
          dark: '#1e293b',
          light: '#ffffff'
        },
        width: 300,
        margin: 2
      });
      res.status(201).json({ record: newRecord, qrCode: qrCodeDataUrl, qrUrl });
    } catch (err) {
      console.error('Error generating QR code for registration:', err);
      res.status(201).json({ record: newRecord });
    }
  } else {
    res.status(500).json({ error: 'Failed to write to database' });
  }
});

// 4. Update an existing household
app.put('/api/households/:id', async (req, res) => {
  const { id } = req.params;
  const records = readDatabase();
  const index = records.findIndex(r => r.id.toUpperCase() === id.toUpperCase());

  if (index === -1) {
    return res.status(404).json({ error: `Household with ID ${id} not found` });
  }

  const existingRecord = records[index];

  // Process photos
  const oldPhotos = existingRecord.photos || [];
  const incomingPhotos = req.body.photos || [];
  
  // Clean up deleted photo files
  const deletedPhotos = oldPhotos.filter(p => !incomingPhotos.includes(p));
  deletePhotos(deletedPhotos);

  // Save new photo files
  const savedPhotoUrls = savePhotos(id, incomingPhotos);

  const updatedRecord = {
    ...existingRecord,
    headName: req.body.headName ? req.body.headName.trim() : existingRecord.headName,
    category: req.body.category || existingRecord.category,
    healthIssues: req.body.healthIssues !== undefined ? req.body.healthIssues.trim() : existingRecord.healthIssues,
    mnregaJobCard: req.body.mnregaJobCard || existingRecord.mnregaJobCard,
    govtBeneficiary: req.body.govtBeneficiary || existingRecord.govtBeneficiary,
    houseOwnership: req.body.houseOwnership || existingRecord.houseOwnership,
    houseType: req.body.houseType || existingRecord.houseType,
    electricityAccess: req.body.electricityAccess || existingRecord.electricityAccess,
    electricityHours: parseInt(req.body.electricityHours, 10) || 0,
    toiletAvailable: req.body.toiletAvailable || existingRecord.toiletAvailable,
    drinkingWaterSource: req.body.drinkingWaterSource || existingRecord.drinkingWaterSource,
    cookingFuel: req.body.cookingFuel || existingRecord.cookingFuel,
    landOwned: req.body.landOwned || existingRecord.landOwned,
    landAcres: parseFloat(req.body.landAcres) || 0,
    livestock: req.body.livestock || existingRecord.livestock,
    povertyStatus: calculatePovertyStatus(req.body.annualIncome !== undefined ? req.body.annualIncome : existingRecord.annualIncome),
    photos: savedPhotoUrls,
    vehicles: req.body.vehicles || existingRecord.vehicles,
    electronics: req.body.electronics || existingRecord.electronics,
    serviceProviders: req.body.serviceProviders || existingRecord.serviceProviders,
    waterStorage: req.body.waterStorage || existingRecord.waterStorage,
    agricultureCrops: req.body.agricultureCrops !== undefined ? req.body.agricultureCrops.trim() : existingRecord.agricultureCrops,
    agricultureChemicals: req.body.agricultureChemicals !== undefined ? req.body.agricultureChemicals.trim() : existingRecord.agricultureChemicals,
    irrigation: req.body.irrigation || existingRecord.irrigation,
    mainIncomeSource: req.body.mainIncomeSource !== undefined ? req.body.mainIncomeSource.trim() : existingRecord.mainIncomeSource,
    migrationStatus: req.body.migrationStatus || existingRecord.migrationStatus,
    migrationDetails: req.body.migrationDetails !== undefined ? req.body.migrationDetails.trim() : existingRecord.migrationDetails,
    aadharNumber: req.body.aadharNumber !== undefined ? req.body.aadharNumber.trim() : existingRecord.aadharNumber,
    bankAccount: req.body.bankAccount || existingRecord.bankAccount,
    contactNo: req.body.contactNo !== undefined ? req.body.contactNo.trim() : existingRecord.contactNo,
    familyMembers: parseInt(req.body.familyMembers, 10) || 0,
    annualIncome: parseFloat(req.body.annualIncome) || 0,
    members: (req.body.members || []).map(m => ({
      ...m,
      fullName: (m.fullName || '').trim(),
      phone: (m.phone || '').trim(),
      healthIssues: (m.healthIssues || '').trim() || 'None'
    })),
    updatedAt: new Date().toISOString()
  };

  records[index] = updatedRecord;

  if (writeDatabase(records)) {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const qrUrl = `${protocol}://${host}/?id=${id}`;
    
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        color: {
          dark: '#1e293b',
          light: '#ffffff'
        },
        width: 300,
        margin: 2
      });
      res.json({ record: updatedRecord, qrCode: qrCodeDataUrl, qrUrl });
    } catch (err) {
      console.error('Error generating QR code for edit:', err);
      res.json({ record: updatedRecord });
    }
  } else {
    res.status(500).json({ error: 'Failed to write to database' });
  }
});

// 5. Delete a household
app.delete('/api/households/:id', (req, res) => {
  const { id } = req.params;
  const records = readDatabase();
  const index = records.findIndex(r => r.id.toUpperCase() === id.toUpperCase());

  if (index === -1) {
    return res.status(404).json({ error: `Household with ID ${id} not found` });
  }

  const [deletedRecord] = records.splice(index, 1);

  // Clean up associated photos
  if (deletedRecord.photos && deletedRecord.photos.length) {
    deletePhotos(deletedRecord.photos);
  }

  if (writeDatabase(records)) {
    res.json({ message: `Household ${id} deleted successfully` });
  } else {
    res.status(500).json({ error: 'Failed to write to database' });
  }
});

// Fallback to index.html for SPA router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
