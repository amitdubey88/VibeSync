import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export default function CreatePollModal({ isOpen, onClose, onSubmit }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) return;
    
    onSubmit(question, validOptions);
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  const handleOptionChange = (idx, val) => {
    const newOpts = [...options];
    newOpts[idx] = val;
    setOptions(newOpts);
  };

  const addOption = () => {
    if (options.length < 4) setOptions([...options, '']);
  };

  const validOptionsCount = options.map(o => o.trim()).filter(Boolean).length;
  const isValid = question.trim().length > 0 && validOptionsCount >= 2;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <Motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-black/95 backdrop-blur-3xl border border-white/10  w-full max-w-sm p-6 shadow-[0_10px_50px_rgba(0,0,0,0.9)]"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-zinc-100 font-headline tracking-wide">Create Poll</h2>
            <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white  hover:bg-white/5 transition-colors duration-200 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Ask a question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={100}
                className="w-full bg-black/50 border border-white/10  px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-fuchsia-500 font-headline transition-colors"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <input
                  key={idx}
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  maxLength={50}
                  className="w-full bg-black/30 border border-white/10  px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-fuchsia-500 font-headline transition-colors"
                />
              ))}
              
              {options.length < 4 && (
                <button 
                  type="button" 
                  onClick={addOption}
                  className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-bold tracking-wide mt-2"
                >
                  + Add another option
                </button>
              )}
            </div>

            <button 
              type="submit" 
              disabled={!isValid}
              className="w-full mt-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3  transition-all shadow-[0_4px_20px_rgba(139,92,246,0.4)] tracking-wider mt-6 font-headline"
            >
              Start Poll
            </button>
          </form>
        </Motion.div>
      </div>
    </AnimatePresence>
  );
}
