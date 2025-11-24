import { useMutation } from '@tanstack/react-query';
import { MutationKeys, dataService } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';

export interface ImprovePromptPayload {
  text: string;
  endpoint: string;
  model?: string;
  conversationId?: string | null;
}

export interface ImprovePromptResponse {
  improvedText: string;
}

export const useImprovePromptMutation = (
  options?: {
    onSuccess?: (data: ImprovePromptResponse) => void;
    onError?: (error: Error) => void;
  },
): UseMutationResult<ImprovePromptResponse, Error, ImprovePromptPayload> => {
  return useMutation([MutationKeys.improvePrompt], {
    mutationFn: (payload: ImprovePromptPayload) => dataService.improvePrompt(payload),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
};

