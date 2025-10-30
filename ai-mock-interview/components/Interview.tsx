import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { MicIcon } from './icons/MicIcon';
import { AlertTriangle } from './icons/AlertTriangle';

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

interface SpeechRecognitionResult { isFinal: boolean; [index: number]: { transcript: string }; }
interface SpeechRecognitionResultList { [index: number]: SpeechRecognitionResult; length: number; }
interface SpeechRecognitionEvent extends Event { resultIndex: number; results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }
interface SpeechRecognitionInstance { continuous: boolean; interimResults: boolean; lang: string; onresult: (event: SpeechRecognitionEvent) => void; onerror: (event: SpeechRecognitionErrorEvent) => void; onend: () => void; start: () => void; stop: () => void; }

interface InterviewProps {
  questions: string[];
  onInterviewComplete: (answers: string[], snapshots: { [key: number]: string[] }, malpracticeLogs: { [key: number]: string[] }) => void;
}

const Interview: React.FC<InterviewProps> = ({ questions, onInterviewComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interviewerStatus, setInterviewerStatus] = useState('Ready for your answer.');
  const [malpracticeAlert, setMalpracticeAlert] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const answersRef = useRef<string[]>([]);
  const snapshotsRef = useRef<{ [key: number]: string[] }>({});
  const malpracticeLogsRef = useRef<{ [key: number]: string[] }>({});
  const snapshotIntervalRef = useRef<number | null>(null);
  const malpracticeCheckIntervalRef = useRef<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const analyzeFrameForMalpractice = useCallback(async () => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: "Analyze this image from a user's webcam during an interview. Is there a mobile phone visible? Is the user looking away from the screen in a way that suggests they are reading from another source or using a proxy? Respond ONLY with a JSON object: {\"phoneDetected\": boolean, \"suspiciousGaze\": boolean, \"reason\": string}." }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        phoneDetected: { type: Type.BOOLEAN },
                        suspiciousGaze: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING }
                    }
                }
            }
        });
        const result = JSON.parse(response.text);
        if (result.phoneDetected || result.suspiciousGaze) {
            setMalpracticeAlert(result.reason);
            if (!malpracticeLogsRef.current[currentQuestionIndex]) {
                malpracticeLogsRef.current[currentQuestionIndex] = [];
            }
            malpracticeLogsRef.current[currentQuestionIndex].push(result.reason);
            setTimeout(() => setMalpracticeAlert(null), 5000);
        }
    } catch(err) {
        console.error("Malpractice detection error:", err);
    }
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (!isSpeechRecognitionSupported) {
      alert("Your browser does not support Speech Recognition. Please use Chrome or Edge.");
      return;
    }

    const recognition: SpeechRecognitionInstance = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart + ' ';
        } else {
          interimTranscript = transcriptPart;
        }
      }
      answersRef.current[currentQuestionIndex] = finalTranscript.trim();
      setTranscript(finalTranscript.trim() + ' ' + interimTranscript);
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return;
      console.error('Speech recognition error', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        recognition.start();
      }
    };
    
    recognitionRef.current = recognition;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Error accessing camera/mic:", err);
        setInterviewerStatus("Camera/Mic access denied.");
      });

    return () => {
      isRecordingRef.current = false;
      recognition.stop();
      if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
      if (malpracticeCheckIntervalRef.current) clearInterval(malpracticeCheckIntervalRef.current);
      videoRef.current?.srcObject && (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    };
  }, [analyzeFrameForMalpractice]);

  const captureSnapshot = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        if (!snapshotsRef.current[currentQuestionIndex]) {
          snapshotsRef.current[currentQuestionIndex] = [];
        }
        snapshotsRef.current[currentQuestionIndex].push(base64Image);
      }
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
      if (malpracticeCheckIntervalRef.current) clearInterval(malpracticeCheckIntervalRef.current);
      snapshotIntervalRef.current = null;
      malpracticeCheckIntervalRef.current = null;
      setMalpracticeAlert(null);
    } else {
      answersRef.current[currentQuestionIndex] = '';
      malpracticeLogsRef.current[currentQuestionIndex] = [];
      setTranscript('');
      setMalpracticeAlert(null);
      recognitionRef.current?.start();
      setIsRecording(true);
      snapshotIntervalRef.current = window.setInterval(captureSnapshot, 5000); 
      malpracticeCheckIntervalRef.current = window.setInterval(analyzeFrameForMalpractice, 8000);
    }
  };

  const handleNextQuestion = async () => {
    if (isRecording) handleToggleRecording();
    setIsProcessing(true);
    
    answersRef.current[currentQuestionIndex] = transcript.trim();
    
    await new Promise(resolve => setTimeout(resolve, 500));

    setTranscript('');
    setIsProcessing(false);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      onInterviewComplete(answersRef.current, snapshotsRef.current, malpracticeLogsRef.current); 
    }
  };

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-800">
        {/* Side Dashboard */}
        <div className="w-full md:w-80 lg:w-96 bg-slate-900 p-6 flex flex-col items-center justify-center relative md:h-screen md:sticky md:top-0">
            <div className={`relative w-64 h-64 md:w-full md:h-auto md:aspect-square bg-slate-800 rounded-full md:rounded-2xl shadow-lg overflow-hidden transition-shadow duration-500`}>
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scaleX-[-1]"></video>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/50 text-white px-3 py-1 rounded-full text-sm whitespace-nowrap">
                    {interviewerStatus}
                </div>
            </div>
            {malpracticeAlert && (
                 <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-11/12 bg-rose-500 text-white p-4 rounded-xl shadow-2xl flex items-center space-x-3 animate-pulse">
                    <AlertTriangle className="w-8 h-8 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold">Malpractice Alert</h4>
                        <p className="text-sm">{malpracticeAlert}</p>
                    </div>
                </div>
            )}
            <div className="hidden md:block text-center text-slate-400 mt-auto pt-6">
                <p className="font-bold text-lg text-white">AI Mock Interview</p>
                <p className="text-sm">Proctoring Enabled</p>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col p-4 sm:p-6">
            <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-between">
                <div>
                    <div className="w-full p-4 mb-6">
                        <p className="text-sky-600 font-semibold text-center text-lg">Question {currentQuestionIndex + 1} of {questions.length}</p>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2 max-w-lg mx-auto">
                            <div className="bg-sky-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                    
                    <div className="w-full bg-white p-8 rounded-2xl shadow-lg flex items-center justify-center min-h-[200px] mb-6">
                        <h2 className="text-2xl md:text-3xl font-semibold text-slate-700 text-center">{questions[currentQuestionIndex]}</h2>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 max-w-3xl mx-auto w-full min-h-[120px] overflow-y-auto">
                        <p className="text-slate-500 italic">{transcript || "Your transcribed answer will appear here..."}</p>
                    </div>
                </div>

                <div className="w-full max-w-3xl mx-auto p-4 sticky bottom-0 bg-slate-50/80 backdrop-blur-sm rounded-t-xl">
                    <div className="flex items-center justify-center space-x-4">
                        <button onClick={handleToggleRecording} disabled={isProcessing} aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
                            className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-50 ${isRecording ? 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-400' : 'bg-sky-500 hover:bg-sky-600 focus:ring-sky-400'}`}>
                            {isRecording && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>}
                            <MicIcon isRecording={isRecording} />
                        </button>

                        <button onClick={handleNextQuestion} disabled={isProcessing || isRecording}
                            className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full transition-transform transform hover:scale-105 shadow-lg">
                            {isProcessing ? 'Processing...' : (currentQuestionIndex === questions.length - 1 ? 'Finish & Evaluate' : 'Next Question')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Interview;
