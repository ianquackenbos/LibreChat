const mongoose = require('mongoose');

/**
 * Adds orgId to a filter if orgId is provided
 * @param {Object} filter - The filter object to add orgId to
 * @param {string|ObjectId|null} orgId - The organization ID to add
 * @returns {Object} The filter with orgId added if provided
 */
const addOrgScope = (filter, orgId) => {
  if (!orgId) {
    return filter;
  }

  const orgIdObj = typeof orgId === 'string' ? new mongoose.Types.ObjectId(orgId) : orgId;
  return {
    ...filter,
    orgId: orgIdObj,
  };
};

/**
 * Adds orgId to update operation if orgId is provided
 * @param {Object} update - The update object
 * @param {string|ObjectId|null} orgId - The organization ID to add
 * @returns {Object} The update with orgId added if provided
 */
const addOrgScopeToUpdate = (update, orgId) => {
  if (!orgId) {
    return update;
  }

  const orgIdObj = typeof orgId === 'string' ? new mongoose.Types.ObjectId(orgId) : orgId;
  return {
    ...update,
    orgId: orgIdObj,
  };
};

module.exports = {
  addOrgScope,
  addOrgScopeToUpdate,
};

