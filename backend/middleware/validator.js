const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/** Return validation errors or call next */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

/** Validate that a param is a valid MongoDB ObjectId */
function validateObjectId(paramName = 'id') {
  return [
    param(paramName).custom((val) => {
      if (!mongoose.Types.ObjectId.isValid(val)) throw new Error('Invalid ID format');
      return true;
    }),
    handleValidation,
  ];
}

/** Password strength validator */
const passwordRules = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain a number')
  .matches(/[!@#$%^&*(),.?":{}|<>]/)
  .withMessage('Password must contain a special character');

/** Email validator */
const emailRules = body('email').isEmail().withMessage('Invalid email format').normalizeEmail();

/** Registration validators */
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  emailRules,
  passwordRules,
  handleValidation,
];

/** Login validators */
const loginValidation = [
  emailRules,
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation,
];

/** Contact creation validator */
const contactValidation = [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{6,14}$/)
    .withMessage('Invalid phone number format'),
  body('name').optional().trim().isLength({ max: 100 }),
  body('email').optional().isEmail().withMessage('Invalid email'),
  handleValidation,
];

/** Campaign creation validator */
const campaignValidation = [
  body('name').trim().notEmpty().withMessage('Campaign name is required'),
  body('templateName').notEmpty().withMessage('Template is required'),
  handleValidation,
];

/** Flow creation validator */
const flowValidation = [
  body('name').trim().notEmpty().withMessage('Flow name is required'),
  body('nodes').isArray({ min: 1 }).withMessage('At least one node is required'),
  handleValidation,
];

module.exports = {
  handleValidation,
  validateObjectId,
  registerValidation,
  loginValidation,
  contactValidation,
  campaignValidation,
  flowValidation,
  passwordRules,
  emailRules,
};
