import React, { useState } from 'react';
import { ROLES_CATEGORIZED, DIFFICULTIES } from '../constants';
import { InterviewConfig } from '../types';

interface HomeProps {
  onStartInterview: (config: InterviewConfig) => void;
  error?: string | null;
}

const Home: React.FC<HomeProps> = ({ onStartInterview, error }) => {
  const [role, setRole] = useState<string>('Software Engineer');
  const [difficulty, setDifficulty] = useState<string>('Medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartInterview({ role, difficulty });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl text-center">
        <h1 className="text-4xl font-bold mb-2 text-sky-600">AI Mock Interview</h1>
        <p className="text-slate-500 mb-8">Hone your skills with an AI-powered interviewer.</p>
        
        {error && <div className="bg-rose-100 border border-rose-300 text-rose-800 px-4 py-3 rounded-lg relative mb-6" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-600 text-left mb-2">Select Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-100 border border-slate-300 rounded-lg py-3 px-4 text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
            >
              {Object.entries(ROLES_CATEGORIZED).map(([category, roles]) => (
                <optgroup key={category} label={category}>
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-slate-600 text-left mb-2">Select Difficulty</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-100 border border-slate-300 rounded-lg py-3 px-4 text-slate-800 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
            >
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 shadow-lg"
          >
            Start Interview
          </button>
        </form>
      </div>
       <footer className="text-center text-slate-400 mt-8">
        <p>&copy; {new Date().getFullYear()} AI Mock Interview. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;