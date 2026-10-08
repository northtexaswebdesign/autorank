import React, { useState } from 'react';
import { Modal } from './Modal.tsx';
import { PlusIcon } from './icons/PlusIcon.tsx';

interface AddKeywordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddKeyword: (keyword: string) => Promise<void>;
}

export const AddKeywordModal: React.FC<AddKeywordModalProps> = ({ isOpen, onClose, onAddKeyword }) => {
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    setIsLoading(true);
    try {
      await onAddKeyword(keyword);
      setKeyword(''); // Reset for next time
    } catch (error) {
      console.error("Failed to add keyword", error);
      alert("Could not add keyword. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a New Keyword">
      <form onSubmit={handleSubmit}>
        <p className="text-slate-600 mb-4">
          Manually add a keyword to your list. The system will assign default metrics.
        </p>
        <div className="flex gap-4">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g., how to optimize local SEO for plumbers"
            className="flex-grow bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
            autoFocus
          />
          <button 
            type="submit" 
            disabled={isLoading || !keyword.trim()}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-900 flex items-center transition-colors shadow-sm disabled:bg-slate-400"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            {isLoading ? 'Adding...' : 'Add to Keywords List'}
          </button>
        </div>
      </form>
    </Modal>
  );
};