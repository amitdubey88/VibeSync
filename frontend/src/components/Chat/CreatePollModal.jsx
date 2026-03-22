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
          className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Create Poll</h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
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
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-purple transition-colors"
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
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-purple transition-colors"
                />
              ))}
              
              {options.length < 4 && (
                <button 
                  type="button" 
                  onClick={addOption}
                  className="text-xs text-accent-purple hover:text-accent-purple/80 font-medium"
                >
                  + Add another option
                </button>
              )}
            </div>

            <button 
              type="submit" 
              disabled={!isValid}
              className="w-full mt-4 bg-accent-purple hover:bg-accent-purple/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors shadow-[0_4px_15px_rgba(139,92,246,0.3)]"
            >
              Start Poll
            </button>
          </form>
        </Motion.div>
      </div>
    </AnimatePresence>
  );
}
