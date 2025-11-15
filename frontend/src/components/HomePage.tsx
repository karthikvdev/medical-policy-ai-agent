import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/base.service";
import type { Conversation } from "../interface";
import ConfirmDialog from "./ConfirmDialog";
import { FileText, MessageSquare, Trash2, AlertCircle, Loader2 } from "lucide-react";
import InsurerPlanSelector from "./InsurerPlanSelector";
import FileUpload from "./FileUpload";

export default function HomePage() {
    const navigate = useNavigate();
    const [selectedInsurer, setSelectedInsurer] = useState<string | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [conversationToDelete, setConversationToDelete] = useState<number | null>(null);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        try {
            const data = await apiService.getConversations();
            setConversations(data);
        } catch (err) {
            console.error('Failed to fetch conversations:', err);
        }
    };

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
        setError(null);
    };

    const handleClearFile = () => {
        setSelectedFile(null);
        setError(null);
    };

    const handleInsurerChange = (insurerId: string) => {
        setSelectedInsurer(insurerId);
        setSelectedPlan(null);
    };

    const handlePlanChange = (planId: string) => {
        setSelectedPlan(planId);
    };

    const handleSelectConversation = (conv: Conversation) => {
        navigate(`/chat/${conv.id}`);
    };

    const handleDeleteClick = (convId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        setConversationToDelete(convId);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!conversationToDelete) return;

        try {
            await apiService.deleteConversation(conversationToDelete);
            await fetchConversations();
        } catch (err) {
            console.error('Error deleting conversation:', err);
        } finally {
            setDeleteDialogOpen(false);
            setConversationToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false);
        setConversationToDelete(null);
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
                try {
                    const dataUrl = reader.result as string;
                    let ocrText = '';

                    // Extract text from file
                    if (selectedFile.type === 'application/pdf') {
                        const raw = dataUrl.split(',')[1] || '';
                        const result = await apiService.extractTextFromPDF(raw);
                        ocrText = result.text || '';
                    } else {
                        const result = await apiService.extractTextFromImage(dataUrl);
                        ocrText = result.text || '';
                    }

                    // Create new conversation
                    const conversation = await apiService.createConversation({
                        insurer: selectedInsurer,
                        plan: selectedPlan,
                        bill_text: ocrText,
                    });

                    // Navigate to the new conversation
                    navigate(`/chat/${conversation.id}`);

                    setIsUploading(false);
                } catch (err) {
                    setError('An unexpected error occurred. Please try again.');
                    console.error('Error:', err);
                    setIsUploading(false);
                }
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

    const canStartChat = selectedFile && selectedInsurer && selectedPlan;

    return (
        <>
            <ConfirmDialog
                isOpen={deleteDialogOpen}
                title="Delete conversation?"
                message="This will permanently delete this conversation and all its messages. This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
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
                            {conversations.length > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-4">
                                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                                        <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
                                        Previous Conversations
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {conversations.map((conv) => (
                                            <div
                                                key={conv.id}
                                                className="relative group"
                                            >
                                                <button
                                                    onClick={() => handleSelectConversation(conv)}
                                                    className="w-full text-left p-3 pr-12 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    <div className="font-medium text-sm text-gray-900">
                                                        {conv.insurer} - {conv.plan}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {new Date(conv.updated_at).toLocaleDateString()} {new Date(conv.updated_at).toLocaleTimeString()}
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteClick(conv.id, e)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete conversation"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                            <div className="bg-white rounded-lg shadow-md p-8 flex items-center justify-center h-[600px]">
                                <div className="text-center text-gray-500">
                                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                    <p className="text-lg mb-2">Welcome to Medical Policy Assistant</p>
                                    <p className="text-sm">Upload a hospital bill and select a plan to start chatting</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}