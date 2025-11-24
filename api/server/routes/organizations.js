const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth, resolveOrgId } = require('~/server/middleware');
const { Organization, Membership, OrganizationInvite, User } = require('~/db/models');
const { getRandomValues } = require('@librechat/api');
const { hashToken } = require('@librechat/data-schemas');
const { sendEmail } = require('~/server/utils');
const ssoRouter = require('./organizations/sso');

const router = express.Router();

// Initialize WorkOS client for admin portal endpoint
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

// Mount SSO routes
router.use('/sso', ssoRouter);

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

/**
 * GET /api/organizations
 * Get all organizations user is a member of
 */
router.get('/', requireJwtAuth, resolveOrgId, async (req, res) => {
  try {
    const userId = req.user.id;
    const memberships = await Membership.find({ userId: new mongoose.Types.ObjectId(userId) })
      .populate('organizationId', 'name slug createdAt updatedAt')
      .sort({ createdAt: 1 })
      .lean();

    const organizations = memberships.map((m) => ({
      id: m.organizationId._id,
      name: m.organizationId.name,
      slug: m.organizationId.slug,
      role: m.role,
      createdAt: m.organizationId.createdAt,
      updatedAt: m.organizationId.updatedAt,
    }));

    res.json(organizations);
  } catch (error) {
    logger.error('[/organizations] Error getting organizations:', error);
    res.status(500).json({ error: 'Error getting organizations' });
  }
});

/**
 * GET /api/organizations/current
 * Get the current user's active organization
 */
router.get('/current', requireJwtAuth, resolveOrgId, async (req, res) => {
  try {
    if (!req.orgId) {
      return res.json(null);
    }

    const organization = await Organization.findById(req.orgId).lean();
    if (!organization) {
      return res.json(null);
    }

    res.json({
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
      ssoConnectionId: organization.ssoConnectionId,
      verifiedDomains: organization.verifiedDomains || [],
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    });
  } catch (error) {
    logger.error('[/organizations/current] Error getting current organization:', error);
    res.status(500).json({ error: 'Error getting current organization' });
  }
});

/**
 * POST /api/organizations
 * Create a new organization
 */
router.post('/', requireJwtAuth, async (req, res) => {
  try {
    const { name, members } = req.body;
    const userId = req.user.id;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    // Create organization
    const organization = await Organization.create({
      name: name.trim(),
      ownerId: new mongoose.Types.ObjectId(userId),
    });

    // Create membership for owner
    await Membership.create({
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: organization._id,
      role: 'owner',
    });

    // Update user's defaultOrgId if not set
    if (!req.user.defaultOrgId) {
      await User.findByIdAndUpdate(userId, {
        defaultOrgId: organization._id,
      });
    }

    // Handle member invites (optional)
    if (Array.isArray(members) && members.length > 0) {
      const validMembers = members.filter((m) => m.email && m.email.trim() !== '');

      // Check if email service is configured
      const hasEmailService =
        (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) ||
        ((process.env.EMAIL_SERVICE || process.env.EMAIL_HOST) &&
          process.env.EMAIL_USERNAME &&
          process.env.EMAIL_PASSWORD &&
          process.env.EMAIL_FROM);

      if (!hasEmailService) {
        logger.warn('Email service not configured. Member invitations will be skipped.');
      }

      for (const member of validMembers) {
        try {
          if (!hasEmailService) {
            logger.warn(`Skipping invite for ${member.email} - email service not configured`);
            continue;
          }

          const token = await getRandomValues(32);
          const hash = await hashToken(token);
          const encodedToken = encodeURIComponent(token);

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

          const invite = await OrganizationInvite.create({
            email: member.email.trim(),
            organizationId: organization._id,
            inviterId: new mongoose.Types.ObjectId(userId),
            role: member.role || 'member',
            token: hash,
            expiresAt,
          });

          const inviteLink = `${process.env.DOMAIN_CLIENT || 'http://localhost:3080'}/register?token=${encodedToken}&organization=${organization._id}`;

          // Send invitation email
          await sendEmail({
            email: member.email.trim(),
            subject: `Invitation to join ${name}`,
            payload: {
              appName: process.env.APP_TITLE || 'LibreChat',
              inviteLink,
              organizationName: name,
              role: member.role || 'member',
              year: new Date().getFullYear(),
            },
            template: 'inviteUser.handlebars',
            throwError: false,
          });
        } catch (error) {
          logger.error(`Error inviting member ${member.email}:`, error);
        }
      }
    }

    res.json({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        ssoConnectionId: organization.ssoConnectionId,
        verifiedDomains: organization.verifiedDomains || [],
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    logger.error('[/organizations] Error creating organization:', error);
    res.status(500).json({ error: 'Error creating organization: ' + error.message });
  }
});

/**
 * PUT /api/organizations/:id
 * Update an organization
 */
router.put('/:id', requireJwtAuth, resolveOrgId, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ssoConnectionId, verifiedDomains } = req.body;
    const userId = req.user.id;

    const { hasAccess, membership } = await verifyOrgAccess(userId, id, 'admin');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Organization name is required' });
      }
      updateData.name = name.trim();
    }

    if (ssoConnectionId !== undefined) {
      updateData.ssoConnectionId = ssoConnectionId || null;
    }

    if (verifiedDomains !== undefined) {
      if (Array.isArray(verifiedDomains)) {
        // Validate domains
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        const validDomains = verifiedDomains.filter((domain) => {
          const trimmed = domain.trim().toLowerCase();
          return trimmed && domainRegex.test(trimmed);
        });
        updateData.verifiedDomains = validDomains;
      } else {
        return res.status(400).json({ error: 'verifiedDomains must be an array' });
      }
    }

    const organization = await Organization.findByIdAndUpdate(id, updateData, { new: true }).lean();

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        ssoConnectionId: organization.ssoConnectionId,
        verifiedDomains: organization.verifiedDomains || [],
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    logger.error('[/organizations/:id] Error updating organization:', error);
    res.status(500).json({ error: 'Error updating organization' });
  }
});

