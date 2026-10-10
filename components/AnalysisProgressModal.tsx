import React from 'react';
import { Modal } from './Modal.tsx';
import { SparklesIcon } from './icons/SparklesIcon.tsx';
import { CheckIcon } from './icons/CheckIcon.tsx';

interface AnalysisProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: { value: number; text: string };
  isComplete: boolean;
  onGoToReport: () => void;
}

const ProgressBar: React.FC<{ percentage: number }> = ({ percentage }) => (
    <div className="w-full bg-stone-200 rounded-full h-2.5">
        <div className="bg-brand-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
    </div>
);

export const AnalysisProgressModal: React.FC<AnalysisProgressModalProps> = ({ isOpen, onClose, progress, isComplete, onGoToReport }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Competitive Analysis">
        <div className="flex flex-col items-center justify-center text-center p-8 min-h-[250px]">
            {isComplete ? (
                <>
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="font-serif text-[26px] leading-tight text-stone-900">Analysis Complete!</h2>
                    <p className="text-stone-500 mt-2 mb-8 max-w-md">
                        Your competitive intelligence report is ready. View it now to uncover strategic insights.
                    </p>
                    <button
                        onClick={onGoToReport}
                        className="bg-brand-500 text-white hover:bg-brand-600 px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center transition-colors shadow-sm"
                    >
                        View Report
                    </button>
                </>
            ) : (
                <>
                    <SparklesIcon className="w-12 h-12 text-stone-400 mb-4 animate-spin" />
                    <h2 className="font-serif text-[26px] leading-tight text-stone-900">Performing Magic...</h2>
                    <p className="text-stone-500 mt-2 mb-8 max-w-md">
                        {progress.text}
                    </p>
                    <div className="w-full max-w-md">
                       <ProgressBar percentage={progress.value} />
                    </div>
                </>
            )}
        </div>
    </Modal>
  );
};
