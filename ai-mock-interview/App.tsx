import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';

import Home from './components/Home';
import Interview from './components/Interview';
import Report from './components/Report';
import { LoadingSpinner } from './components/icons/LoadingSpinner';
import type { AppState, InterviewConfig, InterviewSession, EvaluationResult } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('HOME');
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startInterview = useCallback(async (config: InterviewConfig) => {
    setAppState('LOADING');
    setLoadingMessage('Generating your interview questions...');
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate 5 interview questions for a ${config.difficulty} ${config.role} position.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });
      
      const responseJson = JSON.parse(response.text);
      const questions = responseJson.questions;

      if (!questions || questions.length === 0) {
        throw new Error('Failed to generate questions. Please try again.');
      }

      setSession({
        config,
        questions,
        answers: [],
        snapshots: {},
        malpracticeLogs: {},
      });
      setAppState('INTERVIEW');
    } catch (err) {
      console.error(err);
      setError('Could not generate questions. Please check your API key and try again.');
      setAppState('HOME');
    }
  }, []);

  const handleInterviewComplete = useCallback(async (answers: string[], snapshots: { [questionIndex: number]: string[] }, malpracticeLogs: { [questionIndex: number]: string[] }) => {
    if (session) {
      setAppState('LOADING');
      setLoadingMessage('Evaluating your performance... This may take a moment.');
      setError(null);
      
      const malpracticeLogText = Object.values(malpracticeLogs).some(logs => logs.length > 0)
        ? `\n\nAdditionally, analyze the following malpractice logs. The candidate was alerted in real-time. Factor any detected malpractice into the overall evaluation, particularly in the 'Weaknesses' and 'Overall Score' sections.\nMalpractice Logs:\n${JSON.stringify(malpracticeLogs, null, 2)}`
        : '';

      const systemInstruction = `You are an expert interviewer evaluating a candidate for a ${session.config.difficulty} ${session.config.role} role. Analyze the following questions, the candidate's transcribed answers, and snapshots of their body language. Provide a comprehensive evaluation in JSON format.

        The JSON object should have the following structure:
        - overallScore: A number from 0 to 100.
        - criteria: An array of objects, each with 'name' (e.g., "Clarity", "Technical Depth", "Problem Solving", "Communication", "Body Language"), 'score' (0-5), 'maxScore' (always 5), and 'reasoning' (a brief justification for the score).
        - strengths: An array of strings highlighting what the candidate did well.
        - weaknesses: An array of strings pointing out areas of concern.
        - improvements: An array of strings with actionable advice.
        - bodyLanguageFeedback: A paragraph summarizing their non-verbal cues from the images.${malpracticeLogText}`;

      const parts: ({ text: string } | { inlineData: { mimeType: string; data: string; } })[] = [
        { text: `Begin Evaluation:\n` },
      ];

      session.questions.forEach((question, index) => {
        parts.push({ text: `\n--- Question ${index + 1}: ${question} ---\n` });
        parts.push({ text: `Candidate's Answer: "${answers[index] || '(No answer provided)'}"\n` });
        parts.push({ text: `Body Language Snapshots during answer:\n` });
        if (snapshots[index]?.length > 0) {
          snapshots[index].forEach(base64Image => {
            parts.push({
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            });
          });
        } else {
           parts.push({ text: `(No snapshots available)\n` });
        }
      });
      
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    overallScore: { type: Type.NUMBER },
                    criteria: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                score: { type: Type.NUMBER },
                                maxScore: { type: Type.NUMBER },
                                reasoning: { type: Type.STRING },
                            }
                        }
                    },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    bodyLanguageFeedback: { type: Type.STRING },
                }
            }
          },
        });

        const evaluationResult: EvaluationResult = JSON.parse(response.text);
        
        setSession({
          ...session,
          answers,
          snapshots,
          malpracticeLogs,
          evaluation: evaluationResult,
        });
        setAppState('REPORT');

      } catch (err) {
        console.error(err);
        setError('An error occurred during evaluation. Please try another interview.');
        setAppState('HOME');
      }
    }
  }, [session]);

  const handleTryAgain = useCallback(() => {
    setSession(null);
    setAppState('HOME');
    setError(null);
  }, []);

  const renderContent = () => {
    switch (appState) {
      case 'HOME':
        return <Home onStartInterview={startInterview} error={error} />;
      case 'LOADING':
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-700">
            <LoadingSpinner />
            <p className="mt-4 text-lg">{loadingMessage}</p>
          </div>
        );
      case 'INTERVIEW':
        if (session?.questions) {
          return <Interview questions={session.questions} onInterviewComplete={handleInterviewComplete} />;
        }
        return <Home onStartInterview={startInterview} error="An unexpected error occurred." />;
      case 'REPORT':
        if (session?.evaluation) {
          return <Report report={session.evaluation} onTryAgain={handleTryAgain} />;
        }
        return <Home onStartInterview={startInterview} error="Failed to load the report." />;
      default:
        return <Home onStartInterview={startInterview} />;
    }
  };

  return <div className="bg-slate-50">{renderContent()}</div>;
};

export default App;
