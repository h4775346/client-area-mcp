#!/usr/bin/env node

const express = require('express');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const moment = require('moment');

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
 * Pricing table for SAS4 licenses (USD & IQD) by user tier
 */
const PRICING_TABLE = {
  usd: {
    100:  { three_months: 43,  six_months: 65,  one_year: 100 },
    250:  { one_month: 40,  three_months: 55,  six_months: 80,  one_year: 150 },
    500:  { one_month: 50,  three_months: 80,  six_months: 130, one_year: 250 },
    1000: { three_months: 130, six_months: 200, one_year: 350 },
    2000: { three_months: 150, six_months: 300, one_year: 500 },
    5000: { three_months: 200, six_months: 400, one_year: 750 },
    10000:{ three_months: 300, six_months: 550, one_year: 1000 },
    unlimited: { three_months: 400, six_months: 800, one_year: 1500 }
  },
  iqd: {
    100:  { three_months: 60000,  six_months: 93000,  one_year: 143000 },
    250:  { one_month: 58000,  three_months: 80000,  six_months: 115000, one_year: 215000 },
    500:  { one_month: 72000,  three_months: 115000, six_months: 186000, one_year: 357000 },
    1000: { three_months: 182000, six_months: 286000, one_year: 500000 },
    2000: { three_months: 215000, six_months: 430000, one_year: 714000 },
    5000: { three_months: 286000, six_months: 572000, one_year: 1072000 },
    10000:{ three_months: 430000, six_months: 786000, one_year: 1430000 },
    unlimited: { three_months: 572000, six_months: 1143000, one_year: 2143000 }
  }
};

/**
 * Get pricing tier and values based on max_users
 */
function getPricingForMaxUsers(maxUsers) {
  if (!maxUsers || typeof maxUsers !== 'number') {
    return null;
  }

  let tier;
  if (maxUsers <= 100) tier = 100;
  else if (maxUsers <= 250) tier = 250;
  else if (maxUsers <= 500) tier = 500;
  else if (maxUsers <= 1000) tier = 1000;
  else if (maxUsers <= 2000) tier = 2000;
  else if (maxUsers <= 5000) tier = 5000;
  else if (maxUsers <= 10000) tier = 10000;
  else tier = 'unlimited';

  return {
    tier,
    usd: PRICING_TABLE.usd[tier],
    iqd: PRICING_TABLE.iqd[tier]
  };
}

/**
 * Simplify license object and merge activation pricing based on max_users
 */
