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
      const ai = new GoogleGenAI({ apiKey: 'AIzaSyDZMhlIw0VQfCER9JbcC8Bid51WWtQW1gI' });
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
      
      const hasMalpractice = Object.values(malpracticeLogs).some(logs => logs.length > 0);
      const malpracticeLogText = hasMalpractice
        ? `The user triggered malpractice alerts during the interview. Here are the logs: ${JSON.stringify(malpracticeLogs, null, 2)}. You MUST address this in the 'malpracticeReport' section of your response. Explain the infractions and how they negatively impacted the score.`
        : 'No malpractice was detected.';

      const systemInstruction = `You are a world-class hiring manager and interview coach, providing a detailed, constructive evaluation for a candidate applying for a ${session.config.difficulty} ${session.config.role} role. Your analysis must be comprehensive, insightful, and presented in a structured JSON format.

      **Analysis Guidelines:**
      1.  **Be Specific:** Ground your feedback in the provided interview data. Quote or paraphrase the candidate's answers where relevant to illustrate your points in strengths, weaknesses, and improvements.
      2.  **Analyze Holistically:** Synthesize information from the transcribed answers, body language snapshots, and any malpractice logs to form a cohesive evaluation.
      3.  **Constructive Tone:** While being critical, maintain a supportive and encouraging tone. The goal is to help the candidate improve.

      **Input Data Provided:**
      -   Interview questions.
      -   Transcribed candidate answers.
      -   A series of body language snapshots taken during each answer.
      -   Malpractice Logs: ${malpracticeLogText}

      **Required JSON Output Structure:**
      Provide your entire response as a single JSON object matching the schema below. Do not include any text outside of the JSON structure.`;

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
        const ai = new GoogleGenAI({ apiKey: 'AIzaSyDZMhlIw0VQfCER9JbcC8Bid51WWtQW1gI' });
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    overallScore: { type: Type.NUMBER, description: "A holistic score from 0 to 100, reflecting the overall performance."},
                    criteria: {
                        type: Type.ARRAY,
                        description: "Breakdown of scores across key areas.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "e.g., 'Technical Depth', 'Communication', 'Problem-Solving'." },
                                score: { type: Type.NUMBER, description: "Score from 0 to 5 for this criterion." },
                                maxScore: { type: Type.NUMBER, description: "Always 5." },
                                reasoning: { type: Type.STRING, description: "Brief, specific justification for the score." },
                            }
                        }
                    },
                    strengths: { type: Type.ARRAY, description: "2-3 specific, positive points. Use examples from their answers.", items: { type: Type.STRING } },
                    weaknesses: { type: Type.ARRAY, description: "2-3 critical but constructive areas of concern. Use examples.", items: { type: Type.STRING } },
                    improvements: { type: Type.ARRAY, description: "Actionable tips for improvement, directly linked to weaknesses.", items: { type: Type.STRING } },
                    bodyLanguageAnalysis: {
                        type: Type.OBJECT,
                        description: "Analysis of non-verbal cues from the image snapshots.",
                        properties: {
                            posture: { type: Type.STRING, description: "Comment on their posture (e.g., upright, slouched)." },
                            eyeContact: { type: Type.STRING, description: "Analyze gaze. Are they looking at the camera or away? (e.g., 'Good, mostly focused on the camera', 'Often looked away')."},
                            gestures: { type: Type.STRING, description: "Note use of hand gestures (e.g., 'Used hands effectively to explain points', 'Appeared stiff')." },
                            overallSummary: { type: Type.STRING, description: "A holistic summary of their non-verbal communication and its impact." }
                        }
                    },
                    verbalAnalysis: {
                        type: Type.OBJECT,
                        description: "Analysis of verbal delivery based on the transcript.",
                        properties: {
                           clarity: { type: Type.STRING, description: "Assess the clarity and structure of their sentences."},
                           conciseness: { type: Type.STRING, description: "Did they answer directly or ramble?" },
                           fillerWords: { type: Type.STRING, description: "Comment on apparent use of filler words like 'um', 'uh', 'like' based on transcript flow." },
                           overallSummary: { type: Type.STRING, description: "A summary of their verbal communication style." }
                        }
                    },
                    ...(hasMalpractice && {
                      malpracticeReport: {
                          type: Type.OBJECT,
                          description: "ONLY include this object if malpractice was detected. Otherwise, omit it.",
                          properties: {
                              summary: { type: Type.STRING, description: "A summary of the detected malpractice incidents."},
                              impactOnScore: { type: Type.STRING, description: "Explain how this behavior negatively affected their score and professional impression."}
                          }
                      }
                    })
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
