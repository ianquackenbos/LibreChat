import React, { useState, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { OGDialog, OGDialogTemplate, useToastContext, Input, Label } from '@librechat/client';
import { useLocalize } from '~/hooks';
import {
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useGetCurrentOrganizationQuery,
} from '~/data-provider/Organizations';
import { dataService } from 'librechat-data-provider';
import { X, Plus, ExternalLink } from 'lucide-react';
import { cn } from '~/utils';

interface MemberInvite {
  email: string;
  role: 'user' | 'administrator';
}

interface OrganizationFormData {
  name: string;
  members: MemberInvite[];
  ssoConnectionId: string;
  verifiedDomains: string[];
}

interface OrganizationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOrganizationCreated: () => void;
  currentOrganization?: string | null;
}

export default function OrganizationModal({
  isOpen,
  onOpenChange,
  onOrganizationCreated,
  currentOrganization,
}: OrganizationModalProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAdminPortal, setIsLoadingAdminPortal] = useState(false);
  const { data: orgData } = useGetCurrentOrganizationQuery({ enabled: !!currentOrganization });

  const isEditMode = !!currentOrganization && !!orgData;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    defaultValues: {
      name: '',
      members: [{ email: '', role: 'user' }],
      ssoConnectionId: '',
      verifiedDomains: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'members',
  });

  const { fields: domainFields, append: appendDomain, remove: removeDomain } = useFieldArray({
    control,
    name: 'verifiedDomains',
  });

  // Reset form when modal opens/closes or organization changes
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && orgData) {
        reset({
          name: orgData.name || '',
          members: [{ email: '', role: 'user' }],
          ssoConnectionId: orgData.ssoConnectionId || '',
          verifiedDomains: orgData.verifiedDomains || [],
        });
      } else {
        reset({
          name: '',
          members: [{ email: '', role: 'user' }],
          ssoConnectionId: '',
          verifiedDomains: [],
        });
      }
    }
  }, [isOpen, isEditMode, orgData, reset]);

  const createOrganizationMutation = useCreateOrganizationMutation({
    onSuccess: (data) => {
      showToast({
        message: localize('com_ui_organization_created') || 'Organization created successfully',
        status: 'success',
      });
      onOrganizationCreated();
      reset();
      setIsSubmitting(false);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        localize('com_ui_error_creating_organization') ||
        'Error creating organization';
      showToast({
        message: errorMessage,
        status: 'error',
      });
      setIsSubmitting(false);
    },
  });

  const updateOrganizationMutation = useUpdateOrganizationMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_organization_created') || 'Organization updated successfully',
        status: 'success',
      });
      onOrganizationCreated();
      setIsSubmitting(false);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        localize('com_ui_error_creating_organization') ||
        'Error updating organization';
      showToast({
        message: errorMessage,
        status: 'error',
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: OrganizationFormData) => {
    setIsSubmitting(true);
    // Filter out empty email entries
    const validMembers = data.members.filter((member) => member.email.trim() !== '');

    if (isEditMode && orgData) {
      updateOrganizationMutation.mutate({
        id: orgData.id,
        name: data.name.trim(),
        ssoConnectionId: data.ssoConnectionId.trim() || null,
        verifiedDomains: data.verifiedDomains.filter((d) => d.trim() !== ''),
      });
    } else {
      createOrganizationMutation.mutate({
        name: data.name.trim(),
        members: validMembers.map((member) => ({
          email: member.email.trim(),
          role: member.role,
        })),
      });
    }
  };

  const handleAddMember = () => {
    append({ email: '', role: 'user' });
  };

  const handleRemoveMember = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const handleAddDomain = () => {
    appendDomain('');
  };

  const handleRemoveDomain = (index: number) => {
    removeDomain(index);
  };

  const handleOpenAdminPortal = async () => {
    if (!orgData?.id) {
      return;
    }

    setIsLoadingAdminPortal(true);
    try {
      const response = await dataService.getOrganizationSSOAdminPortal(orgData.id);
      window.open(response.adminPortalLink, '_blank');
    } catch (error: any) {
      showToast({
        message: error?.response?.data?.error || error?.message || 'Error opening admin portal',
        status: 'error',
      });
    } finally {
      setIsLoadingAdminPortal(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      reset();
    }
    onOpenChange(open);
  };

  const ssoConnectionId = watch('ssoConnectionId');

  return (
    <OGDialog open={isOpen} onOpenChange={handleOpenChange}>
      <OGDialogTemplate
        title={
          isEditMode
            ? localize('com_ui_edit_organization') || 'Edit Organization'
            : localize('com_ui_new_organization') || 'New Organization'
        }
        className="sm:max-w-2xl"
        headerClassName="px-6 pt-6 pb-4"
        main={
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 pb-2">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="organization-name" className="text-sm font-medium text-text-primary">
                {localize('com_ui_organization_name') || 'Organization Name'}
              </Label>
              <Controller
                name="name"
                control={control}
                rules={{
                  required: localize('com_ui_organization_name_required') || 'Organization name is required',
                  minLength: {
                    value: 1,
                    message:
                      localize('com_ui_organization_name_min_length') ||
                      'Organization name must be at least 1 character',
                  },
                }}
                render={({ field }) => (
                  <>
                    <Input
                      {...field}
                      id="organization-name"
                      type="text"
                      placeholder={
                        localize('com_ui_organization_name_placeholder') || 'Enter organization name'
                      }
                      className={cn(
                        'w-full',
                        errors.name && 'border-red-500 focus-visible:ring-red-500',
                      )}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && (
                      <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
                    )}
                  </>
                )}
              />
            </div>

            {/* SSO Configuration - Only shown in edit mode */}
            {isEditMode && (
              <div className="space-y-4 rounded-lg border border-border-light bg-surface-secondary p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="sso-connection-id"
                      className="text-sm font-medium text-text-primary"
                    >
                      {localize('com_ui_sso_connection_id') || 'SSO Connection ID'}
                    </Label>
                    {ssoConnectionId && (
                      <button
                        type="button"
                        onClick={handleOpenAdminPortal}
                        disabled={isLoadingAdminPortal}
                        className="flex items-center gap-1.5 rounded-md border border-border-light bg-surface-tertiary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                      >
                        {isLoadingAdminPortal ? (
                          'Loading...'
                        ) : (
                          <>
                            <ExternalLink className="h-3.5 w-3.5" />
                            {localize('com_ui_sso_admin_portal') || 'Open WorkOS Admin Portal'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <Controller
                    name="ssoConnectionId"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="sso-connection-id"
                        type="text"
                        placeholder={
                          localize('com_ui_sso_connection_id_placeholder') ||
                          'Enter WorkOS SSO Connection ID'
                        }
                        className="w-full"
                      />
                    )}
                  />
                  <p className="text-xs text-text-secondary">
                    {localize('com_ui_sso_admin_portal_description') ||
                      'Configure SSO settings in WorkOS'}
                  </p>
                </div>

                {/* Verified Domains */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-text-primary">
                    {localize('com_ui_verified_domains') || 'Verified Domains'}
                  </Label>
                  <p className="text-xs text-text-secondary">
                    {localize('com_ui_verified_domains_description') ||
                      'Only users with emails from these domains can sign in via SSO'}
                  </p>
                  <div className="space-y-2">
                    {domainFields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <Controller
                          name={`verifiedDomains.${index}`}
                          control={control}
                          rules={{
                            pattern: {
                              value: /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
                              message: 'Invalid domain format',
                            },
                          }}
                          render={({ field: domainField }) => (
                            <Input
                              {...domainField}
                              type="text"
                              placeholder={
                                localize('com_ui_domain_placeholder') || 'example.com'
                              }
                              className="flex-1"
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDomain(index)}
                          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          aria-label={localize('com_ui_remove') || 'Remove'}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddDomain}
                      className="flex items-center gap-1.5 rounded-md border border-border-light bg-surface-tertiary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {localize('com_ui_add_domain') || 'Add Domain'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Members Section - Only shown when creating */}
            {!isEditMode && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="members" className="text-sm font-medium text-text-primary">
                    {localize('com_ui_invite_members') || 'Invite Members'}
                  </Label>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="flex items-center gap-1.5 rounded-md border border-border-light bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {localize('com_ui_add_member') || 'Add Member'}
                  </button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-2 rounded-lg border border-border-light bg-surface-secondary p-3 transition-colors hover:bg-surface-tertiary"
                    >
                      <div className="flex-1 space-y-2">
                        <Controller
                          name={`members.${index}.email`}
                          control={control}
                          rules={{
                            validate: (value) => {
                              if (value.trim() === '') return true; // Allow empty for optional
                              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                              return (
                                emailRegex.test(value) ||
                                localize('com_ui_invalid_email') ||
                                'Invalid email address'
                              );
                            },
                          }}
                          render={({ field: emailField }) => (
                            <>
                              <Input
                                {...emailField}
                                type="email"
                                placeholder={
                                  localize('com_ui_email_placeholder') || 'email@example.com'
                                }
                                className={cn(
                                  'w-full',
                                  errors.members?.[index]?.email &&
                                    'border-red-500 focus-visible:ring-red-500',
                                )}
                              />
                              {errors.members?.[index]?.email && (
                                <p className="text-xs text-red-500 mt-1">
                                  {errors.members?.[index]?.email?.message}
                                </p>
                              )}
                            </>
                          )}
                        />
                        <Controller
                          name={`members.${index}.role`}
                          control={control}
                          render={({ field: roleField }) => (
                            <select
                              {...roleField}
                              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="user">{localize('com_ui_role_user') || 'User'}</option>
                              <option value="administrator">
                                {localize('com_ui_role_administrator') || 'Administrator'}
                              </option>
                            </select>
                          )}
                        />
                      </div>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(index)}
                          className="mt-2 rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          aria-label={localize('com_ui_remove') || 'Remove'}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        }
        selection={{
          selectHandler: handleSubmit(onSubmit),
          selectClasses: 'bg-green-500 hover:bg-green-600 text-white',
          selectText: isSubmitting
            ? localize('com_ui_creating') || 'Creating...'
            : isEditMode
              ? localize('com_ui_save') || 'Save'
              : localize('com_ui_create') || 'Create',
        }}
        footerClassName="flex justify-end gap-2 px-6 pb-6 pt-2"
        showCancelButton={true}
      />
    </OGDialog>
  );
}
