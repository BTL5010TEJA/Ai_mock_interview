import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { EvaluationResult } from '../types';

interface ReportProps {
  report: EvaluationResult;
  onTryAgain: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-xl">
        <p className="text-sky-300 font-bold">{`${label}`}</p>
        <p className="text-white mt-1">{`Score: ${data.score} / ${data.maxScore}`}</p>
        <p className="text-slate-300 mt-2 max-w-xs">{data.reasoning}</p>
      </div>
    );
  }
  return null;
};


const Report: React.FC<ReportProps> = ({ report, onTryAgain }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-sky-600 text-center">Interview Report</h1>
        <p className="text-slate-500 mb-8 text-center">Here's your AI-powered performance breakdown.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-xl text-center flex flex-col justify-center">
            <h2 className="text-lg font-semibold text-slate-500">Overall Score</h2>
            <p className={`text-6xl font-bold mt-2 ${report.overallScore > 80 ? 'text-emerald-500' : report.overallScore > 60 ? 'text-amber-500' : 'text-rose-500'}`}>
              {report.overallScore}<span className="text-3xl text-slate-400">/100</span>
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-xl md:col-span-2">
             <h2 className="text-lg font-semibold text-slate-500 mb-4">Criteria Breakdown</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={report.criteria || []} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" domain={[0, 5]} tick={{ fill: '#475569' }} stroke="#CBD5E1" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#475569' }} stroke="#CBD5E1" interval={0} />
                  <Tooltip
                    cursor={{fill: 'rgba(226, 232, 240, 0.5)'}}
                    content={<CustomTooltip />}
                  />
                  <Bar dataKey="score" fill="#38BDF8" background={{ fill: '#F1F5F9' }} barSize={25}>
                    <LabelList dataKey="score" position="right" fill="#1E293B" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xl mb-6">
            <h3 className="text-xl font-semibold text-violet-500 mb-4">Body Language & Non-Verbal Cues</h3>
            <p className="text-slate-600">{report.bodyLanguageFeedback}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-xl font-semibold text-emerald-500 mb-4">Strengths</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              {(report.strengths || []).map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-xl font-semibold text-amber-500 mb-4">Weaknesses</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              {(report.weaknesses || []).map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-xl font-semibold text-sky-500 mb-4">Areas for Improvement</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              {(report.improvements || []).map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="text-center mt-12">
          <button
            onClick={onTryAgain}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-8 rounded-full transition-transform transform hover:scale-105 shadow-lg"
          >
            Try Another Interview
          </button>
        </div>
      </div>
    </div>
  );
};

export default Report;