const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth, resolveOrgId } = require('~/server/middleware');
const { Organization, Membership, User } = require('~/db/models');
const { findUser, createUser, generateToken } = require('~/models');
const { setAuthTokens } = require('~/server/services/AuthService');

const router = express.Router();

/**
 * Helper to verify user has access to organization
 */
const verifyOrgAccess = async (userId, organizationId, requiredRole = null) => {
  const membership = await Membership.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(organizationId),
  }).lean();

  if (!membership) {
    return { hasAccess: false, membership: null };
  }

  if (requiredRole) {
    const roleHierarchy = { member: 1, admin: 2, owner: 3 };
    const userRoleLevel = roleHierarchy[membership.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
    return {
      hasAccess: userRoleLevel >= requiredRoleLevel,
      membership,
    };
  }

  return { hasAccess: true, membership };
};

// Initialize WorkOS client
let WorkOS;
let workosClient;
try {
  WorkOS = require('@workos/node').default;
  if (process.env.WORKOS_API_KEY) {
    workosClient = new WorkOS(process.env.WORKOS_API_KEY);
  }
} catch (error) {
  logger.warn('WorkOS SDK not installed. SSO features will be disabled.');
}

/**
 * GET /api/organizations/sso/:id/start
 * Start SSO authentication flow for an organization
 */
router.get('/:id/start', async (req, res) => {
  try {
    if (!workosClient) {
      return res.status(503).json({ error: 'SSO is not configured' });
    }

    const { id } = req.params;
    const organization = await Organization.findById(id).lean();

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!organization.ssoConnectionId) {
      return res.status(400).json({ error: 'SSO is not configured for this organization' });
    }

    const redirectUri = `${process.env.DOMAIN_SERVER || 'http://localhost:3080'}/api/organizations/sso/callback`;
    const state = Buffer.from(JSON.stringify({ organizationId: id })).toString('base64');

    const authorizationUrl = workosClient.userManagement.getAuthorizationUrl({
      provider: 'saml',
      clientId: process.env.WORKOS_CLIENT_ID,
      redirectUri,
      state,
      connection: organization.ssoConnectionId,
    });

    res.redirect(authorizationUrl);
  } catch (error) {
    logger.error('[/organizations/:id/sso/start] Error starting SSO:', error);
    res.status(500).json({ error: 'Error starting SSO authentication' });
  }
});

/**
 * GET /api/organizations/sso/callback
 * Handle SSO callback from WorkOS
 */
router.get('/callback', async (req, res) => {
  try {
    if (!workosClient) {
      return res.status(503).json({ error: 'SSO is not configured' });
    }

    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Decode state to get organization ID
    let organizationId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      organizationId = stateData.organizationId;
    } catch (error) {
      logger.error('[/organizations/sso/callback] Error decoding state:', error);
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const organization = await Organization.findById(organizationId).lean();
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Exchange authorization code for user info
    const redirectUri = `${process.env.DOMAIN_SERVER || 'http://localhost:3080'}/api/organizations/sso/callback`;
    const { user: workosUser } = await workosClient.userManagement.authenticateWithCode({
      code,
      clientId: process.env.WORKOS_CLIENT_ID,
    });

    if (!workosUser || !workosUser.email) {
      return res.status(400).json({ error: 'Invalid user data from SSO provider' });
    }

    const email = workosUser.email.toLowerCase();
    const emailDomain = email.split('@')[1];

    // Verify domain if verifiedDomains is set
    if (organization.verifiedDomains && organization.verifiedDomains.length > 0) {
      const isDomainVerified = organization.verifiedDomains.some(
        (domain) => emailDomain === domain.toLowerCase(),
      );
      if (!isDomainVerified) {
        return res.status(403).json({
          error: `Email domain ${emailDomain} is not verified for this organization`,
        });
      }
    }

    // Find or create user
    let user = await findUser({ email });
    if (!user) {
      // Auto-create user if domain is verified
      const userData = {
        email,
        name: workosUser.firstName && workosUser.lastName
          ? `${workosUser.firstName} ${workosUser.lastName}`
          : workosUser.firstName || workosUser.lastName || email.split('@')[0],
        provider: 'workos',
        emailVerified: true,
        defaultOrgId: organizationId,
      };

      user = await createUser(userData);
      logger.info(`[SSO] Auto-created user ${email} for organization ${organizationId}`);
    } else if (user.provider !== 'workos' && user.provider !== 'saml') {
      // Allow existing users to login via SSO if they haven't set a password
      // or if they're using a compatible provider
      logger.info(`[SSO] Existing user ${email} logging in via SSO`);
    }

    // Ensure user has membership in organization
    const existingMembership = await Membership.findOne({
      userId: user._id,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    }).lean();

    if (!existingMembership) {
      // Create membership with default role 'member'
      await Membership.create({
        userId: user._id,
        organizationId: new mongoose.Types.ObjectId(organizationId),
        role: 'member',
      });
      logger.info(`[SSO] Created membership for ${email} in organization ${organizationId}`);
    }

    // Update user's defaultOrgId if not set
    if (!user.defaultOrgId) {
      await User.findByIdAndUpdate(user._id, {
        defaultOrgId: organizationId,
      });
    }

    // Generate JWT token for the user
    const token = await generateToken(user);

    // Set orgId cookie
    res.cookie('orgId', organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Set auth tokens (refresh token, etc.)
    await setAuthTokens(user._id, res);

    // Redirect to frontend with token
    const frontendUrl = process.env.DOMAIN_CLIENT || 'http://localhost:3080';
    res.redirect(`${frontendUrl}/login?token=${token}&orgId=${organizationId}`);
  } catch (error) {
    logger.error('[/organizations/sso/callback] Error handling SSO callback:', error);
    const frontendUrl = process.env.DOMAIN_CLIENT || 'http://localhost:3080';
    res.redirect(`${frontendUrl}/login?error=sso_failed`);
  }
});

/**
 * GET /api/organizations/sso/:id/admin-portal
 * Get WorkOS Admin Portal link for SSO configuration
 */
router.get('/:id/admin-portal', requireJwtAuth, resolveOrgId, async (req, res) => {
  try {
    if (!workosClient) {
      return res.status(503).json({ error: 'WorkOS is not configured' });
    }

    const { id } = req.params;
    const userId = req.user.id;

    const { hasAccess } = await verifyOrgAccess(userId, id, 'admin');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const organization = await Organization.findById(id).lean();
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!organization.ssoConnectionId) {
      return res.status(400).json({ error: 'SSO is not configured for this organization' });
    }

    // Generate admin portal link
    const { link } = await workosClient.userManagement.generateLink({
      type: 'sso',
      connection: organization.ssoConnectionId,
      intent: 'sso',
    });

    res.json({
      adminPortalLink: link,
    });
  } catch (error) {
    logger.error('[/organizations/sso/:id/admin-portal] Error generating admin portal link:', error);
    res.status(500).json({ error: 'Error generating admin portal link' });
  }
});

module.exports = router;

