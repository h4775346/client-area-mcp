#!/usr/bin/env node

const express = require('express');
const CryptoJS = require('crypto-js');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Encryption configuration
const ENCRYPTION_KEY = 'abcdefghijuklmno0123456789012345';
const BASE_URL = 'https://client.snono-systems.com/backend/index.php/api';

// Admin credentials (hardcoded)
const ADMIN_EMAIL = 'apanub@snono-systems.com';
const ADMIN_PASSWORD = 'hH0109741663';

// In-memory token storage
let accessToken = null;
let tokenExpiry = null;

/**
 * Encrypt data using AES-256-CBC
 */
function encryptPayload(data) {
  const jsonString = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  return encrypted;
}

/**
 * Check if token is valid (with 60 second buffer before expiry)
 */
function isTokenValid() {
  if (!accessToken || !tokenExpiry) return false;
  // Refresh token 60 seconds before it expires to avoid using expired token
  const bufferTime = 60 * 1000; // 60 seconds in milliseconds
  return Date.now() < (tokenExpiry - bufferTime);
}

/**
 * Login to the SAS4 Client Area
 */
async function login(email, password) {
  try {
    const credentials = { email, password };
    const encryptedPayload = encryptPayload(credentials);
    
    const response = await axios.post(`${BASE_URL}/login`, {
      payload: encryptedPayload
    });
    
    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    
    return {
      success: true,
      message: 'Successfully logged in',
      token: accessToken,
      expires_in: response.data.expires_in
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Ensure we have a valid token
 */
async function ensureAuthenticated() {
  if (!isTokenValid()) {
    console.log('Token expired or missing, logging in...');
    const loginResult = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!loginResult.success) {
      throw new Error('Authentication failed: ' + loginResult.error);
    }
    console.log(`Token refreshed, expires in ${loginResult.expires_in} seconds`);
  } else {
    const remainingTime = Math.floor((tokenExpiry - Date.now()) / 1000);
    console.log(`Using cached token, expires in ${remainingTime} seconds`);
  }
  return accessToken;
}

/**
 * Search for licenses
 */
async function searchLicenses(searchParams) {
  try {
    const token = await ensureAuthenticated();
    
    const requestData = {
      page: searchParams.page || 1,
      count: searchParams.count || 500,
      sortBy: searchParams.sortBy || 'id',
      direction: searchParams.direction || 'asc',
      search: searchParams.search || '',
      owner: searchParams.owner || null
    };
    
    const encryptedPayload = encryptPayload(requestData);
    
    const response = await axios.post(`${BASE_URL}/license/index`, {
      payload: encryptedPayload
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Check if string is an email format
 */
function isEmail(str) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

/**
 * Check if string looks like an EHWID format (e.g., Q46I5-BEAAO-RQA4R-EBQDT)
 */
function isEHWID(str) {
  // EHWID format: alphanumeric groups separated by dashes
  // Format: XXXXX-XXXXX-XXXXX-XXXXX (4 groups of 5 alphanumeric characters)
  const ehwidRegex = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i;
  return ehwidRegex.test(str);
}

/**
 * Get license directly by EHWID using direct API endpoint
 */
async function getLicenseByEHWID(ehwid) {
  try {
    const token = await ensureAuthenticated();
    
    const response = await axios.get(`${BASE_URL}/license/${ehwid}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.status === 200 && response.data.data) {
      return {
        success: true,
        data: response.data.data,
        match_type: 'ehwid'
      };
    }
    
    return {
      success: false,
      error: 'License not found for this EHWID'
    };
  } catch (error) {
    // Handle 500 error or other errors
    if (error.response && error.response.status === 500) {
      return {
        success: false,
        error: 'License not found for this EHWID (Hardware ID)'
      };
    }
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Search license by keyword
 */
async function searchLicenseByKeyword(keyword) {
  try {
    const searchTerm = keyword.toString().trim();
    
    // If keyword is an EHWID, use direct API endpoint
    if (isEHWID(searchTerm)) {
      console.log(`EHWID detected: ${searchTerm}, using direct API endpoint`);
      return await getLicenseByEHWID(searchTerm);
    }
    
    // Otherwise, use search API
    const result = await searchLicenses({
      search: searchTerm,
      count: 50,
      page: 1
    });
    
    if (!result.success) {
      return result;
    }
    
    const licenses = result.data.data || [];
    const totalResults = result.data.total || 0;
    const currentPage = result.data.current_page || 1;
    const lastPage = result.data.last_page || 1;
    
    // If no licenses found
    if (licenses.length === 0) {
      return {
        success: false,
        error: 'License not found. Please try searching by EHWID (Hardware ID) for more accurate results.'
      };
    }
    
    // Try to find exact match by looping through all licenses
    let exactMatch = null;
    
    // Check if keyword is numeric (license ID)
    const licenseId = parseInt(searchTerm);
    if (!isNaN(licenseId) && searchTerm === licenseId.toString()) {
      exactMatch = licenses.find(l => l.id === licenseId);
      if (exactMatch) {
        return {
          success: true,
          data: exactMatch,
          match_type: 'license_id'
        };
      }
    }
    
    // Check if keyword is an email - return all matching licenses
    if (isEmail(searchTerm)) {
      const emailMatches = licenses.filter(l => 
        l.client_details && l.client_details.email && 
        l.client_details.email.toLowerCase() === searchTerm.toLowerCase()
      );
      if (emailMatches.length > 0) {
        return {
          success: true,
          data: emailMatches,
          total: emailMatches.length,
          match_type: 'email'
        };
      }
    }
    
    // Check if keyword matches EHWID (Hardware ID) - fallback for any format
    exactMatch = licenses.find(l => 
      l.ehwid && l.ehwid.toLowerCase() === searchTerm.toLowerCase()
    );
    if (exactMatch) {
      return {
        success: true,
        data: exactMatch,
        match_type: 'ehwid'
      };
    }
    
    // If we have more pages and didn't find exact match, suggest searching by EHWID
    if (currentPage < lastPage || licenses.length < totalResults) {
      return {
        success: false,
        error: `Found ${licenses.length} license(s) on first page, but no exact match. Please search by EHWID (Hardware ID) for more accurate results.`,
        suggestions: licenses.length > 0 ? licenses.map(l => ({
          id: l.id,
          ehwid: l.ehwid,
          email: l.client_details?.email || 'N/A'
        })) : []
      };
    }
    
    // If we searched all pages and found licenses but no exact match
    if (licenses.length > 0) {
      return {
        success: false,
        error: `Found ${licenses.length} license(s), but no exact match found. Please search by EHWID (Hardware ID) for more accurate results.`,
        suggestions: licenses.map(l => ({
          id: l.id,
          ehwid: l.ehwid,
          email: l.client_details?.email || 'N/A'
        }))
      };
    }
    
    return {
      success: false,
      error: 'License not found. Please try searching by EHWID (Hardware ID) for more accurate results.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// REST API endpoints

// Search for licenses
app.post('/api/search-license', async (req, res) => {
  try {
    // Check if req.body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: keyword and this could be license id, email, or ehwid (Hardware Id)'
      });
    }

    const keyword = req.body.keyword;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: keyword and this could be license id, email, or ehwid (Hardware Id)'
      });
    }

    const result = await searchLicenseByKeyword(keyword);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SAS4 License Search Server',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SAS4 License Search Server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Search license: POST http://localhost:${PORT}/api/search-license`);
});