function simplifyLicense(license) {
  if (!license) return null;

  const pricing = getPricingForMaxUsers(license.max_users);

  return {
    id: license.id,
    expiration: license.expiration,
    ip: license.ip,
    max_users: license.max_users,
    max_sites: license.max_sites,
    product_details: license.product_details || null,
    client_details: license.client_details || null,
    pricing: pricing
  };
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
      const simplified = simplifyLicense(response.data.data);
      return {
        success: true,
        data: simplified,
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
 * Search for clients by email
 */
async function searchClientByEmail(email) {
  try {
    const token = await ensureAuthenticated();
    
    const requestData = {
      page: 1,
      count: 10,
      sortBy: 'email',
      direction: 'asc',
      search: email,
      owner: null
    };
    
    const encryptedPayload = encryptPayload(requestData);
    
    const response = await axios.post(`${BASE_URL}/client/index`, {
      payload: encryptedPayload
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data || !response.data.data) {
      return {
        success: false,
        error: 'No client data returned from API'
      };
    }
    
    const clients = response.data.data || [];
    
    // Find exact email match (case-insensitive)
    const matchingClient = clients.find(client => 
      client.email && client.email.toLowerCase() === email.toLowerCase()
    );
    
    if (!matchingClient) {
      return {
        success: false,
        error: `Client not found with email: ${email}`,
        suggestions: clients.length > 0 ? clients.map(c => ({
          id: c.id,
          email: c.email,
          company: c.company || 'N/A'
        })) : []
      };
    }
    
    return {
      success: true,
      data: matchingClient,
      client_id: matchingClient.id
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Create an invoice
 */
async function createInvoice(invoiceData) {
  try {
    const token = await ensureAuthenticated();
    
    // Prepare invoice payload
    const invoicePayload = {
      client_id: invoiceData.client_id,
      description: invoiceData.description || '',
      comments: invoiceData.comments || 'created by Ai',
      license_id: invoiceData.license_id || null,
      due_on: invoiceData.due_on || null,
      items: invoiceData.items || '[]',
      discount: invoiceData.discount || 0,
      amount: invoiceData.amount,
      total: invoiceData.total || invoiceData.amount
    };
    
    const encryptedPayload = encryptPayload(invoicePayload);
    
    const response = await axios.post(`${BASE_URL}/invoice/create`, {
      payload: encryptedPayload
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      data: response.data,
      message: 'Invoice created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create invoice'
    };
  }
}

/**
 * Swap licenses between two EHWIDs
 */
async function swapLicenses(old_ehwid, new_ehwid) {
  try {
    // Validate EHWID formats
    if (!isEHWID(old_ehwid)) {
      return {
        success: false,
        error: `Invalid old_ehwid format: ${old_ehwid}. Expected format: XXXXX-XXXXX-XXXXX-XXXXX`
      };
    }
    
    if (!isEHWID(new_ehwid)) {
      return {
        success: false,
        error: `Invalid new_ehwid format: ${new_ehwid}. Expected format: XXXXX-XXXXX-XXXXX-XXXXX`
      };
    }
    
    // Get license details for old EHWID
    const oldLicenseResult = await getLicenseByEHWID(old_ehwid);
    if (!oldLicenseResult.success) {
      return {
        success: false,
        error: `Failed to find license for old_ehwid (${old_ehwid}): ${oldLicenseResult.error}`
      };
    }
    
    const oldLicenseId = oldLicenseResult.data.id;
    
    // Get license details for new EHWID
    const newLicenseResult = await getLicenseByEHWID(new_ehwid);
    if (!newLicenseResult.success) {
      return {
        success: false,
        error: `Failed to find license for new_ehwid (${new_ehwid}): ${newLicenseResult.error}`
      };
    }
    
    const newLicenseId = newLicenseResult.data.id;
    
    // Check if both licenses are the same
    if (oldLicenseId === newLicenseId) {
      return {
        success: false,
        error: 'Cannot swap license with itself. Both EHWIDs point to the same license.'
      };
    }
    
    // Prepare swap payload
    const swapPayload = {
      license_id: oldLicenseId,
      des_license_id: newLicenseId
    };
    
    const token = await ensureAuthenticated();
    const encryptedPayload = encryptPayload(swapPayload);
    
    // Call swap API
    const response = await axios.post(`${BASE_URL}/licenses/swap`, {
      payload: encryptedPayload
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      message: 'Licenses swapped successfully',
      data: {
        old_ehwid: old_ehwid,
        new_ehwid: new_ehwid,
        old_license_id: oldLicenseId,
        new_license_id: newLicenseId,
        old_license_details: {
          id: oldLicenseResult.data.id,
          client_email: oldLicenseResult.data.client_details?.email || 'N/A',
          expiration: oldLicenseResult.data.expiration,
          status: oldLicenseResult.data.status
        },
        new_license_details: {
          id: newLicenseResult.data.id,
          client_email: newLicenseResult.data.client_details?.email || 'N/A',
          expiration: newLicenseResult.data.expiration,
          status: newLicenseResult.data.status
        },
        swap_response: response.data
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to swap licenses'
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
          data: simplifyLicense(exactMatch),
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
          data: emailMatches.map(l => simplifyLicense(l)),
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
        data: simplifyLicense(exactMatch),
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

// Create invoice
app.post('/api/create-invoice', async (req, res) => {
  try {
    // Check if req.body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Required fields: email, price, invoice_item. Optional fields: description, license_id, due_on, discount.'
      });
    }

    const { email, description, comments, license_id, due_on, invoice_item, price} = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: email (client email address)'
      });
    }

    if (!isEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    if (!price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: price'
      });
    }

    if (!invoice_item) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: invoice_item (invoice item text/description)'
      });
    }

    // Search for client by email
    const clientResult = await searchClientByEmail(email);
    
    if (!clientResult.success) {
      return res.status(404).json({
        success: false,
        error: clientResult.error,
        suggestions: clientResult.suggestions || []
      });
    }

    const client_id = clientResult.client_id;

    // Parse price to number
    let amount = parseFloat(price);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid price value. Price must be a positive number.'
      });
    }



    // Calculate total
    const total = amount;

    // Create invoice item automatically with default structure
    // invoice_item is a simple string, we create the item structure ourselves
    const itemsJson = JSON.stringify([{
      text: invoice_item.toString(),
      qty: 1,
      price: `$${amount.toFixed(2)}`
    }]);

    // Calculate default due_on (next year) if not provided
    let defaultDueOn = null;
    if (!due_on) {
      defaultDueOn = moment().add(1, 'year').endOf('day').format('YYYY-MM-DD HH:mm:ss');
    }

    // Prepare invoice data
    const invoiceData = {
      client_id: client_id,
      description: description || '',
      comments: comments || 'created by Ai',
      license_id: license_id || null,
      due_on: due_on || defaultDueOn,
      items: itemsJson,
      discount: 0,
      amount: amount,
      total: total
    };

    // Create the invoice
    const invoiceResult = await createInvoice(invoiceData);

    if (invoiceResult.success) {
      res.json({
        success: true,
        message: 'Invoice created successfully',
        data: {
          client_id: client_id,
          client_email: email,
          invoice: invoiceResult.data,
          invoice_details: {
            description: invoiceData.description,
            comments: invoiceData.comments,
            license_id: invoiceData.license_id,
            due_on: invoiceData.due_on,
            items: JSON.parse(itemsJson),
            discount: 0,
            amount: amount,
            total: total
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: invoiceResult.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred while creating the invoice'
    });
  }
});

// Swap licenses
app.post('/api/swap-licenses', async (req, res) => {
  try {
    // Check if req.body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Required fields: old_ehwid, new_ehwid'
      });
    }

    const { old_ehwid, new_ehwid } = req.body;

    // Validate required fields
    if (!old_ehwid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: old_ehwid (Hardware ID of the source license)'
      });
    }

    if (!new_ehwid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: new_ehwid (Hardware ID of the destination license)'
      });
    }

    // Validate EHWID formats
    if (!isEHWID(old_ehwid)) {
      return res.status(400).json({
        success: false,
        error: `Invalid old_ehwid format: ${old_ehwid}. Expected format: XXXXX-XXXXX-XXXXX-XXXXX (e.g., Q46I5-BEAAO-RQA4R-EBQDT)`
      });
    }

    if (!isEHWID(new_ehwid)) {
      return res.status(400).json({
        success: false,
        error: `Invalid new_ehwid format: ${new_ehwid}. Expected format: XXXXX-XXXXX-XXXXX-XXXXX (e.g., Q46I5-BEAAO-RQA4R-EBQDT)`
      });
    }

    // Swap the licenses
    const swapResult = await swapLicenses(old_ehwid, new_ehwid);

    if (swapResult.success) {
      res.json({
        success: true,
        message: 'Licenses swapped successfully',
        data: swapResult.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: swapResult.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred while swapping licenses'
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
  console.log(`Create invoice: POST http://localhost:${PORT}/api/create-invoice`);
  console.log(`Swap licenses: POST http://localhost:${PORT}/api/swap-licenses`);
});