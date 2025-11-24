import React, { memo, useState } from 'react';
import { Wand2, Check, X } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useBadgeRowContext, useChatContext } from '~/Providers';
import { cn } from '~/utils';
import { mainTextareaId } from '~/common';
import { forceResize } from '~/utils/textarea';
import { useImprovePromptMutation } from '~/data-provider/Misc';

function Improve() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { improve } = useBadgeRowContext();
  const { toggleState: improveEnabled, isPinned } = improve;
  const { conversation } = useChatContext();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [originalText, setOriginalText] = useState<string>('');
  const [improvedText, setImprovedText] = useState<string>('');

  const improveMutation = useImprovePromptMutation({
    onSuccess: (data) => {
      const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
      if (textarea && data?.improvedText) {
        // Store the improved text and show confirmation
        setImprovedText(data.improvedText);
        setShowConfirmation(true);
        
        // Replace the entire textarea content with improved text
        textarea.value = data.improvedText;
        textarea.setSelectionRange(data.improvedText.length, data.improvedText.length);
        forceResize(textarea);
        // Trigger input event to update form state
        const event = new Event('input', { bubbles: true });
        textarea.dispatchEvent(event);
      }
      setIsImproving(false);
      setIsAnimating(false);
    },
    onError: (error) => {
      console.error('Error improving prompt:', error);
      showToast({
        message: localize('com_ui_error_improving_prompt') || 'Error improving prompt',
        status: 'error',
      });
      setIsImproving(false);
      setIsAnimating(false);
    },
  });

  // Handle accepting the improved text
  const handleAccept = () => {
    setShowConfirmation(false);
    setOriginalText('');
    setImprovedText('');
  };

  // Handle rejecting and restoring original text
  const handleReject = () => {
    const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
    if (textarea && originalText) {
      // Restore original text
      textarea.value = originalText;
      textarea.setSelectionRange(originalText.length, originalText.length);
      forceResize(textarea);
      // Trigger input event to update form state
      const event = new Event('input', { bubbles: true });
      textarea.dispatchEvent(event);
    }
    setShowConfirmation(false);
    setOriginalText('');
    setImprovedText('');
  };

  // Handle click - improve the prompt
  const handleImproveClick = async () => {
    const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
    const currentText = textarea?.value?.trim() || '';

    if (!currentText) {
      showToast({
        message: localize('com_ui_no_text_to_improve') || 'No text to improve',
        status: 'info',
      });
      return;
    }

    if (!conversation?.endpoint) {
      showToast({
        message: localize('com_ui_no_model_selected') || 'No model selected',
        status: 'error',
      });
      return;
    }

    // Store original text before improving
    setOriginalText(currentText);
    setIsAnimating(true);
    setIsImproving(true);

    // Call improve mutation
    improveMutation.mutate({
      text: currentText,
      endpoint: conversation.endpoint,
      model: conversation.model,
      conversationId: conversation.conversationId,
    });
  };


  // Animated icon with sparkle effect
  const AnimatedWandIcon = (
    <span className="relative inline-block">
      <Wand2
        className={cn(
          'icon-md transition-all duration-300 relative z-10',
          isAnimating && 'animate-sparkle',
        )}
        style={
          isAnimating
            ? {
                filter: 'drop-shadow(0 0 12px rgba(168, 85, 247, 1)) drop-shadow(0 0 20px rgba(168, 85, 247, 0.8)) drop-shadow(0 0 30px rgba(168, 85, 247, 0.6))',
                color: 'rgb(192, 132, 252)',
              }
            : {}
        }
      />
      {/* Sparkle particles */}
      {isAnimating && (
        <>
          <span
            className="absolute top-1/2 left-1/2 h-2 w-2 rounded-full bg-purple-400"
            style={{
              '--tx': '12px',
              '--ty': '-12px',
              animation: 'sparkleParticle 0.8s ease-out',
              boxShadow: '0 0 8px rgba(168, 85, 247, 1)',
            } as React.CSSProperties}
          />
          <span
            className="absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full bg-purple-300"
            style={{
              '--tx': '-12px',
              '--ty': '12px',
              animation: 'sparkleParticle 0.8s ease-out 0.15s',
              boxShadow: '0 0 6px rgba(196, 181, 253, 1)',
            } as React.CSSProperties}
          />
          <span
            className="absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full bg-purple-500"
            style={{
              '--tx': '0px',
              '--ty': '-16px',
              animation: 'sparkleParticle 0.8s ease-out 0.3s',
              boxShadow: '0 0 6px rgba(168, 85, 247, 1)',
            } as React.CSSProperties}
          />
          <span
            className="absolute top-1/2 left-1/2 h-1 w-1 rounded-full bg-purple-400"
            style={{
              '--tx': '16px',
              '--ty': '0px',
              animation: 'sparkleParticle 0.8s ease-out 0.1s',
              boxShadow: '0 0 4px rgba(196, 181, 253, 1)',
            } as React.CSSProperties}
          />
          <span
            className="absolute top-1/2 left-1/2 h-1 w-1 rounded-full bg-purple-300"
            style={{
              '--tx': '-16px',
              '--ty': '0px',
              animation: 'sparkleParticle 0.8s ease-out 0.25s',
              boxShadow: '0 0 4px rgba(168, 85, 247, 1)',
            } as React.CSSProperties}
          />
          <span
            className="absolute top-1/2 left-1/2 h-1 w-1 rounded-full bg-purple-400"
            style={{
              '--tx': '10px',
              '--ty': '14px',
              animation: 'sparkleParticle 0.8s ease-out 0.2s',
              boxShadow: '0 0 4px rgba(196, 181, 253, 1)',
            } as React.CSSProperties}
          />
        </>
      )}
    </span>
  );

  return (
    <>
      {(improveEnabled || isPinned) && (
        <div className="relative inline-block">
          {/* Purple glow effect */}
          {isAnimating && (
            <>
              <div
                className="absolute -inset-3 rounded-full bg-purple-500/40 blur-2xl"
                style={{
                  animation: 'purpleGlow 1s ease-out',
                }}
              />
              <div
                className="absolute -inset-2 rounded-full bg-purple-400/30 blur-xl"
                style={{
                  animation: 'purpleGlow 0.8s ease-out 0.1s',
                }}
              />
            </>
          )}
          <button
            type="button"
            onClick={handleImproveClick}
            disabled={isImproving}
            className={cn(
              'group relative inline-flex items-center justify-center gap-1.5',
              'rounded-full border border-border-medium text-sm font-medium',
              'size-9 p-2 transition-all md:w-full md:p-3',
              'bg-transparent shadow-sm hover:bg-surface-hover hover:shadow-md active:shadow-inner',
              improveEnabled && 'border-purple-600/40 bg-purple-500/10 hover:bg-purple-700/10',
              isAnimating && 'transition-all duration-300',
              isImproving && 'opacity-75 cursor-wait',
              'max-w-fit relative z-10',
            )}
            aria-label={localize('com_ui_improve')}
          >
            {AnimatedWandIcon}
            <span className="hidden truncate md:block">{localize('com_ui_improve')}</span>
          </button>
        </div>
      )}
      
      {/* Confirmation UI */}
      {showConfirmation && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border-medium bg-surface-primary px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-text-primary">
            {localize('com_ui_accept_change') || 'Accept change?'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAccept}
              className={cn(
                'flex items-center justify-center rounded-full p-1.5',
                'bg-green-500 hover:bg-green-600 text-white',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
              )}
              aria-label={localize('com_ui_accept') || 'Accept'}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleReject}
              className={cn(
                'flex items-center justify-center rounded-full p-1.5',
                'bg-red-500 hover:bg-red-600 text-white',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
              )}
              aria-label={localize('com_ui_reject') || 'Reject'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes sparkle {
          0%, 100% {
            transform: rotate(0deg) scale(1);
          }
          20% {
            transform: rotate(-15deg) scale(1.15);
          }
          40% {
            transform: rotate(15deg) scale(1.2);
          }
          60% {
            transform: rotate(-10deg) scale(1.15);
          }
          80% {
            transform: rotate(10deg) scale(1.1);
          }
        }
        @keyframes sparkleParticle {
          0% {
            opacity: 1;
            transform: scale(0) translate(0, 0);
          }
          50% {
            opacity: 1;
            transform: scale(1.5) translate(var(--tx, 0), var(--ty, 0));
          }
          100% {
            opacity: 0;
            transform: scale(0.5) translate(var(--tx, 0), var(--ty, 0));
          }
        }
        @keyframes purpleGlow {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          30% {
            opacity: 0.8;
            transform: scale(1.3);
          }
          60% {
            opacity: 0.6;
            transform: scale(1.5);
          }
          100% {
            opacity: 0;
            transform: scale(2);
          }
        }
        .animate-sparkle {
          animation: sparkle 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </>
  );
}

export default memo(Improve);

