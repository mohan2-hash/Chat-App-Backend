// Validation and API response helpers

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
};

const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

const sendError = (res, message = 'Internal Server Error', statusCode = 500, details = null) => {
    const response = {
        success: false,
        error: message
    };
    if (details) {
        response.details = details;
    }
    return res.status(statusCode).json(response);
};

module.exports = {
    isValidEmail,
    sendSuccess,
    sendError
};