/**
 * DELETE /api/organizations/:id
 * Delete an organization (owner only)
 */
router.delete('/:id', requireJwtAuth, resolveOrgId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { hasAccess, membership } = await verifyOrgAccess(userId, id, 'owner');
    if (!hasAccess || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only organization owner can delete organization' });
    }

    // Delete organization, memberships, and invites
    await Promise.all([
      Organization.findByIdAndDelete(id),
      Membership.deleteMany({ organizationId: id }),
      OrganizationInvite.deleteMany({ organizationId: id }),
    ]);

    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    logger.error('[/organizations/:id] Error deleting organization:', error);
    res.status(500).json({ error: 'Error deleting organization' });
  }
});

/**
 * POST /api/organizations/:id/invites
 * Create an invite for an organization
 */
router.post('/:id/invites', requireJwtAuth, resolveOrgId, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role = 'member' } = req.body;
    const userId = req.user.id;

    const { hasAccess } = await verifyOrgAccess(userId, id, 'admin');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Check if user already has membership (find by email)
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() }).lean();
    if (existingUser) {
      const existingMembership = await Membership.findOne({
        userId: existingUser._id,
        organizationId: new mongoose.Types.ObjectId(id),
      }).lean();

      if (existingMembership) {
        return res.status(400).json({ error: 'User is already a member of this organization' });
      }
    }

    // Check if invite already exists and is not expired
    const existingInvite = await OrganizationInvite.findOne({
      email: email.trim(),
      organizationId: id,
      expiresAt: { $gt: new Date() },
      acceptedAt: null,
    }).lean();

    if (existingInvite) {
      return res.status(400).json({ error: 'Invite already exists for this email' });
    }

    const token = await getRandomValues(32);
    const hash = await hashToken(token);
    const encodedToken = encodeURIComponent(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invite = await OrganizationInvite.create({
      email: email.trim(),
      organizationId: new mongoose.Types.ObjectId(id),
      inviterId: new mongoose.Types.ObjectId(userId),
      role: role === 'admin' ? 'admin' : 'member',
      token: hash,
      expiresAt,
    });

    // Send invitation email if email service is configured
    const hasEmailService =
      (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) ||
      ((process.env.EMAIL_SERVICE || process.env.EMAIL_HOST) &&
        process.env.EMAIL_USERNAME &&
        process.env.EMAIL_PASSWORD &&
        process.env.EMAIL_FROM);

    if (hasEmailService) {
      const organization = await Organization.findById(id).lean();
      const inviteLink = `${process.env.DOMAIN_CLIENT || 'http://localhost:3080'}/register?token=${encodedToken}&organization=${id}`;

      await sendEmail({
        email: email.trim(),
        subject: `Invitation to join ${organization.name}`,
        payload: {
          appName: process.env.APP_TITLE || 'LibreChat',
          inviteLink,
          organizationName: organization.name,
          role: role,
          year: new Date().getFullYear(),
        },
        template: 'inviteUser.handlebars',
        throwError: false,
      });
    }

    res.json({
      invite: {
        id: invite._id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    logger.error('[/organizations/:id/invites] Error creating invite:', error);
    res.status(500).json({ error: 'Error creating invite' });
  }
});

/**
 * POST /api/organizations/invites/accept
 * Accept an organization invite
 */
router.post('/invites/accept', requireJwtAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decodedToken = decodeURIComponent(token);
    const hash = await hashToken(decodedToken);

    const invite = await OrganizationInvite.findOne({
      token: hash,
      expiresAt: { $gt: new Date() },
      acceptedAt: null,
    }).lean();

    if (!invite) {
      return res.status(404).json({ error: 'Invalid or expired invite' });
    }

    // Check if user already has membership
    const existingMembership = await Membership.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: invite.organizationId,
    }).lean();

    if (existingMembership) {
      // Mark invite as accepted even if membership exists
      await OrganizationInvite.findByIdAndUpdate(invite._id, {
        acceptedAt: new Date(),
      });
      return res.json({ message: 'Already a member of this organization' });
    }

    // Create membership
    await Membership.create({
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: invite.organizationId,
      role: invite.role,
    });

    // Update user's defaultOrgId if not set
    if (!req.user.defaultOrgId) {
      await User.findByIdAndUpdate(userId, {
        defaultOrgId: invite.organizationId,
      });
    }

    // Mark invite as accepted
    await OrganizationInvite.findByIdAndUpdate(invite._id, {
      acceptedAt: new Date(),
    });

    const organization = await Organization.findById(invite.organizationId).lean();

    res.json({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    logger.error('[/organizations/invites/accept] Error accepting invite:', error);
    res.status(500).json({ error: 'Error accepting invite' });
  }
});

/**
 * POST /api/organizations/:id/switch
 * Switch active organization (sets cookie)
 */
router.post('/:id/switch', requireJwtAuth, resolveOrgId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { hasAccess } = await verifyOrgAccess(userId, id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Set cookie
    res.cookie('orgId', id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Optionally update user's defaultOrgId
    await User.findByIdAndUpdate(userId, {
      defaultOrgId: id,
    });

    const organization = await Organization.findById(id).lean();

    res.json({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        ssoConnectionId: organization.ssoConnectionId,
        verifiedDomains: organization.verifiedDomains || [],
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    logger.error('[/organizations/:id/switch] Error switching organization:', error);
    res.status(500).json({ error: 'Error switching organization' });
  }
});

module.exports = router;
