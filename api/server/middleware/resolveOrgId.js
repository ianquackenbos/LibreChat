const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { Membership, User } = require('~/db/models');

/**
 * Middleware to resolve organization ID from cookie or user's defaultOrgId
 * Verifies membership and attaches req.orgId to the request
 */
const resolveOrgId = async (req, res, next) => {
  try {
    // Skip if user is not authenticated
    if (!req.user || !req.user.id) {
      req.orgId = null;
      return next();
    }

    const userId = req.user.id;
    let orgId = null;

    // 1. Try to get orgId from cookie (orgId cookie)
    const cookieOrgId = req.cookies?.orgId;
    if (cookieOrgId) {
      // Verify user has membership in this org
      try {
        const membership = await Membership.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          organizationId: new mongoose.Types.ObjectId(cookieOrgId),
        }).lean();

        if (membership) {
          orgId = cookieOrgId;
        } else {
          // Invalid orgId in cookie, clear it
          res.clearCookie('orgId');
        }
      } catch (err) {
        // Invalid ObjectId format, clear cookie
        res.clearCookie('orgId');
      }
    }

    // 2. If no orgId from cookie, use user's defaultOrgId
    if (!orgId && req.user.defaultOrgId) {
      // Verify user has membership in default org
      const membership = await Membership.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        organizationId: req.user.defaultOrgId,
      }).lean();

      if (membership) {
        orgId = req.user.defaultOrgId;
        // Set cookie for future requests
        res.cookie('orgId', orgId.toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }
    }

    // 3. If still no orgId, try to find user's first organization
    if (!orgId) {
      const membership = await Membership.findOne({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .sort({ createdAt: 1 })
        .lean();

      if (membership) {
        orgId = membership.organizationId;
        // Set as default and cookie
        await User.findByIdAndUpdate(userId, {
          defaultOrgId: orgId,
        });
        res.cookie('orgId', orgId.toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }
    }

    // Attach orgId to request (convert to string if ObjectId)
    req.orgId = orgId
      ? orgId instanceof mongoose.Types.ObjectId
        ? orgId.toString()
        : orgId
      : null;

    next();
  } catch (error) {
    logger.error('[resolveOrgId] Error resolving organization ID:', error);
    req.orgId = null;
    next();
  }
};

module.exports = resolveOrgId;
