
import React, { useState } from 'react';
import { FAQItem } from '../types.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';

interface AccordionProps {
  items: FAQItem[];
}

const AccordionItem: React.FC<{ item: FAQItem; isOpen: boolean; onClick: () => void }> = ({ item, isOpen, onClick }) => {
  return (
    <div className="border-b border-slate-200/80 last:border-b-0">
      <button
        className="w-full flex justify-between items-center text-left py-4"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span className="font-medium text-slate-800">{item.question}</span>
        <ChevronDownIcon
          className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="prose prose-sm max-w-none text-slate-600 pb-4 pr-6">
            <p>{item.answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Accordion: React.FC<AccordionProps> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleClick = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div>
      {items.map((item, index) => (
        <AccordionItem
          key={index}
          item={item}
          isOpen={openIndex === index}
          onClick={() => handleClick(index)}
        />
      ))}
    </div>
  );
};