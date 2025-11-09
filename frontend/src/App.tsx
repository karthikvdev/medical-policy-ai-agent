/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import InsurerPlanSelector from './components/InsurerPlanSelector';
import FileUpload from './components/FileUpload';
import Chatbot from './components/Chatbot';
import { FileText, AlertCircle, Loader2 } from 'lucide-react';
type PolicyPlan = any;

function App() {
  const [selectedInsurer, setSelectedInsurer] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<PolicyPlan | null>(null);
  const [billText, setBillText] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setDocumentId(null);
    setError(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setDocumentId(null);
    setError(null);
  };

  const handleInsurerChange = (insurerId: string) => {
    setSelectedInsurer(insurerId);
    setSelectedPlan(null);
    setPlanDetails(null);
    setDocumentId(null);
  };

  const handlePlanChange = async (planId: string) => {
    setSelectedPlan(planId);
    setDocumentId(null);

    if (planId) {
      const base = import.meta.env.VITE_API_URL as string;
      const resp = await fetch(`${base}/policy`);
      const policy = await resp.json() as Record<string, any>;
      const plan = selectedInsurer ? policy[selectedInsurer]?.[planId] : null;
      setPlanDetails(plan);
    } else {
      setPlanDetails(null);
    }
  };

  const handleStartChat = async () => {
    if (!selectedFile || !selectedInsurer || !selectedPlan) {
      setError('Please select an insurer, plan, and upload a file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string; // data:*/*;base64,....
        const base = import.meta.env.VITE_API_URL as string;
        let ocrText = '';
        if (selectedFile.type === 'application/pdf') {
          const raw = dataUrl.split(',')[1] || '';
          const resp = await fetch(`${base}/ocr/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdf_base64: raw }),
          });
          if (!resp.ok) throw new Error('OCR failed');
          const j = await resp.json();
          ocrText = j.text || '';
        } else {
          const resp = await fetch(`${base}/ocr/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_data_url: dataUrl }),
          });
          if (!resp.ok) throw new Error('OCR failed');
          const j = await resp.json();
          ocrText = j.text || '';
        }
        setBillText(ocrText);
        setDocumentId('local'); // mark started
        setIsUploading(false);
      };

      reader.onerror = () => {
        setError('Failed to read file. Please try again.');
        setIsUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Error:', err);
      setIsUploading(false);
    }
  };

  const canStartChat = selectedFile && selectedInsurer && selectedPlan && !documentId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">
              Medical Policy Assistant
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Upload your hospital bill and get instant answers about your insurance coverage
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1 space-y-6">
            <InsurerPlanSelector
              selectedInsurer={selectedInsurer}
              selectedPlan={selectedPlan}
              onInsurerChange={handleInsurerChange}
              onPlanChange={handlePlanChange}
            />

            <FileUpload
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              onClearFile={handleClearFile}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {canStartChat && (
              <button
                onClick={handleStartChat}
                disabled={isUploading}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Start Chat</span>
                )}
              </button>
            )}
          </div>

          <div className="lg:col-span-2">
            <Chatbot documentId={documentId} selectedPlan={planDetails as any} billText={billText} policy={planDetails} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
