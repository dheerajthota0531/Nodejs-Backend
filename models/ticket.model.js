/**
 * Ticket model
 * @module ticket.model
 */
const db = require('../config/database');
const config = require('../config/config');
const { outputEscaping } = require('../helpers/functions');
const fs = require('fs');
const path = require('path');

/**
 * Get ticket types
 * @returns {Object} Ticket types data
 */
async function getTicketTypes() {
  try {
    const connection = await db.getConnection();
    const [rows] = await connection.query('SELECT * FROM ticket_types');
    connection.release();

    // Format results like PHP implementation
    const formattedRows = rows.map(row => outputEscaping(row));

    return {
      error: false,
      message: 'Ticket types fetched successfully',
      data: formattedRows
    };
  } catch (error) {
    console.error('Error in getTicketTypes:', error);
    return {
      error: true,
      message: error.message || 'Something went wrong while fetching ticket types',
      data: []
    };
  }
}

/**
 * Add a new ticket or edit existing ticket
 * @param {Object} data - Ticket data
 * @returns {Object} Result with ticket data
 */
async function addTicket(data) {
  try {
    const connection = await db.getConnection();
    let ticketId = null;
    
    // Check if we're editing an existing ticket or adding a new one
    if (data.edit_ticket) {
      // Update existing ticket
      const ticketData = {
        ticket_type_id: data.ticket_type_id,
        user_id: data.user_id,
        subject: data.subject,
        email: data.email,
        description: data.description,
        status: data.status || 1 // 1 = PENDING
      };
      
      await connection.query(
        'UPDATE tickets SET ? WHERE id = ?',
        [ticketData, data.edit_ticket]
      );
      
      ticketId = data.edit_ticket;
    } else if (data.edit_ticket_status) {
      // Update only status
      await connection.query(
        'UPDATE tickets SET status = ? WHERE id = ?',
        [data.status, data.edit_ticket_status]
      );
      
      ticketId = data.edit_ticket_status;
    } else {
      // Insert new ticket
      const ticketData = {
        ticket_type_id: data.ticket_type_id,
        user_id: data.user_id,
        subject: data.subject,
        email: data.email,
        description: data.description,
        status: data.status || 1 // 1 = PENDING
      };
      
      const [result] = await connection.query(
        'INSERT INTO tickets SET ?',
        [ticketData]
      );
      
      ticketId = result.insertId;
    }
    
    connection.release();
    
    if (ticketId) {
      // Get ticket details after insert/update
      return await getTickets(ticketId, data.ticket_type_id, data.user_id);
    } else {
      return {
        error: true,
        message: 'Failed to add ticket',
        data: []
      };
    }
  } catch (error) {
    console.error('Error in addTicket:', error);
    return {
      error: true,
      message: error.message || 'Something went wrong while adding ticket',
      data: []
    };
  }
}

/**
 * Add a message to a ticket
 * @param {Object} data - Message data
 * @returns {number|boolean} Message ID or false
 */
async function addTicketMessage(data) {
  try {
    const connection = await db.getConnection();
    
    const messageData = {
      user_type: data.user_type,
      user_id: data.user_id,
      ticket_id: data.ticket_id,
      message: data.message || ''
    };
    
    // Add attachments if provided
    if (data.attachments && data.attachments.length > 0) {
      messageData.attachments = JSON.stringify(data.attachments);
    }
    
    const [result] = await connection.query(
      'INSERT INTO ticket_messages SET ?',
      [messageData]
    );
    
    connection.release();
    return result.insertId || false;
  } catch (error) {
    console.error('Error in addTicketMessage:', error);
    return false;
  }
}

/**
 * Get tickets based on various filters
 * @param {number} ticketId - Ticket ID (optional)
 * @param {number} ticketTypeId - Ticket type ID (optional)
 * @param {number} userId - User ID (optional)
 * @param {number} status - Ticket status (optional)
 * @param {string} search - Search term (optional)
 * @param {number} offset - Pagination offset (optional)
 * @param {number} limit - Pagination limit (optional)
 * @param {string} sort - Sort field (optional)
 * @param {string} order - Sort order (optional)
 * @returns {Object} Tickets data
 */
