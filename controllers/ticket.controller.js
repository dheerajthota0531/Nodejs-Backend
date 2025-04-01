/**
 * Ticket Controller
 * @module ticket.controller
 */
const ticketModel = require('../models/ticket.model');
const userModel = require('../models/user.model');
const fs = require('fs');
const path = require('path');
const { validateRequired, outputEscaping, formatResponse } = require('../helpers/functions');
const config = require('../config/config');

// Status constants (matching PHP implementation)
const PENDING = 1;
const OPENED = 2;
const RESOLVED = 3;
const CLOSED = 4;
const REOPENED = 5;

/**
 * Get ticket types
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTicketTypesController(req, res) {
  try {
    // Verify token (optional in development mode)
    // Implementation depends on your authentication middleware

    const result = await ticketModel.getTicketTypes();
    return res.json(result);
  } catch (error) {
    console.error('Error in getTicketTypesController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Something went wrong!',
      data: []
    });
  }
}

/**
 * Add a new ticket
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function addTicketController(req, res) {
  try {
    // Verify token (optional in development mode)
    // Implementation depends on your authentication middleware

    // Validate required fields
    const requiredFields = ['ticket_type_id', 'user_id', 'subject', 'email', 'description'];
    const missingFields = validateRequired(req.body, requiredFields);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: true,
        message: `${missingFields.join(', ')} is required!`,
        data: []
      });
    }
    
    // Verify user exists
    const userId = req.body.user_id;
    const user = await userModel.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found!',
        data: []
      });
    }
    
    // Prepare ticket data
    const ticketData = {
      ticket_type_id: req.body.ticket_type_id,
      user_id: req.body.user_id,
      subject: req.body.subject,
      email: req.body.email,
      description: req.body.description,
      status: PENDING
    };
    
    // Add ticket
    const result = await ticketModel.addTicket(ticketData);
    
    return res.json(result);
  } catch (error) {
    console.error('Error in addTicketController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Something went wrong!',
      data: []
    });
  }
}

/**
 * Edit an existing ticket
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function editTicketController(req, res) {
  try {
    // Verify token (optional in development mode)
    // Implementation depends on your authentication middleware

    // Validate required fields
    const requiredFields = ['ticket_id', 'ticket_type_id', 'user_id', 'subject', 'email', 'description', 'status'];
    const missingFields = validateRequired(req.body, requiredFields);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: true,
        message: `${missingFields.join(', ')} is required!`,
        data: []
      });
    }
    
    // Verify user exists
    const userId = req.body.user_id;
    const user = await userModel.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found!',
        data: []
      });
    }
    
    // Verify ticket exists and belongs to user
    const ticketId = req.body.ticket_id;
    const ticketResult = await ticketModel.getTickets(ticketId, '', userId);
    
    if (ticketResult.error || !ticketResult.data || ticketResult.data.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'User id is changed you can not update the ticket.',
        data: []
      });
    }
    
    const ticket = ticketResult.data[0];
    const status = parseInt(req.body.status);
    
    // Validate status transitions
    if (status === RESOLVED && parseInt(ticket.status) === CLOSED) {
      return res.status(400).json({
        error: true,
        message: 'Current status is closed.',
        data: []
      });
    }
    
    if (status === REOPENED && (parseInt(ticket.status) === PENDING || parseInt(ticket.status) === OPENED)) {
      return res.status(400).json({
        error: true,
        message: 'Current status is pending or opened.',
        data: []
      });
    }
    
    // Prepare ticket data for update
    const ticketData = {
      ticket_type_id: req.body.ticket_type_id,
      user_id: req.body.user_id,
      subject: req.body.subject,
      email: req.body.email,
      description: req.body.description,
      status: status,
      edit_ticket: ticketId
    };
    
    // Update ticket
    const result = await ticketModel.addTicket(ticketData);
    
    if (!result.error) {
      return res.json({
        error: false,
        message: 'Ticket updated Successfully',
        data: result.data
      });
    } else {
      return res.status(400).json({
        error: true,
        message: 'Ticket Not Updated',
        data: []
      });
    }
  } catch (error) {
    console.error('Error in editTicketController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Something went wrong!',
      data: []
    });
  }
}

/**
 * Controller to handle sending a message for a ticket
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendMessageController(req, res) {
  try {
    // Validate required fields
    const requiredFields = ['user_id', 'ticket_id'];
    const missingFields = validateRequired(req.body, requiredFields);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: true,
        message: `Please provide ${missingFields.join(', ')}`,
        data: []
      });
    }
    
    const userId = req.body.user_id;
    const ticketId = req.body.ticket_id;
    const message = req.body.message || '';
    
    // Validate user exists
    const user = await userModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User not found!",
        data: []
      });
    }
    
    // Prepare message data
    const messageData = {
      user_type: 'user',
      user_id: userId,
      ticket_id: ticketId,
      message: message
    };
    
    // Handle attachments
    const attachments = [];
    if (req.files && req.files.attachments) {
      try {
        // Create directory if not exists
        const ticketImgPath = path.join(__dirname, '../public/uploads/tickets');
        if (!fs.existsSync(ticketImgPath)) {
          fs.mkdirSync(ticketImgPath, { recursive: true });
        }
        
        // Handle single file or array of files
        const files = Array.isArray(req.files.attachments) ? req.files.attachments : [req.files.attachments];
        console.log(`Processing ${files.length} attachment(s)`);
        
        // Get allowed media types
        const allowedTypes = ticketModel.getAllowedMediaTypes();
        const maxFileSize = 8 * 1024 * 1024; // 8MB
        
        // Process each file sequentially
        for (const file of files) {
          // Validate file size
          if (file.size > maxFileSize) {
            return res.status(400).json({
              error: true,
              message: `File ${file.name} exceeds maximum size of 8MB`,
              data: []
            });
          }
          
          // Validate file type
          if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({
              error: true,
              message: `Invalid file type for ${file.name}. Allowed types: image, video, document, spreadsheet, archive`,
              data: []
            });
          }
          
          // Generate unique filename
          const timestamp = Date.now();
          const ext = path.extname(file.name);
          const filename = `ticket_${ticketId}_${userId}_${timestamp}${ext}`;
          const filepath = path.join(ticketImgPath, filename);
          
          // Save file using promise
          await new Promise((resolve, reject) => {
            file.mv(filepath, (err) => {
              if (err) {
                console.error('File upload error:', err);
                reject(err);
              } else {
                console.log(`File uploaded successfully: ${filename}`);
                resolve();
              }
            });
          });
          
          // Add to attachments array
          attachments.push(`uploads/tickets/${filename}`);
        }
        
        console.log(`Successfully processed ${attachments.length} attachment(s)`);
      } catch (fileError) {
        console.error('File upload error:', fileError);
        return res.status(500).json({
          error: true,
          message: "File upload failed. Please try again with smaller files or different file types.",
          data: []
        });
      }
    }
    
    // Add attachments to message data
    if (attachments.length > 0) {
      messageData.attachments = attachments;
    }
    
    // Add message
    const insertId = await ticketModel.addTicketMessage(messageData);
    
    if (insertId) {
      return res.json({
        error: false,
        message: "Message sent successfully",
        data: {
          id: insertId
        }
      });
    } else {
      return res.status(500).json({
        error: true,
        message: "Failed to send message",
        data: []
      });
    }
  } catch (error) {
    console.error('Error in sendMessageController:', error);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      data: []
    });
  }
}

/**
 * Controller for getting tickets
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTicketsController(req, res) {
  try {
    // Parse and validate request parameters
    const ticketId = req.body.ticket_id ? String(req.body.ticket_id) : "";
    const ticketTypeId = req.body.ticket_type_id ? String(req.body.ticket_type_id) : "";
    const userId = req.body.user_id ? String(req.body.user_id) : "";
    const status = req.body.status ? String(req.body.status) : "";
    const search = req.body.search || "";
    const limit = req.body.limit ? parseInt(req.body.limit) : 10;
    const offset = req.body.offset ? parseInt(req.body.offset) : 0;
    const sort = req.body.sort || "id";
    const order = req.body.order || "DESC";
    
    // Fetch tickets
    const result = await ticketModel.getTickets(
      ticketId, ticketTypeId, userId, status, 
      search, offset, limit, sort, order
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error in getTicketsController:', error);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      total: "0",
      data: []
    });
  }
}

/**
 * Controller for getting messages for a ticket
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getMessagesController(req, res) {
  try {
    // Parse and validate request parameters
    const ticketId = req.body.ticket_id ? String(req.body.ticket_id) : "";
    const userId = req.body.user_id ? String(req.body.user_id) : "";
    const search = req.body.search || "";
    const limit = req.body.limit ? parseInt(req.body.limit) : 10;
    const offset = req.body.offset ? parseInt(req.body.offset) : 0;
    const sort = req.body.sort || "id";
    const order = req.body.order || "DESC";
    const msgId = req.body.msg_id ? String(req.body.msg_id) : "";
    
    // File type configuration for attachments
    const fileTypes = {
      image: { types: ['jpg', 'jpeg', 'png', 'gif'] },
      video: { types: ['mp4', 'avi', 'mov', 'flv'] },
      document: { types: ['pdf', 'doc', 'docx', 'txt'] },
      spreadsheet: { types: ['xls', 'xlsx', 'csv'] },
      archive: { types: ['zip', 'rar', '7z'] }
    };
    
    // Fetch messages
    const result = await ticketModel.getMessages(
      ticketId, userId, search, offset, limit, 
      sort, order, fileTypes, msgId
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Error in getMessagesController:', error);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
      total: "0",
      data: []
    });
  }
}

module.exports = {
  getTicketTypesController,
  addTicketController,
  editTicketController,
  sendMessageController,
  getTicketsController,
  getMessagesController
}; 