async function getTickets(ticketId = "", ticketTypeId = "", userId = "", status = "", search = "", offset = 0, limit = 10, sort = "id", order = "DESC") {
  try {
    const connection = await db.getConnection();
    
    let sql = `
      SELECT t.*, tty.title, u.username
      FROM tickets t
      LEFT JOIN ticket_types tty ON tty.id = t.ticket_type_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE 1=1
    `;
    
    const values = [];
    
    // Add filters if provided
    if (ticketId) {
      sql += ' AND t.id = ?';
      values.push(ticketId);
    }
    
    if (ticketTypeId) {
      sql += ' AND t.ticket_type_id = ?';
      values.push(ticketTypeId);
    }
    
    if (userId) {
      sql += ' AND t.user_id = ?';
      values.push(userId);
    }
    
    if (status) {
      sql += ' AND t.status = ?';
      values.push(status);
    }
    
    // Handle search across multiple fields
    if (search) {
      sql += ` AND (u.id LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.mobile LIKE ? 
              OR t.subject LIKE ? OR t.email LIKE ? OR t.description LIKE ? OR tty.title LIKE ?)`;
      const searchParam = `%${search}%`;
      values.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    // Count total tickets for pagination
    const [countResult] = await connection.query(
      `SELECT COUNT(t.id) as total FROM tickets t 
       LEFT JOIN ticket_types tty ON tty.id = t.ticket_type_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE 1=1 ${sql.split('WHERE 1=1')[1]}`,
      values
    );
    
    const total = countResult[0].total || 0;
    
    // Ensure the sort field is prefixed with table name if needed
    let sortField = sort;
    if (sort === 'id' || sort === 'status' || sort === 'subject' || sort === 'email' || sort === 'description' || sort === 'last_updated' || sort === 'date_created') {
      sortField = `t.${sort}`;
    } else if (sort === 'title') {
      sortField = 'tty.title';
    } else if (sort === 'username') {
      sortField = 'u.username';
    }
    
    // Add order and limit clauses
    sql += ` ORDER BY ${sortField} ${order} LIMIT ?, ?`;
    values.push(parseInt(offset), parseInt(limit));
    
    // Execute the query
    const [rows] = await connection.query(sql, values);
    connection.release();
    
    // Format tickets like PHP implementation - all IDs and numeric values as strings
    const tickets = rows.map(row => {
      const processedRow = outputEscaping(row);
      return {
        id: String(processedRow.id || ''),
        ticket_type_id: String(processedRow.ticket_type_id || ''),
        user_id: String(processedRow.user_id || ''),
        subject: processedRow.subject || '',
        email: processedRow.email || '',
        description: processedRow.description || '',
        status: String(processedRow.status || ''),
        last_updated: processedRow.last_updated || '',
        date_created: processedRow.date_created || '',
        name: processedRow.username || '',
        ticket_type: processedRow.title || ''
      };
    });
    
    return {
      error: tickets.length === 0,
      message: tickets.length === 0 ? 'Ticket(s) does not exist' : 'Tickets retrieved successfully',
      total: String(total), // Convert total to string to match PHP behavior
      data: tickets
    };
  } catch (error) {
    console.error('Error in getTickets:', error);
    return {
      error: true,
      message: error.message || 'Something went wrong while fetching tickets',
      total: "0", // Return as string to match PHP behavior
      data: []
    };
  }
}

/**
 * Get messages for a ticket
 * @param {number} ticketId - Ticket ID (optional)
 * @param {number} userId - User ID (optional)
 * @param {string} search - Search term (optional)
 * @param {number} offset - Pagination offset (optional)
 * @param {number} limit - Pagination limit (optional)
 * @param {string} sort - Sort field (optional)
 * @param {string} order - Sort order (optional)
 * @param {Object} fileTypes - File type configuration (optional)
 * @param {number} msgId - Message ID (optional)
 * @returns {Object} Messages data
 */
async function getMessages(ticketId = "", userId = "", search = "", offset = 0, limit = 10, sort = "id", order = "DESC", fileTypes = {}, msgId = "") {
  try {
    const connection = await db.getConnection();
    
    let sql = `
      SELECT tm.*, t.subject, u.username
      FROM ticket_messages tm
      LEFT JOIN tickets t ON t.id = tm.ticket_id
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE 1=1
    `;
    
    const values = [];
    
    // Add filters if provided
    if (ticketId) {
      sql += ' AND tm.ticket_id = ?';
      values.push(ticketId);
    }
    
    if (userId) {
      sql += ' AND tm.user_id = ?';
      values.push(userId);
    }
    
    if (msgId) {
      sql += ' AND tm.id = ?';
      values.push(msgId);
    }
    
    // Handle search across multiple fields
    if (search) {
      sql += ` AND (u.id LIKE ? OR u.username LIKE ? OR t.subject LIKE ? OR tm.message LIKE ?)`;
      const searchParam = `%${search}%`;
      values.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    // Count total messages for pagination
    const [countResult] = await connection.query(
      `SELECT COUNT(tm.id) as total FROM ticket_messages tm 
       LEFT JOIN tickets t ON t.id = tm.ticket_id
       LEFT JOIN users u ON u.id = tm.user_id
       WHERE 1=1 ${sql.split('WHERE 1=1')[1]}`,
      values
    );
    
    const total = countResult[0].total || 0;
    
    // Ensure the sort field is prefixed with table name if needed
    let sortField = sort;
    if (sort === 'id' || sort === 'user_type' || sort === 'user_id' || sort === 'ticket_id' || sort === 'message' || sort === 'attachments' || sort === 'last_updated' || sort === 'date_created') {
      sortField = `tm.${sort}`;
    } else if (sort === 'subject') {
      sortField = 't.subject';
    } else if (sort === 'username') {
      sortField = 'u.username';
    }
    
    // Add order and limit clauses
    sql += ` ORDER BY ${sortField} ${order} LIMIT ?, ?`;
    values.push(parseInt(offset), parseInt(limit));
    
    // Execute the query
    const [rows] = await connection.query(sql, values);
    connection.release();
    
    // Format messages like PHP implementation - all IDs and numeric values as strings
    const messages = rows.map(row => {
      const processedRow = outputEscaping(row);
      const messageObj = {
        id: String(processedRow.id || ''),
        user_type: processedRow.user_type || '',
        user_id: String(processedRow.user_id || ''),
        ticket_id: String(processedRow.ticket_id || ''),
        message: processedRow.message || '',
        name: processedRow.username || '',
        subject: processedRow.subject || '',
        last_updated: processedRow.last_updated || '',
        date_created: processedRow.date_created || '',
        attachments: []
      };
      
      // Process attachments if any
      if (processedRow.attachments) {
        try {
          const attachmentsArr = JSON.parse(processedRow.attachments);
          if (Array.isArray(attachmentsArr)) {
            messageObj.attachments = attachmentsArr.map(attachmentPath => {
              const file = path.basename(attachmentPath);
              const ext = path.extname(file).substring(1).toLowerCase();
              
              let type = 'other';
              if (fileTypes && fileTypes.image && fileTypes.image.types && fileTypes.image.types.includes(ext)) {
                type = 'image';
              } else if (fileTypes && fileTypes.video && fileTypes.video.types && fileTypes.video.types.includes(ext)) {
                type = 'video';
              } else if (fileTypes && fileTypes.document && fileTypes.document.types && fileTypes.document.types.includes(ext)) {
                type = 'document';
              } else if (fileTypes && fileTypes.archive && fileTypes.archive.types && fileTypes.archive.types.includes(ext)) {
                type = 'archive';
              }
              
              return {
                media: getImageUrl(attachmentPath),
                type: type
              };
            });
          }
        } catch (e) {
          console.error('Error parsing attachments:', e);
        }
      }
      
      return messageObj;
    });
    
    return {
      error: messages.length === 0,
      message: messages.length === 0 ? 'Ticket Message(s) does not exist' : 'Message retrieved successfully',
      total: String(total), // Convert total to string to match PHP behavior
      data: messages
    };
  } catch (error) {
    console.error('Error in getMessages:', error);
    return {
      error: true,
      message: error.message || 'Something went wrong while fetching messages',
      total: "0", // Return as string to match PHP behavior
      data: []
    };
  }
}

/**
 * Delete a ticket and its messages
 * @param {number} ticketId - Ticket ID
 * @returns {boolean} Success or failure
 */
async function deleteTicket(ticketId) {
  try {
    const connection = await db.getConnection();
    
    // Begin transaction to ensure both operations succeed or fail together
    await connection.beginTransaction();
    
    try {
      // Delete ticket messages first (foreign key constraint)
      await connection.query('DELETE FROM ticket_messages WHERE ticket_id = ?', [ticketId]);
      
      // Delete the ticket
      const [result] = await connection.query('DELETE FROM tickets WHERE id = ?', [ticketId]);
      
      // Commit transaction
      await connection.commit();
      
      connection.release();
      return result.affectedRows > 0;
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteTicket:', error);
    return false;
  }
}

/**
 * Helper function to get image URL
 * @param {string} imagePath - Image path
 * @returns {string} Full image URL
 */
function getImageUrl(imagePath) {
  if (!imagePath) return '';
  
  // If already a URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Construct full URL from base URL and image path
  const baseUrl = config.baseUrl || 'http://localhost:3000';
  const normalizePath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
  return `${baseUrl}/${normalizePath}`;
}

/**
 * Get allowed media types for ticket attachments
 * @returns {Array} Array of allowed mime types
 */
function getAllowedMediaTypes() {
  return [
    'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
    'application/zip', 'application/x-rar-compressed'
  ];
}

module.exports = {
  getTicketTypes,
  addTicket,
  addTicketMessage,
  getTickets,
  getMessages,
  deleteTicket,
  getImageUrl,
  getAllowedMediaTypes
}; 